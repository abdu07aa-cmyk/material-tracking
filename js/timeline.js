/* ============================================================
   TIMELINE — "Riwayat Lengkap": gabungan kronologis semua
   transaksi satu jenis barang lintas Gudang/QC/Diecut/Suplai/
   Produksi dalam satu tampilan. Fitur baru, read-only, tidak
   menyentuh data atau tabel yang sudah ada.
   ============================================================ */

function buildTimeline(item){
  const s = itemStats(item);
  const events = [];

  s.rec.forEach(e => events.push({
    order:1, date:e.sj_do_date, title:'Gudang', color:'var(--steel)',
    desc:`${e.sj_do_qty ?? '-'} ${escapeHtml(e.sj_do_unit||'')} diterima dari ${escapeHtml(e.supplier||'-')}${e.sj_do_no ? ' · SJ/DO '+escapeHtml(e.sj_do_no) : ''}`,
    status: e.status_material
  }));

  s.qcAll.forEach(e => {
    const isDiecut = e.source_stage === 'Diecut';
    events.push({
      order:2, date:e.inspection_date, title: isDiecut ? 'QC Ulang' : 'QC Awal', color: isDiecut ? 'var(--gold)' : 'var(--amber)',
      desc:`Good ${e.good_material ?? 0} · N.G ${e.ng_material ?? 0}${(!isDiecut && e.bentuk_diperiksa) ? ' · bentuk ' + escapeHtml(e.bentuk_diperiksa) : ''}`,
      status: e.qc_status
    });
  });

  s.mac.forEach(e => events.push({
    order:3, date:e.machine_date, title:'Diecut', color:'var(--rust)',
    desc:`Masuk ${e.qty_in ?? 0} → Keluar ${e.qty_out ?? 0}${e.notes ? ' · ' + escapeHtml(e.notes) : ''}`,
    status: e.machine_status
  }));

  s.sup.forEach(e => events.push({
    order:4, date:e.supply_date, title:'Suplai', color:'var(--green)',
    desc:`Diterima suplai ${e.supply_qty ?? 0}${e.total_material!=null ? ' · total tercatat ' + e.total_material : ''}`,
    status: e.supply_status
  }));

  s.prod.forEach(e => events.push({
    order:5, date:e.production_date, title:'Produksi', color:'var(--violet)',
    desc:`Terkirim ke produksi ${e.production_qty ?? 0}${e.notes ? ' · ' + escapeHtml(e.notes) : ''}`,
    status: e.production_status
  }));

  events.sort((a,b)=>{
    const da = a.date || '9999-99-99';
    const db = b.date || '9999-99-99';
    if(da !== db) return da < db ? -1 : 1;
    return a.order - b.order;
  });
  return events;
}

function openTimelineModal(itemId){
  const item = items.find(x=>x.id===itemId);
  if(!item) return;
  document.getElementById('timelineTitle').textContent = item.pi_specification || '(Belum diberi nama)';
  document.getElementById('timelineSub').textContent = `PI ${item.pi_no||'-'} · ${item.brand||'-'}${item.unit ? ' · '+item.unit : ''}`;

  const events = buildTimeline(item);
  const body = document.getElementById('timelineBody');
  if(events.length===0){
    body.innerHTML = `<div class="empty"><div class="glyph">🕘</div><div class="msg">Belum ada transaksi tercatat untuk barang ini di tahap manapun.</div></div>`;
  } else {
    body.innerHTML = `<div class="tl-list">` + events.map(e => `
      <div class="tl-row">
        <div class="tl-dot" style="background:${e.color}"></div>
        <div class="tl-content">
          <div class="tl-head">
            <span class="tl-stage" style="color:${e.color}">${escapeHtml(e.title)}</span>
            <span class="tl-date mono">${e.date || 'Tanggal belum diisi'}</span>
          </div>
          <div class="tl-desc">${e.desc}</div>
          ${e.status ? `<div class="tl-status">${escapeHtml(e.status)}</div>` : ''}
        </div>
      </div>`).join('') + `</div>`;
  }
  document.getElementById('timelineModal').classList.add('open');
}

function closeTimelineModal(){ document.getElementById('timelineModal').classList.remove('open'); }
