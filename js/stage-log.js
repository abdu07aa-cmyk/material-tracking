/* ============================================================
   STAGE LOG — riwayat transaksi lengkap (flat, bukan per kartu)
   untuk tiap divisi, plus ekspor Excel-nya sendiri. Ini terpisah
   dari Laporan admin (yang meringkas semua tahap sekaligus).
   ============================================================ */

const LOG_HEADERS = {
  gudang:   ['Tanggal SJ/DO','PI No','PI Specification','Supplier','SJ/DO No','Qty','Unit','Status'],
  qc:       ['Tanggal Inspeksi','PI No','PI Specification','Jenis QC','Bentuk Diperiksa','Good','N.G','Status'],
  diecut:   ['Tanggal Diecut','PI No','PI Specification','Qty Masuk','Qty Keluar','Status','Catatan'],
  suplai:   ['Tanggal Suplai','PI No','PI Specification','Qty Diterima','Total Material','Status'],
  produksi: ['Tanggal Produksi','PI No','PI Specification','Qty Terkirim','Status','Catatan']
};

const LOG_ROW_FN = {
  gudang:   (e,it)=>[e.sj_do_date, it?.pi_no, it?.pi_specification, e.supplier, e.sj_do_no, e.sj_do_qty, e.sj_do_unit, e.status_material],
  qc:       (e,it)=>[e.inspection_date, it?.pi_no, it?.pi_specification, e.source_stage==='Diecut'?'QC Ulang':'QC Awal', e.bentuk_diperiksa||'-', e.good_material, e.ng_material, e.qc_status],
  diecut:   (e,it)=>[e.machine_date, it?.pi_no, it?.pi_specification, e.qty_in, e.qty_out, e.machine_status, e.notes],
  suplai:   (e,it)=>[e.supply_date, it?.pi_no, it?.pi_specification, e.supply_qty, e.total_material, e.supply_status],
  produksi: (e,it)=>[e.production_date, it?.pi_no, it?.pi_specification, e.production_qty, e.production_status, e.notes]
};

function buildStageLog(stage){
  return STAGE[stage].arr().slice().reverse().map(e => ({ entry:e, item: items.find(x=>x.id===e.pi_item_id) }));
}

function renderStageLog(stage){
  const headEl = document.getElementById('logHead_'+stage);
  const bodyEl = document.getElementById('logBody_'+stage);
  if(!headEl || !bodyEl) return;
  headEl.innerHTML = LOG_HEADERS[stage].map(h=>`<th>${h}</th>`).join('');
  const rows = buildStageLog(stage);
  if(rows.length===0){
    bodyEl.innerHTML = `<tr><td colspan="${LOG_HEADERS[stage].length}" style="text-align:center;color:var(--muted);padding:20px;font-family:'Inter';">Belum ada transaksi tercatat.</td></tr>`;
    return;
  }
  bodyEl.innerHTML = rows.map(({entry,item})=>{
    const vals = LOG_ROW_FN[stage](entry, item).map(v => v ?? '-');
    return '<tr>' + vals.map(v=>`<td>${escapeHtml(String(v))}</td>`).join('') + '</tr>';
  }).join('');
}

function toggleStageLog(stage){
  const wrap = document.getElementById('logWrap_'+stage);
  if(!wrap) return;
  wrap.classList.toggle('hidden');
  if(!wrap.classList.contains('hidden')) renderStageLog(stage);
}

function exportStageLog(stage){
  const rows = buildStageLog(stage);
  if(rows.length===0){ showToast('Belum ada transaksi untuk diekspor'); return; }
  if(typeof XLSX === 'undefined'){ showToast('Modul Excel gagal dimuat, cek koneksi internet'); return; }

  const aoa = [LOG_HEADERS[stage], ...rows.map(({entry,item}) => LOG_ROW_FN[stage](entry,item).map(v=>v ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = LOG_HEADERS[stage].map(()=>({wch:16}));
  ws['!freeze'] = { xSplit:0, ySplit:1, topLeftCell:'A2', state:'frozen' };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, STAGE[stage].label.slice(0,28));
  XLSX.writeFile(wb, `riwayat-${stage}-${new Date().toISOString().slice(0,10)}.xlsx`);
}
