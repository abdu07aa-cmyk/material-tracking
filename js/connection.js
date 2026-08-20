/* ============================================================
   CONNECTION — Supabase project setup screen. Reads/writes only
   the URL and anon key from localStorage; never touches table
   data or schema.
   ============================================================ */

function initSupabase(){
  const url = localStorage.getItem('mt_supabase_url');
  const key = localStorage.getItem('mt_supabase_key');
  if(!url || !key){ document.getElementById('setupScreen').classList.remove('hidden'); return false; }
  supabaseClient = window.supabase.createClient(url, key);
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('setupScreen').classList.add('hidden');
  document.getElementById('fabAdd').classList.remove('hidden');
  loadAll();
  return true;
}

function saveSetup(){
  const url = document.getElementById('setupUrl').value.trim();
  const key = document.getElementById('setupKey').value.trim();
  if(!url || !key){ showToast('Isi URL dan Key terlebih dahulu'); return; }
  localStorage.setItem('mt_supabase_url', url);
  localStorage.setItem('mt_supabase_key', key);
  document.getElementById('setupScreen').classList.add('hidden');
  initSupabase();
}

function openSettings(){
  document.getElementById('app').classList.add('hidden');
  document.getElementById('fabAdd').classList.add('hidden');
  document.getElementById('setupUrl').value = localStorage.getItem('mt_supabase_url') || '';
  document.getElementById('setupKey').value = localStorage.getItem('mt_supabase_key') || '';
  document.getElementById('setupScreen').classList.remove('hidden');
}
