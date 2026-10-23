// ==========================================
// STATE GLOBAL & VARIABEL
// ==========================================
let currentTable = 'incoming_material';
let currentRole = 'dashboard';
let dataGudangSementara = []; 
let dataTabelSekarang = []; // Menyimpan data tabel untuk di-export ke Excel

// ==========================================
// 1. FUNGSI NOTIFIKASI (TOAST)
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-emerald-500' : (type === 'warning' ? 'bg-amber-500' : 'bg-red-500');
    
    toast.className = `toast-animate flex items-center gap-3 px-4 py-3 rounded-xl text-white shadow-lg pointer-events-auto ${bgColor} mb-2 z-50`;
    toast.innerHTML = `<span class="font-medium text-sm">${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ==========================================
// 2. FUNGSI TAMPILAN FORM & DASHBOARD
// ==========================================
function showForm(role, event) {
    currentRole = role;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white');
        btn.classList.add('text-slate-300');
    });
    if (event) {
        event.currentTarget.classList.remove('text-slate-300');
        event.currentTarget.classList.add('bg-slate-700', 'text-white');
    }

    const container = document.getElementById('form-container');
    const tableWrapper = document.getElementById('table-wrapper');
    const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all text-sm";
    const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";
    const btnClass = "w-full md:w-auto px-6 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-blue-700 transition-all mt-4 shadow-md";

    const dropdownHtml = `
        <div class="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
            <label class="${labelClass} text-blue-800">Tarik Data Barang dari Gudang (Wajib):</label>
            <select id="select_pi" class="${inputClass} border-blue-300 mb-3" onchange="tampilkanDetailBarang()">
                <option value="">-- Pilih PI NO --</option>
            </select>
            <div id="info-barang" class="hidden bg-white border border-blue-200 rounded-lg p-4 text-sm shadow-sm">
                <div class="grid grid-cols-2 gap-2">
                    <p><strong class="text-slate-600">Brand:</strong> <br><span id="info_brand" class="font-medium text-slate-900"></span></p>
                    <p><strong class="text-slate-600">Spesifikasi:</strong> <br><span id="info_spec" class="font-medium text-slate-900"></span></p>
                </div>
            </div>
        </div>
    `;

    // --- TAMPILAN DASHBOARD (BARU) ---
    if (role === 'dashboard') {
        tableWrapper.classList.add('hidden'); // Sembunyikan tabel
        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div class="text-slate-500 text-sm font-semibold mb-2">Total Incoming</div>
                    <div id="dash-incoming" class="text-3xl font-bold text-slate-800 animate-pulse">...</div>
                </div>
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div class="text-slate-500 text-sm font-semibold mb-2">Total Good QC</div>
                    <div id="dash-good" class="text-3xl font-bold text-emerald-600 animate-pulse">...</div>
                </div>
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div class="text-slate-500 text-sm font-semibold mb-2">Total NG QC</div>
                    <div id="dash-ng" class="text-3xl font-bold text-red-600 animate-pulse">...</div>
                </div>
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div class="text-slate-500 text-sm font-semibold mb-2">Total Supply Dikirim</div>
                    <div id="dash-supply" class="text-3xl font-bold text-blue-600 animate-pulse">...</div>
                </div>
            </div>
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 class="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Status Keseluruhan Barang</h3>
                <div id="dash-status" class="animate-pulse text-slate-500">Memuat status...</div>
            </div>
        `;
        loadDashboard();
    } 
    // --- FORM GUDANG ---
    else if (role === 'incoming') {
        tableWrapper.classList.remove('hidden');
        currentTable = 'incoming_material';
        document.getElementById('table-title').innerText = 'Daftar Incoming Material';
        container.innerHTML = `
            <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Input Incoming Material (Gudang)</h2>
            <form id="form-data" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="hidden" id="edit_id">
                <div><label class="${labelClass}">PI NO <span class="text-red-500">*</span></label><input type="text" id="in_pi" required class="${inputClass}" placeholder="Cth: 297.10.26.PRP"></div>
                <div><label class="${labelClass}">Brand</label><input type="text" id="in_brand" class="${inputClass}"></div>
                <div><label class="${labelClass}">Spesifikasi</label><input type="text" id="in_spec" class="${inputClass}"></div>
                <div><label class="${labelClass}">Qty PI <span class="text-red-500">*</span></label><input type="number" id="in_qtypi" min="0" required class="${inputClass}"></div>
                <div><label class="${labelClass}">Qty PO <span class="text-red-500">*</span></label><input type="number" id="in_qtypo" min="0" required class="${inputClass}"></div>
                <div><label class="${labelClass}">No SJ / DO</label><input type="text" id="in_sj" class="${inputClass}"></div>
                <div><label class="${labelClass}">Qty SJ <span class="text-red-500">*</span></label><input type="number" id="in_qtysj" min="0" required class="${inputClass}"></div>
                <div class="md:col-span-2 flex gap-2">
                    <button type="submit" class="${btnClass}">Simpan Data Gudang</button>
                    <button type="button" onclick="resetForm()" class="mt-4 px-6 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-all hidden" id="btn-cancel">Batal Edit</button>
                </div>
            </form>
        `;
        document.getElementById('form-data').addEventListener('submit', handleSubmit);
        loadData();
    } 
    else {
        tableWrapper.classList.remove('hidden');
        if (role === 'qc') {
            currentTable = 'qc_incoming';
            document.getElementById('table-title').innerText = 'Daftar QC Incoming';
            container.innerHTML = `
                <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Input QC Incoming</h2>
                ${dropdownHtml}
                <form id="form-data" class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <input type="hidden" id="edit_id">
                    <div><label class="${labelClass}">PI NO (Otomatis)</label><input type="text" id="input_pi" required class="${inputClass} bg-slate-100 cursor-not-allowed" readonly placeholder="Pilih dari dropdown di atas"></div>
                    <div><label class="${labelClass}">Good Material <span class="text-red-500">*</span></label><input type="number" id="qc_good" min="0" required class="${inputClass}"></div>
                    <div><label class="${labelClass}">NG Material <span class="text-red-500">*</span></label><input type="number" id="qc_ng" min="0" required class="${inputClass}"></div>
                    <div><label class="${labelClass}">Description</label><input type="text" id="qc_desc" class="${inputClass}"></div>
                    <div class="md:col-span-2 flex gap-2">
                        <button type="submit" class="${btnClass}">Simpan Data QC</button>
                        <button type="button" onclick="resetForm()" class="mt-4 px-6 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-all hidden" id="btn-cancel">Batal Edit</button>
                    </div>
                </form>
            `;
        } else if (role === 'supply') {
            currentTable = 'supply_material';
            document.getElementById('table-title').innerText = 'Daftar Supply Material';
            container.innerHTML = `
                <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Input Supply Material</h2>
                ${dropdownHtml}
                <form id="form-data" class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <input type="hidden" id="edit_id">
                    <div><label class="${labelClass}">PI NO (Otomatis)</label><input type="text" id="input_pi" required class="${inputClass} bg-slate-100 cursor-not-allowed" readonly placeholder="Pilih dari dropdown di atas"></div>
                    <div><label class="${labelClass}">Tgl Request</label><input type="date" id="sp_req" class="${inputClass}"></div>
                    <div><label class="${labelClass}">Jumlah Barang Dikirim <span class="text-red-500">*</span></label><input type="number" id="sp_sent" min="0" required class="${inputClass}"></div>
                    <div><label class="${labelClass}">Tgl Return</label><input type="date" id="sp_ret" class="${inputClass}"></div>
                    <div><label class="${labelClass}">Jumlah Return</label><input type="number" id="sp_noret" min="0" class="${inputClass}"></div>
                    <div><label class="${labelClass}">Tgl Diterima</label><input type="date" id="sp_recdate" class="${inputClass}"></div>
                    <div class="md:col-span-2 flex gap-2">
                        <button type="submit" class="${btnClass}">Simpan Data Supply</button>
                        <button type="button" onclick="resetForm()" class="mt-4 px-6 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-all hidden" id="btn-cancel">Batal Edit</button>
                    </div>
                </form>
            `;
        } else if (role === 'finish') {
            currentTable = 'finish_good';
            document.getElementById('table-title').innerText = 'Daftar Finish Good';
            container.innerHTML = `
                <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Input Finish Good</h2>
                ${dropdownHtml}
                <form id="form-data" class="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <input type="hidden" id="edit_id">
                    <div><label class="${labelClass}">PI NO (Otomatis)</label><input type="text" id="input_pi" required class="${inputClass} bg-slate-100 cursor-not-allowed" readonly placeholder="Pilih dari dropdown di atas"></div>
                    <div><label class="${labelClass}">Karton <span class="text-red-500">*</span></label><input type="number" id="fg_karton" min="0" required class="${inputClass}"></div>
                    <div><label class="${labelClass}">Display <span class="text-red-500">*</span></label><input type="number" id="fg_display" min="0" required class="${inputClass}"></div>
                    <div><label class="${labelClass}">Booklet / Cones <span class="text-red-500">*</span></label><input type="number" id="fg_booklet" min="0" required class="${inputClass}"></div>
                    <div class="md:col-span-2 flex gap-2">
                        <button type="submit" class="${btnClass}">Simpan Data Finish Good</button>
                        <button type="button" onclick="resetForm()" class="mt-4 px-6 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-all hidden" id="btn-cancel">Batal Edit</button>
                    </div>
                </form>
            `;
        }
        
        document.getElementById('form-data').addEventListener('submit', handleSubmit);
        loadData();
        loadDropdownGudang();
    }
}

// ==========================================
// 3. FUNGSI LOAD DASHBOARD
// ==========================================
async function loadDashboard() {
    // Ambil data dari keempat tabel
    const [resIn, resQc, resSup] = await Promise.all([
        supabaseClient.from('incoming_material').select('total_incoming'),
        supabaseClient.from('qc_incoming').select('good_material, ng_material'),
        supabaseClient.from('supply_material').select('material_sent')
    ]);

    // Kalkulasi
    const totalIn = resIn.data?.reduce((sum, item) => sum + (item.total_incoming || 0), 0) || 0;
    const totalGood = resQc.data?.reduce((sum, item) => sum + (item.good_material || 0), 0) || 0;
    const totalNg = resQc.data?.reduce((sum, item) => sum + (item.ng_material || 0), 0) || 0;
    const totalSup = resSup.data?.reduce((sum, item) => sum + (item.material_sent || 0), 0) || 0;

    // Tampilkan
    document.getElementById('dash-incoming').innerText = totalIn.toLocaleString('id-ID');
    document.getElementById('dash-incoming').classList.remove('animate-pulse');
    
    document.getElementById('dash-good').innerText = totalGood.toLocaleString('id-ID');
    document.getElementById('dash-good').classList.remove('animate-pulse');

    document.getElementById('dash-ng').innerText = totalNg.toLocaleString('id-ID');
    document.getElementById('dash-ng').classList.remove('animate-pulse');

    document.getElementById('dash-supply').innerText = totalSup.toLocaleString('id-ID');
    document.getElementById('dash-supply').classList.remove('animate-pulse');

    document.getElementById('dash-status').innerHTML = `
        <div class="flex items-center gap-2 mb-2"><span class="w-3 h-3 rounded-full bg-emerald-500"></span> <span class="font-medium">Incoming Material:</span> ${totalIn} Unit</div>
        <div class="flex items-center gap-2 mb-2"><span class="w-3 h-3 rounded-full bg-blue-500"></span> <span class="font-medium">Lolos QC (Good):</span> ${totalGood} Unit</div>
        <div class="flex items-center gap-2 mb-2"><span class="w-3 h-3 rounded-full bg-red-500"></span> <span class="font-medium">Gagal QC (NG):</span> ${totalNg} Unit</div>
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-amber-500"></span> <span class="font-medium">Terkirim ke Produksi:</span> ${totalSup} Unit</div>
    `;
}

// ==========================================
// 4. FUNGSI DROPDOWN & RELASI
// ==========================================
async function loadDropdownGudang() {
    const select = document.getElementById('select_pi');
    if (!select) return; 

    const { data, error } = await supabaseClient.from('incoming_material').select('*').order('id', { ascending: false });

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

function tampilkanDetailBarang() {
    const selectedPi = document.getElementById('select_pi').value;
    const infoBox = document.getElementById('info-barang');
    const inputPi = document.getElementById('input_pi');

    if (!selectedPi) {
        infoBox.classList.add('hidden');
        inputPi.value = '';
        return;
    }

    const barang = dataGudangSementara.find(item => item.pi_no === selectedPi);
    if (barang) {
        document.getElementById('info_brand').innerText = barang.brand || '-';
        document.getElementById('info_spec').innerText = barang.spesifikasi || '-';
        infoBox.classList.remove('hidden');
        inputPi.value = barang.pi_no;
    }
}

// ==========================================
// 5. FUNGSI EXPORT EXCEL
// ==========================================
function exportExcel() {
    if (dataTabelSekarang.length === 0) {
        showToast('Tidak ada data untuk di-export!', 'error');
        return;
    }

    // Format ulang objek agar rapi di Excel
    const dataRapi = dataTabelSekarang.map(row => {
        const newRow = {};
        Object.keys(row).forEach(key => {
            if (key !== 'id' && key !== 'created_at') {
                // Ubah nama kolom menjadi Title Case
                const headerName = key.replace(/_/g, ' ').toUpperCase();
                newRow[headerName] = row[key];
            }
        });
        return newRow;
    });

    // Buat worksheet & workbook
    const ws = XLSX.utils.json_to_sheet(dataRapi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    // Download file
    const fileName = `${currentTable}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('File Excel berhasil didownload!', 'success');
}

// ==========================================
// 6. FUNGSI TAMPILAN TABEL & DATA
// ==========================================
async function loadData() {
    if (currentRole === 'dashboard') return;

    const tabelContainer = document.getElementById('tabel-data');
    tabelContainer.innerHTML = `<div class="p-6 text-center text-slate-500 animate-pulse">Memuat data...</div>`;

    const { data, error } = await supabaseClient.from(currentTable).select('*').order('id', { ascending: false });

    if (error) {
        tabelContainer.innerHTML = `<div class="p-6 text-center text-red-500">Gagal memuat: ${error.message}</div>`;
        return;
    }

    if (data.length === 0) {
        dataTabelSekarang = [];
        tabelContainer.innerHTML = `<div class="p-10 text-center text-slate-500">Belum ada data.</div>`;
        return;
    }

    dataTabelSekarang = data; // Simpan untuk export excel

    const columns = Object.keys(data[0]).filter(col => col !== 'id' && col !== 'created_at');
    let html = `<table class="w-full text-sm text-left whitespace-nowrap">`;
    html += `<thead class="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200"><tr>`;
    columns.forEach(col => {
        html += `<th class="px-6 py-4 font-bold">${col.replace(/_/g, ' ').toUpperCase()}</th>`;
    });
    html += `<th class="px-6 py-4 font-bold text-center">AKSI</th>`;
    html += `</tr></thead><tbody class="divide-y divide-slate-100">`;

    data.forEach(row => {
        html += `<tr class="bg-white hover:bg-slate-50 transition-colors">`;
        columns.forEach(col => {
            let val = row[col];
            if (typeof val === 'number') val = val.toLocaleString('id-ID'); 
            html += `<td class="px-6 py-3 text-slate-700">${val !== null ? val : '-'}</td>`;
        });
        html += `<td class="px-6 py-3 text-center flex justify-center gap-2">
            <button onclick="editData(${row.id})" class="px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 text-xs font-semibold">Edit</button>
            <button onclick="hapusData(${row.id})" class="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-semibold">Hapus</button>
        </td>`;
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    tabelContainer.innerHTML = html;
}

// ==========================================
// 7. LOGIKA SIMPAN (CREATE & UPDATE)
// ==========================================
async function handleSubmit(e) {
    e.preventDefault();
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Memproses...'; btn.disabled = true;

    const editId = document.getElementById('edit_id').value;
    let payload = {};
    let isUpdate = editId !== '';
    
    if (currentRole === 'incoming') {
        const qtyPo = parseInt(document.getElementById('in_qtypo').value);
        const qtySj = parseInt(document.getElementById('in_qtysj').value);
        
        if (qtySj > qtyPo) {
            showToast('Gagal: Qty SJ tidak boleh lebih besar dari Qty PO!', 'error');
            btn.innerHTML = originalText; btn.disabled = false; return;
        }

        payload = {
            pi_no: document.getElementById('in_pi').value.trim(),
            brand: document.getElementById('in_brand').value.trim(),
            spesifikasi: document.getElementById('in_spec').value.trim(),
            qty_pi: parseInt(document.getElementById('in_qtypi').value),
            qty_po: qtyPo,
            no_sj: document.getElementById('in_sj').value.trim(),
            qty_sj: qtySj,
            total_incoming: qtySj,
            balance: qtyPo - qtySj
        };
    } 
    else {
        const piNo = document.getElementById('input_pi').value;
        if (!piNo) {
            showToast('Gagal: Pilih PI NO dari dropdown terlebih dahulu!', 'error');
            btn.innerHTML = originalText; btn.disabled = false; return;
        }

        if (currentRole === 'qc') {
            const good = parseInt(document.getElementById('qc_good').value);
            const ng = parseInt(document.getElementById('qc_ng').value);
            payload = { pi_no: piNo, good_material: good, ng_material: ng, description: document.getElementById('qc_desc').value.trim(), balance: good - ng };
        } 
        else if (currentRole === 'supply') {
            payload = { 
                pi_no: piNo, 
                request_date: document.getElementById('sp_req').value || null, 
                material_sent: parseInt(document.getElementById('sp_sent').value), 
                return_date: document.getElementById('sp_ret').value || null, 
                no_return: parseInt(document.getElementById('sp_noret').value) || 0, 
                received_date: document.getElementById('sp_recdate').value || null 
            };
        } 
        else if (currentRole === 'finish') {
            const karton = parseInt(document.getElementById('fg_karton').value);
            const display = parseInt(document.getElementById('fg_display').value);
            const booklet = parseInt(document.getElementById('fg_booklet').value);
            payload = { pi_no: piNo, karton: karton, display: display, booklet_cones: booklet, balance: karton + display + booklet };
        }
    }

    let error;
    if (isUpdate) {
        const res = await supabaseClient.from(currentTable).update(payload).eq('id', editId);
        error = res.error;
    } else {
        if (currentRole === 'incoming') {
            const { data: cek } = await supabaseClient.from('incoming_material').select('pi_no').eq('pi_no', payload.pi_no);
            if (cek && cek.length > 0) {
                showToast('Gagal: PI NO tersebut sudah pernah diinput!', 'error');
                btn.innerHTML = originalText; btn.disabled = false; return;
            }
        }
        const res = await supabaseClient.from(currentTable).insert([payload]);
        error = res.error;
    }
    
    btn.innerHTML = originalText; btn.disabled = false;

    if (error) {
        showToast('Gagal Database: ' + error.message, 'error');
    } else { 
        showToast(`Data Berhasil ${isUpdate ? 'Diperbarui' : 'Disimpan'}!`, 'success'); 
        resetForm(); 
        loadData(); 
        if (currentRole !== 'incoming') loadDropdownGudang(); 
    }
}

// ==========================================
// 8. LOGIKA EDIT, HAPUS & RESET
// ==========================================
async function editData(id) {
    const { data, error } = await supabaseClient.from(currentTable).select('*').eq('id', id).single();
    if (error || !data) return showToast('Gagal mengambil data', 'error');

    document.getElementById('edit_id').value = id;
    document.getElementById('btn-cancel').classList.remove('hidden');

    if (currentRole === 'incoming') {
        document.getElementById('in_pi').value = data.pi_no;
        document.getElementById('in_brand').value = data.brand || '';
        document.getElementById('in_spec').value = data.spesifikasi || '';
        document.getElementById('in_qtypi').value = data.qty_pi || 0;
        document.getElementById('in_qtypo').value = data.qty_po;
        document.getElementById('in_sj').value = data.no_sj || '';
        document.getElementById('in_qtysj').value = data.qty_sj;
    } 
    else {
        document.getElementById('input_pi').value = data.pi_no;
        if (currentRole === 'qc') {
            document.getElementById('qc_good').value = data.good_material;
            document.getElementById('qc_ng').value = data.ng_material;
            document.getElementById('qc_desc').value = data.description || '';
        } 
        else if (currentRole === 'supply') {
            document.getElementById('sp_req').value = data.request_date || '';
            document.getElementById('sp_sent').value = data.material_sent;
            document.getElementById('sp_ret').value = data.return_date || '';
            document.getElementById('sp_noret').value = data.no_return;
            document.getElementById('sp_recdate').value = data.received_date || '';
        } 
        else if (currentRole === 'finish') {
            document.getElementById('fg_karton').value = data.karton;
            document.getElementById('fg_display').value = data.display;
            document.getElementById('fg_booklet').value = data.booklet_cones;
        }
    }
    
    document.getElementById('form-container').scrollIntoView({ behavior: 'smooth' });
    showToast('Mode Edit: Silakan perbaiki data lalu simpan.', 'warning');
}

async function hapusData(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini? Data yang dihapus tidak bisa dikembalikan.')) return;

    const { error } = await supabaseClient.from(currentTable).delete().eq('id', id);
    if (error) showToast('Gagal menghapus: ' + error.message, 'error');
    else { showToast('Data berhasil dihapus!', 'success'); loadData(); }
}

function resetForm() {
    document.getElementById('form-data').reset();
    document.getElementById('edit_id').value = '';
    document.getElementById('btn-cancel').classList.add('hidden');
    const infoBox = document.getElementById('info-barang');
    if (infoBox) infoBox.classList.add('hidden');
}
