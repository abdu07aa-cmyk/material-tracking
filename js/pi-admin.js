/* ============================================================
   PI ADMIN — halaman khusus Admin untuk membuat & mengoreksi
   Data PI (pi_items). Divisi lain (Gudang/QC/Diecut/Suplai/
   Produksi) tidak melihat tab ini sama sekali.
   ============================================================ */

function renderPiAdmin(){
  const body = document.getElementById('piAdminBody');
  if(!body) return;
  const q = (document.getElementById('searchPi')?.value || '').toLowerCase();
  const filtered = items.filter(it => !q || (it.pi_specification||'').toLowerCase().includes(q) || (it.pi_no||'').toLowerCase().includes(q));

  document.getElementById('piAdminCount').textContent = `${items.length} jenis barang terdaftar`;

  if(filtered.length===0){
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:26px;font-family:'Inter';">Belum ada Data PI. Klik "+ Tambah PI" untuk membuat yang pertama.</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map(it=>{
    const s = itemStats(it);
    return `<tr>
      <td>${it.pi_date||'-'}</td>
      <td>${escapeHtml(it.pi_no||'-')}</td>
      <td>${escapeHtml(it.brand||'-')}</td>
      <td>${escapeHtml(it.pi_specification||'-')}</td>
      <td>${it.pi_qty??'-'} ${escapeHtml(it.unit||'')}</td>
      <td>${s.receivedQty}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="openItemModal('${it.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="openTimelineModal('${it.id}')">Riwayat</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}
