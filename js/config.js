/* ============================================================
   CONFIG — stage → Supabase table mapping and form field lists.
   These map 1:1 onto the existing Supabase schema. Table and
   column names below must never be changed without a matching
   migration, since they are the live schema already in use.
   ============================================================ */

// Populated lazily so STAGE.<x>.arr() always reads current in-memory state.
const STAGE = {
  gudang:   { table:'receipts',           arr:()=>receipts,          qtyField:'sj_do_qty',     color:'var(--steel)', label:'Gudang',           dateField:'sj_do_date' },
  qc:       { table:'qc_entries',         arr:()=>qcEntries,         qtyField:null,             color:'var(--amber)', label:'Quality Control',  dateField:'inspection_date' },
  diecut:   { table:'machine_entries',    arr:()=>machineEntries,    qtyField:'qty_out',        color:'var(--rust)',  label:'Diecut',           dateField:'machine_date' },
  suplai:   { table:'supply_entries',     arr:()=>supplyEntries,     qtyField:'supply_qty',     color:'var(--green)', label:'Suplai Material',  dateField:'supply_date' },
  produksi: { table:'production_entries', arr:()=>productionEntries, qtyField:'production_qty', color:'var(--violet)',label:'Produksi',         dateField:'production_date' }
};

const FIELDS_BY_STAGE = {
  gudang:   ['supplier','sj_do_no','sj_do_date','sj_do_qty','sj_do_unit','delivery_date_to_qc','status_material'],
  qc:       ['source_stage','bentuk_diperiksa','inspection_date','good_material','ng_material','qc_status','delivery_supply_material'],
  diecut:   ['machine_date','qty_in','qty_out','machine_status','notes'],
  suplai:   ['supply_date','supply_qty','total_material','supply_status'],
  produksi: ['production_date','production_qty','production_status','notes']
};

// diecut's "notes" field uses a differently-named input id (e_diecut_notes) to avoid
// clashing with produksi's "notes" input (e_notes) since both share the same modal.
function entryFieldElId(stage, f){
  if(stage==='diecut' && f==='notes') return 'e_diecut_notes';
  return 'e_'+f;
}
