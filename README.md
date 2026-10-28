# MaterialFlow – Pendataan Material (Gudang → QC → Supply → Finish Good)

Web app mobile-friendly untuk mencatat alur material. Data saling terhubung per **PI**:

1. **Leader Gudang** input PI/PO dan penerimaan per Surat Jalan (SJ/DO). Total incoming & balance PO dihitung otomatis.
2. **Leader QC** memeriksa tiap SJ: Good + NG tidak boleh melebihi Qty SJ. NG wajib diberi keterangan.
3. **Leader Supply Material** mengirim material **Good** ke produksi (tidak bisa melebihi stok Good) dan mencatat retur.
4. **Leader Finish Good/Produksi** mencatat hasil jadi: Karton, Display, Booklet/Cones. Balance dihitung otomatis.

Semua saldo (balance) dihitung otomatis oleh database, tidak diinput manual.

## Banyak jenis barang dalam satu PI
Satu PI bisa berisi Booklet, Filter Book, Filter Cones, Display, Cover, dll. Setiap jenis barang adalah satu **item** dengan Qty PO, satuan, dan saldonya sendiri.
- **Gudang → Data PI → "PI / Item Baru"**: isi PI No, Brand, **Jenis Barang** (pilih saran atau ketik sendiri), Spesifikasi, dan Qty PO.
- Tombol **"Simpan & Tambah Item Lain di PI Ini"** menyimpan lalu membuka form berikutnya dengan PI No dan Brand sudah terisi. Tinggal ganti Jenis Barang, Spesifikasi, dan Qty.
- Di tabel Data PI, tombol **+ Item** pada baris mana pun menambah item baru di PI yang sama.
- Satu Surat Jalan yang berisi beberapa jenis barang dicatat satu baris per jenis barang dengan No. SJ yang sama.
- Dashboard dan Laporan Tabel dikelompokkan per PI, dengan kolom **Jenis Barang**. Finish Good dicatat per item, sama seperti baris di Excel.
- **Update dari versi sebelumnya:** jalankan ulang seluruh isi `schema.sql`. Data lama aman; item lama belum punya Jenis Barang, buka tombol ubah lalu isi Jenis Barang-nya.

## Alur barang SHEET: Diecut dan QC Ulang
Barang yang datang dalam bentuk **sheet** melewati tahap tambahan. Barang berbentuk PCS langsung ke Supply.

**Gudang → QC Incoming (hitung sheet) → Diecut (sheet jadi pcs) → QC Ulang (hitung pcs) → Supply → Finish Good**

- **Leader Diecut** (role baru) memakai menu **Diecut**: tab *Menunggu Diecut* menampilkan sheet yang lolos QC. Isi jumlah sheet yang didiecut; hasil pcs terisi otomatis (sheet × isi per sheet). Bila hasil nyata berbeda, isi kolom Hasil Diecut.
- **Leader QC** memakai tab *Menunggu QC Ulang* di menu QC untuk mengecek hasil diecut dalam pcs (Good + NG, NG wajib keterangan).
- **Stok siap kirim** untuk barang sheet dihitung dari **Good QC Ulang**, bukan Good QC Incoming. Supply tidak bisa mengirim barang yang belum didiecut dan dicek ulang.
- Dashboard menampilkan kotak Diecut per PI dan KPI "Menunggu Diecut" / "Menunggu QC Ulang". Laporan Tabel dan Excel punya grup kolom **DIECUT** dan **QC ULANG**.

## Filter Book
- Filter Book datang dalam sheet berisi kiri + kanan. Contoh: 45 kanan + 45 kiri = **90 pcs per sheet**. Di form PI isi Jenis Barang `Filter Book`, satuan **SHEET**, isi per sheet **90**.
- **1 kiri + 1 kanan yang dilem = 1 leaf.** Jadi 90 pcs = **45 leaves**; 10 sheet = 900 pcs = 450 leaves.
- Kolom **Isi per Filter Book (leaves)**: 32, 33, 40, 50, 60, atau angka lain. 1 filter book jadi memakai leaves × 2 pcs (mis. 32 leaves = 64 pcs).
- QC ulang mencatat **total pcs saja** (kiri dan kanan tidak dipisah); form menampilkan konversi ke leaves.
- Di **Finish Good**, isi jumlah filter book jadi. Balance otomatis memotong jumlah jadi × pcs per filter book, dan form menampilkan sisa leaves serta perkiraan buku yang masih bisa dibuat.
- **Update:** jalankan ulang seluruh `schema.sql`, lalu ubah item Filter Book yang sudah ada dan isi ulang leaves-nya (artinya berubah menjadi pasangan kiri+kanan). SJ sheet lama kini perlu Diecut + QC Ulang sebelum stoknya bisa dikirim.

## Master Barang, Badge, dan Riwayat Perubahan
- **Master Barang & Brand** (menu Admin → tab Master): daftar Jenis Barang dan Brand yang muncul sebagai pilihan di form PI. Penulisan di PI otomatis diseragamkan mengikuti daftar (huruf besar/kecil dan spasi ganda), jadi "booklet" dan "Booklet" tidak terhitung terpisah di Rekap Barang. Bila Leader Gudang mengetik nama yang belum ada, aplikasi menanyakan dulu agar salah ketik tidak menjadi data baru. Admin bisa menambah dan menghapus pilihan; menghapus dari daftar tidak mengubah PI yang sudah ada.
- **Badge tugas menunggu** (angka merah di menu): QC = SJ menunggu QC + hasil diecut menunggu QC ulang; Diecut = SJ sheet menunggu diecut; Supply = item yang punya stok siap kirim; Finish Good = item yang masih punya material di produksi untuk dijadikan barang jadi.
- **Riwayat Perubahan** (menu Admin → tab Riwayat, khusus Admin): mencatat otomatis siapa menambah, mengubah, dan menghapus data, kapan, dan nilai sebelum → sesudah. Dicatat oleh database sehingga tidak bisa diubah dari aplikasi. Menampilkan 500 perubahan terakhir.
- **Update:** jalankan ulang seluruh `schema.sql`. Jenis barang dan brand yang sudah pernah diinput otomatis masuk ke master. Riwayat perubahan mulai tercatat sejak `schema.sql` dijalankan.

## Satuan PCS dan SHEET
Barang dari supplier bisa datang dalam PCS atau masih berbentuk sheet (1 sheet berisi 3, 4, 6, 8 pcs atau lebih, bebas per material/SJ).
- Semua jumlah dan saldo di database dihitung dalam **PCS**, jadi balance Gudang → QC → Supply → Finish Good selalu sinkron.
- Di form PI, Penerimaan SJ, QC, Pengiriman, dan Retur ada pilihan **Satuan Input**: `PCS` atau `SHEET`. Bila SHEET, isi **Isi per Sheet (pcs)**, lalu aplikasi menghitung sheet × isi per sheet = pcs secara otomatis (terlihat langsung di bawah form).
- Satuan dan isi per sheet yang diisi di PI otomatis terisi saat membuat SJ, QC, dan pengiriman untuk PI yang sama. Bisa diubah bila SJ tertentu isi per sheet-nya berbeda.
- Hasil konversi harus bilangan bulat pcs (mis. 10,3 sheet × 8 = 82,4 pcs akan ditolak).
- Laporan dan tabel menampilkan jumlah dalam PCS, ditambah kolom **Satuan SJ** (mis. `500 sheet × 6 pcs`) sebagai catatan input aslinya.
- **Update dari versi sebelumnya:** jalankan ulang seluruh isi `schema.sql` di Supabase SQL Editor (aman, data lama tidak hilang; data lama otomatis berstatus PCS).

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
| `manifest.json`, `sw.js` | Agar bisa dipasang di layar utama HP seperti aplikasi |
| `icon.svg`, `icon-full.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png` | Logo aplikasi |

## Pasang di layar HP (seperti aplikasi)
- **Android (Chrome):** buka link web → menu ⋮ → **Instal aplikasi** (atau *Tambahkan ke layar utama*).
- **iPhone (Safari):** buka link web → tombol Bagikan → **Tambah ke Layar Utama**.
Logo kotak biru-ungu dengan ikon kardus akan muncul di layar utama, dan aplikasi terbuka layar penuh tanpa bilah alamat browser.
Setelah mengganti logo/manifest, hapus pintasan lama lalu pasang ulang agar logo baru terbaca.

## Setup (sekali saja)

### 1. Supabase
1. Buat project di supabase.com.
2. Buka **SQL Editor → New query**, tempel seluruh isi `schema.sql`, klik **Run**.
3. **Authentication → Providers → Email**: matikan **Allow new users to sign up** (agar hanya akun dari Admin yang bisa masuk). Matikan juga "Confirm email" bila Anda membuat user lewat dashboard dengan Auto Confirm.
4. **Authentication → Users → Add user**: buat akun untuk setiap orang (email + password, centang *Auto Confirm User*).
   - **Akun pertama yang dibuat otomatis menjadi Admin.** Buat akun Anda dulu.
5. Login ke aplikasi sebagai Admin → menu **Admin → Pengguna** → atur role: Leader Gudang, Leader QC, **Leader Diecut**, Leader Supply Material, Leader Finish Good/Produksi.
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
| Leader QC | Semua | Hasil QC & QC Ulang | Tidak |
| Leader Diecut | Semua | Proses Diecut | Tidak |
| Leader Supply | Semua | Pengiriman & Retur | Tidak |
| Leader Produksi | Semua | Finish Good | Tidak |
| Viewer | Semua | Tidak ada | Tidak |

## Aturan validasi (dijaga database)
- No SJ tidak boleh dobel pada PI yang sama; PI + Brand + Spesifikasi tidak boleh dobel.
- QC: Good + NG ≤ sisa Qty SJ yang belum dicek; NG > 0 wajib ada keterangan.
- Diecut ≤ Good QC yang belum didiecut; QC ulang (Good + NG) ≤ hasil diecut yang belum dicek.
- Kirim material ≤ stok Good (PCS: Good QC; SHEET: Good QC Ulang; dikurangi dikirim, ditambah retur).
- Retur ≤ sisa material di produksi, tanggal retur tidak boleh sebelum tanggal request.
- Data yang sudah dipakai tahap berikutnya tidak bisa dihapus/diubah sehingga merusak angka.

## Rumus balance
- **Balance PO** = Qty PO − Total Incoming (positif = masih kurang, negatif = kirim lebih).
- **Sisa dicek QC** = Qty SJ − Good − NG.
- **Stok siap kirim** = Good (QC, atau QC Ulang untuk sheet) − Dikirim + Retur.
- **Balance Supply** = Dikirim − Retur.
- **Balance Finish Good** = (Dikirim − Retur) − Booklet/Cones jadi.
  *Asumsi: 1 booklet/cones memakai 1 pcs material (Filter Book: leaves × 2 pcs). Jika rumus di perusahaan Anda berbeda, ubah kolom `fg_balance` di view `v_po_summary` pada `schema.sql`.*

## Tips
- Cadangan data: Supabase → Database → Backups, atau tombol **CSV** di setiap tabel.
- Menambah tahap/kolom baru: ubah `schema.sql`, jalankan lagi di SQL Editor.
