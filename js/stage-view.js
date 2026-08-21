/* ============================================================
   STAGE VIEW — the Gudang / QC / Diecut / Suplai / Produksi
   tabs: search + filter, pipeline strip, progress bar, history.
   ============================================================ */

function stageFilterPredicate(stage, item){
  const s = itemStats(item);
  if(stage==='qc') return s.remainToQc>0;
  if(stage==='diecut') return s.remainToDiecut>0;
  if(stage==='suplai') return s.remainToSupply>0;
  if(stage==='produksi') return s.remainToProduction>0;
  return true;
}

function renderStage(stage){
  const searchId = {gudang:'searchGudang', qc:'searchQc', diecut:'searchDiecut', suplai:'searchSuplai', produksi:'searchProduksi'}[stage];
  const filterId = {qc:'filterQc', diecut:'filterDiecut', suplai:'filterSuplai', produksi:'filterProduksi'}[stage];
  const sortId = {gudang:'sortGudang', qc:'sortQc', diecut:'sortDiecut', suplai:'sortSuplai', produksi:'sortProduksi'}[stage];
  const listId = {gudang:'listGudang', qc:'listQc', diecut:'listDiecut', suplai:'listSuplai', produksi:'listProduksi'}[stage];
  const q = (document.getElementById(searchId)?.value || '').toLowerCase();
  const filterVal = filterId ? (document.getElementById(filterId)?.value || 'belum') : null;
  const sortVal = sortId ? (document.getElementById(sortId)?.value || 'default') : 'default';

  let filtered = items.filter(it => !q || (it.pi_specification||'').toLowerCase().includes(q) || (it.pi_no||'').toLowerCase().includes(q));
  if(stage==='diecut'){
    // Diecut relevan untuk item mana pun yang PERNAH punya batch QC Awal bertanda Sheet,
    // bukan berdasarkan flag tetap di level PI (karena 1 PI bisa terima campuran Sheet & Pcs).
    filtered = filtered.filter(it => itemStats(it).hasSheetActivity);
  }
  if(filterVal==='belum') filtered = filtered.filter(it=>stageFilterPredicate(stage, it));
  if(sortVal!=='default') filtered = sortItemsForStage(filtered, stage, sortVal);

  const el = document.getElementById(listId);
  if(!el) return;
  if(filtered.length===0){
    const msgs = {
      gudang:'Belum ada jenis barang. Ketuk tombol + untuk menambah.',
      qc:'Tidak ada barang yang perlu diperiksa QC saat ini.',
      diecut:'Tidak ada barang Sheet yang perlu diproses Diecut saat ini.',
      suplai:'Tidak ada barang yang perlu diterima suplai saat ini.',
      produksi:'Tidak ada barang yang perlu dikirim ke produksi saat ini.'
    };
    const glyphs = {gudang:'🏭', qc:'✅', diecut:'⚙️', suplai:'🚚', produksi:'🏗️'};
    el.innerHTML = `<div class="empty"><div class="glyph">${glyphs[stage]}</div><div class="msg">${msgs[stage]}</div></div>`;
    updateMiniStat(stage);
    renderStageLog(stage);
    return;
  }
  el.innerHTML = filtered.map(it=>itemCardHTML(it, stage)).join('');
  updateMiniStat(stage);
  renderStageLog(stage);
}

function updateMiniStat(stage){
  const el = document.getElementById('miniStat_'+stage);
  if(!el) return;
  if(stage==='gudang'){ el.textContent = `${items.length} jenis barang terdaftar`; return; }
  const n = items.filter(it=>stageFilterPredicate(stage, it)).length;
  el.textContent = `${n} menunggu diproses`;
}

function pipelineHTML(s){
  // Barang Sheet: Gudang → QC Awal → Diecut → QC Ulang → Suplai → Produksi (6 tahap)
  // Barang Pcs:   Gudang → QC → Suplai → Produksi (4 tahap, lompat Diecut & QC Ulang)
  if(s.hasSheetActivity){
    let idx = 0.5;
    if(s.receivedQty>0) idx = 1.5;
    if(s.qcGudangQty>0) idx = 2.5;
    if(s.diecutOutQty>0) idx = 3.5;
    if(s.qcDiecutQty>0) idx = 4.5;
    if(s.suppliedQty>0) idx = 5.5;
    if(s.producedQty>0) idx = 6.4;
    return `
    <div class="pipeline">
      <div class="seg ${idx>=1?'done':'current'}"></div>
      <div class="seg ${idx>=2?'done':(idx>=1?'current':'')}"></div>
      <div class="seg ${idx>=3?'done':(idx>=2?'current':'')}"></div>
      <div class="seg ${idx>=4?'done':(idx>=3?'current':'')}"></div>
      <div class="seg ${idx>=5?'done':(idx>=4?'current':'')}"></div>
      <div class="seg ${idx>=6?'current':(idx>=5?'current':'')}"></div>
    </div>
    <div class="pipeline-labels"><span>Gudang</span><span>QC Awal</span><span>Diecut</span><span>QC Ulang</span><span>Suplai</span><span>Produksi</span></div>`;
  }
  let idx = 0.5;
  if(s.receivedQty>0) idx = 1.5;
  if(s.qcGudangQty>0) idx = 2.5;
  if(s.suppliedQty>0) idx = 3.5;
  if(s.producedQty>0) idx = 4.4;
  return `
  <div class="pipeline">
    <div class="seg ${idx>=1?'done':'current'}"></div>
    <div class="seg ${idx>=2?'done':(idx>=1?'current':'')}"></div>
    <div class="seg ${idx>=3?'done':(idx>=2?'current':'')}"></div>
    <div class="seg ${idx>=4?'current':(idx>=3?'current':'')}"></div>
  </div>
  <div class="pipeline-labels"><span>Gudang</span><span>QC</span><span>Suplai</span><span>Produksi</span></div>`;
}

function overallBadge(s){
  // Status di sini murni menampilkan input status manual terakhir, bukan tebakan otomatis.
  const stagesInOrder = s.hasSheetActivity
    ? [['Produksi', s.lastProdStatus], ['Suplai', s.lastSupplyStatus], ['QC Ulang', s.lastQcDiecutStatus], ['Diecut', s.lastMachineStatus], ['QC Awal', s.lastQcGudangStatus], ['Gudang', s.lastMaterialStatus]]
    : [['Produksi', s.lastProdStatus], ['Suplai', s.lastSupplyStatus], ['QC', s.lastQcGudangStatus], ['Gudang', s.lastMaterialStatus]];
  for(const [label, val] of stagesInOrder){
    if(val) return `<span class="badge badge-grey">${escapeHtml(label)}: ${escapeHtml(val)}</span>`;
  }
  return `<span class="badge badge-grey">Belum Ada Aktivitas</span>`;
}

function qtyBarHTML(label, current, base, color){
  const pct = base>0 ? Math.min(100, Math.round(current/base*100)) : (current>0? 100:0);
  return `
  <div class="qtybar-row"><span>${label}</span><b>${current}${base?(' / '+base):''}</b></div>
  <div class="qtybar"><div style="width:${pct}%;background:${color};"></div></div>`;
}

function historyHTML(entries, stage){
  if(entries.length===0) return `<div class="history-empty">Belum ada transaksi.</div>`;
  const cfg = STAGE[stage];
  return entries.slice().reverse().slice(0,4).map(e=>{
    let qty;
    if(stage==='qc') qty = e.source_stage==='Diecut' ? `[QC Ulang] ${e.good_material??0} good / ${e.ng_material??0} ng` : `[QC Awal · ${e.bentuk_diperiksa==='Sheet'?'Sheet':'Pcs'}] ${e.good_material??0} good / ${e.ng_material??0} ng`;
    else if(stage==='diecut') qty = `masuk ${e.qty_in??0} / keluar ${e.qty_out??0}`;
    else if(stage==='gudang') qty = `${e.sj_do_qty??'-'} ${escapeHtml(e.sj_do_unit||'')}${e.supplier ? ' · '+escapeHtml(e.supplier) : ''}`;
    else qty = cfg.qtyField ? (e[cfg.qtyField] ?? '-') : '-';
    const date = e[cfg.dateField] || '-';
    const clickAttr = isAdmin() ? ` onclick="event.stopPropagation();openEntryModal('${stage}','${e.pi_item_id}','${e.id}')"` : '';
    return `<div class="history-row${isAdmin()?'':' history-row-static'}"${clickAttr}><span class="l">${date}</span><span class="r">${qty}</span></div>`;
  }).join('') + (entries.length>4 ? `<div class="history-empty">+${entries.length-4} transaksi lainnya</div>` : '');
}

function itemCardHTML(item, stage, compact){
  const s = itemStats(item);
  let bar = '';
  if(stage==='gudang') bar = qtyBarHTML('Diterima dari Supplier', s.receivedQty, item.pi_qty, 'var(--steel)');
  else if(stage==='qc' && s.hasSheetActivity) bar = qtyBarHTML('QC Awal: '+s.qcGudangQty+'/'+s.receivedQty+' · QC Ulang', s.qcDiecutQty, s.diecutOutQty, 'var(--amber)');
  else if(stage==='qc') bar = qtyBarHTML('Sudah Diperiksa (Good+NG)', s.qcGudangQty, s.receivedQty, 'var(--amber)');
  else if(stage==='diecut') bar = qtyBarHTML('Selesai Diecut (Keluar)', s.diecutOutQty, s.goodQtyGudangSheet, 'var(--rust)');
  else if(stage==='suplai') bar = qtyBarHTML('Diterima Suplai', s.suppliedQty, s.supplyBase, 'var(--green)');
  else if(stage==='produksi') bar = qtyBarHTML('Terkirim ke Produksi', s.producedQty, s.suppliedQty, 'var(--violet)');

  let history = '', addBtn = '';
  if(!compact && stage!=='laporan'){
    history = `<div class="history">${historyHTML(STAGE[stage].arr().filter(x=>x.pi_item_id===item.id), stage)}</div>`;
    addBtn = `<div class="card-actions">
      <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openTimelineModal('${item.id}')" title="Riwayat lintas semua tahap">🕘 Riwayat Lengkap</button>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openEntryModal('${stage}','${item.id}')">+ Catat ${STAGE[stage].label}</button>
    </div>`;
  }

  return `
  <div class="record-card">
    <div class="top" onclick="${isAdmin() ? `openItemModal('${item.id}')` : `openTimelineModal('${item.id}')`}">
      <div>
        <div class="pi-name">${escapeHtml(item.pi_specification || '(Belum diberi nama)')}</div>
        <div class="sj">PI ${escapeHtml(item.pi_no||'-')} · ${escapeHtml(item.brand||'-')}${item.unit?' · '+escapeHtml(item.unit):''}</div>
        ${item.description ? `<div class="desc">${escapeHtml(item.description)}</div>` : ''}
      </div>
      ${overallBadge(s)}
    </div>
    ${pipelineHTML(s)}
    ${bar}
    ${history}
    ${addBtn}
  </div>`;
}
