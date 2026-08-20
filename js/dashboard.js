/* ============================================================
   DASHBOARD — top-line stat cards and recent activity feed.
   ============================================================ */

function renderDashboard(){
  document.getElementById('statItems').textContent = items.length;
  let pendingQc=0, goodTotal=0, prodTotal=0;
  items.forEach(it=>{
    const s = itemStats(it);
    if(s.remainToQc>0) pendingQc++;
    goodTotal += s.goodQty;
    prodTotal += s.producedQty;
  });
  document.getElementById('statPendingQc').textContent = pendingQc;
  document.getElementById('statGoodQty').textContent = goodTotal;
  document.getElementById('statProdQty').textContent = prodTotal;

  const recent = items.slice(0,5);
  const el = document.getElementById('recentList');
  if(recent.length===0){
    el.innerHTML = `<div class="empty"><div class="glyph">📦</div><div class="msg">Belum ada barang. Buka menu Gudang untuk menambah jenis barang pertama.</div></div>`;
    return;
  }
  el.innerHTML = recent.map(it=>itemCardHTML(it,'gudang',true)).join('');
}
