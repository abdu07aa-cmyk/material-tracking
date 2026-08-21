/* ============================================================
   TABS — top-level navigation between the seven views.
   ============================================================ */

function switchTab(tab){
  if(!roleAllowsTab(tab)) return;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  ['dashboard','pi','gudang','qc','diecut','suplai','produksi','laporan'].forEach(t=>{
    document.getElementById('tab-'+t).classList.toggle('hidden', t!==tab);
  });
  document.getElementById('fabAdd').classList.toggle('hidden', !(isAdmin() && tab==='pi'));
  if(['gudang','qc','diecut','suplai','produksi'].includes(tab)) renderStage(tab);
  if(tab==='laporan') renderLaporan();
  if(tab==='pi') renderPiAdmin();
  if(tab==='dashboard') renderDashboard();
}
