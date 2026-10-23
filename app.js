// ==========================================
// FUNGSI TAMPILAN FORM (UI)
// ==========================================
function showForm(role, event) {
    // Reset warna tombol
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('bg-blue-100', 'text-blue-700');
        btn.classList.add('bg-gray-100', 'text-gray-700');
    });
    
    if (event) {
        event.target.classList.remove('bg-gray-100', 'text-gray-700');
        event.target.classList.add('bg-blue-100', 'text-blue-700');
    }

    const container = document.getElementById('form-container');
    if (!container) return; 

    if (role === 'incoming') {
        container.innerHTML = `
            <h2 class="text-lg font-bold mb-4 border-b pb-2 text-gray-800">Input Incoming Material</h2>
            <form id="form-incoming" class="space-y-3">
                <input type="text" id="in_pi" placeholder="PI NO" required class="w-full p-2 border rounded focus:ring focus:ring-blue-200">
                <input type="text" id="in_brand" placeholder="Brand" class="w-full p-2 border rounded">
                <input type="text" id="in_spec" placeholder="Spesifikasi" class="w-full p-2 border rounded">
                <input type="number" id="in_qtypo" placeholder="Qty PO" class="w-full p-2 border rounded">
                <input type="text" id="in_sj" placeholder="No SJ / DO" class="w-full p-2 border rounded">
                <input type="number" id="in_qtysj" placeholder="Qty SJ" class="w-full p-2 border rounded">
                <button type="submit" class="w-full bg-green-600 text-white p-2 rounded font-bold mt-4 hover:bg-green-700 transition">Simpan Data</button>
            </form>
        `;
        document.getElementById('form-incoming').addEventListener('submit', submitIncoming);
    } 
    else if (role === 'qc') {
        container.innerHTML = `
            <h2 class="text-lg font-bold mb-4 border-b pb-2 text-gray-800">Input QC Incoming</h2>
            <form id="form-qc" class="space-y-3">
                <input type="text" id="qc_pi" placeholder="PI NO (Harus sama dgn Gudang)" required class="w-full p-2 border rounded">
                <input type="number" id="qc_good" placeholder="Good Material" class="w-full p-2 border rounded">
                <input type="number" id="qc_ng" placeholder="NG Material" class="w-full p-2 border rounded">
                <input type="text" id="qc_desc" placeholder="Description" class="w-full p-2 border rounded">
                <button type="submit" class="w-full bg-green-600 text-white p-2 rounded font-bold mt-4 hover:bg-green-700 transition">Simpan Data</button>
            </form>
        `;
        document.getElementById('form-qc').addEventListener('submit', submitQC);
    }
    else if (role === 'supply') {
        container.innerHTML = `<p class="text-gray-500 text-center py-4">Form Supply Material (Segera Hadir)</p>`;
    }
    else if (role === 'finish') {
        container.innerHTML = `<p class="text-gray-500 text-center py-4">Form Finish Good (Segera Hadir)</p>`;
    }
}

// ==========================================
// FUNGSI SIMPAN KE DATABASE
// ==========================================
async function submitIncoming(e) {
    e.preventDefault();
    const qtyPo = parseInt(document.getElementById('in_qtypo').value) || 0;
    const qtySj = parseInt(document.getElementById('in_qtysj').value) || 0;
    
    // supabaseClient didapat dari config.js yang dipanggil di HTML
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
    
    if (error) alert('Gagal: ' + error.message + '\nPastikan PI NO sudah diinput di form Gudang.');
    else { alert('Data QC Berhasil Disimpan!'); e.target.reset(); }
}
