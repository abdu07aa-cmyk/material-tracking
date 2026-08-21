/* ============================================================
   STATE — in-memory mirrors of the Supabase tables.
   loadAll() re-reads everything and re-renders all views.
   ============================================================ */

let supabaseClient = null;
let items=[], receipts=[], qcEntries=[], machineEntries=[], supplyEntries=[], productionEntries=[];

async function loadAll(){
  const [i,r,q,m,s,p] = await Promise.all([
    supabaseClient.from('pi_items').select('*').order('created_at',{ascending:false}),
    supabaseClient.from('receipts').select('*').order('created_at',{ascending:true}),
    supabaseClient.from('qc_entries').select('*').order('created_at',{ascending:true}),
    supabaseClient.from('machine_entries').select('*').order('created_at',{ascending:true}),
    supabaseClient.from('supply_entries').select('*').order('created_at',{ascending:true}),
    supabaseClient.from('production_entries').select('*').order('created_at',{ascending:true}),
  ]);
  const errs = [i,r,q,m,s,p].map(x=>x.error).filter(Boolean);
  if(errs.length){ showToast('Gagal memuat data: '+errs[0].message); return; }
  items = i.data||[]; receipts = r.data||[]; qcEntries = q.data||[]; machineEntries = m.data||[]; supplyEntries = s.data||[]; productionEntries = p.data||[];
  renderDashboard();
  renderStage('gudang'); renderStage('qc'); renderStage('diecut'); renderStage('suplai'); renderStage('produksi');
  renderLaporan();
  if(typeof renderPiAdmin === 'function') renderPiAdmin();
}
