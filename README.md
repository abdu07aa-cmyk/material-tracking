# MaterialFlow – Pendataan Material (Gudang → QC → Supply → Finish Good)

Web app mobile-friendly untuk mencatat alur material. Data saling terhubung per **PI**:

1. **Leader Gudang** input PI/PO dan penerimaan per Surat Jalan (SJ/DO). Total incoming & balance PO dihitung otomatis.
2. **Leader QC** memeriksa tiap SJ: Good + NG tidak boleh melebihi Qty SJ. NG wajib diberi keterangan.
3. **Leader Supply Material** mengirim material **Good** ke produksi (tidak bisa melebihi stok Good) dan mencatat retur.
4. **Leader Finish Good/Produksi** mencatat hasil jadi: Karton, Display, Booklet/Cones. Balance dihitung otomatis.

Semua saldo (balance) dihitung otomatis oleh database, tidak diinput manual.

## Laporan & Export Excel
- **Dashboard → tab "Laporan Tabel"**: satu tabel panjang seperti format Excel (Incoming → QC → Supply → Finish Good). Satu baris = satu Surat Jalan; pengiriman supply dan penerimaan finish good dari PI yang sama ditampilkan pada baris berikutnya.
- Tombol **Export Excel** menghasilkan file `.xlsx` berformat (judul, header berkelompok, garis, warna selang-seling, filter, siap cetak landscape) untuk laporan atasan. Hasil pencarian ikut terexport.
- Setiap tabel di menu Gudang, QC, Supply, dan Finish Good juga punya tombol **Excel**.
- Modul Excel dimuat dari internet saat tombol ditekan, jadi perangkat harus online.

## File
| File | Fungsi |
|---|---|
| `schema.sql` | Tabel, validasi otomatis, hak akses per role, view saldo (jalankan di Supabase) |
| `config.js` | Isi URL & anon key Supabase |
| `index.html`, `style.css`, `app.js` | Aplikasi web |

## Setup (sekali saja)

### 1. Supabase
1. Buat project di supabase.com.
2. Buka **SQL Editor → New query**, tempel seluruh isi `schema.sql`, klik **Run**.
3. **Authentication → Providers → Email**: matikan **Allow new users to sign up** (agar hanya akun dari Admin yang bisa masuk). Matikan juga "Confirm email" bila Anda membuat user lewat dashboard dengan Auto Confirm.
4. **Authentication → Users → Add user**: buat akun untuk setiap orang (email + password, centang *Auto Confirm User*).
   - **Akun pertama yang dibuat otomatis menjadi Admin.** Buat akun Anda dulu.
5. Login ke aplikasi sebagai Admin → menu **Pengguna** → atur role: Leader Gudang, Leader QC, Leader Supply Material, Leader Finish Good/Produksi.
6. **Project Settings → API**: salin *Project URL* dan *anon public key*.

### 2. Config
Edit `config.js`, isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY`. Jangan pakai `service_role` key.
(Anon key memang publik; data tetap aman karena dilindungi RLS di `schema.sql`.)

### 3. GitHub Pages
1. Buat repository, upload semua file ini ke root repo.
2. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main` / `(root)`.
3. Tunggu beberapa menit, buka `https://<username>.github.io/<repo>/`.
4. Di HP: buka link → menu browser → *Add to Home Screen*.

## Hak akses
| Role | Lihat | Input/Ubah | Hapus |
|---|---|---|---|
| Admin | Semua | Semua menu | Ya |
| Leader Gudang | Semua | PI & Penerimaan SJ | Tidak |
| Leader QC | Semua | Hasil QC | Tidak |
| Leader Supply | Semua | Pengiriman & Retur | Tidak |
| Leader Produksi | Semua | Finish Good | Tidak |
| Viewer | Semua | Tidak ada | Tidak |

## Aturan validasi (dijaga database)
- No SJ tidak boleh dobel pada PI yang sama; PI + Brand + Spesifikasi tidak boleh dobel.
- QC: Good + NG ≤ sisa Qty SJ yang belum dicek; NG > 0 wajib ada keterangan.
- Kirim material ≤ stok Good (Good QC − dikirim + retur).
- Retur ≤ sisa material di produksi, tanggal retur tidak boleh sebelum tanggal request.
- Data yang sudah dipakai tahap berikutnya tidak bisa dihapus/diubah sehingga merusak angka.

## Rumus balance
- **Balance PO** = Qty PO − Total Incoming (positif = masih kurang, negatif = kirim lebih).
- **Sisa dicek QC** = Qty SJ − Good − NG.
- **Stok siap kirim** = Good − Dikirim + Retur.
- **Balance Supply** = Dikirim − Retur.
- **Balance Finish Good** = (Dikirim − Retur) − Booklet/Cones jadi.
  *Asumsi: 1 booklet/cones memakai 1 satuan material. Jika rumus di perusahaan Anda berbeda, ubah kolom `fg_balance` di view `v_po_summary` pada `schema.sql`.*

## Tips
- Cadangan data: Supabase → Database → Backups, atau tombol **CSV** di setiap tabel.
- Menambah tahap/kolom baru: ubah `schema.sql`, jalankan lagi di SQL Editor.
