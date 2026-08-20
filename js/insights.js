/* ============================================================
   INSIGHTS — "Perlu Perhatian": daftar barang yang macet lebih
   dari ATTENTION_STALE_DAYS hari di satu tahap. Murni turunan
   dari data yang sudah ada (tidak menambah tabel baru).
   ============================================================ */

function renderAttentionPanel(){
  const wrap = document.getElementById('attentionWrap');
  const list = document.getElementById('attentionList');
  if(!wrap || !list) return;

  if(items.length===0){ wrap.classList.add('hidden'); return; }

  const attn = computeAttentionItems();
  if(attn.length===0){ wrap.classList.add('hidden'); list.innerHTML=''; return; }

  wrap.classList.remove('hidden');
  list.innerHTML = attn.slice(0,8).map(({item, bottleneck, days})=>{
    const dayLabel = days===null ? 'Belum ada aktivitas' : `${days} hari tanpa progres`;
    return `
    <div class="attn-row" onclick="switchTab('${bottleneck.tab}')" title="Buka tab ${escapeHtml(bottleneck.label)}">
      <div class="attn-main">
        <div class="attn-name">${escapeHtml(item.pi_specification || '(Belum diberi nama)')}</div>
        <div class="attn-meta">PI ${escapeHtml(item.pi_no||'-')} · Menunggu di <b>${escapeHtml(bottleneck.label)}</b></div>
      </div>
      <span class="badge ${days!==null && days>=7 ? 'badge-red' : 'badge-amber'}">${dayLabel}</span>
    </div>`;
  }).join('') + (attn.length>8 ? `<div class="history-empty">+${attn.length-8} barang lain juga perlu ditinjau</div>` : '');
}
