/* ============================================================
   AGGREGATE — derive per-item pipeline totals from the raw
   transaction rows. Pure functions, no DOM/Supabase access.
   ============================================================ */

function childrenOf(arr, itemId){ return arr.filter(x=>x.pi_item_id===itemId); }
function sumQty(arr, field){ return arr.reduce((s,x)=> s + (Number(x[field])||0), 0); }
function lastVal(arr, field){ return arr.length ? (arr[arr.length-1][field] ?? null) : null; }

function itemStats(item){
  const rec = childrenOf(receipts, item.id);
  const qcAll = childrenOf(qcEntries, item.id);
  const mac = childrenOf(machineEntries, item.id);
  const sup = childrenOf(supplyEntries, item.id);
  const prod = childrenOf(productionEntries, item.id);

  // QC Awal = pemeriksaan barang yang baru datang dari Gudang. Tiap batch QC Awal
  // dicatat manual bentuknya: Sheet (perlu Diecut dulu) atau Pcs (langsung ke Suplai) —
  // karena dalam 1 PI yang sama, kiriman supplier bisa campur Sheet dan Pcs.
  // QC Ulang = pemeriksaan barang yang baru selesai dipotong di Diecut (otomatis sudah Pcs).
  const qcGudang = qcAll.filter(e => (e.source_stage||'Gudang') !== 'Diecut');
  const qcDiecut = qcAll.filter(e => e.source_stage === 'Diecut');
  const qcGudangSheet = qcGudang.filter(e => e.bentuk_diperiksa === 'Sheet');
  const qcGudangPcs = qcGudang.filter(e => e.bentuk_diperiksa !== 'Sheet');

  const receivedQty = sumQty(rec,'sj_do_qty');
  const goodQtyGudangSheet = sumQty(qcGudangSheet,'good_material');
  const ngQtyGudangSheet = sumQty(qcGudangSheet,'ng_material');
  const goodQtyGudangPcs = sumQty(qcGudangPcs,'good_material');
  const ngQtyGudangPcs = sumQty(qcGudangPcs,'ng_material');
  const goodQtyGudang = goodQtyGudangSheet + goodQtyGudangPcs;
  const ngQtyGudang = ngQtyGudangSheet + ngQtyGudangPcs;
  const qcGudangQty = goodQtyGudang + ngQtyGudang;
  const goodQtyDiecut = sumQty(qcDiecut,'good_material');
  const ngQtyDiecut = sumQty(qcDiecut,'ng_material');
  const qcDiecutQty = goodQtyDiecut + ngQtyDiecut;
  const diecutInQty = sumQty(mac,'qty_in');
  const diecutOutQty = sumQty(mac,'qty_out');
  const suppliedQty = sumQty(sup,'supply_qty');
  const producedQty = sumQty(prod,'production_qty');

  // Barang yang lolos QC Awal dalam bentuk Pcs langsung siap ke Suplai;
  // yang masih Sheet harus lewat Diecut lalu QC Ulang dulu baru siap ke Suplai.
  const supplyBase = goodQtyGudangPcs + goodQtyDiecut;
  const hasSheetActivity = goodQtyGudangSheet>0 || diecutInQty>0 || diecutOutQty>0 || qcDiecutQty>0;

  const remainToQcGudang = Math.max(0, receivedQty - qcGudangQty);
  const remainToQcDiecut = Math.max(0, diecutOutQty - qcDiecutQty);

  return {
    hasSheetActivity, rec, qcAll, qcGudang, qcDiecut, mac, sup, prod,
    receivedQty,
    goodQtyGudangSheet, ngQtyGudangSheet, goodQtyGudangPcs, ngQtyGudangPcs,
    goodQtyGudang, ngQtyGudang, qcGudangQty,
    goodQtyDiecut, ngQtyDiecut, qcDiecutQty,
    goodQty: goodQtyGudang + goodQtyDiecut, ngQty: ngQtyGudang + ngQtyDiecut,
    diecutInQty, diecutOutQty, suppliedQty, producedQty, supplyBase,
    remainToQcGudang, remainToQcDiecut,
    remainToQc: remainToQcGudang + remainToQcDiecut,
    remainToDiecut: Math.max(0, goodQtyGudangSheet - diecutInQty),
    remainToSupply: Math.max(0, supplyBase - suppliedQty),
    remainToProduction: Math.max(0, suppliedQty - producedQty),
    lastMaterialStatus: lastVal(rec,'status_material'),
    lastSupplier: lastVal(rec,'supplier'),
    lastQcGudangStatus: lastVal(qcGudang,'qc_status'),
    lastQcDiecutStatus: lastVal(qcDiecut,'qc_status'),
    lastQcStatus: lastVal(qcAll,'qc_status'),
    lastMachineStatus: lastVal(mac,'machine_status'),
    lastSupplyStatus: lastVal(sup,'supply_status'),
    lastProdStatus: lastVal(prod,'production_status'),
    lastReceiptDate: lastVal(rec,'sj_do_date'),
    lastQcGudangDate: lastVal(qcGudang,'inspection_date'),
    lastQcDiecutDate: lastVal(qcDiecut,'inspection_date'),
    lastDiecutDate: lastVal(mac,'machine_date'),
    lastSupplyDate: lastVal(sup,'supply_date'),
    lastProductionDate: lastVal(prod,'production_date')
  };
}
