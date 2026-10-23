// STATE GLOBAL
let currentTable = 'incoming_material';

// ==========================================
// FUNGSI NOTIFIKASI (TOAST)
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    // Desain Toast
    const bgColor = type === 'success' ? 'bg-emerald-500' : 'bg-red-500';
    const icon = type === 'success' 
        ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
        : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';

    toast.className = `toast-animate flex items-center gap-3 px-4 py-3 rounded-xl text-white shadow-lg pointer-events-auto ${bgColor}`;
    toast.innerHTML = `${icon} <span class="font-medium text-sm">${message}</span>`;
    
    container.appendChild(toast);

    // Hilangkan setelah 3 detik
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// FUNGSI TAMPILAN FORM (UI)
// ==========================================
function showForm(role, event) {
    // Reset Gaya Menu
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white', 'active-nav');
        btn.classList.add('text-slate-300');
    });
    
    if (event) {
        event.currentTarget.classList.remove('text-slate-300');
        event.currentTarget.classList.add('bg-slate-700', 'text-white', 'active-nav');
    }

    const container = document.getElementById('form-container');
    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all text-sm";
    const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";
    const btnClass = "w-full md:w-auto px-6 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all flex items-center justify-center gap-2";

    if (role === 'incoming') {
        currentTable = 'incoming_material';
        document.getElementById('table-title').innerText = 'Daftar Incoming Material';
        container.innerHTML = `
            <h2 class="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span class="w-2 h-6 bg-accent rounded-full"></span> Input Incoming Material
            </h2>
            <form id="form-incoming" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="${labelClass}">PI NO</label><input type="text" id="in_pi" required class="${inputClass}"></div>
                <div><label class="${labelClass}">Brand</label><input type="text" id="in_brand" class="${inputClass}"></div>
                <div><label class="${labelClass}">Spesifikasi</label><input type="text" id="in_spec" class="${inputClass}"></div>
                <div><label class="${labelClass}">Qty PO</label><input type="number" id="in_qtypo" class="${inputClass}"></div>
                <div><label class="${labelClass}">No SJ / DO</label><input type="text" id="in_sj" class="${inputClass}"></div>
                <div><label class="${labelClass}">Qty SJ</label><input type="number" id="in_qtysj" class="${inputClass}"></div>
                <div class="md:col-span-2 mt-2">
                    <button type="submit" id="btn-submit" class="${btnClass}">Simpan Data Gudang</button>
                </div>
            </form>
        `;
        document.getElementById('form-incoming').addEventListener('submit', submitIncoming);
        loadData();
    } 
    else if (role === 'qc') {
        currentTable = 'qc_incoming';
        document.getElementById('table-title').innerText = 'Daftar QC Incoming';
        container.innerHTML = `
            <h2 class="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span class="w-2 h-6 bg-accent rounded-full"></span> Input QC Incoming
            </h2>
            <form id="form-qc" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="${labelClass}">PI NO (Cari data gudang)</label><input type="text" id="qc_pi" required class="${inputClass}"></div>
                <div><label class="${labelClass}">Good Material</label><input type="number" id="qc_good" class="${inputClass}"></div>
                <div><label class="${labelClass}">NG Material</label><input type="number" id="qc_ng" class="${inputClass}"></div>
                <div><label class="${labelClass}">Description</label><input type="text" id="qc_desc" class="${inputClass}"></div>
                <div class="md:col-span-2 mt-2">
                    <button type="submit" class="${btnClass}">Simpan Data QC</button>
                </div>
            </form>
        `;
        document.getElementById('form-qc').addEventListener('submit', submitQC);
        loadData();
    }
    else if (role === 'supply' || role === 'finish') {
        currentTable = role === 'supply' ? 'supply_material' : 'finish_good';
        document.getElementById('table-title').innerText = `Daftar ${role === 'supply' ? 'Supply' : 'Finish Good'}`;
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-slate-400">
                <svg class="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <p class="text-lg font-medium text-slate-600">Form ${role === 'supply' ? 'Supply Material' : 'Finish Good'} (Segera Hadir)</p>
            </div>
        `;
        loadData();
    }
}

// ==========================================
// FUNGSI MENAMPILKAN DATA (TABEL PRO)
// ==========================================
async function loadData() {
    const tabelContainer = document.getElementById('tabel-data');
    tabelContainer.innerHTML = `
        <div class="flex justify-center items-center py-10">
            <svg class="animate-spin h-8 w-8 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
    `;

    const { data, error } = await supabaseClient.from(currentTable).select('*').order('created_at', { ascending: false });

    if (error) {
        tabelContainer.innerHTML = `<div class="p-6 text-center text-red-500 font-medium">Gagal memuat data: ${error.message}</div>`;
        return;
    }

    if (data.length === 0) {
        tabelContainer.innerHTML = `<div class="p-10 text-center text-slate-500 font-medium">Belum ada data yang diinput.</div>`;
        return;
    }

    // Buat Tabel
    const columns = Object.keys(data[0]).filter(col => col !== 'id' && col !== 'created_at');
    let html = `<table class="w-full text-sm text-left whitespace-nowrap">`;
    html += `<thead class="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">`;
    html += `<tr>`;
    columns.forEach(col => {
        html += `<th class="px-6 py-4 font-semibold">${col.replace(/_/g, ' ')}</th>`;
    });
    html += `</tr></thead><tbody class="divide-y divide-slate-100">`;

    // Isi Tabel
    data.forEach(row => {
        html += `<tr class="bg-white hover:bg-slate-50 transition-colors">`;
        columns.forEach(col => {
            let val = row[col];
            // Format angka agar lebih rapi
            if (typeof val === 'number') val = val.toLocaleString('id-ID'); 
            html += `<td class="px-6 py-3 font-medium text-slate-700">${val !== null ? val : '-'}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    tabelContainer.innerHTML = html;
}

// Fungsi untuk tombol refresh manual
function refreshData() {
    loadData();
}

// ==========================================
// FUNGSI SIMPAN KE DATABASE
// ==========================================
async function submitIncoming(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Menyimpan...'; btn.disabled = true;

    const qtyPo = parseInt(document.getElementById('in_qtypo').value) || 0;
    const qtySj = parseInt(document.getElementById('in_qtysj').value) || 0;
    
    const { error } = await supabaseClient.from('incoming_material').insert([{
        pi_no: document.getElementById('in_pi').value,
        brand: document.getElementById('in_brand').value,
        spesifikasi: document.getElementById('in_spec').value,
        qty_po: qtyPo,
        no_sj: document.getElementById('in_sj').value,
        qty_sj: qtySj,
        total_incoming: qtySj,
        balance: qtyPo - qtySj
    }]);
    
    btn.innerHTML = originalText; btn.disabled = false;

    if (error) {
        showToast('Gagal: ' + error.message, 'error');
    } else { 
        showToast('Data Gudang Berhasil Disimpan!', 'success'); 
        e.target.reset(); 
        loadData(); 
    }
}

async function submitQC(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Menyimpan...'; btn.disabled = true;

    const good = parseInt(document.getElementById('qc_good').value) || 0;
    const ng = parseInt(document.getElementById('qc_ng').value) || 0;
    
    const { error } = await supabaseClient.from('qc_incoming').insert([{
        pi_no: document.getElementById('qc_pi').value,
        good_material: good,
        ng_material: ng,
        description: document.getElementById('qc_desc').value,
        balance: good - ng
    }]);
    
    btn.innerHTML = originalText; btn.disabled = false;

    if (error) {
        showToast('Gagal: ' + error.message + ' (Pastikan PI NO ada di Gudang)', 'error');
    } else { 
        showToast('Data QC Berhasil Disimpan!', 'success'); 
        e.target.reset(); 
        loadData(); 
    }
}
