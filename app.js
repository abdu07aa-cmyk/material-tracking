(function () {
'use strict';

/* =====================================================================
   MaterialFlow - Gudang -> QC -> Supply -> Finish Good
   Vanilla JS + Supabase. Tanpa build step, siap GitHub Pages.
   ===================================================================== */

const cfg = window.APP_CONFIG || {};
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(n) || 0);
const dt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

let sb = null;
const state = { user: null, profile: null, seg: {} };

const ROLES = {
  admin: 'Admin',
  gudang: 'Leader Gudang',
  qc: 'Leader QC',
  supply: 'Leader Supply Material',
  produksi: 'Leader Finish Good / Produksi',
  viewer: 'Viewer (belum diberi role)'
};
const STAGE_ROLE = { gudang: 'gudang', qc: 'qc', supply: 'supply', fg: 'produksi' };
const isAdmin = () => state.profile?.role === 'admin';
const can = stage => isAdmin() || state.profile?.role === STAGE_ROLE[stage];

/* ---------- Icons ---------- */
const P = {
  dash: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  truck: '<rect x="1" y="6" width="14" height="10" rx="1"/><path d="M15 9h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  pkg: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7"/><path d="M17 4a4 4 0 010 8M22 21c0-3-2-5-4-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  logout: '<path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
  refresh: '<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>'
};
const icon = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

/* ---------- UI helpers ---------- */
function toast(msg, type = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = 'toast'), 3800);
}

function errMsg(e) {
  const m = e?.message || String(e), c = e?.code;
  if (c === '23505') return 'Data sudah ada (duplikat). Periksa kembali No PI / No SJ.';
  if (c === '23503') return 'Data ini sudah dipakai proses berikutnya (mis. sudah ada QC / pengiriman). Hapus data turunannya terlebih dahulu.';
  if (c === '42501' || /row-level security/i.test(m)) return 'Anda tidak punya hak akses untuk aksi ini.';
  if (c === '23514') return 'Data tidak valid. Periksa angka yang diisi.';
  if (c === '42P01' || /does not exist|schema cache/i.test(m)) return 'Tabel belum ada. Jalankan schema.sql di Supabase SQL Editor.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Koneksi internet bermasalah.';
  return m;
}

function closeModal() {
  const m = $('#modal');
  m.classList.remove('open');
  m.innerHTML = '';
  m.onclick = null;
  document.body.classList.remove('lock');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function ask(msg, ok = 'Hapus') {
  return new Promise(res => {
    const m = $('#modal');
    m.innerHTML = `<div class="backdrop" data-no></div><div class="sheet small" role="dialog">
      <div class="sheet-h"><h3>Konfirmasi</h3></div>
      <div class="sheet-b"><p>${esc(msg)}</p></div>
      <div class="sheet-f"><button class="btn ghost" data-no>Batal</button><button class="btn danger" data-yes>${esc(ok)}</button></div></div>`;
    m.classList.add('open');
    document.body.classList.add('lock');
    m.onclick = e => {
      if (e.target.closest('[data-yes]')) { closeModal(); res(true); }
      else if (e.target.closest('[data-no]')) { closeModal(); res(false); }
    };
  });
}

function fieldHTML(f, val) {
  const id = 'f_' + f.name, v = val ?? f.default ?? '';
  const dis = f.disabled ? 'disabled' : '';
  let inp;
  if (f.type === 'select') {
    inp = `<select id="${id}" name="${f.name}" ${dis}><option value="">— Pilih —</option>${f.options.map(o =>
      `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    inp = `<textarea id="${id}" name="${f.name}" rows="3" placeholder="${esc(f.placeholder || '')}" ${dis}>${esc(v)}</textarea>`;
  } else {
    const n = f.type === 'number' ? `inputmode="decimal" step="any" min="${f.min ?? 0}"` : '';
    inp = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${n} placeholder="${esc(f.placeholder || '')}" autocomplete="off" ${dis}>`;
  }
  return `<div class="fld" data-f="${f.name}"><label for="${id}">${esc(f.label)}${f.req ? ' <i>*</i>' : ''}</label>${inp}${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
}

function openForm(o) {
  const m = $('#modal'), v0 = o.values || {};
  // baris 2 kolom: field dengan half:true dipasangkan
  let body = '', buf = [];
  const flush = () => { if (buf.length) { body += `<div class="row2">${buf.join('')}</div>`; buf = []; } };
  o.fields.forEach(f => {
    const h = fieldHTML(f, v0[f.name]);
    if (f.half) { buf.push(h); if (buf.length === 2) flush(); } else { flush(); body += h; }
  });
  flush();
  m.innerHTML = `<div class="backdrop" data-close></div>
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-h"><h3>${esc(o.title)}</h3><button type="button" class="x" data-close aria-label="Tutup">&times;</button></div>
      ${o.sub ? `<p class="sheet-sub">${esc(o.sub)}</p>` : ''}
      <form id="frm" novalidate style="display:flex;flex-direction:column;min-height:0">
        <div class="sheet-b">${body}<div id="fhint" class="hintbox" hidden></div></div>
        <div class="sheet-f"><button type="button" class="btn ghost" data-close>Batal</button>
        <button type="submit" class="btn primary">${esc(o.submit || 'Simpan')}</button></div>
      </form></div>`;
  m.classList.add('open');
  document.body.classList.add('lock');
  m.onclick = e => { if (e.target.closest('[data-close]')) closeModal(); };

  const frm = $('#frm', m);
  const read = () => {
    const v = {};
    o.fields.forEach(f => {
      const el = frm.elements[f.name];
      if (!el) return;
      let x = el.value;
      if (f.type === 'number') x = x === '' ? null : Number(x);
      else { x = x.trim(); if (x === '') x = null; }
      v[f.name] = x;
    });
    return v;
  };
  const hint = (html, type = 'info') => {
    const h = $('#fhint', m);
    if (!html) { h.hidden = true; return; }
    h.hidden = false; h.className = 'hintbox ' + type; h.innerHTML = html;
  };
  const upd = () => o.onInput && o.onInput(read(), hint);
  frm.addEventListener('input', upd);
  frm.addEventListener('change', upd);
  upd();

  frm.addEventListener('submit', async e => {
    e.preventDefault();
    frm.querySelectorAll('.fld.err').forEach(x => x.classList.remove('err'));
    const v = read();
    let ok = true;
    o.fields.forEach(f => {
      const bad = (f.req && (v[f.name] == null)) ||
        (f.type === 'number' && v[f.name] != null && (isNaN(v[f.name]) || v[f.name] < (f.min ?? 0)));
      if (bad) { ok = false; frm.querySelector(`[data-f="${f.name}"]`)?.classList.add('err'); }
    });
    if (!ok) return toast('Lengkapi data yang wajib diisi dengan benar', 'err');
    const btn = frm.querySelector('[type=submit]');
    btn.disabled = true;
    try { await o.onSubmit(v); closeModal(); }
    catch (err) { toast(errMsg(err), 'err'); btn.disabled = false; }
  });
  const first = frm.querySelector('input:not([disabled]),select:not([disabled])');
  if (first && window.innerWidth > 700) first.focus();
}

/* ---------- Data helpers ---------- */
async function q(table, orders = [['created_at', false]]) {
  let r = sb.from(table).select('*');
  orders.forEach(([c, asc]) => (r = r.order(c, { ascending: asc })));
  const { data, error } = await r;
  if (error) throw error;
  return data || [];
}
async function save(table, payload, id) {
  const r = id ? sb.from(table).update(payload).eq('id', id) : sb.from(table).insert(payload);
  const { data, error } = await r.select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Data tidak tersimpan. Anda mungkin tidak punya hak akses.');
}
async function del(table, id) {
  const { data, error } = await sb.from(table).delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Data tidak terhapus. Hanya Admin yang boleh menghapus.');
}
const poLabel = p => `${p.pi_no} · ${p.brand}${p.specification ? ' · ' + p.specification : ''}`;

/* ---------- Table renderer ---------- */
const bal = v => `<span class="bal ${v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'}">${num(v)}</span>`;
function cell(c, r) {
  if (c.f) return c.f(r);
  const v = r[c.k];
  if (c.t === 'n') return num(v);
  if (c.t === 'd') return dt(v);
  if (c.t === 'b') return bal(v);
  return v == null || v === '' ? '<span class="mut">–</span>' : esc(v);
}
function table(cols, rows, acts) {
  if (!rows.length) return `<div class="empty"><b>Belum ada data</b>Data akan tampil di sini setelah diinput.</div>`;
  const hasAct = acts.some(a => a.length);
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.cls || ''}">${esc(c.label)}</th>`).join('')}${hasAct ? '<th></th>' : ''}</tr></thead><tbody>${
    rows.map((r, i) => `<tr>${cols.map(c => `<td class="${c.cls || ''}" data-label="${esc(c.label)}">${cell(c, r)}</td>`).join('')}${
      hasAct ? `<td class="acts">${acts[i].map(a => a.text
        ? `<button class="btn sm ${a.cls || 'soft'}" data-i="${i}" data-k="${a.key}">${icon(a.icon, 16)}<span>${esc(a.label)}</span></button>`
        : `<button class="ibtn ${a.cls || ''}" data-i="${i}" data-k="${a.key}" title="${esc(a.label)}" aria-label="${esc(a.label)}">${icon(a.icon, 16)}</button>`).join('')}</td>` : ''}</tr>`).join('')
  }</tbody></table></div>`;
}

function exportCSV(seg, rows, name) {
  const cols = seg.cols.filter(c => c.k);
  const line = a => a.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',');
  const csv = '\ufeff' + [line(cols.map(c => c.label)), ...rows.map(r => line(cols.map(c => r[c.k])))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${name}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* standar aksi baris: Ubah (leader tahap itu) + Hapus (admin) */
const stdActs = (table_, stage, edit) => r => {
  const a = [];
  if (can(stage)) a.push({ key: 'edit', label: 'Ubah', icon: 'edit', run: rl => edit(r, rl) });
  if (isAdmin()) a.push({
    key: 'del', label: 'Hapus', icon: 'trash', cls: 'danger',
    run: async rl => {
      if (!(await ask('Hapus data ini? Tindakan tidak dapat dibatalkan.'))) return;
      try { await del(table_, r.id); toast('Data dihapus'); rl(); } catch (e) { toast(errMsg(e), 'err'); }
    }
  });
  return a;
};

/* =====================================================================
   FORMS
   ===================================================================== */
function poForm(row, rl) {
  openForm({
    title: row ? 'Ubah Data PI' : 'PI / PO Baru',
    sub: 'Master PI yang akan diterima gudang.',
    fields: [
      { name: 'pi_no', label: 'PI No', req: true, placeholder: 'mis. 210.07.26.SMB' },
      { name: 'brand', label: 'Brand', req: true, placeholder: 'mis. SB BROWN + TIPS' },
      { name: 'specification', label: 'Spesifikasi Incoming Material', placeholder: 'mis. Filter / Paper / Tipping' },
      { name: 'qty_po', label: 'Qty PO', type: 'number', req: true, min: 0.01 }
    ],
    values: row,
    onSubmit: async v => {
      await save('po_items', { pi_no: v.pi_no, brand: v.brand, specification: v.specification || '', qty_po: v.qty_po }, row?.id);
      toast('PI tersimpan'); rl();
    }
  });
}

async function receiptForm(row, rl) {
  const pos = await q('v_po_summary');
  if (!pos.length) return toast('Buat data PI terlebih dahulu di tab "Data PI".', 'err');
  const by = Object.fromEntries(pos.map(p => [p.id, p]));
  openForm({
    title: row ? 'Ubah Penerimaan' : 'Penerimaan Material Baru',
    sub: 'Catat barang masuk berdasarkan Surat Jalan / DO.',
    fields: [
      { name: 'po_item_id', label: 'PI / Material', type: 'select', req: true, disabled: !!row, options: pos.map(p => ({ v: p.id, l: poLabel(p) })) },
      { name: 'receipt_date', label: 'Tanggal Terima', type: 'date', req: true, default: today(), half: true },
      { name: 'sj_no', label: 'No. SJ / DO', req: true, half: true },
      { name: 'qty_sj', label: 'Qty SJ', type: 'number', req: true, min: 0.01 },
      { name: 'notes', label: 'Catatan', type: 'textarea' }
    ],
    values: row,
    onInput: (v, hint) => {
      const p = by[v.po_item_id];
      if (!p) return hint();
      const used = Number(p.total_incoming) - (row ? Number(row.qty_sj) : 0);
      const sisa = Number(p.qty_po) - used;
      const after = v.qty_sj != null ? sisa - v.qty_sj : null;
      const over = after != null && after < 0;
      hint(`Qty PO <b>${num(p.qty_po)}</b> · Sudah masuk <b>${num(used)}</b> · Sisa PO <b>${num(sisa)}</b>` +
        (over ? `<br>⚠ Melebihi sisa PO sebanyak ${num(-after)} (tetap bisa disimpan bila memang kirim lebih).` : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      await save('receipts', { po_item_id: v.po_item_id, receipt_date: v.receipt_date, sj_no: v.sj_no, qty_sj: v.qty_sj, notes: v.notes }, row?.id);
      toast('Penerimaan tersimpan'); rl();
    }
  });
}

async function qcForm(row, pre, rl) {
  const recs = await q('v_receipts', [['receipt_date', false], ['created_at', false]]);
  const list = row ? recs.filter(r => r.id === row.receipt_id) : recs.filter(r => Number(r.qc_balance) > 0 || (pre && r.id === pre.id));
  if (!list.length) return toast('Tidak ada penerimaan yang menunggu QC.', 'err');
  const by = Object.fromEntries(list.map(r => [r.id, r]));
  const own = row ? Number(row.good_qty) + Number(row.ng_qty) : 0;
  openForm({
    title: row ? 'Ubah Hasil QC' : 'Input Hasil QC',
    sub: 'Total Good + NG tidak boleh melebihi Qty SJ.',
    fields: [
      { name: 'receipt_id', label: 'Surat Jalan yang Dicek', type: 'select', req: true, disabled: !!row,
        options: list.map(r => ({ v: r.id, l: `${r.pi_no} · ${r.brand} · SJ ${r.sj_no} (sisa ${num(r.qc_balance)})` })) },
      { name: 'inspect_date', label: 'Tanggal Cek', type: 'date', req: true, default: today() },
      { name: 'good_qty', label: 'Good Material', type: 'number', default: 0, half: true },
      { name: 'ng_qty', label: 'NG Material', type: 'number', default: 0, half: true },
      { name: 'description', label: 'Keterangan / Description', type: 'textarea', help: 'Wajib diisi bila ada NG (jenis & penyebab).' }
    ],
    values: row || { receipt_id: pre?.id },
    onInput: (v, hint) => {
      const r = by[v.receipt_id];
      if (!r) return hint();
      const sisa = Number(r.qc_balance) + own;
      const tot = (v.good_qty || 0) + (v.ng_qty || 0);
      const over = tot > sisa;
      hint(`Qty SJ <b>${num(r.qty_sj)}</b> · Sisa belum dicek <b>${num(sisa)}</b> · Input ini <b>${num(tot)}</b>` +
        (over ? `<br>⚠ Melebihi sisa SJ sebanyak ${num(tot - sisa)}.` : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      const r = by[v.receipt_id];
      const good = v.good_qty || 0, ng = v.ng_qty || 0;
      if (good + ng <= 0) throw new Error('Isi qty Good atau NG.');
      if (good + ng > Number(r.qc_balance) + own) throw new Error(`Total Good + NG melebihi sisa SJ (${num(Number(r.qc_balance) + own)}).`);
      if (ng > 0 && !v.description) throw new Error('Keterangan wajib diisi karena ada NG.');
      await save('qc_inspections', { receipt_id: v.receipt_id, inspect_date: v.inspect_date, good_qty: good, ng_qty: ng, description: v.description }, row?.id);
      toast('Hasil QC tersimpan'); rl();
    }
  });
}

async function issueForm(row, rl) {
  const pos = await q('v_po_summary');
  const list = row ? pos.filter(p => p.id === row.po_item_id) : pos.filter(p => Number(p.stock_ready) > 0);
  if (!list.length) return toast('Belum ada material GOOD yang siap dikirim. Selesaikan QC terlebih dahulu.', 'err');
  const by = Object.fromEntries(list.map(p => [p.id, p]));
  openForm({
    title: row ? 'Ubah Pengiriman Material' : 'Kirim Material ke Produksi',
    sub: 'Hanya material berstatus GOOD dari QC yang bisa dikirim.',
    fields: [
      { name: 'po_item_id', label: 'PI / Material', type: 'select', req: true, disabled: !!row,
        options: list.map(p => ({ v: p.id, l: `${poLabel(p)} (stok ${num(p.stock_ready)})` })) },
      { name: 'request_date', label: 'Tanggal Request Material', type: 'date', req: true, default: today(), half: true },
      { name: 'qty_sent', label: 'Qty Dikirim', type: 'number', req: true, min: 0.01, half: true },
      { name: 'notes', label: 'Catatan', type: 'textarea' }
    ],
    values: row,
    onInput: (v, hint) => {
      const p = by[v.po_item_id];
      if (!p) return hint();
      const stok = Number(p.stock_ready) + (row ? Number(row.qty_sent) : 0);
      const over = v.qty_sent != null && v.qty_sent > stok;
      hint(`Stok GOOD siap kirim: <b>${num(stok)}</b>` + (over ? `<br>⚠ Qty melebihi stok sebanyak ${num(v.qty_sent - stok)}.` : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      const p = by[v.po_item_id];
      const stok = Number(p.stock_ready) + (row ? Number(row.qty_sent) : 0);
      if (v.qty_sent > stok) throw new Error(`Qty kirim melebihi stok GOOD (${num(stok)}).`);
      if (row && v.qty_sent < Number(row.returned_qty)) throw new Error(`Qty kirim tidak boleh di bawah qty retur (${num(row.returned_qty)}).`);
      await save('supply_issues', { po_item_id: v.po_item_id, request_date: v.request_date, qty_sent: v.qty_sent, notes: v.notes }, row?.id);
      toast('Pengiriman tersimpan'); rl();
    }
  });
}

async function returnForm(row, pre, rl) {
  const issues = await q('v_supply_issues', [['request_date', false], ['created_at', false]]);
  const list = row ? issues.filter(i => i.id === row.issue_id) : issues.filter(i => Number(i.balance) > 0 || (pre && i.id === pre.id));
  if (!list.length) return toast('Tidak ada material di produksi yang bisa diretur.', 'err');
  const by = Object.fromEntries(list.map(i => [i.id, i]));
  const own = row ? Number(row.qty_return) : 0;
  openForm({
    title: row ? 'Ubah Retur' : 'Retur Material dari Produksi',
    fields: [
      { name: 'issue_id', label: 'Pengiriman', type: 'select', req: true, disabled: !!row,
        options: list.map(i => ({ v: i.id, l: `${i.pi_no} · ${i.brand} · kirim ${dt(i.request_date)} (sisa ${num(i.balance)})` })) },
      { name: 'return_date', label: 'Tanggal Retur', type: 'date', req: true, default: today(), half: true },
      { name: 'qty_return', label: 'Qty Retur', type: 'number', req: true, min: 0.01, half: true },
      { name: 'notes', label: 'Catatan / Alasan', type: 'textarea' }
    ],
    values: row || { issue_id: pre?.id },
    onInput: (v, hint) => {
      const i = by[v.issue_id];
      if (!i) return hint();
      const sisa = Number(i.balance) + own;
      const over = v.qty_return != null && v.qty_return > sisa;
      hint(`Dikirim <b>${num(i.qty_sent)}</b> · Sisa di produksi <b>${num(sisa)}</b>` + (over ? '<br>⚠ Qty retur melebihi sisa di produksi.' : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      const i = by[v.issue_id];
      if (v.qty_return > Number(i.balance) + own) throw new Error('Qty retur melebihi sisa material di produksi.');
      if (v.return_date < i.request_date) throw new Error('Tanggal retur tidak boleh sebelum tanggal request.');
      await save('supply_returns', { issue_id: v.issue_id, return_date: v.return_date, qty_return: v.qty_return, notes: v.notes }, row?.id);
      toast('Retur tersimpan'); rl();
    }
  });
}

async function fgForm(row, rl) {
  const pos = await q('v_po_summary');
  const list = row ? pos.filter(p => p.id === row.po_item_id) : pos.filter(p => Number(p.supplied_total) > 0);
  if (!list.length) return toast('Belum ada material yang dikirim ke produksi.', 'err');
  const by = Object.fromEntries(list.map(p => [p.id, p]));
  openForm({
    title: row ? 'Ubah Finish Good' : 'Terima Finish Good',
    sub: 'Catat hasil produksi yang diterima.',
    fields: [
      { name: 'po_item_id', label: 'PI / Material', type: 'select', req: true, disabled: !!row, options: list.map(p => ({ v: p.id, l: poLabel(p) })) },
      { name: 'received_date', label: 'Tanggal Terima', type: 'date', req: true, default: today() },
      { name: 'karton', label: 'Karton', type: 'number', default: 0, half: true },
      { name: 'display', label: 'Display', type: 'number', default: 0, half: true },
      { name: 'booklet_cones', label: 'Booklet / Cones', type: 'number', default: 0 },
      { name: 'notes', label: 'Catatan', type: 'textarea' }
    ],
    values: row,
    onInput: (v, hint) => {
      const p = by[v.po_item_id];
      if (!p) return hint();
      const done = Number(p.fg_booklet) - (row ? Number(row.booklet_cones) : 0);
      const sisa = Number(p.at_production) - done;
      const over = (v.booklet_cones || 0) > sisa;
      hint(`Material di produksi <b>${num(p.at_production)}</b> · Booklet/Cones jadi <b>${num(done)}</b> · Sisa <b>${num(sisa)}</b>` +
        (over ? '<br>⚠ Booklet/Cones melebihi material yang ada di produksi — periksa kembali.' : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      if ((v.karton || 0) + (v.display || 0) + (v.booklet_cones || 0) <= 0) throw new Error('Isi minimal salah satu: Karton, Display, atau Booklet/Cones.');
      await save('fg_receipts', { po_item_id: v.po_item_id, received_date: v.received_date, karton: v.karton || 0, display: v.display || 0, booklet_cones: v.booklet_cones || 0, notes: v.notes }, row?.id);
      toast('Finish Good tersimpan'); rl();
    }
  });
}

/* =====================================================================
   HALAMAN
   ===================================================================== */
const qcStatus = r => Number(r.qc_balance) <= 0 ? '<span class="pill ok">Selesai</span>'
  : (Number(r.good_qty) + Number(r.ng_qty) > 0 ? `<span class="pill warn">Sisa ${num(r.qc_balance)}</span>` : '<span class="pill gray">Belum QC</span>');

const DEFS = {
  gudang: () => ({
    id: 'gudang', title: 'Gudang · Incoming Material',
    sub: 'Catat PI/PO dan penerimaan barang dari supplier berdasarkan Surat Jalan / DO.',
    segments: [
      {
        id: 'sj', label: 'Penerimaan SJ',
        load: () => q('v_receipts', [['receipt_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tanggal', k: 'receipt_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' },
          { label: 'Brand', k: 'brand' }, { label: 'Spesifikasi', k: 'specification' },
          { label: 'Qty PO', k: 'qty_po', t: 'n', cls: 'num' }, { label: 'No. SJ / DO', k: 'sj_no' },
          { label: 'Qty SJ', k: 'qty_sj', t: 'n', cls: 'num' }, { label: 'Status QC', f: qcStatus }
        ],
        add: { label: 'Penerimaan Baru', stage: 'gudang', run: rl => receiptForm(null, rl) },
        acts: stdActs('receipts', 'gudang', (r, rl) => receiptForm(r, rl))
      },
      {
        id: 'po', label: 'Data PI',
        load: () => q('v_po_summary'),
        cols: [
          { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Spesifikasi', k: 'specification' },
          { label: 'Qty PO', k: 'qty_po', t: 'n', cls: 'num' }, { label: 'Total Incoming', k: 'total_incoming', t: 'n', cls: 'num' },
          { label: 'Balance', k: 'balance_po', t: 'b', cls: 'num' }
        ],
        add: { label: 'PI Baru', stage: 'gudang', run: rl => poForm(null, rl) },
        acts: stdActs('po_items', 'gudang', (r, rl) => poForm(r, rl))
      }
    ]
  }),

  qc: () => ({
    id: 'qc', title: 'QC · Pengecekan Incoming',
    sub: 'Periksa barang dari gudang: pisahkan Good dan NG. Hanya Good yang bisa dikirim ke produksi.',
    segments: [
      {
        id: 'wait', label: 'Menunggu QC',
        load: async () => (await q('v_receipts', [['receipt_date', true], ['created_at', true]])).filter(r => Number(r.qc_balance) > 0),
        cols: [
          { label: 'Tgl Terima', k: 'receipt_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' },
          { label: 'No. SJ / DO', k: 'sj_no' }, { label: 'Qty SJ', k: 'qty_sj', t: 'n', cls: 'num' },
          { label: 'Good', k: 'good_qty', t: 'n', cls: 'num' }, { label: 'NG', k: 'ng_qty', t: 'n', cls: 'num' },
          { label: 'Sisa Dicek', k: 'qc_balance', t: 'b', cls: 'num' }
        ],
        acts: r => can('qc') ? [{ key: 'qc', label: 'Input QC', icon: 'check', text: true, cls: 'primary', run: rl => qcForm(null, r, rl) }] : []
      },
      {
        id: 'hist', label: 'Riwayat QC',
        load: () => q('v_qc_inspections', [['inspect_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Cek', k: 'inspect_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' },
          { label: 'No. SJ / DO', k: 'sj_no' }, { label: 'Qty SJ', k: 'qty_sj', t: 'n', cls: 'num' },
          { label: 'Good', k: 'good_qty', t: 'n', cls: 'num' }, { label: 'NG', k: 'ng_qty', t: 'n', cls: 'num' },
          { label: 'Keterangan', k: 'description' }
        ],
        acts: stdActs('qc_inspections', 'qc', (r, rl) => qcForm(r, null, rl))
      },
      {
        id: 'all', label: 'Semua SJ',
        load: () => q('v_receipts', [['receipt_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Terima', k: 'receipt_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' },
          { label: 'No. SJ / DO', k: 'sj_no' }, { label: 'Qty SJ', k: 'qty_sj', t: 'n', cls: 'num' },
          { label: 'Good', k: 'good_qty', t: 'n', cls: 'num' }, { label: 'NG', k: 'ng_qty', t: 'n', cls: 'num' },
          { label: 'Status', f: qcStatus }
        ],
        acts: () => []
      }
    ]
  }),

  supply: () => ({
    id: 'supply', title: 'Supply Material · Ke Produksi',
    sub: 'Catat material GOOD yang diminta produksi, serta retur bila ada sisa.',
    segments: [
      {
        id: 'issue', label: 'Pengiriman',
        load: () => q('v_supply_issues', [['request_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Request', k: 'request_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' },
          { label: 'Spesifikasi', k: 'specification' }, { label: 'Qty Dikirim', k: 'qty_sent', t: 'n', cls: 'num' },
          { label: 'Qty Retur', k: 'returned_qty', t: 'n', cls: 'num' }, { label: 'Balance', k: 'balance', t: 'b', cls: 'num' }
        ],
        add: { label: 'Kirim Material', stage: 'supply', run: rl => issueForm(null, rl) },
        acts: r => {
          const a = [];
          if (can('supply') && Number(r.balance) > 0) a.push({ key: 'ret', label: 'Retur', icon: 'undo', text: true, run: rl => returnForm(null, r, rl) });
          return a.concat(stdActs('supply_issues', 'supply', (x, rl) => issueForm(x, rl))(r));
        }
      },
      {
        id: 'ret', label: 'Retur',
        load: () => q('v_supply_returns', [['return_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Retur', k: 'return_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' },
          { label: 'Tgl Request', k: 'request_date', t: 'd' }, { label: 'Qty Dikirim', k: 'qty_sent', t: 'n', cls: 'num' },
          { label: 'Qty Retur', k: 'qty_return', t: 'n', cls: 'num' }, { label: 'Catatan', k: 'notes' }
        ],
        add: { label: 'Input Retur', stage: 'supply', run: rl => returnForm(null, null, rl) },
        acts: stdActs('supply_returns', 'supply', (r, rl) => returnForm(r, null, rl))
      },
      {
        id: 'stock', label: 'Stok Siap Kirim',
        load: async () => (await q('v_po_summary', [['pi_no', true]])).filter(p => Number(p.good_total) > 0),
        cols: [
          { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Spesifikasi', k: 'specification' },
          { label: 'Good (QC)', k: 'good_total', t: 'n', cls: 'num' }, { label: 'Dikirim', k: 'supplied_total', t: 'n', cls: 'num' },
          { label: 'Retur', k: 'returned_total', t: 'n', cls: 'num' }, { label: 'Stok Siap Kirim', k: 'stock_ready', t: 'b', cls: 'num' }
        ],
        acts: () => []
      }
    ]
  }),

  fg: () => ({
    id: 'fg', title: 'Finish Good · Produksi',
    sub: 'Catat hasil jadi dari produksi: karton, display, booklet / cones.',
    segments: [
      {
        id: 'fg', label: 'Penerimaan FG',
        load: () => q('v_fg_receipts', [['received_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Terima', k: 'received_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' },
          { label: 'Karton', k: 'karton', t: 'n', cls: 'num' }, { label: 'Display', k: 'display', t: 'n', cls: 'num' },
          { label: 'Booklet / Cones', k: 'booklet_cones', t: 'n', cls: 'num' }, { label: 'Catatan', k: 'notes' }
        ],
        add: { label: 'Terima FG', stage: 'fg', run: rl => fgForm(null, rl) },
        acts: stdActs('fg_receipts', 'fg', (r, rl) => fgForm(r, rl))
      },
      {
        id: 'bal', label: 'Saldo per PI',
        load: async () => (await q('v_po_summary', [['pi_no', true]])).filter(p => Number(p.supplied_total) > 0),
        cols: [
          { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' },
          { label: 'Material di Produksi', k: 'at_production', t: 'n', cls: 'num' },
          { label: 'Karton', k: 'fg_karton', t: 'n', cls: 'num' }, { label: 'Display', k: 'fg_display', t: 'n', cls: 'num' },
          { label: 'Booklet / Cones', k: 'fg_booklet', t: 'n', cls: 'num' }, { label: 'Balance', k: 'fg_balance', t: 'b', cls: 'num' }
        ],
        acts: () => []
      }
    ]
  })
};

async function renderSegPage(view, def) {
  const seg = def.segments.find(s => s.id === state.seg[def.id]) || def.segments[0];
  state.seg[def.id] = seg.id;
  const reload = () => renderSegPage(view, def);
  const canAdd = seg.add && can(seg.add.stage);
  view.innerHTML = `
    <div class="page-head"><div><h1>${esc(def.title)}</h1><p>${esc(def.sub)}</p></div>
      ${canAdd ? `<button class="btn primary" id="addBtn">${icon('plus')}<span>${esc(seg.add.label)}</span></button>`
        : (seg.add ? '<span class="pill gray">Mode lihat saja</span>' : '')}</div>
    <div class="seg" id="segs">${def.segments.map(s => `<button data-seg="${s.id}" class="${s.id === seg.id ? 'on' : ''}">${esc(s.label)}</button>`).join('')}</div>
    <div class="toolbar"><div class="search">${icon('search', 18)}<input id="q" type="search" placeholder="Cari PI, brand, SJ…"></div>
      <button class="btn ghost" id="csv" title="Unduh CSV">${icon('download', 18)}<span class="hide-m">CSV</span></button></div>
    <div class="cnt" id="cnt"></div>
    <div id="list"><div class="loading"><span class="spin"></span>Memuat data…</div></div>`;
  $('#segs').onclick = e => { const b = e.target.closest('[data-seg]'); if (b) { state.seg[def.id] = b.dataset.seg; reload(); } };
  if (canAdd) $('#addBtn').onclick = () => seg.add.run(reload);

  let rows = [];
  try { rows = await seg.load(); } catch (e) { $('#list').innerHTML = `<div class="errbox">${esc(errMsg(e))}</div>`; return; }
  let acts = [];
  const draw = () => {
    const k = $('#q').value.trim().toLowerCase();
    const f = k ? rows.filter(r => Object.values(r).join(' ').toLowerCase().includes(k)) : rows;
    acts = f.map(r => (seg.acts ? seg.acts(r) : []));
    $('#list').innerHTML = table(seg.cols, f, acts);
    $('#cnt').textContent = f.length + ' data';
  };
  $('#q').oninput = draw;
  draw();
  $('#list').onclick = e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const a = acts[+b.dataset.i]?.find(x => x.key === b.dataset.k);
    if (a) a.run(reload);
  };
  $('#csv').onclick = () => exportCSV(seg, rows, def.id + '-' + seg.id);
}

/* ---------- Dashboard ---------- */
function poCard(p) {
  const pct = Number(p.qty_po) ? Math.min(100, Number(p.total_incoming) / Number(p.qty_po) * 100) : 0;
  return `<div class="po">
    <div class="po-h"><div><b>${esc(p.pi_no)}</b><small>${esc(p.brand)}${p.specification ? ' · ' + esc(p.specification) : ''}</small></div>
      <div>${Number(p.balance_po) > 0 ? `<span class="pill warn">Sisa PO ${num(p.balance_po)}</span>` : Number(p.balance_po) < 0 ? `<span class="pill err">Lebih ${num(-p.balance_po)}</span>` : '<span class="pill ok">PO lengkap</span>'}</div></div>
    <div class="stages">
      <div class="st g"><em>Gudang</em><strong>${num(p.total_incoming)}</strong><div class="bar"><i style="width:${pct}%"></i></div><small>dari PO ${num(p.qty_po)}</small></div>
      <div class="st q"><em>QC</em><strong>${num(p.good_total)} <span style="font-size:12px;font-weight:600">good</span></strong><small>NG ${num(p.ng_total)} · menunggu ${num(p.qc_pending)}</small></div>
      <div class="st s"><em>Supply</em><strong>${num(p.at_production)} <span style="font-size:12px;font-weight:600">di produksi</span></strong><small>Kirim ${num(p.supplied_total)} · retur ${num(p.returned_total)}<br>Stok siap ${num(p.stock_ready)}</small></div>
      <div class="st f"><em>Finish Good</em><strong>${num(p.fg_booklet)} <span style="font-size:12px;font-weight:600">booklet/cones</span></strong><small>Karton ${num(p.fg_karton)} · Display ${num(p.fg_display)}<br>Balance ${num(p.fg_balance)}</small></div>
    </div></div>`;
}

async function renderDashboard(view) {
  view.innerHTML = `<div class="page-head"><div><h1>Dashboard</h1><p>Ringkasan alur material dari Gudang sampai Finish Good.</p></div>
    <button class="btn ghost" id="rf">${icon('refresh', 18)}<span>Muat ulang</span></button></div>
    <div class="loading"><span class="spin"></span>Memuat data…</div>`;
  $('#rf').onclick = () => renderDashboard(view);
  let rows;
  try { rows = await q('v_po_summary'); } catch (e) { view.insertAdjacentHTML('beforeend', ''); view.querySelector('.loading').outerHTML = `<div class="errbox">${esc(errMsg(e))}</div>`; return; }
  const sum = k => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
  const kp = [['Total PI', rows.length, 'g'], ['Total Incoming', num(sum('total_incoming')), 'g'], ['Menunggu QC', num(sum('qc_pending')), 'q'],
    ['Good', num(sum('good_total')), 'q'], ['NG', num(sum('ng_total')), 'r'], ['Stok Siap Kirim', num(sum('stock_ready')), 's'],
    ['Di Produksi', num(sum('at_production')), 's'], ['Booklet / Cones Jadi', num(sum('fg_booklet')), 'f']];
  view.querySelector('.loading').outerHTML = `
    <div class="kpis">${kp.map(([l, v, c]) => `<div class="kpi ${c}"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    <div class="toolbar"><div class="search">${icon('search', 18)}<input id="q" type="search" placeholder="Cari PI / brand…"></div></div>
    <div class="sec-title">Progres per PI</div><div id="pos" class="po-grid"></div>`;
  const draw = () => {
    const k = $('#q').value.trim().toLowerCase();
    const f = k ? rows.filter(r => [r.pi_no, r.brand, r.specification].join(' ').toLowerCase().includes(k)) : rows;
    $('#pos').innerHTML = f.length ? f.map(poCard).join('') : '<div class="empty" style="grid-column:1/-1"><b>Belum ada data PI</b>Leader Gudang dapat menambah PI di menu Gudang.</div>';
  };
  $('#q').oninput = draw; draw();
}

/* ---------- Pengguna (admin) ---------- */
async function renderUsers(view) {
  if (!isAdmin()) { view.innerHTML = '<div class="empty"><b>Khusus Admin</b>Anda tidak punya akses ke menu ini.</div>'; return; }
  view.innerHTML = `<div class="page-head"><div><h1>Pengguna</h1><p>Atur role setiap akun. Akun baru dibuat di Supabase → Authentication → Users.</p></div></div><div id="list"><div class="loading"><span class="spin"></span>Memuat…</div></div>`;
  let rows;
  try { rows = await q('profiles', [['created_at', true]]); } catch (e) { $('#list').innerHTML = `<div class="errbox">${esc(errMsg(e))}</div>`; return; }
  $('#list').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Email</th><th>Role</th></tr></thead><tbody>${rows.map(r => `<tr>
    <td data-label="Nama" class="strong">${esc(r.full_name || '-')}</td><td data-label="Email">${esc(r.email || '-')}</td>
    <td data-label="Role"><select class="role" data-id="${r.id}" ${r.id === state.user.id ? 'disabled title="Tidak bisa mengubah role sendiri"' : ''}>${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${k === r.role ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
  $('#list').onchange = async e => {
    const s = e.target.closest('select.role'); if (!s) return;
    try { await save('profiles', { role: s.value }, s.dataset.id); toast('Role diperbarui'); }
    catch (err) { toast(errMsg(err), 'err'); renderUsers(view); }
  };
}

/* =====================================================================
   SHELL, ROUTER, AUTH
   ===================================================================== */
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dash' },
  { id: 'gudang', label: 'Gudang', icon: 'box' },
  { id: 'qc', label: 'QC', icon: 'check' },
  { id: 'supply', label: 'Supply', icon: 'truck' },
  { id: 'fg', label: 'Finish Good', icon: 'pkg' },
  { id: 'users', label: 'Pengguna', icon: 'users', admin: true }
];

function logoHTML() {
  return `<div class="logo"><i>${icon('box', 22)}</i><div><b>MaterialFlow</b><small>Pendataan Material</small></div></div>`;
}

function renderShell() {
  const nav = NAV.filter(n => !n.admin || isAdmin());
  const name = state.profile.full_name || state.user.email;
  $('#app').innerHTML = `<div class="shell">
    <aside class="side">${logoHTML()}<nav>${nav.map(n => `<a href="#${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}</nav>
      <div class="foot">Alur: Gudang → QC → Supply → Finish Good</div></aside>
    <div class="main">
      <header class="top">${logoHTML()}<div class="me"><div class="who"><b>${esc(name)}</b><span>${esc(ROLES[state.profile.role])}</span></div>
        <div class="avatar">${esc(name.slice(0, 1).toUpperCase())}</div>
        <button class="ibtn" id="logout" title="Keluar" aria-label="Keluar">${icon('logout', 18)}</button></div></header>
      <main class="content" id="view"></main>
    </div>
    <nav class="bottom">${nav.map(n => `<a href="#${n.id}" data-nav="${n.id}">${icon(n.icon, 22)}<span>${n.label}</span></a>`).join('')}</nav></div>`;
  $('#logout').onclick = async () => { await sb.auth.signOut(); };
}

async function route() {
  if (!state.profile) return;
  let page = location.hash.slice(1) || 'dashboard';
  if (!NAV.some(n => n.id === page)) page = 'dashboard';
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === page));
  const view = $('#view');
  window.scrollTo(0, 0);
  try {
    if (page === 'dashboard') await renderDashboard(view);
    else if (page === 'users') await renderUsers(view);
    else await renderSegPage(view, DEFS[page]());
    if (state.profile.role === 'viewer') view.insertAdjacentHTML('afterbegin', '<div class="banner">Akun Anda belum diberi role input. Hubungi Admin untuk mengatur role (Gudang / QC / Supply / Produksi). Saat ini hanya bisa melihat data.</div>');
  } catch (e) { view.innerHTML = `<div class="errbox">${esc(errMsg(e))}</div>`; }
}

function showLogin(msg) {
  state.user = null; state.profile = null;
  closeModal();
  $('#app').innerHTML = `<div class="login"><form class="login-card" id="lf" novalidate>
    ${logoHTML()}<h2>Masuk</h2><p class="sub">Gunakan akun yang diberikan Admin.</p>
    <div class="fld"><label for="em">Email</label><input id="em" type="email" autocomplete="username" inputmode="email" required></div>
    <div class="fld"><label for="pw">Password</label><div class="pw"><input id="pw" type="password" autocomplete="current-password" required><button type="button" id="tg">Lihat</button></div></div>
    <button class="btn primary" type="submit">Masuk</button></form></div>`;
  if (msg) toast(msg, 'err');
  $('#tg').onclick = () => { const p = $('#pw'); const s = p.type === 'password'; p.type = s ? 'text' : 'password'; $('#tg').textContent = s ? 'Sembunyi' : 'Lihat'; };
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const email = $('#em').value.trim(), password = $('#pw').value;
    if (!email || !password) return toast('Isi email dan password', 'err');
    const b = $('#lf button[type=submit]'); b.disabled = true; b.textContent = 'Memproses…';
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      b.disabled = false; b.textContent = 'Masuk';
      return toast(/invalid login/i.test(error.message) ? 'Email atau password salah' : errMsg(error), 'err');
    }
    start(data.user);
  };
}

async function start(user) {
  $('#app').innerHTML = '<div class="loading" style="padding-top:30vh"><span class="spin"></span>Memuat…</div>';
  const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error || !data) {
    await sb.auth.signOut();
    return showLogin(error ? errMsg(error) : 'Profil tidak ditemukan. Pastikan schema.sql sudah dijalankan.');
  }
  state.user = user; state.profile = data;
  renderShell();
  route();
}

function setupNeeded() {
  $('#app').innerHTML = `<div class="setup"><h2>Konfigurasi belum diisi</h2>
    <p style="margin:10px 0">Buka file <code>config.js</code>, isi <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> dari Supabase → Project Settings → API, lalu simpan dan muat ulang halaman.</p></div>`;
}

async function boot() {
  if (!cfg.SUPABASE_URL || /YOUR_/.test(cfg.SUPABASE_URL) || /YOUR_/.test(cfg.SUPABASE_ANON_KEY || 'YOUR_')) return setupNeeded();
  if (!window.supabase) { $('#app').innerHTML = '<div class="setup">Gagal memuat library Supabase. Periksa koneksi internet.</div>'; return; }
  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') showLogin(); });
  window.addEventListener('hashchange', route);
  const { data: { session } } = await sb.auth.getSession();
  if (session) start(session.user); else showLogin();
}
boot();
})();
