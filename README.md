# Material Tracking — Data Order & Status

Aplikasi pelacakan material multi-tahap (Gudang → QC Awal → Diecut →
QC Ulang → Suplai → Produksi), berjalan penuh di browser dan disimpan
di Supabase. Struktur proyek ini sudah dipecah jadi file-file terpisah
(HTML / CSS / JS) supaya lebih mudah dirawat, di-*review* di GitHub, dan
dikembangkan lebih lanjut — **tanpa mengubah skema data Supabase yang
sudah kamu pakai sekarang.**

```
material-tracking/
├── index.html              ← struktur halaman & semua modal
├── css/
│   ├── tokens.css          ← warna, tipografi, radius, shadow (design tokens)
│   ├── layout.css          ← app bar, tab, kartu statistik, pipeline, toolbar
│   ├── components.css      ← tombol, badge, kartu data (record-card)
│   ├── modals.css          ← modal tambah/edit barang & transaksi
│   └── misc.css            ← layar setup Supabase, toast, tabel laporan
└── js/
    ├── config.js            ← peta tahap → tabel Supabase & daftar field form
    ├── utils.js              ← escapeHtml, toast, penomoran kolom Excel
    ├── state.js               ← state di memori + loadAll() dari Supabase
    ├── aggregate.js           ← itemStats() — semua perhitungan qty per barang
    ├── connection.js          ← simpan/pakai kredensial Supabase (localStorage)
    ├── tabs.js                 ← navigasi antar tab
    ├── dashboard.js            ← kartu ringkasan & aktivitas terbaru
    ├── stage-view.js           ← daftar per tahap, pipeline, progress bar, riwayat
    ├── item-modal.js           ← form tambah/edit jenis barang (pi_items)
    ├── entry-modal.js          ← form catat transaksi per tahap
    ├── report.js                ← tabel Laporan + ekspor Excel (.xlsx)
    └── app.js                   ← baris terakhir yang dijalankan: boot aplikasi
```

Tidak ada langkah build. Buka `index.html` langsung di browser, atau
deploy foldernya apa adanya ke GitHub Pages / Netlify / Vercel / hosting
statis lainnya.

## 1. Menghubungkan ke Supabase

Saat pertama kali dibuka, aplikasi meminta:

- **Supabase Project URL** — dari Supabase Dashboard → *Settings → API*
- **Supabase Anon Public Key** — dari halaman yang sama

Dua nilai ini disimpan di `localStorage` browser kamu saja (key
`mt_supabase_url` dan `mt_supabase_key`), tidak dikirim ke server lain.
Untuk mengganti koneksi nanti, klik ikon ⚙ di pojok kanan atas.

## 2. Skema tabel (TIDAK BERUBAH)

Aplikasi ini memakai persis nama tabel dan nama kolom yang sama seperti
versi sebelumnya, jadi data yang sudah ada di project Supabase kamu
tetap terbaca tanpa migrasi apa pun:

| Tabel | Dipakai untuk |
|---|---|
| `pi_items` | Master jenis barang per PI (pi_no, pi_date, brand, pi_specification, description, pi_qty, unit) |
| `receipts` | Transaksi Gudang (supplier, sj_do_no, sj_do_date, sj_do_qty, sj_do_unit, delivery_date_to_qc, status_material) |
| `qc_entries` | Transaksi QC Awal & QC Ulang (source_stage, bentuk_diperiksa, inspection_date, good_material, ng_material, qc_status, delivery_supply_material) |
| `machine_entries` | Transaksi Diecut (machine_date, qty_in, qty_out, machine_status, notes) |
| `supply_entries` | Transaksi Suplai (supply_date, supply_qty, total_material, supply_status) |
| `production_entries` | Transaksi Produksi (production_date, production_qty, production_status, notes) |

Semua tabel transaksi punya kolom `pi_item_id` yang merujuk ke `pi_items.id`.

**Penting:** jangan mengganti nama tabel/kolom di Supabase — jika perlu
menambah field baru, tambahkan kolom baru saja (jangan rename), lalu
tambahkan nama field itu ke `FIELDS_BY_STAGE` di `js/config.js` dan ke
input yang sesuai di `index.html`.

## 3. Alur kerja aplikasi

1. **Gudang** — buat PI baru (bisa berisi beberapa jenis barang sekaligus),
   lalu catat tiap kedatangan barang dari supplier (bisa bertahap/parsial).
2. **QC** — periksa barang yang sudah diterima gudang. Barang bisa ditandai
   **Sheet** (perlu Diecut dulu) atau **Pcs** (langsung siap ke Suplai).
3. **Diecut** — khusus barang Sheet: catat hasil potong mesin, lalu kirim
   balik ke QC untuk **QC Ulang**.
4. **Suplai** — terima barang yang sudah lolos QC (baik jalur Pcs langsung
   maupun jalur Sheet setelah QC Ulang).
5. **Produksi** — catat pengiriman dari Suplai ke bagian produksi.
6. **Laporan** — ringkasan seluruh tahap per jenis barang, dengan tombol
   ekspor ke file `.xlsx` (header berkelompok, siap dibuka di Excel).

## 4. Pengembangan lanjutan di GitHub

Karena sudah dipecah per file, alur kerja Git jadi jauh lebih rapi:
setiap perubahan tampilan (CSS), logika satu tahap (mis. `stage-view.js`),
atau laporan (`report.js`) bisa di-*commit* dan di-*review* terpisah tanpa
menyentuh file lain.

Saran struktur *branch*:
- `main` — versi yang dipakai tim (bisa langsung di-deploy)
- `feature/...` — untuk perubahan per fitur, lalu pull request ke `main`
