// ==========================================
// 1. KONFIGURASI SUPABASE (API DISINI)
// ==========================================
const SUPABASE_URL = 'https://rdzrzzjykhbqvaaxdrvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkenJ6emp5a2hicXZhYXhkcnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NTU3MTEsImV4cCI6MjEwMTUzMTcxMX0.sF3NqFM6ldqEAsd0Mq_wKUvfkoACAlohM5VW92zhcKg';

// Inisialisasi Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. LOGIKA AUTENTIKASI (LOGIN & LOGOUT)
// ==========================================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        document.getElementById('login-error').classList.remove('hidden');
    } else {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        showForm('incoming', null); // Tampilkan form default
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

// ==========================================
// 3. LOGIKA UI & RENDER FORM
// ==========================================
function showForm(role, event) {
    // Reset warna tombol
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('bg-blue-100', 'text-blue-700');
        btn.classList.add('bg-gray-100', 'text-gray-700');
    });
    
    // Ubah warna tombol yang diklik
    if (event) {
        event.target.classList.remove('bg-gray-100', 'text-gray-700');
        event.target.classList.add('bg-blue-100', 'text-blue-700');
    }

    // Render form HTML berdasarkan role
    const container = document.getElementById('form-container');
    
    if (role === 'incoming') {
        container.innerHTML = `
            <h2 class="text-lg font-bold mb-4 border-b pb-2">Input Incoming Material</h2>
            <form id="form-incoming" class="space-y-3">
                <input type="text" id="in_pi" placeholder="PI NO" required class="w-full p-2 border rounded">
                <input type="text" id="in_brand" placeholder="Brand" class="w-full p-2 border rounded">
                <input type="text" id="in_spec" placeholder="Spesifikasi" class="w-full p-2 border rounded">
                <input type="number" id="in_qtypo" placeholder="Qty PO" class="w-full p-2 border rounded">
                <input type="text" id="in_sj" placeholder="No SJ / DO" class="w-full p-2 border rounded">
                <input type="number" id="in_qtysj" placeholder="Qty SJ" class="w-full p-2 border rounded">
                <button type="submit" class="w-full bg-green-600 text-white p-2 rounded font-bold mt-4">Simpan Data</button>
            </form>
        `;
        document.getElementById('form-incoming').addEventListener('submit', submitIncoming);
    } 
    else if (role === 'qc') {
        container.innerHTML = `
            <h2 class="text-lg font-bold mb-4 border-b pb-2">Input QC Incoming</h2>
            <form id="form-qc" class="space-y-3">
                <input type="text" id="qc_pi" placeholder="PI NO (Cari data gudang)" required class="w-full p-2 border rounded">
                <input type="number" id="qc_good" placeholder="Good Material" class="w-full p-2 border rounded">
                <input type="number" id="qc_ng" placeholder="NG Material" class="w-full p-2 border rounded">
                <input type="text" id="qc_desc" placeholder="Description" class="w-full p-2 border rounded">
                <button type="submit" class="w-full bg-green-600 text-white p-2 rounded font-bold mt-4">Simpan Data</button>
            </form>
        `;
        document.getElementById('form-qc').addEventListener('submit', submitQC);
    }
    // Anda bisa menambahkan logika untuk 'supply' dan 'finish' di sini seperti sebelumnya
}

// ==========================================
// 4. LOGIKA SIMPAN KE SUPABASE
// ==========================================
async function submitIncoming(e) {
    e.preventDefault();
    const qtyPo = parseInt(document.getElementById('in_qtypo').value) || 0;
    const qtySj = parseInt(document.getElementById('in_qtysj').value) || 0;
    const balance = qtyPo - qtySj; 

    // Gunakan supabaseClient (bukan supabase) karena sudah diinisialisasi di atas
    const { error } = await supabaseClient.from('incoming_material').insert([{
        pi_no: document.getElementById('in_pi').value,
        brand: document.getElementById('in_brand').value,
        spesifikasi: document.getElementById('in_spec').value,
        qty_po: qtyPo,
        no_sj: document.getElementById('in_sj').value,
        qty_sj: qtySj,
        total_incoming: qtySj,
        balance: balance
    }]);
    
    if (error) alert('Gagal: ' + error.message);
    else { alert('Data Gudang Berhasil Disimpan!'); e.target.reset(); }
}

async function submitQC(e) {
    e.preventDefault();
    const good = parseInt(document.getElementById('qc_good').value) || 0;
    const ng = parseInt(document.getElementById('qc_ng').value) || 0;
    
    const { error } = await supabaseClient.from('qc_incoming').insert([{
        pi_no: document.getElementById('qc_pi').value,
        good_material: good,
        ng_material: ng,
        description: document.getElementById('qc_desc').value,
        balance: good - ng
    }]);
    
    if (error) alert('Gagal: ' + error.message + ' (Pastikan PI NO sudah diinput Gudang)');
    else { alert('Data QC Berhasil Disimpan!'); e.target.reset(); }
}
