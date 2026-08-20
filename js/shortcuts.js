/* ============================================================
   SHORTCUTS — "/" fokus ke kolom cari tab yang sedang aktif,
   "Esc" menutup modal yang sedang terbuka. Tidak mengubah
   perilaku klik/tombol yang sudah ada.
   ============================================================ */

const SEARCH_ID_BY_TAB = {
  gudang:'searchGudang', qc:'searchQc', diecut:'searchDiecut',
  suplai:'searchSuplai', produksi:'searchProduksi', laporan:'searchLaporan'
};

document.addEventListener('keydown', function(e){
  const typingInField = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);

  if(e.key === '/' && !typingInField){
    e.preventDefault();
    const activeTabBtn = document.querySelector('.tab-btn.active');
    const tab = activeTabBtn ? activeTabBtn.dataset.tab : 'dashboard';
    const id = SEARCH_ID_BY_TAB[tab];
    const el = id ? document.getElementById(id) : null;
    if(el){ el.focus(); el.select(); }
    return;
  }

  if(e.key === 'Escape'){
    document.querySelectorAll('.modal-backdrop.open').forEach(m=>m.classList.remove('open'));
  }
});
