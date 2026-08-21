/* ============================================================
   ITEM MODAL — create/edit rows in pi_items. Supports adding
   several jenis barang under one PI at creation time.
   ============================================================ */

let itemRowKeys = [];
let itemRowSeq = 0;

function rowTemplate(key, num, data){
  data = data || {};
  return `
  <div class="item-row" data-row-key="${key}">
    <div class="row-num">Barang ${num}</div>
    <button type="button" class="remove-row" onclick="removeItemRow('${key}')" title="Hapus baris">✕</button>
    <div class="field">
      <label>PI Specification (jenis barang)</label>
      <input id="row_${key}_spec" placeholder="Nama / jenis barang" value="${escapeHtml(data.pi_specification||'')}">
    </div>
    <div class="field">
      <label>Description</label>
      <input id="row_${key}_desc" placeholder="Keterangan tambahan (opsional)" value="${escapeHtml(data.description||'')}">
    </div>
    <div class="row-fields-2">
      <div class="field"><label>PI Qty</label><input type="number" id="row_${key}_qty" value="${data.pi_qty??''}"></div>
      <div class="field"><label>Unit</label><input id="row_${key}_unit" placeholder="pcs/kg" value="${escapeHtml(data.unit||'')}"></div>
    </div>
  </div>`;
}

function renumberRows(){
  const container = document.getElementById('itemRowsContainer');
  [...container.children].forEach((el, i)=>{
    el.querySelector('.row-num').textContent = 'Barang ' + (i+1);
    el.querySelector('.remove-row').classList.toggle('hidden', itemRowKeys.length<=1);
  });
}

function addItemRow(data){
  const key = 'r' + (itemRowSeq++);
  itemRowKeys.push(key);
  const container = document.getElementById('itemRowsContainer');
  container.insertAdjacentHTML('beforeend', rowTemplate(key, itemRowKeys.length, data));
  renumberRows();
}

function removeItemRow(key){
  if(itemRowKeys.length<=1) return;
  itemRowKeys = itemRowKeys.filter(k=>k!==key);
  const el = document.querySelector(`.item-row[data-row-key="${key}"]`);
  if(el) el.remove();
  renumberRows();
}

function openItemModal(id){
  if(!isAdmin()){ showToast('Hanya Admin yang bisa mengelola Data PI'); return; }
  document.getElementById('i_id').value = id || '';
  document.getElementById('itemRowsContainer').innerHTML = '';
  itemRowKeys = [];

  if(id){
    const it = items.find(x=>x.id===id);
    document.getElementById('itemModalTitle').textContent = 'Edit Jenis Barang';
    document.getElementById('itemDeleteBtn').classList.remove('hidden');
    document.getElementById('itemDuplicateBtn').classList.remove('hidden');
    document.getElementById('i_pi_no').value = it.pi_no || '';
    document.getElementById('i_pi_date').value = it.pi_date || '';
    document.getElementById('i_brand').value = it.brand || '';
    document.getElementById('itemRowsLabel').textContent = 'Jenis Barang';
    document.getElementById('itemRowsHint').textContent = 'Mengedit satu jenis barang ini saja.';
    document.getElementById('addRowBtn').classList.add('hidden');
    addItemRow({pi_specification: it.pi_specification, description: it.description, pi_qty: it.pi_qty, unit: it.unit});
  } else {
    document.getElementById('itemModalTitle').textContent = 'Tambah PI Baru';
    document.getElementById('itemDeleteBtn').classList.add('hidden');
    document.getElementById('itemDuplicateBtn').classList.add('hidden');
    ['i_pi_no','i_pi_date','i_brand'].forEach(f=>document.getElementById(f).value='');
    document.getElementById('itemRowsLabel').textContent = 'Jenis Barang dalam PI Ini';
    document.getElementById('itemRowsHint').textContent = 'Satu PI bisa berisi beberapa jenis barang — tambah barisnya satu per satu.';
    document.getElementById('addRowBtn').classList.remove('hidden');
    addItemRow();
  }
  document.getElementById('itemModal').classList.add('open');
}
function closeItemModal(){ document.getElementById('itemModal').classList.remove('open'); }

async function saveItem(){
  if(!isAdmin()){ showToast('Hanya Admin yang bisa mengelola Data PI'); return; }
  const id = document.getElementById('i_id').value;
  const pi_no = document.getElementById('i_pi_no').value || null;
  const pi_date = document.getElementById('i_pi_date').value || null;
  const brand = document.getElementById('i_brand').value || null;

  if(id){
    const key = itemRowKeys[0];
    const payload = {
      pi_no, pi_date, brand,
      pi_specification: document.getElementById('row_'+key+'_spec').value || null,
      description: document.getElementById('row_'+key+'_desc').value || null,
      pi_qty: document.getElementById('row_'+key+'_qty').value || null,
      unit: document.getElementById('row_'+key+'_unit').value || null
    };
    const {error} = await supabaseClient.from('pi_items').update(payload).eq('id', id);
    if(error){ showToast('Gagal menyimpan: '+error.message); return; }
    showToast('Data barang tersimpan');
    closeItemModal();
    loadAll();
    return;
  }

  const rows = itemRowKeys.map(key=>({
    pi_no, pi_date, brand,
    pi_specification: document.getElementById('row_'+key+'_spec').value || null,
    description: document.getElementById('row_'+key+'_desc').value || null,
    pi_qty: document.getElementById('row_'+key+'_qty').value || null,
    unit: document.getElementById('row_'+key+'_unit').value || null
  })).filter(r=> r.pi_specification || r.pi_qty);

  if(rows.length===0){ showToast('Isi minimal 1 jenis barang'); return; }

  const {error} = await supabaseClient.from('pi_items').insert(rows);
  if(error){ showToast('Gagal menyimpan: '+error.message); return; }
  showToast(rows.length>1 ? `${rows.length} jenis barang tersimpan` : 'Data barang tersimpan');
  closeItemModal();
  loadAll();
}

// Menyalin data barang (brand, spec, description, unit) ke form "Tambah PI Baru"
// supaya cepat bikin PI baru yang serupa. Tidak langsung menulis ke Supabase —
// user tetap mengisi PI No/Date/Qty baru lalu menekan Simpan sendiri.
function duplicateItem(){
  if(!isAdmin()) return;
  const id = document.getElementById('i_id').value;
  if(!id) return;
  const it = items.find(x=>x.id===id);
  if(!it) return;
  closeItemModal();
  setTimeout(()=>{
    openItemModal();
    document.getElementById('i_brand').value = it.brand || '';
    const key = itemRowKeys[0];
    document.getElementById('row_'+key+'_spec').value = it.pi_specification || '';
    document.getElementById('row_'+key+'_desc').value = it.description || '';
    document.getElementById('row_'+key+'_unit').value = it.unit || '';
    showToast('Data disalin — isi PI No, PI Date & Qty baru lalu Simpan');
  }, 50);
}

async function deleteItem(){
  if(!isAdmin()){ showToast('Hanya Admin yang bisa menghapus Data PI'); return; }
  const id = document.getElementById('i_id').value;
  if(!id) return;
  if(!confirm('Hapus jenis barang ini beserta SEMUA riwayat transaksi Gudang/QC/Diecut/Suplai/Produksi-nya? Tindakan ini permanen.')) return;
  const {error} = await supabaseClient.from('pi_items').delete().eq('id', id);
  if(error){ showToast('Gagal menghapus: '+error.message); return; }
  showToast('Barang dihapus');
  closeItemModal();
  loadAll();
}
