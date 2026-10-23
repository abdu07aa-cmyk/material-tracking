// STATE GLOBAL
let currentTable = 'incoming_material';
let dataGudangSementara = []; // Menyimpan data gudang untuk dropdown

// ==========================================
// FUNGSI NOTIFIKASI (TOAST)
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-emerald-500' : 'bg-red-500';
    toast.className = `toast-animate flex items-center gap-3 px-4 py-3 rounded-xl text-white shadow-lg pointer-events-auto ${bgColor} mb-2`;
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

    // --- FORM GUDANG ---
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
        loadData();
    } 
    // --- FORM QC ---
    else if (role === 'qc') {
        currentTable = 'qc_incoming';
        document.getElementById('table-title').innerText = 'Daftar QC Incoming';
        container.innerHTML = `
            <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Input QC Incoming</h2>
            <div class="mb-4">
                <label class="${labelClass} text-blue-700">Pilih Barang dari Gudang:</label>
                <select id="select_pi" class="${inputClass} border-blue-400 bg-blue-50 mb-3" onchange="tampilkanDetailBarang('qc')">
                    <option value="">-- Pilih PI NO --</option>
                </select>
                <div id="info-barang-qc" class="hidden bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                    <p class="mb-1"><strong class="text-blue-800">Brand:</strong> <span id="info_brand_qc"></span></p>
                    <p class="mb-1"><strong class="text-blue-800">Spesifikasi:</strong> <span id="info_spec_qc"></span></p>
                    <p><strong class="text-blue-800">Total Incoming:</strong> <span id="info_total_qc"></span></p>
                </div>
            </div>
            <form id="form-qc" class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div><label class="${labelClass}">PI NO (Otomatis)</label><input type="text" id="input_pi" required class="${inputClass} bg-slate-100" readonly></div>
                <div><label class="${labelClass}">Good Material</label><input type="number" id="qc_good" class="${inputClass}"></div>
                <div><label class="${labelClass}">NG Material</label><input type="number" id="qc_ng" class="${inputClass}"></div>
                <div><label class="${labelClass}">Description (Keterangan)</label><input type="text" id="qc_desc" class="${inputClass}"></div>
                <div class="md:col-span-2"><button type="submit" class="${btnClass}">Simpan Data QC</button></div>
            </form>
        `;
        document.getElementById('form-qc').addEventListener('submit', submitQC);
        loadData();
        loadDropdownGudang('qc');
    }
    // --- FORM SUPPLY (BARU DIPERBAIKI) ---
    else if (role === 'supply') {
        currentTable = 'supply_material';
        document.getElementById('table-title').innerText = 'Daftar Supply Material';
        container.innerHTML = `
            <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Input Supply Material</h2>
            <div class="mb-4">
                <label class="${labelClass} text-blue-700">Pilih Barang dari Gudang:</label>
                <select id="select_pi" class="${inputClass} border-blue-400 bg-blue-50 mb-3" onchange="tampilkanDetailBarang('supply')">
                    <option value="">-- Pilih PI NO --</option>
                </select>
                <div id="info-barang-supply" class="hidden bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                    <p class="mb-1"><strong class="text-blue-800">Brand:</strong> <span id="info_brand_supply"></span></p>
                    <p><strong class="text-blue-800">Spesifikasi:</strong> <span id="info_spec_supply"></span></p>
                </div>
            </div>
            <form id="form-supply" class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div><label class="${labelClass}">PI NO (Otomatis)</label><input type="text" id="input_pi" required class="${inputClass} bg-slate-100" readonly></div>
                <div><label class="${labelClass}">Material Request Date</label><input type="date" id="sp_req" class="${inputClass}"></div>
                <div><label class="${labelClass}">No Of Material Sent</label><input type="number" id="sp_sent" class="${inputClass}"></div>
                <div><label class="${labelClass}">Return Date</label><input type="date" id="sp_ret" class="${inputClass}"></div>
                <div><label class="${labelClass}">No Of Return</label><input type="number" id="sp_noret" class="${inputClass}"></div>
                <div><label class="${labelClass}">Received Date</label><input type="date" id="sp_recdate" class="${inputClass}"></div>
                <div class="md:col-span-2"><button type="submit" class="${btnClass}">Simpan Data Supply</button></div>
            </form>
        `;
        document.getElementById('form-supply').addEventListener('submit', submitSupply);
        loadData();
        loadDropdownGudang('supply');
    }
    // --- FORM FINISH GOOD (BARU DIPERBAIKI) ---
    else if (role === 'finish') {
        currentTable = 'finish_good';
        document.getElementById('table-title').innerText = 'Daftar Finish Good';
        container.innerHTML = `
            <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Input Finish Good</h2>
            <div class="mb-4">
                <label class="${labelClass} text-blue-700">Pilih Barang dari Gudang:</label>
                <select id="select_pi" class="${inputClass} border-blue-400 bg-blue-50 mb-3" onchange="tampilkanDetailBarang('finish')">
                    <option value="">-- Pilih PI NO --</option>
                </select>
                <div id="info-barang-finish" class="hidden bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                    <p class="mb-1"><strong class="text-blue-800">Brand:</strong> <span id="info_brand_finish"></span></p>
                    <p><strong class="text-blue-800">Spesifikasi:</strong> <span id="info_spec_finish"></span></p>
                </div>
            </div>
            <form id="form-finish" class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div><label class="${labelClass}">PI NO (Otomatis)</label><input type="text" id="input_pi" required class="${inputClass} bg-slate-100" readonly></div>
                <div><label class="${labelClass}">Karton</label><input type="number" id="fg_karton" class="${inputClass}"></div>
                <div><label class="${labelClass}">Display</label><input type="number" id="fg_display" class="${inputClass}"></div>
                <div><label class="${labelClass}">Booklet / Cones</label><input type="number" id="fg_booklet" class="${inputClass}"></div>
                <div class="md:col-span-2"><button type="submit" class="${btnClass}">Simpan Data Finish Good</button></div>
            </form>
        `;
        document.getElementById('form-finish').addEventListener('submit', submitFinishGood);
        loadData();
        loadDropdownGudang('finish');
    }
}

// ==========================================
// FUNGSI DROPDOWN & DETAIL (BERLAKU UNTUK SEMUA LEADER)
// ==========================================
async function loadDropdownGudang(role) {
    const select = document.getElementById('select_pi');
    if (!select) return; 

    const { data, error } = await supabaseClient.from('incoming_material').select('*');

    if (!error && data) {
        dataGudangSementara = data; 
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.pi_no;
            option.text = `${item.pi_no} (${item.brand || 'Tanpa Brand'})`;
            select.appendChild(option);
        });
    }
}

// Fungsi ini menerima parameter role agar tahu kotak info mana yang harus diisi
function tampilkanDetailBarang(role) {
    const selectedPi = document.getElementById('select_pi').value;
    
    // Elemen-elemen yang berbeda tergantung role
    const infoBox = document.getElementById(`info-barang-${role}`);
    const inputPi = document.getElementById('input_pi');

    if (!selectedPi) {
        infoBox.classList.add('hidden');
        inputPi.value = '';
        return;
    }

    const barang = dataGudangSementara.find(item => item.pi_no === selectedPi);

    if (barang) {
        // Isi teks info
        document.getElementById(`info_brand_${role}`).innerText = barang.brand || '-';
        document.getElementById(`info_spec_${role}`).innerText = barang.spesifikasi || '-';
        
        // Khusus QC, kita tampilkan Total Incoming juga
        if (role === 'qc' && document.getElementById('info_total_qc')) {
            document.getElementById('info_total_qc').innerText = barang.total_incoming || 0;
        }

        infoBox.classList.remove('hidden');
        inputPi.value = barang.pi_no;
    }
}

// ==========================================
// FUNGSI MENAMPILKAN DATA KE TABEL
// ==========================================
async function loadData() {
    const tabelContainer = document.getElementById('tabel-data');
    tabelContainer.innerHTML = `<div class="p-6 text-center text-slate-500 animate-pulse">Memuat data...</div>`;

    const { data, error } = await supabaseClient.from(currentTable).select('*').order('id', { ascending: false });

    if (error) {
        tabelContainer.innerHTML = `<div class="p-6 text-center text-red-500">Gagal memuat: ${error.message}</div>`;
        return;
    }

    if (data.length === 0) {
        tabelContainer.innerHTML = `<div class="p-10 text-center text-slate-500">Belum ada data.</div>`;
        return;
    }

    const columns = Object.keys(data[0]).filter(col => col !== 'id' && col !== 'created_at');
    let html = `<table class="w-full text-sm text-left whitespace-nowrap">`;
    html += `<thead class="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200"><tr>`;
    columns.forEach(col => {
        html += `<th class="px-6 py-4 font-bold">${col.replace(/_/g, ' ').toUpperCase()}</th>`;
    });
    html += `</tr></thead><tbody class="divide-y divide-slate-100">`;

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
    
    if (error) showToast('Gagal: ' + error.message, 'error');
    else { showToast('Data Gudang Disimpan!', 'success'); e.target.reset(); loadData(); }
}

async function submitQC(e) {
    e.preventDefault();
    const piNo = document.getElementById('input_pi').value;
    if (!piNo) return showToast('Pilih barang dari dropdown!', 'error');

    const good = parseInt(document.getElementById('qc_good').value) || 0;
    const ng = parseInt(document.getElementById('qc_ng').value) || 0;
    
    const { error } = await supabaseClient.from('qc_incoming').insert([{
        pi_no: piNo, good_material: good, ng_material: ng,
        description: document.getElementById('qc_desc').value, balance: good - ng
    }]);
    
    if (error) showToast('Gagal: ' + error.message, 'error');
    else { 
        showToast('Data QC Disimpan!', 'success'); e.target.reset(); 
        document.getElementById('info-barang-qc').classList.add('hidden'); 
        loadData(); 
    }
}

async function submitSupply(e) {
    e.preventDefault();
    const piNo = document.getElementById('input_pi').value;
    if (!piNo) return showToast('Pilih barang dari dropdown!', 'error');

    const { error } = await supabaseClient.from('supply_material').insert([{
        pi_no: piNo,
        request_date: document.getElementById('sp_req').value || null,
        material_sent: parseInt(document.getElementById('sp_sent').value) || 0,
        return_date: document.getElementById('sp_ret').value || null,
        no_return: parseInt(document.getElementById('sp_noret').value) || 0,
        received_date: document.getElementById('sp_recdate').value || null
    }]);
    
    if (error) showToast('Gagal: ' + error.message, 'error');
    else { 
        showToast('Data Supply Disimpan!', 'success'); e.target.reset(); 
        document.getElementById('info-barang-supply').classList.add('hidden');
        loadData(); 
    }
}

async function submitFinishGood(e) {
    e.preventDefault();
    const piNo = document.getElementById('input_pi').value;
    if (!piNo) return showToast('Pilih barang dari dropdown!', 'error');

    const karton = parseInt(document.getElementById('fg_karton').value) || 0;
    const display = parseInt(document.getElementById('fg_display').value) || 0;
    const booklet = parseInt(document.getElementById('fg_booklet').value) || 0;

    const { error } = await supabaseClient.from('finish_good').insert([{
        pi_no: piNo, karton: karton, display: display, booklet_cones: booklet,
        balance: karton + display + booklet 
    }]);
    
    if (error) showToast('Gagal: ' + error.message, 'error');
    else { 
        showToast('Data Finish Good Disimpan!', 'success'); e.target.reset(); 
        document.getElementById('info-barang-finish').classList.add('hidden');
        loadData(); 
    }
}
