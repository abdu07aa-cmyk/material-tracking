// STATE GLOBAL
let currentTable = 'incoming_material';

// ==========================================
// FUNGSI NOTIFIKASI (TOAST)
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const bgColor = type === 'success' ? 'bg-emerald-500' : 'bg-red-500';
    toast.className = `toast-animate flex items-center gap-3 px-4 py-3 rounded-xl text-white shadow-lg pointer-events-auto ${bgColor}`;
    toast.innerHTML = `<span class="font-medium text-sm">${message}</span>`;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// FUNGSI TAMPILAN FORM
// ==========================================
function showForm(role, event) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white');
        btn.classList.add('text-slate-300');
    });
    if (event) {
        event.currentTarget.classList.remove('text-slate-300');
        event.currentTarget.classList.add('bg-slate-700', 'text-white');
    }

    const container = document.getElementById('form-container');
    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all text-sm";
    const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";
    const btnClass = "w-full md:w-auto px-6 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-blue-700 transition-all mt-4";

    if (role === 'incoming') {
        currentTable = 'incoming_material';
        document.getElementById('table-title').innerText = 'Daftar Incoming Material';
        container.innerHTML = `
            <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Input Incoming Material</h2>
            <form id="form-incoming" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="${labelClass}">PI NO</label><input type="text" id="in_pi" required class="${inputClass}"></div>
                <div><label class="${labelClass}">Brand</label><input type="text" id="in_brand" class="${inputClass}"></div>
                <div><label class="${labelClass}">Spesifikasi</label><input type="text" id="in_spec" class="${inputClass}"></div>
                <div><label class="${labelClass}">Qty PO</label><input type="number" id="in_qtypo" class="${inputClass}"></div>
                <div><label class="${labelClass}">No SJ / DO</label><input type="text" id="in_sj" class="${inputClass}"></div>
                <div><label class="${labelClass}">Qty SJ</label><input type="number" id="in_qtysj" class="${inputClass}"></div>
                <div class="md:col-span-2"><button type="submit" class="${btnClass}">Simpan Data Gudang</button></div>
            </form>
        `;
        document.getElementById('form-incoming').addEventListener('submit', submitIncoming);
        loadData(); // Panggil data saat form dibuka
    } 
    else if (role === 'qc') {
        currentTable = 'qc_incoming';
        document.getElementById('table-title').innerText = 'Daftar QC Incoming';
        container.innerHTML = `
            <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Input QC Incoming</h2>
            <form id="form-qc" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="${labelClass}">PI NO (Cari data gudang)</label><input type="text" id="qc_pi" required class="${inputClass}"></div>
                <div><label class="${labelClass}">Good Material</label><input type="number" id="qc_good" class="${inputClass}"></div>
                <div><label class="${labelClass}">NG Material</label><input type="number" id="qc_ng" class="${inputClass}"></div>
                <div><label class="${labelClass}">Description</label><input type="text" id="qc_desc" class="${inputClass}"></div>
                <div class="md:col-span-2"><button type="submit" class="${btnClass}">Simpan Data QC</button></div>
            </form>
        `;
        document.getElementById('form-qc').addEventListener('submit', submitQC);
        loadData();
    }
    else if (role === 'supply' || role === 'finish') {
        currentTable = role === 'supply' ? 'supply_material' : 'finish_good';
        document.getElementById('table-title').innerText = `Daftar ${role}`;
        container.innerHTML = `<div class="p-10 text-center text-slate-500">Form ${role} sedang disiapkan.</div>`;
        loadData();
    }
}

// ==========================================
// FUNGSI MENAMPILKAN DATA KE TABEL (INI YG TADI HILANG)
// ==========================================
async function loadData() {
    const tabelContainer = document.getElementById('tabel-data');
    tabelContainer.innerHTML = `<div class="p-6 text-center text-slate-500 animate-pulse">Memuat data dari server...</div>`;

    // Ambil semua data, urutkan dari yang terbaru
    const { data, error } = await supabaseClient.from(currentTable).select('*').order('id', { ascending: false });

    if (error) {
        tabelContainer.innerHTML = `<div class="p-6 text-center text-red-500">Gagal memuat: ${error.message}</div>`;
        return;
    }

    if (data.length === 0) {
        tabelContainer.innerHTML = `<div class="p-10 text-center text-slate-500">Belum ada data. Silakan isi form di atas.</div>`;
        return;
    }

    // Buat Header Tabel
    const columns = Object.keys(data[0]).filter(col => col !== 'id' && col !== 'created_at');
    let html = `<table class="w-full text-sm text-left whitespace-nowrap">`;
    html += `<thead class="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200"><tr>`;
    columns.forEach(col => {
        html += `<th class="px-6 py-4 font-bold">${col.replace(/_/g, ' ').toUpperCase()}</th>`;
    });
    html += `</tr></thead><tbody class="divide-y divide-slate-100">`;

    // Isi Baris Data
    data.forEach(row => {
        html += `<tr class="bg-white hover:bg-slate-50 transition-colors">`;
        columns.forEach(col => {
            let val = row[col];
            if (typeof val === 'number') val = val.toLocaleString('id-ID'); 
            html += `<td class="px-6 py-3 text-slate-700">${val !== null ? val : '-'}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    
    // Masukkan ke layar
    tabelContainer.innerHTML = html;
}

// ==========================================
// FUNGSI SIMPAN DATA
// ==========================================
async function submitIncoming(e) {
    e.preventDefault();
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
    
    if (error) {
        showToast('Gagal: ' + error.message, 'error');
    } else { 
        showToast('Data Berhasil Disimpan!', 'success'); 
        e.target.reset(); 
        loadData(); // <--- INI KUNCINYA: Refresh tabel setelah simpan
    }
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
    
    if (error) {
        showToast('Gagal: ' + error.message, 'error');
    } else { 
        showToast('Data QC Disimpan!', 'success'); 
        e.target.reset(); 
        loadData(); // <--- INI KUNCINYA
    }
}
