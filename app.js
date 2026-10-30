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
  diecut: 'Leader Diecut',
  supply: 'Leader Supply Material',
  produksi: 'Leader Finish Good / Produksi',
  viewer: 'Viewer (belum diberi role)'
};
const STAGE_ROLE = { gudang: 'gudang', qc: 'qc', diecut: 'diecut', supply: 'supply', fg: 'produksi' };
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
  bell: '<path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 003.4 0"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  logout: '<path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
  refresh: '<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>'
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
  if (c === '23505') return 'Data sudah ada (duplikat). Periksa kembali No PI + Jenis Barang + Spesifikasi, atau No SJ.';
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
    inp = `<select id="${id}" name="${f.name}" ${dis}>${f.noEmpty ? '' : '<option value="">— Pilih —</option>'}${f.options.map(o =>
      `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    inp = `<textarea id="${id}" name="${f.name}" rows="3" placeholder="${esc(f.placeholder || '')}" ${dis}>${esc(v)}</textarea>`;
  } else {
    const n = f.type === 'number' ? `inputmode="decimal" step="any" min="${f.min ?? 0}"` : '';
    const ls = f.list ? `list="dl_${f.name}"` : '';
    inp = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${n} ${ls} placeholder="${esc(f.placeholder || '')}" autocomplete="off" ${dis}>` +
      (f.list ? `<datalist id="dl_${f.name}">${f.list.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>` : '');
  }
  return `<div class="fld" data-f="${f.name}"><label for="${id}"><span class="lt">${esc(f.label)}</span>${f.req ? ' <i>*</i>' : ''}</label>${inp}${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
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
        <div class="sheet-f">${o.submit2 ? `<button type="button" class="btn soft" id="sub2">${esc(o.submit2)}</button>` : ''}<button type="button" class="btn ghost" data-close>Batal</button>
        <button type="submit" class="btn primary">${esc(o.submit || 'Simpan')}</button></div>
      </form></div>`;
  m.classList.add('open');
  document.body.classList.add('lock');
  m.onclick = e => { if (e.target.closest('[data-close]')) closeModal(); };

  const frm = $('#frm', m);
  const uf = o.fields.filter(f => f.u);          // kolom jumlah yang ikut satuan (PCS / SHEET)
  let touched = !!o.keepUnit, auto = null, extra = '';

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
  // Konversi ke PCS: jumlah sheet x isi per sheet. Handler menerima nilai dalam PCS; nilai ketikan asli ada di v.raw
  const convert = raw => {
    const v = { ...raw, raw };
    v.unit = raw.unit || 'PCS';
    if (v.unit === 'SHEET') {
      const k = Number(raw.pps);
      uf.forEach(f => { v[f.name] = raw[f.name] == null ? null : (k > 0 ? Math.round(raw[f.name] * k * 100) / 100 : null); });
    }
    return v;
  };
  const convLine = v => v.unit !== 'SHEET' ? '' : uf
    .filter(f => v.raw[f.name] != null && v.raw[f.name] > 0 && v[f.name] != null)
    .map(f => `${esc(f.label)}: ${num(v.raw[f.name])} sheet × ${num(v.raw.pps)} = <b>${num(v[f.name])} pcs</b>` + (v[f.name] % 1 ? ' ⚠ bukan bilangan bulat' : ''))
    .join('<br>');
  const show = (html, type = 'info') => {
    const h = $('#fhint', m);
    const t = (html || '') + (html && extra ? '<br>' : '') + extra;
    if (!t) { h.hidden = true; return; }
    h.hidden = false; h.className = 'hintbox ' + type; h.innerHTML = t;
  };
  const upd = ev => {
    if (ev && ev.target && ev.target.name === 'unit') touched = true;   // diubah manual oleh pengguna
    let raw = read();
    // satuan & isi per sheet otomatis mengikuti PI / SJ yang dipilih (selama belum diubah manual)
    if (o.unitFrom && !touched && frm.elements.unit) {
      const u = o.unitFrom(raw);
      if (u && frm.elements.unit.value !== u) { frm.elements.unit.value = u; raw = read(); }
    }
    if (raw.unit === 'SHEET' && o.ppsFrom && frm.elements.pps) {
      const d = o.ppsFrom(raw), el = frm.elements.pps;
      if (d != null && (el.value === '' || (auto != null && Number(el.value) === auto))) { el.value = d; auto = Number(d); raw = read(); }
    }
    o.fields.forEach(f => {
      if (f.showIf) { const w = frm.querySelector(`[data-f="${f.name}"]`); if (w) w.hidden = !f.showIf(raw); }
    });
    uf.forEach(f => {
      const w = frm.querySelector(`[data-f="${f.name}"] .lt`);
      if (w) w.textContent = f.label + (raw.unit === 'SHEET' ? ' (sheet)' : ' (pcs)');
    });
    const v = convert(raw);
    extra = convLine(v);
    let called = false;
    if (o.onInput) o.onInput(v, (h, t) => { called = true; show(h, t); });
    if (!called) show('');
  };
  frm.addEventListener('input', upd);
  frm.addEventListener('change', upd);
  upd();

  const doSubmit = async again => {
    frm.querySelectorAll('.fld.err').forEach(x => x.classList.remove('err'));
    const raw = read();
    let ok = true;
    o.fields.forEach(f => {
      if (f.showIf && !f.showIf(raw)) return;
      const bad = (f.req && (raw[f.name] == null)) ||
        (f.type === 'number' && raw[f.name] != null && (isNaN(raw[f.name]) || raw[f.name] < (f.min ?? 0)));
      if (bad) { ok = false; frm.querySelector(`[data-f="${f.name}"]`)?.classList.add('err'); }
    });
    if (!ok) return toast('Lengkapi data yang wajib diisi dengan benar', 'err');
    const v = convert(raw);
    if (v.unit === 'SHEET' && uf.some(f => v[f.name] != null && v[f.name] % 1 !== 0))
      return toast('Hasil sheet × isi per sheet harus bilangan bulat pcs. Periksa jumlah sheet dan isi per sheet.', 'err');
    const btns = [...frm.querySelectorAll('[type=submit],#sub2')];
    btns.forEach(x => (x.disabled = true));
    try { const r = await o.onSubmit(v, again); if (r !== 'keep') closeModal(); }
    catch (err) { toast(errMsg(err), 'err'); btns.forEach(x => (x.disabled = false)); }
  };
  frm.addEventListener('submit', e => { e.preventDefault(); doSubmit(false); });
  const s2 = $('#sub2', m);
  if (s2) s2.onclick = () => doSubmit(true);
  const first = frm.querySelector('input:not([disabled]),select:not([disabled])');
  if (first && window.innerWidth > 700) first.focus();
}

/* ---------- Data helpers ---------- */
async function q(table, orders = [['created_at', false]], tie = 'id') {
  // Ambil per 1000 baris sampai habis (batas default Supabase 1000 baris/permintaan)
  const out = [];
  for (let from = 0; ; from += 1000) {
    let r = sb.from(table).select('*');
    orders.forEach(([c, asc]) => (r = r.order(c, { ascending: asc })));
    r = r.order(tie, { ascending: true });
    const { data, error } = await r.range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
async function save(table, payload, id) {
  const r = id ? sb.from(table).update(payload).eq('id', id) : sb.from(table).insert(payload);
  const { data, error } = await r.select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Data tidak tersimpan. Anda mungkin tidak punya hak akses.');
  setTimeout(refreshBadges, 300);
  return data[0];
}
/* ---------- Inbox (notifikasi tugas per role) ---------- */
state.inbox = [];
function buildInbox(rc, dj, po, rq) {
  const it = [], since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  rq.filter(x => Number(x.outstanding) > 0).forEach(x => {
    it.push({ roles: ['supply'], ic: 'truck', title: `Request dari Produksi: ${poLabel(x)}`,
      sub: `Diminta ${dt(x.request_date)} · sisa dikirim ${num(x.outstanding)} pcs` + (Number(x.qty_sent) > 0 ? ` (sudah terkirim ${num(x.qty_sent)})` : ''),
      page: 'supply', seg: 'reqin', open: (rl) => issueFromRequest(x, rl) });
    if (Number(x.qty_sent) > 0) it.push({ roles: ['produksi'], ic: 'truck', title: `Request sebagian terkirim: ${poLabel(x)}`,
      sub: `Terkirim ${num(x.qty_sent)} dari ${num(x.qty_requested)} pcs · sisa ${num(x.outstanding)} menunggu Supply`, page: 'fg', seg: 'req' });
  });
  rc.filter(r => Number(r.qc_balance) > 0).forEach(r => it.push({ roles: ['qc'], ic: 'check', title: `SJ ${r.sj_no} menunggu QC`,
    sub: `${poLabel(r)} · sisa ${num(r.qc_balance)} pcs`, page: 'qc', seg: 'wait', open: rl => qcForm(null, r, rl) }));
  dj.filter(j => Number(j.qc2_balance) > 0).forEach(j => it.push({ roles: ['qc'], ic: 'check', title: `Hasil diecut SJ ${j.sj_no} menunggu QC ulang`,
    sub: `${poLabel(j)} · sisa ${num(j.qc2_balance)} pcs`, page: 'qc', seg: 'wait2', open: rl => qc2Form(null, j, rl) }));
  rc.filter(r => r.unit === 'SHEET' && Number(r.dc_waiting) > 0).forEach(r => it.push({ roles: ['diecut'], ic: 'cut', title: `SJ ${r.sj_no} siap diecut`,
    sub: `${poLabel(r)} · ${num(shn(r.dc_waiting, r))} sheet lolos QC`, page: 'diecut', seg: 'wait', open: rl => diecutForm(null, r, rl) }));
  rc.filter(r => Number(r.ng_qty) > 0 && r.receipt_date >= since).forEach(r => it.push({ roles: ['gudang'], ic: 'box', title: `NG pada SJ ${r.sj_no}: ${num(r.ng_qty)} pcs`,
    sub: `${poLabel(r)} · hasil QC, tindak lanjuti ke supplier bila perlu`, page: 'gudang', seg: 'sj' }));
  po.filter(p => p.source !== 'STOCK' && Number(p.supplied_total) > 0 && Number(p.fg_balance) > 0).forEach(p => it.push({ roles: ['produksi'], ic: 'pkg', title: `Material di produksi: ${poLabel(p)}`,
    sub: `Sisa material ${num(p.fg_balance)} pcs belum jadi barang · catat hasil jadi`, page: 'fg', seg: 'fg', open: rl => fgForm(null, rl) }));
  const role = state.profile?.role;
  return it.filter(x => role === 'admin' || x.roles.includes(role));
}
async function goInbox(i) {
  const x = state.inbox[i]; if (!x) return;
  closeInbox();
  state.seg[x.page] = x.seg;
  history.pushState(null, '', '#' + x.page);
  await route();
  if (x.open && can(x.page === 'fg' ? 'fg' : x.page)) { try { await x.open(() => route()); } catch (e) { toast(errMsg(e), 'err'); } }
}
function closeInbox() { $('#inbox')?.remove(); }
function openInbox() {
  if ($('#inbox')) return closeInbox();
  const list = state.inbox;
  const h = document.createElement('div'); h.id = 'inbox';
  h.innerHTML = `<div class="backdrop" data-x></div><div class="ibox" role="dialog" aria-label="Inbox">
    <div class="ibox-h"><b>Inbox</b><span class="mut">${list.length ? list.length + ' perlu tindakan' : ''}</span><button class="x" data-x aria-label="Tutup">&times;</button></div>
    <div class="ibox-b">${list.length ? list.map((x, i) => `<button class="imsg" data-i="${i}"><i>${icon(x.ic, 18)}</i><span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span><em>›</em></button>`).join('')
      : '<div class="empty"><b>Inbox kosong</b>Tidak ada pekerjaan yang menunggu Anda saat ini.</div>'}</div></div>`;
  document.body.appendChild(h);
  h.onclick = e => { if (e.target.closest('[data-x]')) return closeInbox(); const b = e.target.closest('[data-i]'); if (b) goInbox(Number(b.dataset.i)); };
}

let badgeBusy = false;
async function refreshBadges() {
  if (badgeBusy || !state.profile) return; badgeBusy = true;
  try {
    const [rc, dj, po, rq] = await Promise.all([q('v_receipts', [['receipt_date', true]]), q('v_diecut_jobs', [['job_date', true]]), q('v_po_summary', [['pi_no', true]]), q('v_requests', [['request_date', true]]).catch(() => [])]);
    state.inbox = buildInbox(rc, dj, po, rq);
    const bell = $('#bell');
    if (bell) { bell.querySelector('.bdg')?.remove(); if (state.inbox.length) bell.insertAdjacentHTML('beforeend', `<em class="bdg">${state.inbox.length > 99 ? '99+' : state.inbox.length}</em>`); }
  } catch (e) { /* badge hanya pelengkap */ } finally { badgeBusy = false; }
}
async function del(table, id) {
  const { data, error } = await sb.from(table).delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Data tidak terhapus. Hanya Admin yang boleh menghapus.');
}
const fmtIn = (unit, input, pps) => unit === 'SHEET' ? `${num(input)} sheet × ${num(pps)} pcs` : 'PCS';
const itemLbl = p => [p.item_name, p.specification, p.leaves_per_book ? `${num(p.leaves_per_book)} leaves` : ''].filter(Boolean).join(' · ');
const isFilterBook = n => /filter\s*-?\s*book/i.test(n || '');
const poLabel = p => `${p.pi_no} · ${p.brand}${itemLbl(p) ? ' · ' + itemLbl(p) : ''}`;
const ITEM_NAMES = ['Booklet', 'Filter Book', 'Filter Cones', 'Display', 'Cover'];
// urutkan agar item-item satu PI berdekatan (urutan PI = urutan pertama kali dibuat)
const groupSort = rows => {
  const first = {};
  rows.forEach(r => { const k = r.pi_no + '|' + r.brand, t = String(r.created_at || ''); if (!(k in first) || t < first[k]) first[k] = t; });
  return [...rows].sort((a, b) => {
    const ka = a.pi_no + '|' + a.brand, kb = b.pi_no + '|' + b.brand;
    if (ka !== kb) return first[ka] < first[kb] ? -1 : first[ka] > first[kb] ? 1 : (ka < kb ? -1 : 1);
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
};

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

/* ---------- Export Excel (.xlsx) memakai ExcelJS, dimuat saat dibutuhkan ---------- */
let _xl = null;
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve();
  if (_xl) return _xl;
  _xl = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
    s.onload = res;
    s.onerror = () => { _xl = null; rej(new Error('Gagal memuat modul Excel. Periksa koneksi internet lalu coba lagi.')); };
    document.head.appendChild(s);
  });
  return _xl;
}
async function saveWorkbook(wb, filename) {
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
// tanggal 'YYYY-MM-DD' -> Date UTC supaya tidak bergeser sehari di Excel
const xlDate = s => { if (!s) return null; const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const xlNum = v => (v == null || v === '' ? null : Number(v));
const GREEN = 'FF70AD47', BAND = 'FFE2EFDA';
const bThin = { style: 'thin', color: { argb: GREEN } };
const bBlack = { style: 'medium', color: { argb: 'FF000000' } };
const allB = b => ({ top: b, left: b, bottom: b, right: b });

function xlTitle(ws, text, n) {
  ws.mergeCells(1, 1, 1, n);
  const t = ws.getCell(1, 1);
  t.value = text; t.font = { bold: true, size: 15 }; t.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 26;
  ws.mergeCells(2, 1, 2, n);
  const s = ws.getCell(2, 1);
  s.value = 'Dicetak: ' + new Date().toLocaleString('id-ID') + (state.profile ? ' \u00b7 oleh ' + (state.profile.full_name || state.user.email) : '');
  s.font = { size: 10, color: { argb: 'FF64748B' } };
}
function xlDataCell(cell, c, v, band) {
  if (c.t === 'd') { cell.value = xlDate(v); cell.numFmt = 'dd-mmm-yyyy'; }
  else if (c.t === 'n' || c.t === 'b') {
    const n = xlNum(v); cell.value = n;
    if (n != null) cell.numFmt = Number.isInteger(n) ? '#,##0' : '#,##0.00';
    if (c.t === 'b' && n != null && n < 0) cell.font = { bold: true, color: { argb: 'FFC00000' } };
  } else cell.value = v == null || v === '' ? null : String(v);
  cell.alignment = { vertical: 'middle', horizontal: c.t === 'n' || c.t === 'b' ? 'right' : (c.al || 'center'), wrapText: true };
  cell.border = allB(bThin);
  if (band) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
}

// Export tabel biasa (dipakai di halaman Gudang, QC, Supply, Finish Good)
async function exportXLSX(title, cols, rows, name) {
  await loadExcelJS();
  const wb = new ExcelJS.Workbook(); wb.creator = 'MaterialFlow';
  const ws = wb.addWorksheet('Data');
  const cc = cols.filter(c => c.k);
  ws.columns = cc.map(c => ({ width: c.w || (c.t === 'd' ? 15 : c.t === 'n' || c.t === 'b' ? 14 : 22) }));
  xlTitle(ws, title.toUpperCase(), cc.length);
  const hr = ws.getRow(4);
  cc.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.label.toUpperCase(); cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = allB(bBlack);
  });
  hr.height = 32;
  rows.forEach((r, i) => {
    const row = ws.getRow(5 + i);
    cc.forEach((c, j) => xlDataCell(row.getCell(j + 1), { ...c, al: 'left' }, r[c.k], i % 2 === 0));
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: cc.length } };
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  await saveWorkbook(wb, `${name}-${today()}.xlsx`);
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
// Satuan input: PCS atau SHEET (1 sheet berisi beberapa pcs). Semua angka disimpan dalam PCS.
const UNIT_FIELDS = [
  { name: 'unit', label: 'Satuan Input', type: 'select', noEmpty: true, default: 'PCS', half: true,
    options: [{ v: 'PCS', l: 'PCS' }, { v: 'SHEET', l: 'SHEET' }] },
  { name: 'pps', label: 'Isi per Sheet (pcs)', type: 'number', min: 0.01, req: true, half: true, placeholder: 'mis. 6',
    showIf: v => v.unit === 'SHEET' }
];

async function stockForm(row, rl) {
  const master = await loadMaster();
  openForm({
    title: row ? 'Ubah Catatan Stok' : 'Tambah Stok Gudang',
    sub: 'Stok dipakai bersama oleh semua PI/brand yang memerlukan barang ini. Isi Stok Awal sekali (hasil hitung sekarang), lalu barang masuk berikutnya.',
    fields: [
      { name: 'item_name', label: 'Jenis Barang', req: true, list: master.item, placeholder: 'mis. Magnet' },
      { name: 'specification', label: 'Spesifikasi', placeholder: 'mis. 10x10 / A4 80gr (boleh kosong)' },
      { name: 'kind', label: 'Jenis Catatan', type: 'select', req: true, noEmpty: true, default: 'OPENING',
        options: [{ v: 'OPENING', l: 'Stok Awal (hasil hitung sekarang)' }, { v: 'IN', l: 'Barang Masuk ke Stok' }, { v: 'ADJUST', l: 'Koreksi (boleh minus)' }] },
      { name: 'entry_date', label: 'Tanggal', type: 'date', req: true, default: today(), half: true },
      { name: 'qty', label: 'Qty (pcs)', type: 'number', req: true, min: -1e9, half: true, help: 'Koreksi boleh diisi negatif, mis. -20.' },
      { name: 'notes', label: 'Catatan', type: 'textarea' }
    ],
    values: row || null,
    onSubmit: async v => {
      if (!v.qty) throw new Error('Qty tidak boleh 0.');
      if (v.kind !== 'ADJUST' && v.qty < 0) throw new Error('Qty harus positif. Gunakan "Koreksi" untuk mengurangi stok.');
      if (!master.item.some(n => sameName(n, v.item_name)) && !(await ask(`Jenis barang "${v.item_name}" belum ada di daftar master. Simpan sebagai barang baru?\n\nYang sudah ada: ${master.item.slice(0, 12).join(', ')}`, 'Ya, Simpan'))) throw new Error('Dibatalkan.');
      await save('stock_ledger', { item_name: v.item_name, specification: v.specification || '', kind: v.kind, entry_date: v.entry_date, qty: v.qty, notes: v.notes }, row?.id);
      toast('Stok tersimpan'); rl();
    }
  });
}

async function loadMaster() {
  let m = [];
  try { m = await q('master_data', [['name', true]]); } catch (e) { /* tabel master belum ada: pakai daftar bawaan */ }
  const pick = k => m.filter(x => x.kind === k).map(x => x.name);
  return { item: [...new Set([...pick('item'), ...ITEM_NAMES])], brand: pick('brand') };
}
const isDisplayItem = n => /display/i.test(n || '');
const sampleOf = p => isDisplayItem(p.item_name) ? Number(p.sample_display || 0) : Number(p.sample_display || 0) * Number(p.isi_per_display || 0);
const reqLimit = p => (p.qty_pi != null ? (Number(p.qty_pi) + sampleOf(p)) * (Number(p.pcs_per_book) || (p.leaves_per_book ? p.leaves_per_book * 2 : 1)) : Number(p.qty_po)) + Number(p.req_extra || 0);
const sameName = (a, b) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

async function poForm(row, rl, pre) {
  const sheet = !!row && row.unit === 'SHEET';
  const master = await loadMaster();
  let stocks = [];
  try { stocks = await q('v_stock', [['item_name', true]]); } catch (e) { /* belum ada */ }
  const stockOf = v => stocks.find(s => sameName(s.item_name, v.item_name || '') && sameName(s.specification || '', v.specification || ''));
  const notStock = v => v.source !== 'STOCK';
  const names = [...new Set([...master.item, ...(poForm.names || [])])];
  openForm({
    title: row ? 'Ubah Item PI' : (pre ? `Tambah Item · PI ${pre.pi_no}` : 'PI / PO Baru'),
    sub: 'Satu PI bisa punya banyak jenis barang (Booklet, Filter Book, Filter Cones, Display, Cover, dll). Isi satu item per jenis barang. Jumlah disimpan dalam PCS.',
    fields: [
      { name: 'pi_no', label: 'PI No', req: true, placeholder: 'mis. 210.07.26.SMB' },
      { name: 'brand', label: 'Brand', req: true, list: master.brand, placeholder: 'pilih atau ketik, mis. SB BROWN + TIPS' },
      { name: 'item_name', label: 'Jenis Barang', req: true, list: names, placeholder: 'pilih atau ketik, mis. Booklet' },
      { name: 'specification', label: 'Spesifikasi Incoming Material', placeholder: 'mis. ukuran / gramasi / warna (boleh kosong)' },
      { name: 'source', label: 'Asal Barang', type: 'select', noEmpty: true, default: 'PI', disabled: !!row,
        options: [{ v: 'PI', l: 'Datang per PI (diterima di Gudang)' }, { v: 'STOCK', l: 'Dari Stok Gudang (tanpa penerimaan)' }],
        help: 'Pilih "Dari Stok Gudang" untuk barang umum yang sudah ada stoknya (mis. magnet, plat, paper).' },
      { name: 'needs_qc', label: 'Perlu QC saat diterima?', type: 'select', noEmpty: true, default: 'Y', showIf: notStock,
        options: [{ v: 'Y', l: 'Ya, lewat QC' }, { v: 'N', l: 'Tidak, langsung dianggap GOOD (barang jadi/pendukung)' }] },
      { name: 'qty_need', label: 'Qty Kebutuhan untuk PI Ini (pcs)', type: 'number', req: true, min: 0.01, showIf: v => v.source === 'STOCK' },
      { name: 'leaves_per_book', label: 'Isi per Filter Book (leaves)', type: 'number', min: 1, req: true, list: ['32', '33', '40', '50', '60'],
        placeholder: 'mis. 32', showIf: v => isFilterBook(v.item_name), help: '1 leaf = 1 pcs kiri + 1 pcs kanan yang dilem. Isi jumlah leaves per 1 filter book jadi.' },
      ...UNIT_FIELDS.map(f => ({ ...f, showIf: v => notStock(v) && (f.showIf ? f.showIf(v) : true) })),
      { name: 'qty_po', label: 'Qty PO (barang masuk dari supplier)', type: 'number', req: true, min: 0.01, u: true, showIf: notStock },
      { name: 'qty_pi', label: 'Qty PI (target barang jadi)', type: 'number', min: 1, half: true, placeholder: 'mis. 1000', showIf: notStock,
        help: 'Jumlah barang jadi sesuai PI (booklet / cones / filter book). Dasar batas request Produksi.' },
      { name: 'isi_per_display', label: 'Isi per Display', type: 'number', min: 1, half: true, default: 25, showIf: v => notStock(v) && !isDisplayItem(v.item_name), help: '25 booklet per display; 24 bila memakai Filter Book.' },
      { name: 'sample_display', label: 'Display untuk Sample', type: 'number', min: 0, half: true, default: 2, showIf: notStock },
      ...(isAdmin() ? [{ name: 'req_extra', label: 'Izin Tambahan Request (pcs, Admin)', type: 'number', min: 0, half: true, default: 0, help: 'Hanya Admin. Tambahan di luar Qty PI + sample, bila Produksi memang perlu lebih.' }] : [])
    ],
    values: row ? { ...row, pps: row.pcs_per_sheet, qty_po: sheet ? row.qty_po_input : row.qty_po, qty_need: row.qty_po, needs_qc: row.needs_qc === false ? 'N' : 'Y' } : (pre || null),
    keepUnit: !!row,
    submit2: row ? null : 'Simpan & Tambah Item Lain di PI Ini',
    onInput: (v, hint) => {
      if (v.source === 'STOCK') {
        const st = stockOf(v), bal = st ? Number(st.balance) : 0, need = v.qty_need || 0;
        return hint(`Stok gudang <b>${esc(v.item_name || '…')}</b> ${esc(v.specification || '')}: <b>${num(bal)}</b> pcs (dipakai bersama semua PI)` +
          (st ? '' : '<br>⚠ Barang ini belum ada di Stok Gudang. Tambahkan stoknya di menu Gudang → Stok Gudang.') +
          (need > bal ? `<br>⚠ Kebutuhan melebihi stok sebanyak ${num(need - bal)} pcs.` : ''), need > bal || !st ? 'warn' : 'info');
      }
      const fb = isFilterBook(v.item_name), L = Number(v.leaves_per_book), k = Number(v.pps);
      let lim = '';
      if (v.qty_pi > 0) {
        const per = fb && L > 0 ? L * 2 : 1, smp = isDisplayItem(v.item_name) ? (v.sample_display || 0) : (v.sample_display || 0) * (v.isi_per_display || 0);
        lim = `<b>Batas request Produksi:</b> (${num(v.qty_pi)} + sample ${num(smp)}) = ${num(v.qty_pi + smp)} ${isDisplayItem(v.item_name) ? 'display' : 'barang jadi'}` + (per > 1 ? ` × ${num(per)} pcs = <b>${num(Math.round((v.qty_pi + smp) * per))} pcs</b>` : '') + ((v.req_extra || 0) > 0 ? ` + izin tambahan ${num(v.req_extra)}` : '');
      } else lim = 'Qty PI belum diisi: batas request Produksi memakai Qty PO.';
      if (!fb) return hint(lim);
      let t = 'Filter Book datang dalam sheet: 1 sheet = kiri + kanan (mis. 45 kiri + 45 kanan = 90 pcs = 45 leaves). Pilih satuan SHEET dan isi per sheet 90. Setelah QC, sheet masuk Diecut.';
      if (v.unit === 'SHEET' && k > 0 && L > 0) {
        const lv = k / 2, bk = Math.floor(lv / L);
        t += `<br>1 sheet (${num(k)} pcs) = ${num(lv)} leaves = ${num(bk)} filter book @${num(L)} leaves, sisa ${num(lv - bk * L)} leaves (digabung ke sheet berikutnya).`;
        if (v.qty_po > 0) t += `<br><b>Estimasi: ${num(v.raw.qty_po)} sheet = ${num(v.qty_po)} pcs = ${num(v.qty_po / 2)} leaves ≈ ${num(Math.floor(v.qty_po / (2 * L)))} filter book @${num(L)} leaves</b>`;
      }
      hint(t + '<br>' + lim);
    },
    onSubmit: async (v, again) => {
      // Nama baru (belum ada di master) ditanyakan dulu supaya salah ketik tidak jadi jenis barang/brand baru
      const fresh = [];
      if (!names.some(n => sameName(n, v.item_name))) fresh.push(['Jenis Barang', v.item_name, master.item]);
      if (!master.brand.some(n => sameName(n, v.brand)) && master.brand.length) fresh.push(['Brand', v.brand, master.brand]);
      for (const [lbl, val, ex] of fresh) {
        if (!(await ask(`${lbl} "${val}" belum ada di daftar master. Simpan sebagai ${lbl.toLowerCase()} baru?\n\nYang sudah ada: ${ex.slice(0, 12).join(', ') || '-'}`, 'Ya, Simpan'))) throw new Error('Dibatalkan. Pilih ' + lbl.toLowerCase() + ' dari daftar atau perbaiki ejaannya.');
      }
      const stk = v.source === 'STOCK';
      await save('po_items', stk ? {
        pi_no: v.pi_no, brand: v.brand, item_name: v.item_name, specification: v.specification || '',
        source: 'STOCK', needs_qc: true, leaves_per_book: null, qty_po: v.qty_need, unit: 'PCS', pcs_per_sheet: null, qty_po_input: null,
        qty_pi: null, isi_per_display: null, sample_display: 2,
        ...(isAdmin() ? { req_extra: v.req_extra || 0 } : {})
      } : {
        source: 'PI', needs_qc: v.needs_qc !== 'N',
        pi_no: v.pi_no, brand: v.brand, item_name: v.item_name, specification: v.specification || '',
        leaves_per_book: isFilterBook(v.item_name) ? v.leaves_per_book : null,
        qty_po: v.qty_po, unit: v.unit, pcs_per_sheet: v.unit === 'SHEET' ? v.pps : null, qty_po_input: v.raw.qty_po,
        qty_pi: v.qty_pi, isi_per_display: isDisplayItem(v.item_name) ? null : v.isi_per_display, sample_display: v.sample_display ?? 2,
        ...(isAdmin() ? { req_extra: v.req_extra || 0 } : {})
      }, row?.id);
      toast(again ? 'Item tersimpan. Isi item berikutnya.' : 'Item PI tersimpan');
      rl();
      if (again) {
        poForm.names = [...new Set([...(poForm.names || []), v.item_name])];
        poForm(null, rl, { pi_no: v.pi_no, brand: v.brand });
        return 'keep';
      }
    }
  });
}

async function receiptForm(row, rl) {
  const pos = groupSort(await q('v_po_summary')).filter(p => p.source !== 'STOCK');
  if (!pos.length) return toast('Buat data PI terlebih dahulu di tab "Data PI".', 'err');
  const by = Object.fromEntries(pos.map(p => [p.id, p]));
  const sheet = !!row && row.unit === 'SHEET';
  openForm({
    title: row ? 'Ubah Penerimaan' : 'Penerimaan Material Baru',
    sub: 'Catat barang masuk berdasarkan Surat Jalan / DO. Bila barang berbentuk sheet, pilih satuan SHEET.',
    fields: [
      { name: 'po_item_id', label: 'PI / Material', type: 'select', req: true, disabled: !!row, options: pos.map(p => ({ v: p.id, l: poLabel(p) })) },
      { name: 'receipt_date', label: 'Tanggal Terima', type: 'date', req: true, default: today(), half: true },
      { name: 'sj_no', label: 'No. SJ / DO', req: true, half: true },
      ...UNIT_FIELDS,
      { name: 'qty_sj', label: 'Qty SJ', type: 'number', req: true, min: 0.01, u: true },
      { name: 'notes', label: 'Catatan', type: 'textarea' }
    ],
    values: row ? { ...row, pps: row.pcs_per_sheet, qty_sj: sheet ? row.qty_input : row.qty_sj } : null,
    keepUnit: !!row,
    unitFrom: v => by[v.po_item_id]?.unit,
    ppsFrom: v => by[v.po_item_id]?.pcs_per_sheet,
    onInput: (v, hint) => {
      const p = by[v.po_item_id];
      if (!p) return hint();
      const used = Number(p.total_incoming) - (row ? Number(row.qty_sj) : 0);
      const sisa = Number(p.qty_po) - used;
      const after = v.qty_sj != null ? sisa - v.qty_sj : null;
      const over = after != null && after < 0;
      hint(`Qty PO <b>${num(p.qty_po)}</b> · Sudah masuk <b>${num(used)}</b> · Sisa PO <b>${num(sisa)}</b> (pcs)` +
        (over ? `<br>⚠ Melebihi sisa PO sebanyak ${num(-after)} pcs (tetap bisa disimpan bila memang kirim lebih).` : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      await save('receipts', {
        po_item_id: v.po_item_id, receipt_date: v.receipt_date, sj_no: v.sj_no, qty_sj: v.qty_sj,
        unit: v.unit, pcs_per_sheet: v.unit === 'SHEET' ? v.pps : null, qty_input: v.raw.qty_sj, notes: v.notes
      }, row?.id);
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
    sub: 'Total Good + NG tidak boleh melebihi Qty SJ. Boleh diisi dalam sheet atau pcs.',
    fields: [
      { name: 'receipt_id', label: 'Surat Jalan yang Dicek', type: 'select', req: true, disabled: !!row,
        options: list.map(r => ({ v: r.id, l: `${poLabel(r)} · SJ ${r.sj_no} (sisa ${num(r.qc_balance)} pcs)` })) },
      { name: 'inspect_date', label: 'Tanggal Cek', type: 'date', req: true, default: today() },
      ...UNIT_FIELDS,
      { name: 'good_qty', label: 'Good Material', type: 'number', default: 0, half: true, u: true },
      { name: 'ng_qty', label: 'NG Material', type: 'number', default: 0, half: true, u: true },
      { name: 'description', label: 'Keterangan / Description', type: 'textarea', help: 'Wajib diisi bila ada NG (jenis & penyebab).' }
    ],
    values: row ? { ...row, unit: 'PCS', pps: null } : { receipt_id: pre?.id },
    keepUnit: !!row,
    unitFrom: v => by[v.receipt_id]?.unit,
    ppsFrom: v => by[v.receipt_id]?.pcs_per_sheet,
    onInput: (v, hint) => {
      const r = by[v.receipt_id];
      if (!r) return hint();
      const sisa = Number(r.qc_balance) + own;
      const tot = (v.good_qty || 0) + (v.ng_qty || 0);
      const over = tot > sisa;
      hint(`Qty SJ <b>${num(r.qty_sj)}</b> · Sisa belum dicek <b>${num(sisa)}</b> · Input ini <b>${num(tot)}</b> (pcs)` +
        (r.unit === 'SHEET' ? `<br>SJ ini diterima dalam sheet (${num(r.qty_input)} sheet × ${num(r.pcs_per_sheet)} pcs).` : '') +
        (over ? `<br>⚠ Melebihi sisa SJ sebanyak ${num(tot - sisa)} pcs.` : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      const r = by[v.receipt_id];
      const good = v.good_qty || 0, ng = v.ng_qty || 0;
      if (good + ng <= 0) throw new Error('Isi qty Good atau NG.');
      if (good + ng > Number(r.qc_balance) + own) throw new Error(`Total Good + NG melebihi sisa SJ (${num(Number(r.qc_balance) + own)} pcs).`);
      if (ng > 0 && !v.description) throw new Error('Keterangan wajib diisi karena ada NG.');
      await save('qc_inspections', { receipt_id: v.receipt_id, inspect_date: v.inspect_date, good_qty: good, ng_qty: ng, description: v.description }, row?.id);
      toast('Hasil QC tersimpan'); rl();
    }
  });
}

/* ---------- Request material (Produksi -> Supply) ---------- */
const reqStatus = r => r.closed ? '<span class="pill gray">Ditutup</span>'
  : Number(r.outstanding) <= 0 ? '<span class="pill ok">Terpenuhi</span>'
  : Number(r.qty_sent) > 0 ? `<span class="pill warn">Sebagian · sisa ${num(r.outstanding)}</span>` : '<span class="pill warn">Menunggu Supply</span>';

async function requestForm(row, pre, rl) {
  const [pos, quota] = await Promise.all([q('v_po_summary', [['pi_no', true]]), q('v_po_req', [['po_item_id', true]], 'po_item_id')]);
  const qm = Object.fromEntries(quota.map(x => [x.po_item_id, x]));
  const list = groupSort(pos).filter(p => row ? p.id === row.po_item_id : Number(qm[p.id]?.req_available) > 0 || (pre && p.id === pre.po_item_id));
  if (!list.length) return toast('Semua item PI sudah direquest penuh sesuai Qty PI.', 'err');
  const by = Object.fromEntries(list.map(p => [p.id, p]));
  const own = row ? (row.closed ? Number(row.qty_sent) : Math.max(Number(row.qty_requested), Number(row.qty_sent))) : 0;
  openForm({
    title: row ? 'Ubah Request Material' : 'Request Material ke Supply',
    sub: 'Boleh diminta bertahap (partial), tetapi total request tidak boleh melebihi Qty PI + display sample.',
    fields: [
      { name: 'po_item_id', label: 'PI / Material', type: 'select', req: true, disabled: !!row,
        options: list.map(p => ({ v: p.id, l: `${poLabel(p)} (boleh diminta ${num(Number(qm[p.id]?.req_available || 0))} pcs)` })) },
      { name: 'request_date', label: 'Tanggal Request', type: 'date', req: true, default: today() },
      ...UNIT_FIELDS,
      { name: 'qty_requested', label: 'Qty Request', type: 'number', req: true, min: 0.01, u: true },
      ...(row ? [{ name: 'closed', label: 'Status Request', type: 'select', req: true,
        options: [{ v: 'N', l: 'Masih berjalan' }, { v: 'Y', l: 'Tutup – sisa yang belum terkirim tidak dikejar lagi' }] }] : []),
      { name: 'notes', label: 'Catatan', type: 'textarea' }
    ],
    values: row ? { ...row, unit: 'PCS', pps: null, closed: row.closed ? 'Y' : 'N' } : { po_item_id: pre?.po_item_id },
    keepUnit: !!row,
    unitFrom: v => by[v.po_item_id]?.unit,
    ppsFrom: v => by[v.po_item_id]?.pcs_per_sheet,
    onInput: (v, hint) => {
      const p = by[v.po_item_id];
      if (!p) return hint();
      const avail = Number(qm[p.id]?.req_available || 0) + own;
      const over = v.qty_requested != null && v.qty_requested > avail;
      hint(`Batas request (Qty PI + sample) <b>${num(Number(qm[p.id]?.req_limit))}</b> · Sudah diminta <b>${num(Number(qm[p.id]?.req_limit) - avail)}</b> · Masih boleh diminta <b>${num(avail)}</b> (pcs)` +
        (over ? `<br>⚠ Melebihi batas Qty PI + sample sebanyak ${num(v.qty_requested - avail)} pcs. Hubungi Admin bila perlu tambahan.` : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      const p = by[v.po_item_id];
      const avail = Number(qm[p.id]?.req_available || 0) + own;
      if (!(v.closed === 'Y') && v.qty_requested > avail) throw new Error(`Request melebihi batas Qty PI + sample. Masih boleh diminta ${num(avail)} pcs. Hubungi Admin bila perlu tambahan.`);
      await save('material_requests', { po_item_id: v.po_item_id, request_date: v.request_date, qty_requested: v.qty_requested, closed: v.closed === 'Y', notes: v.notes }, row?.id);
      toast('Request tersimpan'); rl();
    }
  });
}

async function issueFromRequest(pre, rl) {
  const [reqs, pos] = await Promise.all([q('v_requests', [['request_date', true], ['created_at', true]]), q('v_po_summary')]);
  const pm = Object.fromEntries(pos.map(p => [p.id, p]));
  const list = reqs.filter(x => Number(x.outstanding) > 0 || (pre && x.id === pre.id));
  if (!list.length) return toast('Belum ada request dari Produksi yang menunggu dikirim.', 'err');
  const by = Object.fromEntries(list.map(x => [x.id, x]));
  openForm({
    title: 'Kirim Material ke Produksi',
    sub: 'Pilih request dari Produksi. Boleh dikirim sebagian; sisanya tetap menunggu. Hanya material GOOD yang bisa dikirim.',
    fields: [
      { name: 'request_id', label: 'Request Produksi', type: 'select', req: true,
        options: list.map(x => ({ v: x.id, l: `${poLabel(x)} · minta ${dt(x.request_date)} (sisa ${num(x.outstanding)} pcs)` })) },
      ...UNIT_FIELDS,
      { name: 'qty_sent', label: 'Qty Dikirim', type: 'number', req: true, min: 0.01, u: true },
      { name: 'notes', label: 'Catatan', type: 'textarea' }
    ],
    values: { request_id: pre?.id },
    unitFrom: v => by[v.request_id]?.unit,
    ppsFrom: v => by[v.request_id]?.pcs_per_sheet,
    onInput: (v, hint) => {
      const x = by[v.request_id];
      if (!x) return hint();
      const stok = Number(pm[x.po_item_id]?.stock_ready || 0), sisa = Number(x.outstanding);
      const s = v.qty_sent || 0;
      const overReq = s > sisa, overStok = s > stok;
      hint(`Request <b>${num(x.qty_requested)}</b> · Sudah dikirim <b>${num(x.qty_sent)}</b> · Sisa request <b>${num(sisa)}</b> · Stok GOOD <b>${num(stok)}</b> (pcs)` +
        (overReq ? '<br>⚠ Melebihi sisa request.' : '') + (overStok ? `<br>⚠ Melebihi stok GOOD sebanyak ${num(s - stok)} pcs.` : '') +
        (s > 0 && !overReq ? `<br>Setelah dikirim, sisa request <b>${num(sisa - s)}</b> pcs.` : ''), overReq || overStok ? 'warn' : 'info');
    },
    onSubmit: async v => {
      const x = by[v.request_id], stok = Number(pm[x.po_item_id]?.stock_ready || 0);
      if (v.qty_sent > Number(x.outstanding)) throw new Error(`Qty kirim melebihi sisa request (${num(x.outstanding)} pcs).`);
      if (v.qty_sent > stok) throw new Error(`Qty kirim melebihi stok GOOD (${num(stok)} pcs).`);
      await save('supply_issues', { po_item_id: x.po_item_id, request_id: x.id, request_date: x.request_date, qty_sent: v.qty_sent, notes: v.notes });
      toast('Pengiriman tersimpan'); rl();
    }
  });
}

async function issueForm(row, rl) {
  if (!row) return issueFromRequest(null, rl);
  const pos = groupSort(await q('v_po_summary'));
  const list = row ? pos.filter(p => p.id === row.po_item_id) : pos.filter(p => Number(p.stock_ready) > 0);
  if (!list.length) return toast('Belum ada material GOOD yang siap dikirim. Selesaikan QC (barang sheet: Diecut dan QC ulang) terlebih dahulu.', 'err');
  const by = Object.fromEntries(list.map(p => [p.id, p]));
  openForm({
    title: row ? 'Ubah Pengiriman Material' : 'Kirim Material ke Produksi',
    sub: 'Hanya material berstatus GOOD dari QC yang bisa dikirim. Boleh diisi dalam sheet atau pcs.',
    fields: [
      { name: 'po_item_id', label: 'PI / Material', type: 'select', req: true, disabled: !!row,
        options: list.map(p => ({ v: p.id, l: `${poLabel(p)} (stok ${num(p.stock_ready)} pcs)` })) },
      ...UNIT_FIELDS,
      { name: 'request_date', label: 'Tanggal Request Material', type: 'date', req: true, default: today(), half: true },
      { name: 'qty_sent', label: 'Qty Dikirim', type: 'number', req: true, min: 0.01, half: true, u: true },
      { name: 'notes', label: 'Catatan', type: 'textarea' }
    ],
    values: row ? { ...row, unit: 'PCS', pps: null } : null,
    keepUnit: !!row,
    unitFrom: v => by[v.po_item_id]?.unit,
    ppsFrom: v => by[v.po_item_id]?.pcs_per_sheet,
    onInput: (v, hint) => {
      const p = by[v.po_item_id];
      if (!p) return hint();
      const stok = Number(p.stock_ready) + (row ? Number(row.qty_sent) : 0);
      const over = v.qty_sent != null && v.qty_sent > stok;
      hint(`Stok GOOD siap kirim: <b>${num(stok)}</b> pcs` + (over ? `<br>⚠ Qty melebihi stok sebanyak ${num(v.qty_sent - stok)} pcs.` : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      const p = by[v.po_item_id];
      const stok = Number(p.stock_ready) + (row ? Number(row.qty_sent) : 0);
      if (v.qty_sent > stok) throw new Error(`Qty kirim melebihi stok GOOD (${num(stok)} pcs).`);
      if (row && v.qty_sent < Number(row.returned_qty)) throw new Error(`Qty kirim tidak boleh di bawah qty retur (${num(row.returned_qty)} pcs).`);
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
  const po = Object.fromEntries((await q('v_po_summary')).map(p => [p.id, p]));
  const own = row ? Number(row.qty_return) : 0;
  const bySupply = can('supply');
  openForm({
    title: row ? 'Ubah Retur' : 'Retur Material dari Produksi',
    fields: [
      { name: 'issue_id', label: 'Pengiriman', type: 'select', req: true, disabled: !!row,
        options: list.map(i => ({ v: i.id, l: `${poLabel(i)} · kirim ${dt(i.request_date)} (sisa ${num(i.balance)} pcs)` })) },
      ...UNIT_FIELDS,
      { name: 'return_date', label: 'Tanggal Retur', type: 'date', req: true, default: today(), half: true },
      { name: 'qty_return', label: 'Qty Retur', type: 'number', req: true, min: 0.01, half: true, u: true },
      { name: 'kondisi', label: 'Kondisi Barang Retur', type: 'select', req: true,
        options: [{ v: 'GOOD', l: 'Masih bagus – kembali ke stok siap kirim' }, { v: 'NG', l: 'Rusak / NG – tidak kembali ke stok' }] },
      ...(row ? [] : [{ name: 'ganti', label: bySupply ? 'Kirim Pengganti Sekarang?' : 'Minta Barang Pengganti?', type: 'select', req: true,
        options: [{ v: 'N', l: 'Tidak' }, { v: 'Y', l: bySupply ? 'Ya – kirim barang pengganti sebanyak qty retur' : 'Ya – buat request pengganti ke Supply sebanyak qty retur' }] }]),
      { name: 'notes', label: 'Catatan / Alasan', type: 'textarea' }
    ],
    values: row ? { ...row, unit: 'PCS', pps: null } : { issue_id: pre?.id, kondisi: 'NG', ganti: 'N' },
    keepUnit: !!row,
    unitFrom: v => by[v.issue_id]?.unit,
    ppsFrom: v => by[v.issue_id]?.pcs_per_sheet,
    onInput: (v, hint) => {
      const i = by[v.issue_id];
      if (!i) return hint();
      const sisa = Number(i.balance) + own;
      const over = v.qty_return != null && v.qty_return > sisa;
      const stokAwal = Number(po[i.po_item_id]?.stock_ready || 0), q = v.qty_return || 0;
      const stokBaru = stokAwal + (v.kondisi === 'GOOD' ? q : 0);
      const gantiOver = bySupply && v.ganti === 'Y' && q > stokBaru;
      hint(`Dikirim <b>${num(i.qty_sent)}</b> · Sisa di produksi <b>${num(sisa)}</b> (pcs)` + (over ? '<br>⚠ Qty retur melebihi sisa di produksi.' : '') +
        (v.ganti === 'Y' && !bySupply ? `<br>Request pengganti <b>${num(q)}</b> pcs akan dibuat otomatis untuk Supply.` : '') +
        (v.ganti === 'Y' && bySupply ? `<br>Stok siap kirim setelah retur: <b>${num(stokBaru)}</b> pcs · pengganti <b>${num(q)}</b> pcs` + (gantiOver ? '<br>⚠ Stok Good tidak cukup untuk pengganti.' : '') : ''), over || gantiOver ? 'warn' : 'info');
    },
    onSubmit: async v => {
      const i = by[v.issue_id];
      if (v.qty_return > Number(i.balance) + own) throw new Error('Qty retur melebihi sisa material di produksi.');
      if (v.return_date < i.request_date) throw new Error('Tanggal retur tidak boleh sebelum tanggal request.');
      const saved = await save('supply_returns', { issue_id: v.issue_id, return_date: v.return_date, qty_return: v.qty_return, kondisi: v.kondisi, notes: v.notes }, row?.id);
      if (!row && v.ganti === 'Y' && !bySupply) {
        try {
          await save('material_requests', { po_item_id: i.po_item_id, request_date: v.return_date, qty_requested: v.qty_return, notes: 'Pengganti barang retur' + (v.notes ? ': ' + v.notes : '') });
        } catch (e) {
          await sb.from('supply_returns').delete().eq('id', saved.id);
          throw new Error('Retur dibatalkan karena request pengganti gagal: ' + errMsg(e));
        }
        toast('Retur tersimpan dan request pengganti sudah dikirim ke Supply'); return rl();
      }
      if (!row && v.ganti === 'Y') {
        try {
          await save('supply_issues', { po_item_id: i.po_item_id, request_date: v.return_date, qty_sent: v.qty_return, notes: 'Pengganti retur' + (v.notes ? ': ' + v.notes : '') });
        } catch (e) {
          await sb.from('supply_returns').delete().eq('id', saved.id);   // batalkan retur agar tidak setengah tersimpan
          throw new Error('Retur dibatalkan karena pengganti gagal dikirim: ' + errMsg(e));
        }
        toast('Retur tersimpan dan pengganti sudah dikirim'); return rl();
      }
      toast('Retur tersimpan'); rl();
    }
  });
}

async function fgForm(row, rl) {
  const pos = groupSort(await q('v_po_summary'));
  const list = row ? pos.filter(p => p.id === row.po_item_id) : pos.filter(p => p.source !== 'STOCK' && Number(p.supplied_total) > 0);
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
      { name: 'booklet_cones', label: 'Booklet / Cones / Filter Book (jadi)', type: 'number', default: 0 },
      { name: 'notes', label: 'Catatan', type: 'textarea' }
    ],
    values: row,
    onInput: (v, hint) => {
      const p = by[v.po_item_id];
      if (!p) return hint();
      const per = Number(p.pcs_per_book) || 1, lv = Number(p.leaves_per_book) || 0;
      const doneBooks = Number(p.fg_booklet) - (row ? Number(row.booklet_cones) : 0);
      const sisa = Number(p.at_production) - doneBooks * per;
      const need = (v.booklet_cones || 0) * per;
      const over = need > sisa;
      hint(lv > 0
        ? `Filter Book isi <b>${num(lv)}</b> leaves (= ${num(per)} pcs kiri + kanan) · Material di produksi <b>${num(p.at_production)}</b> pcs · Terpakai <b>${num(doneBooks * per)}</b> pcs (${num(doneBooks)} buku jadi) · Sisa <b>${num(sisa)}</b> pcs = ${num(sisa / 2)} leaves ≈ ${num(Math.floor(sisa / per))} buku` +
          (need > 0 ? `<br>Input ini ${num(v.booklet_cones)} buku = ${num(need)} pcs (${num(need / 2)} leaves)` : '') +
          (over ? '<br>⚠ Melebihi material yang ada di produksi — periksa kembali.' : '')
        : `Material di produksi <b>${num(p.at_production)}</b> · Booklet/Cones jadi <b>${num(doneBooks)}</b> · Sisa <b>${num(sisa)}</b>` +
          (over ? '<br>⚠ Booklet/Cones melebihi material yang ada di produksi — periksa kembali.' : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      if ((v.karton || 0) + (v.display || 0) + (v.booklet_cones || 0) <= 0) throw new Error('Isi minimal salah satu: Karton, Display, atau Booklet/Cones.');
      await save('fg_receipts', { po_item_id: v.po_item_id, received_date: v.received_date, karton: v.karton || 0, display: v.display || 0, booklet_cones: v.booklet_cones || 0, notes: v.notes }, row?.id);
      toast('Finish Good tersimpan'); rl();
    }
  });
}

const shn = (pcs, r) => Number(r.pcs_per_sheet) > 0 ? Math.round(Number(pcs) / Number(r.pcs_per_sheet) * 100) / 100 : 0;

async function diecutForm(row, pre, rl) {
  const recs = await q('v_receipts', [['receipt_date', true], ['created_at', true]]);
  const list = row ? recs.filter(r => r.id === row.receipt_id)
    : recs.filter(r => r.unit === 'SHEET' && (Number(r.dc_waiting) > 0 || (pre && r.id === pre.id)));
  if (!list.length) return toast('Belum ada barang sheet yang lolos QC dan menunggu diecut.', 'err');
  const by = Object.fromEntries(list.map(r => [r.id, r]));
  const ownIn = row ? Number(row.qty_in) : 0;
  openForm({
    title: row ? 'Ubah Proses Diecut' : 'Proses Diecut',
    sub: 'Sheet yang lolos QC incoming diubah menjadi pcs. Hasil pcs kemudian dicek QC ulang.',
    fields: [
      { name: 'receipt_id', label: 'Surat Jalan (sheet)', type: 'select', req: true, disabled: !!row,
        options: list.map(r => ({ v: r.id, l: `${poLabel(r)} · SJ ${r.sj_no} (sisa ${num(shn(r.dc_waiting, r))} sheet)` })) },
      { name: 'job_date', label: 'Tanggal Diecut', type: 'date', req: true, default: today() },
      { name: 'sheets_in', label: 'Jumlah Sheet Didiecut', type: 'number', req: true, min: 0.01, half: true },
      { name: 'qty_out', label: 'Hasil Diecut (pcs)', type: 'number', min: 0.01, half: true, help: 'Kosongkan bila hasil sesuai hitungan teori.' },
      { name: 'notes', label: 'Catatan', type: 'textarea' }
    ],
    values: row || { receipt_id: pre?.id },
    onInput: (v, hint) => {
      const r = by[v.receipt_id];
      if (!r) return hint();
      const k = Number(r.pcs_per_sheet);
      const sisa = Number(r.dc_waiting) + ownIn;
      const teori = v.sheets_in != null ? Math.round(v.sheets_in * k * 100) / 100 : null;
      const over = teori != null && teori > sisa + 1e-6;
      hint(`Good QC siap diecut: <b>${num(shn(sisa, r))}</b> sheet (= ${num(sisa)} pcs, isi ${num(k)} pcs per sheet)` +
        (teori != null ? `<br>${num(v.sheets_in)} sheet → teori <b>${num(teori)}</b> pcs` + (r.leaves_per_book ? ` = ${num(teori / 2)} leaves ≈ <b>${num(Math.floor(teori / (2 * Number(r.leaves_per_book))))} filter book</b> @${num(r.leaves_per_book)} leaves` : '') : '') +
        (over ? '<br>⚠ Melebihi Good QC yang belum didiecut.' : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      const r = by[v.receipt_id];
      const qin = Math.round(v.sheets_in * Number(r.pcs_per_sheet) * 100) / 100;
      const sisa = Number(r.dc_waiting) + ownIn;
      if (qin > sisa + 1e-6) throw new Error(`Sheet melebihi Good QC yang belum didiecut (${num(shn(sisa, r))} sheet).`);
      const out = v.qty_out != null ? v.qty_out : qin;
      await save('diecut_jobs', { receipt_id: v.receipt_id, job_date: v.job_date, sheets_in: v.sheets_in, qty_in: qin, qty_out: out, notes: v.notes }, row?.id);
      toast('Proses diecut tersimpan'); rl();
    }
  });
}

async function qc2Form(row, pre, rl) {
  const jobs = await q('v_diecut_jobs', [['job_date', false], ['created_at', false]]);
  const list = row ? jobs.filter(j => j.id === row.diecut_id) : jobs.filter(j => Number(j.qc2_balance) > 0 || (pre && j.id === pre.id));
  if (!list.length) return toast('Tidak ada hasil diecut yang menunggu QC ulang.', 'err');
  const by = Object.fromEntries(list.map(j => [j.id, j]));
  const own = row ? Number(row.good_qty) + Number(row.ng_qty) : 0;
  openForm({
    title: row ? 'Ubah QC Ulang' : 'Input QC Ulang (setelah Diecut)',
    sub: 'Periksa hasil diecut dalam pcs. Total Good + NG tidak boleh melebihi hasil diecut.',
    fields: [
      { name: 'diecut_id', label: 'Hasil Diecut yang Dicek', type: 'select', req: true, disabled: !!row,
        options: list.map(j => ({ v: j.id, l: `${poLabel(j)} · SJ ${j.sj_no} · diecut ${dt(j.job_date)} (sisa ${num(j.qc2_balance)} pcs)` })) },
      { name: 'inspect_date', label: 'Tanggal Cek', type: 'date', req: true, default: today() },
      { name: 'good_qty', label: 'Good (pcs)', type: 'number', default: 0, half: true },
      { name: 'ng_qty', label: 'NG (pcs)', type: 'number', default: 0, half: true },
      { name: 'description', label: 'Keterangan / Description', type: 'textarea', help: 'Wajib diisi bila ada NG (jenis & penyebab).' }
    ],
    values: row || { diecut_id: pre?.id },
    onInput: (v, hint) => {
      const j = by[v.diecut_id];
      if (!j) return hint();
      const sisa = Number(j.qc2_balance) + own;
      const g = v.good_qty || 0, tot = g + (v.ng_qty || 0);
      const over = tot > sisa;
      hint(`Hasil diecut <b>${num(j.qty_out)}</b> pcs · Sisa belum dicek <b>${num(sisa)}</b> · Input ini <b>${num(tot)}</b> pcs` +
        (j.leaves_per_book && g > 0 ? `<br>Good ${num(g)} pcs = ${num(g / 2)} leaves (1 leaf = 1 kiri + 1 kanan)` : '') +
        (over ? `<br>⚠ Melebihi sisa hasil diecut sebanyak ${num(tot - sisa)} pcs.` : ''), over ? 'warn' : 'info');
    },
    onSubmit: async v => {
      const j = by[v.diecut_id];
      const good = v.good_qty || 0, ng = v.ng_qty || 0;
      if (good + ng <= 0) throw new Error('Isi qty Good atau NG.');
      if (good + ng > Number(j.qc2_balance) + own) throw new Error(`Total Good + NG melebihi sisa hasil diecut (${num(Number(j.qc2_balance) + own)} pcs).`);
      if (ng > 0 && !v.description) throw new Error('Keterangan wajib diisi karena ada NG.');
      await save('qc2_inspections', { diecut_id: v.diecut_id, inspect_date: v.inspect_date, good_qty: good, ng_qty: ng, description: v.description }, row?.id);
      toast('QC ulang tersimpan'); rl();
    }
  });
}

/* =====================================================================
   HALAMAN
   ===================================================================== */
const qcStatus = r => Number(r.qc_balance) <= 0 ? '<span class="pill ok">Selesai</span>'
  : (Number(r.good_qty) + Number(r.ng_qty) > 0 ? `<span class="pill warn">Sisa ${num(r.qc_balance)}</span>` : '<span class="pill gray">Belum QC</span>');

const dcStatus = r => r.unit !== 'SHEET' ? '<span class="mut">–</span>'
  : (Number(r.dc_waiting) > 0 && Number(r.good_qty) > 0 ? '<span class="pill warn">Menunggu Diecut</span>'
  : Number(r.qc2_waiting) > 0 ? '<span class="pill warn">Menunggu QC Ulang</span>'
  : Number(r.dc_qty_in) > 0 ? '<span class="pill ok">Selesai</span>' : '<span class="pill gray">Belum</span>');

const DEFS = {
  gudang: () => ({
    id: 'gudang', title: 'Gudang · Incoming Material',
    sub: 'Catat PI/PO dan penerimaan barang dari supplier berdasarkan Surat Jalan / DO. Semua jumlah dalam PCS; barang berbentuk sheet dikonversi otomatis (sheet × isi per sheet).',
    segments: [
      {
        id: 'sj', label: 'Penerimaan SJ',
        load: async () => (await q('v_receipts', [['receipt_date', false], ['created_at', false]]))
          .map(r => ({ ...r, sj_input: fmtIn(r.unit, r.qty_input, r.pcs_per_sheet) })),
        cols: [
          { label: 'Tanggal', k: 'receipt_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' },
          { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' }, { label: 'Spesifikasi', k: 'specification' },
          { label: 'Qty PO', k: 'qty_po', t: 'n', cls: 'num' }, { label: 'No. SJ / DO', k: 'sj_no' },
          { label: 'Satuan SJ', k: 'sj_input' }, { label: 'Qty SJ (pcs)', k: 'qty_sj', t: 'n', cls: 'num' }, { label: 'Status QC', f: qcStatus }
        ],
        add: { label: 'Penerimaan Baru', stage: 'gudang', run: rl => receiptForm(null, rl) },
        acts: stdActs('receipts', 'gudang', (r, rl) => receiptForm(r, rl))
      },
      {
        id: 'po', label: 'Data PI',
        load: async () => {
          const rows = groupSort(await q('v_po_summary'));
          poForm.names = [...new Set(rows.map(p => p.item_name).filter(Boolean))];
          return rows.map(p => ({ ...p, po_input: fmtIn(p.unit, p.qty_po_input, p.pcs_per_sheet), lpb_text: p.leaves_per_book ? `${num(p.leaves_per_book)} leaves` : '', req_limit: reqLimit(p) }));
        },
        cols: [
          { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' }, { label: 'Spesifikasi', k: 'specification' },
          { label: 'Asal', f: p => p.source === 'STOCK' ? '<span class="pill gray">Stok Gudang</span>' : (p.needs_qc === false ? '<span class="pill gray">Tanpa QC</span>' : '<span class="mut">Per PI</span>') }, { label: 'Satuan PO', k: 'po_input' }, { label: 'Isi Filter Book', k: 'lpb_text' }, { label: 'Qty PO (pcs)', k: 'qty_po', t: 'n', cls: 'num' }, { label: 'Qty PI', k: 'qty_pi', t: 'n', cls: 'num' }, { label: 'Batas Request (pcs)', k: 'req_limit', t: 'n', cls: 'num' }, { label: 'Total Incoming', k: 'total_incoming', t: 'n', cls: 'num' },
          { label: 'Balance', k: 'balance_po', t: 'b', cls: 'num' }
        ],
        add: { label: 'PI / Item Baru', stage: 'gudang', run: rl => poForm(null, rl) },
        acts: r => (can('gudang') ? [{ key: 'item', label: '+ Item', icon: 'plus', text: true, run: rl => poForm(null, rl, { pi_no: r.pi_no, brand: r.brand }) }] : [])
          .concat(stdActs('po_items', 'gudang', (x, rl) => poForm(x, rl))(r))
      },
      {
        id: 'stok', label: 'Stok Gudang',
        load: () => q('v_stock', [['item_name', true]]),
        cols: [
          { label: 'Jenis Barang', k: 'item_name', cls: 'strong' }, { label: 'Spesifikasi', k: 'specification' },
          { label: 'Total Masuk / Stok Awal', k: 'stock_in', t: 'n', cls: 'num' }, { label: 'Dikirim ke Produksi', k: 'stock_out', t: 'n', cls: 'num' },
          { label: 'Kebutuhan PI (total)', k: 'need_total', t: 'n', cls: 'num' }, { label: 'Saldo Stok', k: 'balance', t: 'b', cls: 'num' }
        ],
        add: { label: 'Tambah Stok', stage: 'gudang', run: rl => stockForm(null, rl) },
        acts: () => []
      },
      {
        id: 'stokrw', label: 'Riwayat Stok',
        load: () => q('stock_ledger', [['entry_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tanggal', k: 'entry_date', t: 'd' }, { label: 'Jenis Barang', k: 'item_name', cls: 'strong' }, { label: 'Spesifikasi', k: 'specification' },
          { label: 'Jenis', f: r => ({ OPENING: 'Stok Awal', IN: 'Barang Masuk', ADJUST: 'Koreksi' }[r.kind] || r.kind) },
          { label: 'Qty', k: 'qty', t: 'n', cls: 'num' }, { label: 'Catatan', k: 'notes' }
        ],
        add: { label: 'Tambah Stok', stage: 'gudang', run: rl => stockForm(null, rl) },
        acts: stdActs('stock_ledger', 'gudang', (r, rl) => stockForm(r, rl))
      }
    ]
  }),

  qc: () => ({
    id: 'qc', title: 'QC · Pengecekan',
    sub: 'QC incoming: pisahkan Good dan NG. Barang sheet lanjut ke Diecut, lalu dicek lagi di QC ulang setelah jadi pcs.',
    segments: [
      {
        id: 'wait', label: 'Menunggu QC',
        load: async () => (await q('v_receipts', [['receipt_date', true], ['created_at', true]])).filter(r => Number(r.qc_balance) > 0),
        cols: [
          { label: 'Tgl Terima', k: 'receipt_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
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
          { label: 'Tgl Cek', k: 'inspect_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'No. SJ / DO', k: 'sj_no' }, { label: 'Qty SJ', k: 'qty_sj', t: 'n', cls: 'num' },
          { label: 'Good', k: 'good_qty', t: 'n', cls: 'num' }, { label: 'NG', k: 'ng_qty', t: 'n', cls: 'num' },
          { label: 'Keterangan', k: 'description' }
        ],
        acts: stdActs('qc_inspections', 'qc', (r, rl) => qcForm(r, null, rl))
      },
      {
        id: 'wait2', label: 'Menunggu QC Ulang',
        load: async () => (await q('v_diecut_jobs', [['job_date', true], ['created_at', true]])).filter(j => Number(j.qc2_balance) > 0),
        cols: [
          { label: 'Tgl Diecut', k: 'job_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'No. SJ / DO', k: 'sj_no' }, { label: 'Hasil Diecut (pcs)', k: 'qty_out', t: 'n', cls: 'num' },
          { label: 'Good', k: 'qc2_good', t: 'n', cls: 'num' }, { label: 'NG', k: 'qc2_ng', t: 'n', cls: 'num' },
          { label: 'Sisa Dicek', k: 'qc2_balance', t: 'b', cls: 'num' }
        ],
        acts: j => can('qc') ? [{ key: 'qc2', label: 'Input QC Ulang', icon: 'check', text: true, cls: 'primary', run: rl => qc2Form(null, j, rl) }] : []
      },
      {
        id: 'hist2', label: 'Riwayat QC Ulang',
        load: () => q('v_qc2_inspections', [['inspect_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Cek', k: 'inspect_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'No. SJ / DO', k: 'sj_no' }, { label: 'Hasil Diecut (pcs)', k: 'qty_out', t: 'n', cls: 'num' },
          { label: 'Good', k: 'good_qty', t: 'n', cls: 'num' }, { label: 'NG', k: 'ng_qty', t: 'n', cls: 'num' },
          { label: 'Keterangan', k: 'description' }
        ],
        add: { label: 'Input QC Ulang', stage: 'qc', run: rl => qc2Form(null, null, rl) },
        acts: stdActs('qc2_inspections', 'qc', (r, rl) => qc2Form(r, null, rl))
      },
      {
        id: 'all', label: 'Semua SJ',
        load: () => q('v_receipts', [['receipt_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Terima', k: 'receipt_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'No. SJ / DO', k: 'sj_no' }, { label: 'Qty SJ', k: 'qty_sj', t: 'n', cls: 'num' },
          { label: 'Good', k: 'good_qty', t: 'n', cls: 'num' }, { label: 'NG', k: 'ng_qty', t: 'n', cls: 'num' },
          { label: 'Status', f: qcStatus }, { label: 'Diecut', f: dcStatus }
        ],
        acts: () => []
      }
    ]
  }),

  diecut: () => ({
    id: 'diecut', title: 'Diecut · Sheet menjadi PCS',
    sub: 'Barang berbentuk sheet yang sudah lolos QC incoming diproses diecut menjadi pcs, lalu dicek QC ulang oleh Leader QC.',
    segments: [
      {
        id: 'wait', label: 'Menunggu Diecut',
        load: async () => (await q('v_receipts', [['receipt_date', true], ['created_at', true]]))
          .filter(r => r.unit === 'SHEET' && Number(r.dc_waiting) > 0)
          .map(r => ({ ...r, good_sheet: shn(r.good_qty, r), done_sheet: Number(r.dc_sheets), wait_sheet: shn(r.dc_waiting, r) })),
        cols: [
          { label: 'Tgl Terima', k: 'receipt_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'No. SJ / DO', k: 'sj_no' }, { label: 'Good QC (sheet)', k: 'good_sheet', t: 'n', cls: 'num' },
          { label: 'Sudah Diecut (sheet)', k: 'done_sheet', t: 'n', cls: 'num' }, { label: 'Sisa Diecut (sheet)', k: 'wait_sheet', t: 'b', cls: 'num' }
        ],
        acts: r => can('diecut') ? [{ key: 'dc', label: 'Proses Diecut', icon: 'cut', text: true, cls: 'primary', run: rl => diecutForm(null, r, rl) }] : []
      },
      {
        id: 'hist', label: 'Riwayat Diecut',
        load: () => q('v_diecut_jobs', [['job_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Diecut', k: 'job_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'No. SJ / DO', k: 'sj_no' }, { label: 'Sheet Didiecut', k: 'sheets_in', t: 'n', cls: 'num' },
          { label: 'Hasil (pcs)', k: 'qty_out', t: 'n', cls: 'num' }, { label: 'QC Ulang Good', k: 'qc2_good', t: 'n', cls: 'num' },
          { label: 'QC Ulang NG', k: 'qc2_ng', t: 'n', cls: 'num' }, { label: 'Sisa QC Ulang', k: 'qc2_balance', t: 'b', cls: 'num' }
        ],
        add: { label: 'Proses Diecut', stage: 'diecut', run: rl => diecutForm(null, null, rl) },
        acts: stdActs('diecut_jobs', 'diecut', (r, rl) => diecutForm(r, null, rl))
      }
    ]
  }),

  supply: () => ({
    id: 'supply', title: 'Supply Material · Ke Produksi',
    sub: 'Catat material GOOD yang diminta produksi, serta retur bila ada sisa. Barang sheet baru bisa dikirim setelah Diecut dan QC ulang.',
    segments: [
      {
        id: 'reqin', label: 'Request Masuk',
        load: async () => (await q('v_requests', [['request_date', true], ['created_at', true]])).filter(x => Number(x.outstanding) > 0),
        cols: [
          { label: 'Tgl Request', k: 'request_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'Qty Request', k: 'qty_requested', t: 'n', cls: 'num' }, { label: 'Sudah Dikirim', k: 'qty_sent', t: 'n', cls: 'num' },
          { label: 'Sisa Dikirim', k: 'outstanding', t: 'b', cls: 'num' }, { label: 'Status', f: reqStatus }, { label: 'Catatan', k: 'notes' }
        ],
        acts: r => can('supply') ? [{ key: 'send', label: 'Kirim', icon: 'truck', text: true, cls: 'primary', run: rl => issueFromRequest(r, rl) }] : []
      },
      {
        id: 'issue', label: 'Pengiriman',
        load: () => q('v_supply_issues', [['request_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Request', k: 'request_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
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
          { label: 'Tgl Retur', k: 'return_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'Tgl Request', k: 'request_date', t: 'd' }, { label: 'Qty Dikirim', k: 'qty_sent', t: 'n', cls: 'num' },
          { label: 'Qty Retur', k: 'qty_return', t: 'n', cls: 'num' }, { label: 'Kondisi', k: 'kondisi' }, { label: 'Catatan', k: 'notes' }
        ],
        add: { label: 'Input Retur', stage: 'supply', run: rl => returnForm(null, null, rl) },
        acts: stdActs('supply_returns', 'supply', (r, rl) => returnForm(r, null, rl))
      },
      {
        id: 'pool', label: 'Stok Gudang (Umum)',
        load: () => q('v_stock', [['item_name', true]]),
        cols: [
          { label: 'Jenis Barang', k: 'item_name', cls: 'strong' }, { label: 'Spesifikasi', k: 'specification' },
          { label: 'Total Masuk / Stok Awal', k: 'stock_in', t: 'n', cls: 'num' }, { label: 'Dikirim', k: 'stock_out', t: 'n', cls: 'num' }, { label: 'Saldo Stok', k: 'balance', t: 'b', cls: 'num' }
        ],
        acts: () => []
      },
      {
        id: 'stock', label: 'Stok Siap Kirim',
        load: async () => (await q('v_po_summary', [['pi_no', true]])).filter(p => Number(p.good_ready) > 0),
        cols: [
          { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' }, { label: 'Spesifikasi', k: 'specification' },
          { label: 'Good Siap Pakai', k: 'good_ready', t: 'n', cls: 'num' }, { label: 'Dikirim', k: 'supplied_total', t: 'n', cls: 'num' },
          { label: 'Retur', k: 'returned_total', t: 'n', cls: 'num' }, { label: 'Stok Siap Kirim', k: 'stock_ready', t: 'b', cls: 'num' }
        ],
        acts: () => []
      }
    ]
  }),

  fg: () => ({
    id: 'fg', title: 'Produksi · Request, Retur, Finish Good',
    sub: 'Request material ke Supply (boleh bertahap, maksimal Qty PI), retur barang NG, dan catat hasil jadi.',
    segments: [
      {
        id: 'req', label: 'Request Material',
        load: () => q('v_requests', [['request_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Request', k: 'request_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'Qty Request', k: 'qty_requested', t: 'n', cls: 'num' }, { label: 'Sudah Dikirim', k: 'qty_sent', t: 'n', cls: 'num' },
          { label: 'Sisa', k: 'outstanding', t: 'b', cls: 'num' }, { label: 'Status', f: reqStatus }, { label: 'Catatan', k: 'notes' }
        ],
        add: { label: 'Request Material', stage: 'fg', run: rl => requestForm(null, null, rl) },
        acts: r => {
          if (isAdmin() || Number(r.qty_sent) <= 0) return stdActs('material_requests', 'fg', (x, rl) => requestForm(x, null, rl))(r);
          // sudah diproses Supply: Produksi tidak bisa mengubah, hanya boleh menutup sisa bila belum terpenuhi
          if (can('fg') && !r.closed && Number(r.outstanding) > 0) return [{ key: 'close', label: 'Tutup Sisa', icon: 'check', text: true, run: async rl => {
            if (!(await ask(`Tutup request ini? Sisa ${num(r.outstanding)} pcs yang belum terkirim tidak dikejar lagi.`, 'Ya, Tutup'))) return;
            await save('material_requests', { closed: true }, r.id); toast('Request ditutup'); rl();
          } }];
          return [];
        }
      },
      {
        id: 'ret', label: 'Retur ke Supply',
        load: () => q('v_supply_returns', [['return_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Retur', k: 'return_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'Qty Retur', k: 'qty_return', t: 'n', cls: 'num' }, { label: 'Kondisi', k: 'kondisi' }, { label: 'Catatan', k: 'notes' }
        ],
        add: { label: 'Retur Barang NG', stage: 'fg', run: rl => returnForm(null, null, rl) },
        acts: stdActs('supply_returns', 'fg', (r, rl) => returnForm(r, null, rl))
      },
      {
        id: 'fg', label: 'Penerimaan FG',
        load: () => q('v_fg_receipts', [['received_date', false], ['created_at', false]]),
        cols: [
          { label: 'Tgl Terima', k: 'received_date', t: 'd' }, { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
          { label: 'Karton', k: 'karton', t: 'n', cls: 'num' }, { label: 'Display', k: 'display', t: 'n', cls: 'num' },
          { label: 'Booklet / Cones', k: 'booklet_cones', t: 'n', cls: 'num' }, { label: 'Catatan', k: 'notes' }
        ],
        add: { label: 'Terima FG', stage: 'fg', run: rl => fgForm(null, rl) },
        acts: stdActs('fg_receipts', 'fg', (r, rl) => fgForm(r, rl))
      },
      {
        id: 'bal', label: 'Saldo per PI',
        load: async () => (await q('v_po_summary', [['pi_no', true]])).filter(p => p.source !== 'STOCK' && Number(p.supplied_total) > 0),
        cols: [
          { label: 'PI No', k: 'pi_no', cls: 'strong' }, { label: 'Brand', k: 'brand' }, { label: 'Jenis Barang', k: 'item_name' },
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
      <button class="btn ghost" id="xls" title="Export ke Excel">${icon('download', 18)}<span class="hide-m">Excel</span></button></div>
    <div class="cnt" id="cnt"></div>
    <div id="list"><div class="loading"><span class="spin"></span>Memuat data…</div></div>`;
  $('#segs').onclick = e => { const b = e.target.closest('[data-seg]'); if (b) { state.seg[def.id] = b.dataset.seg; reload(); } };
  if (canAdd) $('#addBtn').onclick = () => seg.add.run(reload);

  let rows = [];
  try { rows = await seg.load(); } catch (e) { $('#list').innerHTML = `<div class="errbox">${esc(errMsg(e))}</div>`; return; }
  let acts = [], shown = rows;
  const draw = () => {
    const k = $('#q').value.trim().toLowerCase();
    const f = k ? rows.filter(r => Object.values(r).join(' ').toLowerCase().includes(k)) : rows;
    shown = f;
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
  $('#xls').onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try { await exportXLSX(`${def.title} - ${seg.label}`, seg.cols, shown, `${def.id}-${seg.id}`); toast('File Excel diunduh'); }
    catch (err) { toast(errMsg(err), 'err'); }
    b.disabled = false;
  };
}

/* ---------- Dashboard ---------- */
/* Status item PI. Selesai = barang jadi sudah mencapai Qty PI (item lama tanpa Qty PI: semua material terpakai & tidak ada yang menunggu) */
function itemStatus(p) {
  const n = k => Number(p[k] || 0), fgTarget = p.qty_pi != null ? Number(p.qty_pi) : null;
  if (p.source === 'STOCK') {
    const net = n('supplied_total') - n('returned_total');
    if (net >= n('qty_po')) return { done: true, label: 'Selesai', tone: 'ok' };
    return { done: false, label: n('supplied_total') > 0 ? 'Terkirim sebagian dari stok' : 'Menunggu dikirim dari stok', tone: 'warn' };
  }
  const done = fgTarget != null ? n('fg_booklet') >= fgTarget
    : n('total_incoming') >= n('qty_po') && n('supplied_total') > 0 && n('fg_balance') <= 0 && n('qc_pending') <= 0 && n('dc_waiting') <= 0 && n('qc2_pending') <= 0;
  if (done) return { done: true, label: 'Selesai', tone: 'ok' };
  if (n('total_incoming') <= 0) return { done: false, label: 'Belum ada barang masuk', tone: 'gray' };
  if (n('qc_pending') > 0) return { done: false, label: 'Proses QC', tone: 'warn' };
  if (n('dc_waiting') > 0 || n('qc2_pending') > 0) return { done: false, label: 'Proses Diecut / QC ulang', tone: 'warn' };
  if (n('supplied_total') <= 0) return { done: false, label: 'Menunggu dikirim ke produksi', tone: 'warn' };
  return { done: false, label: 'Produksi berjalan', tone: 'warn' };
}
const piGroups = rows => { const g = new Map(); groupSort(rows).forEach(r => { const k = r.pi_no + '|' + r.brand; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }); return [...g.values()]; };
const piDone = items => items.every(p => itemStatus(p).done);

function groupHTML(rows) {
  const g = new Map();
  groupSort(rows).forEach(r => { const k = r.pi_no + '|' + r.brand; if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
  return [...g.values()].map(items => `<section class="pi-group"><div class="pi-head"><b>PI ${esc(items[0].pi_no)}</b><span>${esc(items[0].brand)}</span><em>${items.length} item</em>${
      piDone(items) ? '<span class="pill ok">PI SELESAI</span>' : `<span class="pill warn">BERJALAN · ${items.filter(p => itemStatus(p).done).length}/${items.length} item selesai</span>`}</div>
    <div class="po-grid">${items.map(poCard).join('')}</div></section>`).join('');
}

function stockCard(p) {
  const s = itemStatus(p), need = Number(p.qty_po), net = Number(p.supplied_total) - Number(p.returned_total);
  return `<div class="po">
    <div class="po-h"><div><b>${esc(p.item_name || p.pi_no)}</b><small>PI ${esc(p.pi_no)}${p.specification ? ' · ' + esc(p.specification) : ''}</small></div>
      <div><span class="pill ${s.tone}">${s.label}</span> <span class="pill gray">Dari Stok</span></div></div>
    <div class="stages">
      <div class="st g"><em>Kebutuhan PI</em><strong>${num(need)}</strong><div class="bar"><i style="width:${need ? Math.min(100, net / need * 100) : 0}%"></i></div><small>terkirim ${num(net)} · sisa ${num(Math.max(0, need - net))}</small></div>
      <div class="st s"><em>Stok Gudang</em><strong>${num(p.stock_ready)} <span style="font-size:12px;font-weight:600">saldo</span></strong><small>dipakai bersama semua PI</small></div>
      <div class="st f"><em>Supply</em><strong>${num(p.at_production)} <span style="font-size:12px;font-weight:600">di produksi</span></strong><small>Kirim ${num(p.supplied_total)} · retur ${num(p.returned_total)}</small></div>
    </div></div>`;
}

function poCard(p) {
  if (p.source === 'STOCK') return stockCard(p);
  const pct = Number(p.qty_po) ? Math.min(100, Number(p.total_incoming) / Number(p.qty_po) * 100) : 0;
  return `<div class="po">
    <div class="po-h"><div><b>${esc(p.item_name || p.specification || p.pi_no)}</b><small>PI ${esc(p.pi_no)}${p.item_name && p.specification ? ' · ' + esc(p.specification) : ''}</small></div>
      <div>${(s => `<span class="pill ${s.tone}">${s.label}</span> `)(itemStatus(p))}${Number(p.balance_po) > 0 ? `<span class="pill warn">Sisa PO ${num(p.balance_po)}</span>` : Number(p.balance_po) < 0 ? `<span class="pill err">Lebih ${num(-p.balance_po)}</span>` : '<span class="pill ok">PO lengkap</span>'}</div></div>
    <div class="stages">
      <div class="st g"><em>Gudang</em><strong>${num(p.total_incoming)}</strong><div class="bar"><i style="width:${pct}%"></i></div><small>dari PO ${num(p.qty_po)}</small></div>
      <div class="st q"><em>QC</em><strong>${num(p.good_total)} <span style="font-size:12px;font-weight:600">good</span></strong><small>NG ${num(p.ng_total)} · menunggu ${num(p.qc_pending)}</small></div>
      ${p.has_sheet ? `<div class="st d"><em>Diecut</em><strong>${num(p.dc_out)} <span style="font-size:12px;font-weight:600">pcs hasil</span></strong><small>Sheet ${num(p.dc_sheets)} · tunggu diecut ${num(p.dc_waiting)} pcs<br>QC ulang: good ${num(p.qc2_good)} · NG ${num(p.qc2_ng)} · tunggu ${num(p.qc2_pending)}</small></div>` : ''}
      <div class="st s"><em>Supply</em><strong>${num(p.at_production)} <span style="font-size:12px;font-weight:600">di produksi</span></strong><small>Kirim ${num(p.supplied_total)} · retur ${num(p.returned_total)}<br>Stok siap ${num(p.stock_ready)}</small></div>
      <div class="st f"><em>Finish Good</em><strong>${num(p.fg_booklet)} <span style="font-size:12px;font-weight:600">${p.leaves_per_book ? 'filter book' : 'booklet/cones'}</span></strong>${p.qty_pi != null ? `<div class="bar"><i style="width:${Math.min(100, Number(p.fg_booklet) / Number(p.qty_pi) * 100)}%"></i></div>` : ''}<small>${p.qty_pi != null ? `dari Qty PI ${num(p.qty_pi)} · ` : ''}Karton ${num(p.fg_karton)} · Display ${num(p.fg_display)}<br>Balance ${num(p.fg_balance)}</small></div>
    </div></div>`;
}

/* ---------- Laporan Tabel (format Excel: 1 tabel panjang) ---------- */
const REPORT = [
  { g: 'INCOMING MATERIAL DATA', c: 'g', cols: [
    { k: 'no', l: 'NO', w: 6, t: 'x' }, { k: 'pi_no', l: 'PI. NO', w: 18, t: 'x' }, { k: 'brand', l: 'BRAND', w: 22, t: 'x', al: 'left' }, { k: 'item', l: 'JENIS BARANG', w: 18, t: 'x', al: 'left' },
    { k: 'spec', l: 'SPESIFIKASI INCOMING MATERIAL', w: 26, t: 'x', al: 'left' }, { k: 'qty_po', l: 'QTY PO', w: 12, t: 'n' }, { k: 'qty_pi', l: 'QTY PI', w: 12, t: 'n' },
    { k: 'sj_no', l: 'NO. SJ / DO. NO', w: 18, t: 'x' }, { k: 'sj_input', l: 'SATUAN SJ', w: 22, t: 'x' }, { k: 'qty_sj', l: 'QTY SJ (PCS)', w: 13, t: 'n' },
    { k: 'total_in', l: 'TOTAL INCOMING MATERIAL', w: 17, t: 'n' }, { k: 'bal_po', l: 'BALANCE', w: 12, t: 'b' }] },
  { g: 'QC INCOMING MATERIAL', c: 'q', cols: [
    { k: 'good', l: 'GOOD MATERIAL', w: 14, t: 'n' }, { k: 'ng', l: 'NG MATERIAL', w: 14, t: 'n' },
    { k: 'qc_desc', l: 'DESCRIPTION', w: 28, t: 'x', al: 'left' }, { k: 'qc_bal', l: 'BALANCE', w: 12, t: 'b' }] },
  { g: 'DIECUT (SHEET JADI PCS)', c: 'd', cols: [
    { k: 'dc_sheets', l: 'SHEET DIECUT', w: 13, t: 'n' }, { k: 'dc_out', l: 'HASIL DIECUT (PCS)', w: 15, t: 'n' },
    { k: 'dc_bal', l: 'BALANCE (SHEET)', w: 14, t: 'b' }] },
  { g: 'QC ULANG SETELAH DIECUT', c: 'q2', cols: [
    { k: 'qc2_good', l: 'GOOD (PCS)', w: 12, t: 'n' }, { k: 'qc2_ng', l: 'NG (PCS)', w: 12, t: 'n' },
    { k: 'qc2_desc', l: 'DESCRIPTION', w: 26, t: 'x', al: 'left' }, { k: 'qc2_bal', l: 'BALANCE', w: 12, t: 'b' }] },
  { g: 'SUPPLY MATERIAL', c: 's', cols: [
    { k: 'req_date', l: 'MATERIAL REQUEST DATE', w: 16, t: 'd' }, { k: 'sent', l: 'NO OF MATERIAL SENT', w: 14, t: 'n' },
    { k: 'ret_date', l: 'MATERIAL RETURN DATE', w: 16, t: 'd' }, { k: 'ret_qty', l: 'NO OF MATERIAL RETURN', w: 15, t: 'n' },
    { k: 'sup_bal', l: 'BALANCE', w: 12, t: 'b' }] },
  { g: 'FINISH GOOD', c: 'f', cols: [
    { k: 'fg_date', l: 'RECEIVED DATE', w: 15, t: 'd' }, { k: 'karton', l: 'KARTON', w: 12, t: 'n' }, { k: 'display', l: 'DISPLAY', w: 12, t: 'n' },
    { k: 'booklet', l: 'BOOKLET / CONES', w: 14, t: 'n' }, { k: 'fg_bal', l: 'BALANCE', w: 12, t: 'b' }] },
  { g: 'STATUS', c: 'st', cols: [
    { k: 'st_item', l: 'STATUS ITEM', w: 24, t: 'x', al: 'left' }, { k: 'st_pi', l: 'STATUS PI', w: 20, t: 'x', al: 'left' }] }
];

async function loadReport() {
  const [pos, recs, qcs, iss, rets, fgs, qc2s] = await Promise.all([
    q('v_po_summary', [['created_at', true]]),
    q('v_receipts', [['receipt_date', true], ['created_at', true]]),
    q('v_qc_inspections', [['inspect_date', true], ['created_at', true]]),
    q('v_supply_issues', [['request_date', true], ['created_at', true]]),
    q('v_supply_returns', [['return_date', true], ['created_at', true]]),
    q('v_fg_receipts', [['received_date', true], ['created_at', true]]),
    q('v_qc2_inspections', [['inspect_date', true], ['created_at', true]])
  ]);
  const by = (arr, k) => arr.reduce((m, x) => { (m[x[k]] = m[x[k]] || []).push(x); return m; }, {});
  const recBy = by(recs, 'po_item_id'), issBy = by(iss, 'po_item_id'), fgBy = by(fgs, 'po_item_id');
  const qcBy = by(qcs, 'receipt_id'), retBy = by(rets, 'issue_id'), qc2By = by(qc2s, 'receipt_id');
  const out = [];
  let piNo = 0, lastKey = null;
  const piItems = {};
  pos.forEach(p => { (piItems[p.pi_no + '|' + p.brand] = piItems[p.pi_no + '|' + p.brand] || []).push(p); });
  groupSort(pos).forEach(p => {
    const key = p.pi_no + '|' + p.brand, newPi = key !== lastKey;
    if (newPi) piNo++;
    lastKey = key;
    const R = recBy[p.id] || [], I = issBy[p.id] || [], F = fgBy[p.id] || [];
    const n = Math.max(R.length, I.length, F.length, 1);
    let cum = 0, cumBook = 0;
    for (let i = 0; i < n; i++) {
      const r = R[i], s = I[i], f = F[i];
      const row = { no: i === 0 && newPi ? piNo : null, newPi: i === 0 && newPi, pi_no: p.pi_no, brand: p.brand, item: p.item_name + (p.leaves_per_book ? ` (${num(p.leaves_per_book)} leaves)` : '') + (p.source === 'STOCK' ? ' (dari stok)' : ''), spec: p.specification,
        qty_po: i === 0 ? p.qty_po : null, qty_pi: i === 0 ? p.qty_pi : null, first: i === 0,
        st_item: i === 0 ? itemStatus(p).label : null,
        st_pi: i === 0 && newPi ? (piDone(piItems[key]) ? 'PI SELESAI' : `BERJALAN (${piItems[key].filter(x => itemStatus(x).done).length}/${piItems[key].length} item selesai)`) : null };
      if (r) {
        cum += Number(r.qty_sj);
        const q_ = qcBy[r.id] || [];
        Object.assign(row, { sj_no: r.sj_no, sj_input: fmtIn(r.unit, r.qty_input, r.pcs_per_sheet), qty_sj: r.qty_sj, total_in: cum, bal_po: Number(p.qty_po) - cum,
          good: r.good_qty, ng: r.ng_qty, qc_desc: q_.map(x => x.description).filter(Boolean).join('; '), qc_bal: r.qc_balance });
        if (r.unit === 'SHEET') Object.assign(row, { dc_sheets: r.dc_sheets, dc_out: r.dc_qty_out,
          dc_bal: Number(r.pcs_per_sheet) > 0 ? Number(r.dc_waiting) / Number(r.pcs_per_sheet) : 0,
          qc2_good: r.qc2_good, qc2_ng: r.qc2_ng, qc2_desc: (qc2By[r.id] || []).map(x => x.description).filter(Boolean).join('; '), qc2_bal: r.qc2_waiting });
      } else if (i === 0 && p.source !== 'STOCK') { Object.assign(row, { total_in: 0, bal_po: Number(p.qty_po) }); }
      if (s) {
        const rr = retBy[s.id] || [];
        Object.assign(row, { req_date: s.request_date, sent: s.qty_sent, ret_date: rr.length ? rr[rr.length - 1].return_date : null,
          ret_qty: s.returned_qty, sup_bal: s.balance });
      }
      if (f) {
        cumBook += Number(f.booklet_cones) * (Number(p.pcs_per_book) || 1);
        Object.assign(row, { fg_date: f.received_date, karton: f.karton, display: f.display, booklet: f.booklet_cones,
          fg_bal: Number(p.at_production) - cumBook });
      }
      out.push(row);
    }
  });
  return out;
}

function reportTable(rows) {
  if (!rows.length) return '<div class="empty"><b>Belum ada data</b>Isi PI dan penerimaan di menu Gudang terlebih dahulu.</div>';
  const cellH = (c, v, r) => {
    if (v == null || v === '') return '';
    if (c.t === 'n') return num(v);
    if (c.t === 'b') return bal(Number(v));
    if (c.t === 'd') return dt(v);
    return esc(v);
  };
  return `<div class="rpt-wrap"><table class="rpt"><thead>
    <tr>${REPORT.map(g => `<th colspan="${g.cols.length}" class="g-${g.c}">${g.g}</th>`).join('')}</tr>
    <tr>${REPORT.flatMap(g => g.cols).map(c => `<th>${c.l}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr class="${r.first ? 'first' : ''}${r.newPi ? ' pigrp' : ''}">${REPORT.flatMap(g => g.cols).map(c =>
      `<td class="${c.al === 'left' ? 'l' : ''}${!r.first && ['pi_no', 'brand', 'item', 'spec'].includes(c.k) ? ' dim' : ''}">${cellH(c, r[c.k], r)}</td>`).join('')}</tr>`).join('')
  }</tbody></table></div>`;
}

async function exportReportXLSX(rows) {
  await loadExcelJS();
  const wb = new ExcelJS.Workbook(); wb.creator = 'MaterialFlow';
  const flat = REPORT.flatMap(g => g.cols);
  const N = flat.length;
  const ws = wb.addWorksheet('Laporan');
  ws.columns = flat.map(c => ({ width: c.w }));
  xlTitle(ws, 'LAPORAN INCOMING MATERIAL → QC → SUPPLY → FINISH GOOD (SATUAN: PCS)', N);
  let col = 1;
  REPORT.forEach(g => {
    ws.mergeCells(3, col, 3, col + g.cols.length - 1);
    const c = ws.getCell(3, col);
    c.value = g.g; c.font = { bold: true, size: 12 };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let i = 0; i < g.cols.length; i++) ws.getCell(3, col + i).border = allB(bBlack);
    col += g.cols.length;
  });
  ws.getRow(3).height = 24;
  flat.forEach((c, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = c.l; cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = allB(bBlack);
  });
  ws.getRow(4).height = 46;
  rows.forEach((r, i) => {
    const row = ws.getRow(5 + i);
    flat.forEach((c, j) => xlDataCell(row.getCell(j + 1), c, r[c.k], i % 2 === 0));
    if (r.newPi) flat.forEach((c, j) => { const cell = row.getCell(j + 1); cell.border = { ...cell.border, top: { style: 'medium', color: { argb: 'FF000000' } } }; });
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: N } };
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '3:4' };
  await saveWorkbook(wb, `Laporan-Material-${today()}.xlsx`);
}

async function renderReport(body) {
  body.innerHTML = '<div class="loading"><span class="spin"></span>Menyusun laporan…</div>';
  let rows;
  try { rows = await loadReport(); } catch (e) { body.innerHTML = `<div class="errbox">${esc(errMsg(e))}</div>`; return; }
  body.innerHTML = `<div class="toolbar"><div class="search">${icon('search', 18)}<input id="rq" type="search" placeholder="Cari PI, brand, SJ…"></div>
    <button class="btn primary" id="rx">${icon('download', 18)}<span>Export Excel</span></button></div>
    <div class="cnt" id="rcnt"></div><div id="rtbl"></div>
    <p class="mut" style="font-size:12px;margin-top:8px">Geser tabel ke samping untuk melihat semua kolom. Semua jumlah dalam PCS (barang yang masuk dalam sheet sudah dikonversi; kolom Satuan SJ menunjukkan input aslinya). Hasil pencarian ikut terexport.</p>`;
  let cur = rows;
  const draw = () => {
    const k = $('#rq').value.trim().toLowerCase();
    cur = k ? rows.filter(r => [r.pi_no, r.brand, r.item, r.spec, r.sj_no].join(' ').toLowerCase().includes(k)) : rows;
    $('#rtbl').innerHTML = reportTable(cur);
    $('#rcnt').textContent = cur.length + ' baris';
  };
  $('#rq').oninput = draw; draw();
  $('#rx').onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try { await exportReportXLSX(cur); toast('Laporan Excel diunduh'); } catch (err) { toast(errMsg(err), 'err'); }
    b.disabled = false;
  };
}

/* ---------- Rekap total per Jenis Barang ---------- */
const REKAP_COLS = [
  { label: 'Jenis Barang', k: 'name', cls: 'strong' }, { label: 'Jumlah Item PI', k: 'n', t: 'n', cls: 'num' },
  { label: 'Qty PO', k: 'qty_po', t: 'n', cls: 'num' }, { label: 'Total Diterima (Incoming)', k: 'total_incoming', t: 'n', cls: 'num' },
  { label: 'Good QC', k: 'good_total', t: 'n', cls: 'num' }, { label: 'NG QC', k: 'ng_total', t: 'n', cls: 'num' },
  { label: 'Total Dikirim ke Produksi', k: 'supplied_total', t: 'n', cls: 'num' }, { label: 'Retur', k: 'returned_total', t: 'n', cls: 'num' },
  { label: 'Di Produksi', k: 'at_production', t: 'n', cls: 'num' }, { label: 'Stok Siap Kirim', k: 'stock_ready', t: 'n', cls: 'num' },
  { label: 'Finish Good Jadi', k: 'fg_booklet', t: 'n', cls: 'num' }
];
function rekapRows(rows) {
  const m = new Map();
  rows.forEach(p => {
    const key = (p.item_name || '').trim().toLowerCase();
    if (!m.has(key)) m.set(key, { name: (p.item_name || '').trim() || '(belum diisi jenis barang)', n: 0 });
    const g = m.get(key); g.n++;
    REKAP_COLS.forEach(c => { if (c.k !== 'name' && c.k !== 'n') g[c.k] = (g[c.k] || 0) + (p.source === 'STOCK' && c.k === 'stock_ready' ? 0 : Number(p[c.k] || 0)); });
  });
  const out = [...m.values()].sort((x, y) => x.name.localeCompare(y.name));
  const tot = { name: 'TOTAL', n: 0 };
  out.forEach(g => REKAP_COLS.forEach(c => { if (c.k !== 'name') tot[c.k] = (tot[c.k] || 0) + (g[c.k] || 0); }));
  return { out, tot };
}
async function renderRekap(body) {
  body.innerHTML = '<div class="loading"><span class="spin"></span>Menghitung rekap…</div>';
  let rows;
  try { rows = await q('v_po_summary'); } catch (e) { body.innerHTML = `<div class="errbox">${esc(errMsg(e))}</div>`; return; }
  body.innerHTML = `<div class="toolbar"><div class="search">${icon('search', 18)}<input id="rk" type="search" placeholder="Filter PI / brand (opsional)…"></div>
    <button class="btn primary" id="rkx">${icon('download', 18)}<span>Export Excel</span></button></div>
    <div id="rkt"></div>
    <p class="mut" style="font-size:12px;margin-top:8px">Total semua PI per jenis barang, dalam PCS. Ketik nomor PI atau brand di kolom cari untuk melihat total PI tertentu saja. Retur sudah termasuk di kolom Retur dan mengurangi Di Produksi.</p>`;
  let cur = [];
  const draw = () => {
    const k = $('#rk').value.trim().toLowerCase();
    const f = k ? rows.filter(r => [r.pi_no, r.brand, r.item_name, r.specification].join(' ').toLowerCase().includes(k)) : rows;
    const { out, tot } = rekapRows(f); cur = out.concat([{ ...tot, n: f.length }]);
    $('#rkt').innerHTML = f.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${REKAP_COLS.map(c => `<th class="${c.cls === 'num' ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${
      cur.map((g, i) => `<tr${i === cur.length - 1 ? ' style="font-weight:800;background:#eef2ff"' : ''}>${REKAP_COLS.map(c => `<td class="${c.cls === 'num' ? 'num' : ''}">${c.t === 'n' ? num(g[c.k] || 0) : esc(g[c.k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><b>Tidak ada data</b></div>';
  };
  $('#rk').oninput = draw; draw();
  $('#rkx').onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try { await exportXLSX('Rekap Total per Jenis Barang', REKAP_COLS, cur, 'rekap-jenis-barang'); toast('Excel diunduh'); } catch (err) { toast(errMsg(err), 'err'); }
    b.disabled = false;
  };
}

async function renderDashboard(view) {
  const tab = ['rpt', 'rkp'].includes(state.seg.dashboard) ? state.seg.dashboard : 'sum';
  view.innerHTML = `<div class="page-head"><div><h1>Dashboard</h1><p>Ringkasan alur material dari Gudang sampai Finish Good.</p></div>
    <button class="btn ghost" id="rf">${icon('refresh', 18)}<span>Muat ulang</span></button></div>
    <div class="seg" id="dsegs"><button data-seg="sum" class="${tab === 'sum' ? 'on' : ''}">Ringkasan</button><button data-seg="rkp" class="${tab === 'rkp' ? 'on' : ''}">Rekap Barang</button><button data-seg="rpt" class="${tab === 'rpt' ? 'on' : ''}">Laporan Tabel</button></div>
    <div id="dbody"></div>`;
  $('#rf').onclick = () => renderDashboard(view);
  $('#dsegs').onclick = e => { const b = e.target.closest('[data-seg]'); if (b) { state.seg.dashboard = b.dataset.seg; renderDashboard(view); } };
  if (tab === 'rpt') await renderReport($('#dbody')); else if (tab === 'rkp') await renderRekap($('#dbody')); else await renderSummary($('#dbody'));
}

async function renderSummary(view) {
  view.innerHTML = '<div class="loading"><span class="spin"></span>Memuat data…</div>';
  let rows;
  try { rows = await q('v_po_summary'); } catch (e) { view.insertAdjacentHTML('beforeend', ''); view.querySelector('.loading').outerHTML = `<div class="errbox">${esc(errMsg(e))}</div>`; return; }
  const sum = k => rows.filter(r => r.source !== 'STOCK').reduce((a, r) => a + Number(r[k] || 0), 0);
  const grp = piGroups(rows), nDone = grp.filter(piDone).length;
  const kp = [['PI Berjalan', grp.length - nDone, 'q'], ['PI Selesai', nDone, 'f'], ['Total Incoming', num(sum('total_incoming')), 'g'], ['Menunggu QC', num(sum('qc_pending')), 'q'], ['Menunggu Diecut', num(sum('dc_waiting')), 'd'], ['Menunggu QC Ulang', num(sum('qc2_pending')), 'q'],
    ['Good', num(sum('good_total')), 'q'], ['NG', num(sum('ng_total')), 'r'], ['Stok Siap Kirim', num(sum('stock_ready')), 's'],
    ['Di Produksi', num(sum('at_production')), 's'], ['Booklet / Cones Jadi', num(sum('fg_booklet')), 'f']];
  view.querySelector('.loading').outerHTML = `
    <div class="kpis">${kp.map(([l, v, c]) => `<div class="kpi ${c}"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    <div class="toolbar"><div class="search">${icon('search', 18)}<input id="q" type="search" placeholder="Cari PI / brand…"></div></div>
    <div class="seg" id="pf"><button data-f="all">Semua</button><button data-f="run">Berjalan</button><button data-f="done">Selesai</button></div>
    <div class="sec-title">Progres per PI</div><div id="pos"></div>`;
  const draw = () => {
    const k = $('#q').value.trim().toLowerCase();
    let f = k ? rows.filter(r => [r.pi_no, r.brand, r.item_name, r.specification].join(' ').toLowerCase().includes(k)) : rows;
    const pf = state.piFilter || 'all';
    document.querySelectorAll('#pf [data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === pf));
    if (pf !== 'all') f = piGroups(f).filter(items => piDone(items) === (pf === 'done')).flat();
    $('#pos').innerHTML = f.length ? groupHTML(f) : '<div class="empty" style="grid-column:1/-1"><b>Belum ada data PI</b>Leader Gudang dapat menambah PI di menu Gudang.</div>';
  };
  $('#q').oninput = draw; draw();
  $('#pf').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { state.piFilter = b.dataset.f; draw(); } };
}

/* ---------- Pengguna (admin) ---------- */
async function renderAdmin(view) {
  if (!isAdmin()) { view.innerHTML = '<div class="empty"><b>Khusus Admin</b>Anda tidak punya akses ke menu ini.</div>'; return; }
  const tab = ['master', 'audit'].includes(state.seg.admin) ? state.seg.admin : 'users';
  view.innerHTML = `<div class="page-head"><div><h1>Admin</h1><p>Kelola pengguna, daftar master barang, dan riwayat perubahan data.</p></div></div>
    <div class="seg" id="asegs"><button data-seg="users" class="${tab === 'users' ? 'on' : ''}">Pengguna</button><button data-seg="master" class="${tab === 'master' ? 'on' : ''}">Master Barang & Brand</button><button data-seg="audit" class="${tab === 'audit' ? 'on' : ''}">Riwayat Perubahan</button></div>
    <div id="abody"></div>`;
  $('#asegs').onclick = e => { const b = e.target.closest('[data-seg]'); if (b) { state.seg.admin = b.dataset.seg; renderAdmin(view); } };
  const body = $('#abody');
  if (tab === 'master') await renderMaster(body); else if (tab === 'audit') await renderAudit(body); else await renderUsers(body);
}

/* ---------- Master Barang & Brand ---------- */
async function renderMaster(view) {
  view.innerHTML = '<div class="loading"><span class="spin"></span>Memuat…</div>';
  let rows;
  try { rows = await q('master_data', [['name', true]]); } catch (e) { view.innerHTML = `<div class="errbox">${esc(errMsg(e))}</div>`; return; }
  const box = (kind, title) => `<div class="mbox"><div class="sec-title">${title}</div>
    <form class="madd" data-kind="${kind}"><input type="text" placeholder="Tambah ${title.toLowerCase()} baru…" required><button class="btn primary" type="submit">Tambah</button></form>
    <div class="chips">${rows.filter(x => x.kind === kind).map(x => `<span class="chip">${esc(x.name)}<button type="button" data-del="${x.id}" aria-label="Hapus ${esc(x.name)}">&times;</button></span>`).join('') || '<span class="mut">Belum ada</span>'}</div></div>`;
  view.innerHTML = `<p class="mut" style="margin:0 0 10px">Daftar ini muncul sebagai pilihan di form PI. Penulisan di PI otomatis diseragamkan mengikuti daftar (huruf besar/kecil dan spasi ganda), sehingga "booklet" dan "Booklet" tidak terhitung terpisah. Menghapus dari daftar tidak mengubah data PI yang sudah ada.</p>
    <div class="mgrid">${box('item', 'Jenis Barang')}${box('brand', 'Brand')}</div>`;
  view.onsubmit = async e => {
    const f = e.target.closest('.madd'); if (!f) return; e.preventDefault();
    const name = f.querySelector('input').value.replace(/\s+/g, ' ').trim(); if (!name) return;
    if (rows.some(x => x.kind === f.dataset.kind && sameName(x.name, name))) return toast('Sudah ada di daftar', 'err');
    try { await save('master_data', { kind: f.dataset.kind, name }); toast('Ditambahkan'); renderMaster(view); } catch (err) { toast(errMsg(err), 'err'); }
  };
  view.onclick = async e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    if (!(await ask('Hapus dari daftar pilihan? Data PI yang sudah ada tidak berubah.'))) return;
    try { await del('master_data', b.dataset.del); toast('Dihapus'); renderMaster(view); } catch (err) { toast(errMsg(err), 'err'); }
  };
}

/* ---------- Riwayat Perubahan (audit log) ---------- */
const AUDIT_TBL = { po_items: 'Item PI', receipts: 'Penerimaan SJ', qc_inspections: 'QC Incoming', diecut_jobs: 'Diecut', qc2_inspections: 'QC Ulang', supply_issues: 'Pengiriman Supply', supply_returns: 'Retur Supply', fg_receipts: 'Finish Good', master_data: 'Master', profiles: 'Pengguna' };
const AUDIT_OP = { INSERT: 'Tambah', UPDATE: 'Ubah', DELETE: 'Hapus' };
const AUDIT_SKIP = new Set(['id', 'created_at', 'updated_at', 'created_by']);
function auditSummary(r) {
  const o = r.old_data || {}, n = r.new_data || {};
  const fmt = x => x == null ? '–' : String(x);
  if (r.op === 'UPDATE') {
    const ch = Object.keys(n).filter(k => !AUDIT_SKIP.has(k) && JSON.stringify(n[k]) !== JSON.stringify(o[k]));
    return ch.map(k => `<b>${esc(k)}</b>: ${esc(fmt(o[k]))} → ${esc(fmt(n[k]))}`).join('<br>');
  }
  const d = r.op === 'DELETE' ? o : n;
  return Object.keys(d).filter(k => !AUDIT_SKIP.has(k) && d[k] != null && d[k] !== '').slice(0, 7).map(k => `<b>${esc(k)}</b>: ${esc(fmt(d[k]))}`).join(' · ');
}
async function renderAudit(view) {
  view.innerHTML = '<div class="loading"><span class="spin"></span>Memuat riwayat…</div>';
  let rows;
  try {
    const { data, error } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(500);
    if (error) throw error; rows = data || [];
  } catch (e) { view.innerHTML = `<div class="errbox">${esc(errMsg(e))}</div>`; return; }
  view.innerHTML = `<div class="toolbar"><div class="search">${icon('search', 18)}<input id="aq" type="search" placeholder="Cari pengguna, tabel, isi perubahan…"></div></div>
    <div class="cnt" id="acnt"></div><div id="atbl"></div><p class="mut" style="font-size:12px;margin-top:8px">Menampilkan 500 perubahan terakhir. Setiap tambah, ubah, dan hapus data tercatat otomatis oleh database dan tidak bisa diubah dari aplikasi.</p>`;
  const draw = () => {
    const k = $('#aq').value.trim().toLowerCase();
    const f = k ? rows.filter(r => [r.actor_email, AUDIT_TBL[r.tbl] || r.tbl, AUDIT_OP[r.op], JSON.stringify(r.new_data || r.old_data)].join(' ').toLowerCase().includes(k)) : rows;
    $('#acnt').textContent = f.length + ' perubahan';
    $('#atbl').innerHTML = f.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Data</th><th>Isi</th></tr></thead><tbody>${f.map(r => `<tr>
      <td style="white-space:nowrap">${esc(new Date(r.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))}</td>
      <td>${esc(r.actor_email || 'sistem')}</td>
      <td><span class="pill ${r.op === 'DELETE' ? 'err' : r.op === 'INSERT' ? 'ok' : 'warn'}">${AUDIT_OP[r.op] || r.op}</span></td>
      <td>${esc(AUDIT_TBL[r.tbl] || r.tbl)}</td><td style="font-size:12.5px;min-width:260px">${auditSummary(r)}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><b>Belum ada riwayat</b></div>';
  };
  $('#aq').oninput = draw; draw();
}

async function renderUsers(view) {
  view.innerHTML = `<p class="mut" style="margin:0 0 10px">Atur role setiap akun. Akun baru dibuat di Supabase → Authentication → Users.</p><div id="list"><div class="loading"><span class="spin"></span>Memuat…</div></div>`;
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
  { id: 'diecut', label: 'Diecut', icon: 'cut' },
  { id: 'supply', label: 'Supply', icon: 'truck' },
  { id: 'fg', label: 'Produksi', icon: 'pkg' },
  { id: 'users', label: 'Admin', icon: 'users', admin: true }
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
        <button class="ibtn" id="bell" title="Inbox" aria-label="Inbox">${icon('bell', 18)}</button>
        <button class="ibtn" id="logout" title="Keluar" aria-label="Keluar">${icon('logout', 18)}</button></div></header>
      <main class="content" id="view"></main>
    </div>
    <nav class="bottom">${nav.map(n => `<a href="#${n.id}" data-nav="${n.id}">${icon(n.icon, 22)}<span>${n.label}</span></a>`).join('')}</nav></div>`;
  $('#logout').onclick = async () => { await sb.auth.signOut(); };
  $('#bell').onclick = async () => { await refreshBadges(); openInbox(); };
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
    else if (page === 'users') await renderAdmin(view);
    else await renderSegPage(view, DEFS[page]());
    refreshBadges();
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
  clearInterval(state.inboxTimer);
  state.inboxTimer = setInterval(() => { if (document.visibilityState === 'visible') refreshBadges(); }, 60000);
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
