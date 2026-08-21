/* ============================================================
   ROLES — pemisahan halaman kerja per divisi. Tidak menambah
   tabel Supabase apa pun: peran & PIN admin disimpan lokal di
   browser (localStorage), murni untuk memisahkan tampilan/hak
   akses UI, bukan sistem otentikasi server yang sesungguhnya.
   ============================================================ */

const ROLE_STORAGE_KEY = 'mt_role';
const ADMIN_PIN_KEY = 'mt_admin_pin';

const ROLES = {
  admin:    { id:'admin',    label:'Admin',            icon:'🛡️', tabs:['dashboard','pi','gudang','qc','diecut','suplai','produksi','laporan'], home:'dashboard' },
  gudang:   { id:'gudang',   label:'Gudang',           icon:'🏭', tabs:['gudang'],   home:'gudang' },
  qc:       { id:'qc',       label:'Quality Control',  icon:'✅', tabs:['qc'],       home:'qc' },
  diecut:   { id:'diecut',   label:'Diecut',           icon:'⚙️', tabs:['diecut'],   home:'diecut' },
  suplai:   { id:'suplai',   label:'Suplai Material',  icon:'🚚', tabs:['suplai'],   home:'suplai' },
  produksi: { id:'produksi', label:'Produksi',         icon:'🏗️', tabs:['produksi'], home:'produksi' }
};

let currentRole = null;

function isAdmin(){ return currentRole === 'admin'; }
function roleAllowsTab(tab){ return !!currentRole && ROLES[currentRole].tabs.includes(tab); }

function hasAdminPin(){ return !!localStorage.getItem(ADMIN_PIN_KEY); }
function setAdminPin(pin){ localStorage.setItem(ADMIN_PIN_KEY, pin); }
function checkAdminPin(pin){ return localStorage.getItem(ADMIN_PIN_KEY) === pin; }

/* ---------- Role picker screen ---------- */
function renderRoleGrid(){
  const grid = document.getElementById('roleGrid');
  grid.innerHTML = Object.values(ROLES).map(r => `
    <button type="button" class="role-btn" onclick="chooseRole('${r.id}')">
      <span class="role-icon">${r.icon}</span>
      <span class="role-name">${r.label}</span>
    </button>`).join('');
  document.getElementById('adminPinBlock').classList.add('hidden');
  document.getElementById('adminPinInput').value = '';
}

function chooseRole(roleId){
  if(roleId === 'admin'){
    document.getElementById('adminPinLabel').textContent = hasAdminPin()
      ? 'Masukkan PIN Admin'
      : 'Buat PIN Admin baru (min. 4 digit) — dipakai lagi nanti untuk masuk sebagai Admin';
    document.getElementById('adminPinBlock').classList.remove('hidden');
    document.getElementById('adminPinInput').focus();
    return;
  }
  setRoleAndBoot(roleId);
}

function submitAdminPin(){
  const pin = document.getElementById('adminPinInput').value.trim();
  if(pin.length < 4){ showToast('PIN minimal 4 digit'); return; }
  if(!hasAdminPin()){ setAdminPin(pin); setRoleAndBoot('admin'); return; }
  if(checkAdminPin(pin)){ setRoleAndBoot('admin'); return; }
  showToast('PIN salah');
}

function cancelAdminPin(){
  document.getElementById('adminPinBlock').classList.add('hidden');
  document.getElementById('adminPinInput').value = '';
}

function setRoleAndBoot(roleId){
  currentRole = roleId;
  localStorage.setItem(ROLE_STORAGE_KEY, roleId);
  showAppForRole();
}

function switchRole(){
  currentRole = null;
  localStorage.removeItem(ROLE_STORAGE_KEY);
  document.getElementById('app').classList.add('hidden');
  document.getElementById('fabAdd').classList.add('hidden');
  showRoleScreen();
}

function showRoleScreen(){
  document.getElementById('setupScreen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('fabAdd').classList.add('hidden');
  renderRoleGrid();
  document.getElementById('roleScreen').classList.remove('hidden');
}

function showAppForRole(){
  document.getElementById('roleScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  applyRoleUI();
  loadAll();
}

/* Filters the tab bar + header chip to whatever the active role is allowed to see. */
function applyRoleUI(){
  const role = ROLES[currentRole];
  document.getElementById('roleChip').innerHTML = `${role.icon} <span>${role.label}</span>`;
  document.getElementById('exportGlobalBtn').classList.toggle('hidden', !isAdmin());

  document.querySelectorAll('.tab-btn').forEach(btn=>{
    const allowed = role.tabs.includes(btn.dataset.tab);
    btn.classList.toggle('hidden', !allowed);
  });

  switchTab(role.home);
}
