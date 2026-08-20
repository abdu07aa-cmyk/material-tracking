/* ============================================================
   ENTRY MODAL — record partial/staged transactions for each
   pipeline stage (Gudang, QC, Diecut, Suplai, Produksi).
   ============================================================ */

function openEntryModal(stage, itemId, entryId){
  const item = items.find(x=>x.id===itemId);
  const cfg = STAGE[stage];
  document.getElementById('e_stage').value = stage;
  document.getElementById('e_item_id').value = itemId;
  document.getElementById('e_id').value = entryId || '';
  document.getElementById('entryModalHead').style.background = cfg.color;
  document.getElementById('entryEyebrow').textContent = cfg.label;

  ['gudang','qc','diecut','suplai','produksi'].forEach(k=> document.getElementById('eblock-'+k).classList.toggle('hidden', k!==stage));

  const s = itemStats(item);
  document.getElementById('entryRefBlock').innerHTML =
    `Barang: <b>${escapeHtml(item.pi_specification||'-')}</b> &nbsp;|&nbsp; PI No: <b>${escapeHtml(item.pi_no||'-')}</b><br>
    Diterima Gudang: <b>${s.receivedQty}</b> ${escapeHtml(item.unit||'')} · QC Awal — Good Sheet (perlu Diecut): <b>${s.goodQtyGudangSheet}</b> · Good Pcs (langsung Suplai): <b>${s.goodQtyGudangPcs}</b> · N.G: <b>${s.ngQtyGudang}</b><br>
    Diecut (masuk/keluar): <b>${s.diecutInQty}/${s.diecutOutQty}</b> · QC Ulang (good/ng): <b>${s.goodQtyDiecut}/${s.ngQtyDiecut}</b> · Ke Suplai: <b>${s.suppliedQty}</b> · Ke Produksi: <b>${s.producedQty}</b>`;

  FIELDS_BY_STAGE[stage].forEach(f=>{
    const el = document.getElementById(entryFieldElId(stage, f));
    if(el) el.value = '';
  });
  if(stage==='qc' && !entryId){
    // Default cerdas (bisa diganti manual): kalau ada Qty Diecut yang sudah keluar tapi belum di-QC-ulang, arahkan ke QC Ulang.
    document.getElementById('e_source_stage').value = (s.remainToQcDiecut>0) ? 'Diecut' : 'Gudang';
    // Bentuk yang diperiksa default mengikuti SJ/DO Unit dari penerimaan gudang terakhir.
    const lastReceiptUnit = s.rec.length ? s.rec[s.rec.length-1].sj_do_unit : null;
    document.getElementById('e_bentuk_diperiksa').value = (lastReceiptUnit==='Sheet') ? 'Sheet' : 'Pcs';
  }
  if(stage==='qc') toggleQcBentukField();
  document.getElementById('entryDeleteBtn').classList.add('hidden');
  document.getElementById('entryModalTitle').textContent = 'Catat ' + cfg.label;

  if(entryId){
    const row = cfg.arr().find(x=>x.id===entryId);
    if(row){
      FIELDS_BY_STAGE[stage].forEach(f=>{
        const el = document.getElementById(entryFieldElId(stage, f));
        if(el) el.value = row[f] ?? '';
      });
      document.getElementById('entryDeleteBtn').classList.remove('hidden');
      document.getElementById('entryModalTitle').textContent = 'Edit Transaksi ' + cfg.label;
    }
    if(stage==='qc') toggleQcBentukField();
  }
  document.getElementById('entryModal').classList.add('open');
}
function closeEntryModal(){ document.getElementById('entryModal').classList.remove('open'); }

function toggleQcBentukField(){
  const isGudang = document.getElementById('e_source_stage').value === 'Gudang';
  document.getElementById('qcBentukFieldWrap').classList.toggle('hidden', !isGudang);
}

async function saveEntry(){
  const stage = document.getElementById('e_stage').value;
  const itemId = document.getElementById('e_item_id').value;
  const id = document.getElementById('e_id').value;
  const cfg = STAGE[stage];
  const payload = { pi_item_id: itemId };
  FIELDS_BY_STAGE[stage].forEach(f=>{
    const val = document.getElementById(entryFieldElId(stage, f)).value;
    payload[f] = val === '' ? null : val;
  });
  let error;
  if(id){ ({error} = await supabaseClient.from(cfg.table).update(payload).eq('id', id)); }
  else { ({error} = await supabaseClient.from(cfg.table).insert(payload)); }
  if(error){ showToast('Gagal menyimpan: '+error.message); return; }
  showToast('Transaksi tersimpan');
  closeEntryModal();
  loadAll();
}

async function deleteEntry(){
  const stage = document.getElementById('e_stage').value;
  const id = document.getElementById('e_id').value;
  if(!id) return;
  if(!confirm('Hapus transaksi ini?')) return;
  const {error} = await supabaseClient.from(STAGE[stage].table).delete().eq('id', id);
  if(error){ showToast('Gagal menghapus: '+error.message); return; }
  showToast('Transaksi dihapus');
  closeEntryModal();
  loadAll();
}
