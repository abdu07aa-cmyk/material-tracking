/* ============================================================
   TABS — top-level navigation between the seven views.
   ============================================================ */

function switchTab(tab){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  ['dashboard','gudang','qc','diecut','suplai','produksi','laporan'].forEach(t=>{
    document.getElementById('tab-'+t).classList.toggle('hidden', t!==tab);
  });
  document.getElementById('fabAdd').classList.toggle('hidden', tab==='dashboard' || tab==='laporan');
  if(['gudang','qc','diecut','suplai','produksi'].includes(tab)) renderStage(tab);
  if(tab==='laporan') renderLaporan();
}
