# Material Tracking — Data Order & Status

Aplikasi pelacakan material multi-tahap (Gudang → QC Awal → Diecut →
QC Ulang → Suplai Material → Produksi), berjalan penuh di browser dan
disimpan di Supabase. Versi ini disusun ulang menjadi **halaman kerja
terpisah per peran** (Admin, Gudang, QC, Diecut, Suplai Material,
Produksi) — setiap orang hanya melihat dan mengerjakan bagian mereka,
sementara semua data tetap terkumpul dalam satu database yang sama dan
bisa dilihat/dikoreksi penuh oleh Admin.

**Tidak ada satu pun tabel atau kolom Supabase yang berubah** dari
versi sebelumnya — lihat bagian "Skema tabel" di bawah.

```
material-tracking/
├── index.html              ← struktur halaman, layar peran, & semua modal
├── css/
│   ├── tokens.css          ← warna, tipografi, radius, shadow (design tokens)
│   ├── layout.css          ← app bar, tab, kartu statistik, pipeline, toolbar
│   ├── components.css      ← tombol, badge, kartu data (record-card)
│   ├── modals.css          ← modal tambah/edit barang & transaksi
│   ├── misc.css            ← layar setup Supabase, toast, tabel laporan
│   ├── features.css        ← linimasa riwayat & panel Perlu Perhatian
│   ├── roles.css           ← [BARU] layar pilih peran, chip peran, log per divisi
│   └── print.css           ← tampilan khusus saat Cetak/PDF Laporan
└── js/
    ├── config.js            ← peta tahap → tabel Supabase & daftar field form
    ├── utils.js              ← escapeHtml, toast, penomoran kolom Excel
    ├── state.js               ← state di memori + loadAll() dari Supabase
    ├── aggregate.js           ← itemStats() + insight & sortir per barang
    ├── roles.js                ← [BARU] konfigurasi peran, layar pilih peran, PIN Admin
    ├── connection.js          ← simpan/pakai kredensial Supabase (localStorage)
    ├── tabs.js                 ← navigasi antar tab (difilter sesuai peran)
    ├── dashboard.js            ← kartu ringkasan & aktivitas terbaru (khusus Admin)
    ├── stage-view.js           ← daftar per tahap, pipeline, progress bar, riwayat
    ├── stage-log.js             ← [BARU] log riwayat flat + ekspor per divisi
    ├── item-modal.js           ← form tambah/edit jenis barang (khusus Admin)
    ├── pi-admin.js               ← [BARU] tabel manajemen Data PI (khusus Admin)
    ├── entry-modal.js          ← form catat transaksi per tahap
    ├── report.js                ← tabel Laporan + ekspor Excel + Cetak/PDF (khusus Admin)
    ├── timeline.js               ← modal Riwayat Lengkap lintas tahap (semua peran)
    ├── insights.js                ← panel Dashboard "Perlu Perhatian" (khusus Admin)
    ├── shortcuts.js                ← pintasan keyboard ("/", Esc)
    └── app.js                       ← baris terakhir yang dijalankan: boot aplikasi
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

## 2. Peran & pembagian tugas

Setelah tersambung ke Supabase, aplikasi menampilkan **layar pilih
peran**. Peran yang dipilih disimpan di perangkat itu (localStorage),
jadi komputer/tablet di tiap divisi bisa "diam" di peran masing-masing
setiap dibuka. Tombol ⇄ di app bar dipakai untuk ganti peran kapan saja.

| Peran | Tab yang terlihat | Tugas |
|---|---|---|
| **Admin** | Dashboard, Data PI, Gudang, QC, Diecut, Suplai, Produksi, Laporan | Input PI baru (`pi_items`), kontrol & **koreksi/edit/hapus** semua data transaksi bila ada laporan yang salah, lihat Laporan & ekspor lengkap. |
| **Gudang** | Gudang | Terima barang masuk dari supplier, catat terhadap PI yang sudah dibuat Admin. |
| **Quality Control** | QC | Terima barang dari Gudang → periksa (**QC Awal**) → barang Sheet dioper ke Diecut, barang Pcs langsung ke Suplai. Barang yang kembali dari Diecut diperiksa lagi di tab yang sama sebagai **QC Ulang**, lalu dioper ke Suplai. |
| **Diecut** | Diecut | Terima barang Sheet dari QC, potong di mesin, kirim balik ke QC untuk QC Ulang. |
| **Suplai Material** | Suplai | Terima barang yang sudah lolos QC (baik dari QC langsung maupun dari QC Ulang), lalu oper ke Produksi. |
| **Produksi** | Produksi | Konfirmasi penerimaan barang dari Suplai Material. |

**Admin dilindungi PIN** (dibuat sendiri saat pertama kali memilih
peran Admin, minimal 4 digit, disimpan di localStorage perangkat itu).
Peran lain tidak butuh PIN — silakan tambahkan pengamanan tambahan
(mis. kunci layar perangkat divisi) sesuai kebutuhan lapangan.

> **Catatan jujur soal keamanan:** ini proteksi ringan di sisi
> tampilan (client-side), bukan sistem login server sungguhan. Semua
> divisi memakai anon key Supabase yang sama, jadi secara teknis semua
> orang tetap bisa membaca/menulis ke semua tabel kalau mereka
> membuka console browser. Untuk keamanan tingkat produksi yang
> sebenarnya (login per-user + Row Level Security di Supabase), ini
> perlu dikembangkan lebih lanjut secara terpisah — di luar cakupan
> perubahan kali ini karena itu akan menambah skema (tabel/kebijakan)
> baru di Supabase.

### Batasan edit per peran

- Semua peran divisi (Gudang/QC/Diecut/Suplai/Produksi) hanya bisa
  **menambah** transaksi baru di tab mereka — riwayat transaksi lama
  tampil sebagai catatan saja (tidak bisa diklik untuk diedit/dihapus).
- **Hanya Admin** yang bisa mengedit/menghapus transaksi yang sudah
  ada (klik baris riwayat di kartu manapun) dan mengedit/menghapus
  Data PI (`pi_items`) lewat tab **Data PI**.
- Tombol "🕘 Riwayat Lengkap" (lihat linimasa lintas semua tahap)
  tetap bisa dibuka oleh semua peran — sifatnya hanya untuk dibaca.

## 3. Skema tabel (TIDAK BERUBAH)

Aplikasi ini memakai persis nama tabel dan nama kolom yang sama seperti
versi sebelumnya, jadi data yang sudah ada di project Supabase kamu
tetap terbaca tanpa migrasi apa pun:

| Tabel | Dipakai untuk |
|---|---|
| `pi_items` | Master jenis barang per PI (pi_no, pi_date, brand, pi_specification, description, pi_qty, unit) — dikelola oleh Admin di tab Data PI |
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

## 4. Riwayat & ekspor per divisi

Tiap tab divisi (Gudang/QC/Diecut/Suplai/Produksi) punya dua lapis riwayat:

1. **Riwayat ringkas** — 4 transaksi terakhir per barang, langsung di
   tiap kartu (seperti sebelumnya).
2. **📜 Log Riwayat** — tombol baru yang membuka tabel datar berisi
   **semua** transaksi divisi tersebut lintas semua barang, diurutkan
   terbaru dulu. Ada tombol **⭳ Ekspor Riwayat** di sebelahnya untuk
   mengunduh log itu sebagai `.xlsx` — terpisah dari ekspor Laporan
   lengkap milik Admin.

## 5. Fitur lain yang sudah ada

- **⚠ Perlu Perhatian (Dashboard, Admin)** — daftar otomatis barang
  yang ≥3 hari tanpa progres di satu tahap manapun.
- **Sortir per tab** — PI Terbaru / PI Terlama / Qty-Sisa Terbanyak.
- **Cetak / PDF Laporan (Admin)** — dialog cetak browser, siap "Save as PDF".
- **Duplikat PI (Admin)** — salin Brand/Spesifikasi/Unit ke form PI baru.
- **Pintasan keyboard** — `/` fokus ke kolom cari tab aktif, `Esc` tutup modal.

## 6. Alur kerja aplikasi

1. **Admin** membuat Data PI baru di tab **Data PI** (bisa berisi
   beberapa jenis barang sekaligus).
2. **Gudang** mencatat tiap kedatangan barang dari supplier terhadap
   PI tersebut (bisa bertahap/parsial).
3. **QC** memeriksa barang yang sudah diterima gudang. Barang bisa
   ditandai **Sheet** (perlu Diecut dulu) atau **Pcs** (langsung siap
   ke Suplai).
4. **Diecut** memotong barang Sheet, lalu mengirim balik ke QC untuk
   **QC Ulang** (dicatat di tab QC yang sama, dengan Asal Barang = Diecut).
5. **Suplai Material** menerima barang yang sudah lolos QC (baik jalur
   Pcs langsung maupun jalur Sheet setelah QC Ulang), lalu mengoper ke Produksi.
6. **Produksi** mengonfirmasi penerimaan dari Suplai.
7. **Admin** memantau semuanya lewat **Laporan** (ringkasan seluruh
   tahap per jenis barang, dengan ekspor `.xlsx` dan Cetak/PDF), dan
   membetulkan data lewat tab divisi terkait (klik baris riwayat) atau
   tab **Data PI** kalau yang salah adalah data PI itu sendiri.

## 7. Pengembangan lanjutan di GitHub

Karena sudah dipecah per file, alur kerja Git jadi jauh lebih rapi:
setiap perubahan tampilan (CSS), logika satu tahap (mis. `stage-view.js`),
peran (`roles.js`), atau laporan (`report.js`) bisa di-*commit* dan
di-*review* terpisah tanpa menyentuh file lain.

Saran struktur *branch*:
- `main` — versi yang dipakai tim (bisa langsung di-deploy)
- `feature/...` — untuk perubahan per fitur, lalu pull request ke `main`
