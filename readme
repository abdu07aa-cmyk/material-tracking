# Material Tracking — Data Order & Status

Web app mobile-friendly untuk mencatat alur material dari PI sampai ke produksi:
**Gudang (terima dari supplier) → QC (periksa) → Suplai Material (terima dari QC) → Produksi (kirim ke lini produksi)**

Didesain untuk kondisi nyata di lapangan:
- **1 PI bisa berisi banyak jenis barang** — tiap jenis barang jadi 1 kartu tersendiri.
- **Barang datang dari supplier bisa parsial / bertahap** — tiap kedatangan dicatat sebagai transaksi baru, jumlahnya otomatis dijumlahkan.
- **QC ke Suplai, dan Suplai ke Produksi, juga bisa parsial** — sama, dicatat bertahap dan dijumlahkan otomatis.

Isi paket ini:
- `index.html` — aplikasinya (1 file saja)
- `schema.sql` — perintah untuk membuat struktur database di Supabase (otomatis memindahkan data lama kalau ada)
- `README.md` — panduan ini

---

## Langkah 1 — Buat / perbarui database Supabase

1. Buka Supabase Dashboard project kamu → **SQL Editor** → **New query**.
2. Copy semua isi `schema.sql`, paste, klik **Run**.
   - Kalau ini project **baru**: langsung membuat 5 tabel (`pi_items`, `receipts`, `qc_entries`, `supply_entries`, `production_entries`).
   - Kalau kamu **sudah pernah pakai versi lama** (tabel `material_tracking`, 1 baris = 1 order): script ini otomatis memindahkan semua data lamamu ke struktur baru, dan tabel lama diganti nama jadi `material_tracking_legacy` (tidak dihapus, aman sebagai cadangan).
3. Cek di **Table Editor** — harus muncul tabel `pi_items`, `receipts`, `qc_entries`, `supply_entries`, `production_entries`.

## Langkah 2 — Upload `index.html` ke GitHub (timpa file lama)

Upload dan timpa file `index.html` di repo GitHub kamu seperti biasa (**Add file → Upload files**, lalu Commit). Kalau GitHub Pages sudah aktif, tidak perlu setting ulang — cukup tunggu ~1 menit lalu refresh link-nya.

## Langkah 3 — Buka aplikasinya

Data URL & key Supabase yang sudah tersimpan di browser tetap terpakai (tidak perlu input ulang), karena strukturnya nyambung ke project Supabase yang sama.

---

## Cara pakai aplikasi

Aplikasi punya **6 menu**:

- **Dashboard** — ringkasan jumlah jenis barang, yang masih ada sisa belum diperiksa QC, total qty lulus QC, dan total qty yang sudah terkirim ke produksi.
- **Gudang** — tempat menambah **jenis barang baru** (tombol + di kanan bawah: isi PI No, PI Date, Brand, PI Specification, PI Qty, Unit). Untuk tiap jenis barang, ada tombol **"+ Catat Gudang"** untuk mencatat setiap kali barang datang dari supplier — bisa dipakai berkali-kali kalau kirimnya bertahap, semua otomatis dijumlahkan dan dibandingkan dengan PI Qty yang dipesan.
- **QC** — daftar barang yang masih ada sisa belum diperiksa. Tombol **"+ Catat Quality Control"** mencatat satu kali pemeriksaan (Good Material, N.G Material, dll) — bisa dicatat berkali-kali untuk batch yang berbeda.
- **Suplai** — daftar barang yang masih ada sisa hasil QC belum diterima suplai. Tombol **"+ Catat Suplai Material"** mencatat tiap kali suplai menerima kiriman dari QC.
- **Produksi** *(menu baru)* — daftar barang yang masih ada sisa di suplai belum dikirim ke produksi. Tombol **"+ Catat Produksi"** mencatat tiap kali suplai mengirim barang ke bagian produksi.
- **Laporan** — tabel ringkasan per jenis barang: total diterima, total good/NG, total ke suplai, total ke produksi, beserta status terakhir dan sisa di tiap tahap. Bisa dicari dan diekspor ke CSV untuk laporan ke atasan.

**Mengedit info dasar barang** (PI No, Brand, PI Specification, dst) — ketuk bagian judul kartu (bukan tombol "+ Catat...") di menu Gudang untuk membuka form edit, termasuk tombol Hapus (menghapus jenis barang beserta seluruh riwayat transaksinya di semua tahap — dipakai hati-hati).

**Melihat / mengedit riwayat transaksi** — tiap kartu barang menampilkan beberapa transaksi terakhir di bagian bawah; ketuk salah satu baris riwayat untuk membuka & mengedit transaksi tersebut.

## Catatan keamanan (penting dibaca sebelum dipakai luas)

Versi ini didesain untuk kemudahan (siapa pun yang punya link + key bisa input/edit data), cocok untuk tim internal kecil. Kalau nanti perlu login per-user (misalnya beda hak akses untuk Gudang, QC, Suplai, dan Produksi), tinggal bilang — bisa ditambahkan **Supabase Auth** tanpa mengubah struktur data yang sudah ada.

## Kalau mau kustomisasi lebih lanjut

Semua tampilan & kolom ada di satu file `index.html`. Kalau butuh kolom tambahan, laporan berbeda, atau menu baru lagi (misalnya retur barang), tinggal bilang.
