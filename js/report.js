/* ============================================================
   REPORT — the "Laporan" summary table and .xlsx export.
   ============================================================ */

function renderLaporan(){
  const q = (document.getElementById('searchLaporan')?.value || '').toLowerCase();
  const filtered = items.filter(it => !q || (it.pi_specification||'').toLowerCase().includes(q) || (it.pi_no||'').toLowerCase().includes(q));
  const body = document.getElementById('reportBody');
  if(!body) return;
  if(filtered.length===0){ body.innerHTML = `<tr><td colspan="30" style="text-align:center;color:var(--muted);font-family:'Inter';padding:30px;">Belum ada data</td></tr>`; return; }
  body.innerHTML = filtered.map(it=>{
    const s = itemStats(it);
    return `<tr>
      <td class="col-warehouse">${it.pi_date||''}</td>
      <td>${escapeHtml(it.pi_no||'')}</td>
      <td>${escapeHtml(it.brand||'')}</td>
      <td>${escapeHtml(it.pi_specification||'')}</td>
      <td>${escapeHtml(it.description||'')}</td>
      <td>${it.pi_qty??''}</td>
      <td>${escapeHtml(it.unit||'')}</td>
      <td>${s.lastReceiptDate||'-'}</td>
      <td>${s.receivedQty}</td>
      <td>${escapeHtml(s.lastSupplier||'-')}</td>
      <td>${escapeHtml(s.lastMaterialStatus||'-')}</td>
      <td class="col-qc">${s.lastQcGudangDate||'-'}</td>
      <td>${s.goodQtyGudangSheet}</td>
      <td>${s.goodQtyGudangPcs}</td>
      <td>${s.ngQtyGudang}</td>
      <td>${escapeHtml(s.lastQcGudangStatus||'-')}</td>
      <td class="col-diecut">${s.hasSheetActivity ? (s.lastDiecutDate||'-') : '-'}</td>
      <td>${s.hasSheetActivity ? s.diecutInQty : '-'}</td>
      <td>${s.hasSheetActivity ? s.diecutOutQty : '-'}</td>
      <td>${s.hasSheetActivity ? escapeHtml(s.lastMachineStatus||'-') : '-'}</td>
      <td class="col-qc2">${s.hasSheetActivity ? (s.lastQcDiecutDate||'-') : '-'}</td>
      <td>${s.hasSheetActivity ? s.goodQtyDiecut : '-'}</td>
      <td>${s.hasSheetActivity ? s.ngQtyDiecut : '-'}</td>
      <td>${s.hasSheetActivity ? escapeHtml(s.lastQcDiecutStatus||'-') : '-'}</td>
      <td class="col-supply">${s.lastSupplyDate||'-'}</td>
      <td>${s.suppliedQty}</td>
      <td>${escapeHtml(s.lastSupplyStatus||'-')}</td>
      <td class="col-prod">${s.lastProductionDate||'-'}</td>
      <td>${s.producedQty}</td>
      <td>${escapeHtml(s.lastProdStatus||'-')}</td>
    </tr>`;
  }).join('');
}

/* ---- Excel export (.xlsx rapi, header berkelompok) ---- */
const REPORT_COLUMNS = [
  {h:'PI Date', w:12},
  {h:'PI No', w:16},
  {h:'Brand', w:14},
  {h:'PI Specification', w:20},
  {h:'Description', w:24},
  {h:'PI Qty', w:9},
  {h:'Unit', w:8},
  {h:'Tgl Diterima Gudang', w:14},
  {h:'Qty In (Total)', w:12},
  {h:'Supplier', w:12},
  {h:'Status', w:16},
  {h:'Tgl QC Awal', w:12},
  {h:'Good — Sheet (perlu Diecut)', w:15},
  {h:'Good — Pcs (langsung Suplai)', w:15},
  {h:'N.G Awal (Total)', w:12},
  {h:'Status QC Awal', w:16},
  {h:'Tgl Diecut', w:12},
  {h:'Qty Masuk Diecut', w:13},
  {h:'Qty Keluar Diecut', w:13},
  {h:'Status Diecut', w:16},
  {h:'Tgl QC Ulang', w:12},
  {h:'Good Ulang (Total)', w:12},
  {h:'N.G Ulang (Total)', w:12},
  {h:'Status QC Ulang', w:16},
  {h:'Tgl Masuk Suplai', w:13},
  {h:'Diterima Suplai (Total)', w:14},
  {h:'Status Suplai Terakhir', w:16},
  {h:'Tgl Masuk Produksi', w:13},
  {h:'Terkirim Produksi (Total)', w:14},
  {h:'Status Produksi Terakhir', w:16}
];
const REPORT_GROUPS = [
  {label:'Wharehouse — PI Data', span:11},
  {label:'QC Awal', span:5},
  {label:'Diecut — Divisi Machine', span:4},
  {label:'QC Ulang (Setelah Diecut)', span:4},
  {label:'Suplay Material', span:3},
  {label:'Produksi', span:3}
];

function reportRowValues(it){
  const s = itemStats(it);
  return [it.pi_date, it.pi_no, it.brand, it.pi_specification, it.description, it.pi_qty, it.unit, s.lastReceiptDate, s.receivedQty, s.lastSupplier, s.lastMaterialStatus,
    s.lastQcGudangDate, s.goodQtyGudangSheet, s.goodQtyGudangPcs, s.ngQtyGudang, s.lastQcGudangStatus,
    s.hasSheetActivity ? s.lastDiecutDate : '', s.hasSheetActivity ? s.diecutInQty : '', s.hasSheetActivity ? s.diecutOutQty : '', s.hasSheetActivity ? s.lastMachineStatus : '',
    s.hasSheetActivity ? s.lastQcDiecutDate : '', s.hasSheetActivity ? s.goodQtyDiecut : '', s.hasSheetActivity ? s.ngQtyDiecut : '', s.hasSheetActivity ? s.lastQcDiecutStatus : '',
    s.lastSupplyDate, s.suppliedQty, s.lastSupplyStatus,
    s.lastProductionDate, s.producedQty, s.lastProdStatus
  ].map(v => v ?? '');
}

/* ---- Cetak / PDF (pakai print dialog browser — pilih "Save as PDF" di sana) ---- */
function printReport(){
  switchTab('laporan');
  document.body.classList.add('print-report');
  setTimeout(()=>{ window.print(); }, 80);
}
window.addEventListener('afterprint', ()=> document.body.classList.remove('print-report'));

function exportExcel(){
  if(items.length===0){ showToast('Belum ada data untuk diekspor'); return; }
  if(typeof XLSX === 'undefined'){ showToast('Modul Excel gagal dimuat, cek koneksi internet'); return; }

  const groupRow = [];
  REPORT_GROUPS.forEach(g=>{ groupRow.push(g.label); for(let i=1;i<g.span;i++) groupRow.push(''); });
  const headerRow = REPORT_COLUMNS.map(c=>c.h);
  const dataRows = items.map(reportRowValues);

  const ws = XLSX.utils.aoa_to_sheet([groupRow, headerRow, ...dataRows]);

  // Merge tiap grup header di baris pertama
  let col = 0;
  ws['!merges'] = REPORT_GROUPS.map(g=>{
    const m = { s:{r:0,c:col}, e:{r:0,c:col+g.span-1} };
    col += g.span;
    return m;
  });

  ws['!cols'] = REPORT_COLUMNS.map(c=>({wch:c.w}));
  ws['!rows'] = [{hpx:20},{hpx:24}];
  const lastCol = colLetter(REPORT_COLUMNS.length-1);
  ws['!autofilter'] = { ref: `A2:${lastCol}2` };
  ws['!freeze'] = { xSplit: 0, ySplit: 2, topLeftCell: 'A3', state: 'frozen' };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Order and Status');
  XLSX.writeFile(wb, `data-order-and-status-${new Date().toISOString().slice(0,10)}.xlsx`);
}
