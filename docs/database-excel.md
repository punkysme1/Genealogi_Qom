# Database versi dan Excel

## Mencoba lokal

Jalankan `npm run setup:local` lalu `npm run dev`. Setup membaca backup Nasab pada workspace dan menulis seed ke `.local/nasab-seed.json` (diabaikan Git). Argumen opsional: `npm run setup:local -- "path/backup.sql"`.

Saat Vite development berjalan tanpa konfigurasi Supabase, mode lokal otomatis aktif. Versi 1 berisi backup 171 individu dan 55 pernikahan. Versi tambahan disimpan secara atomik di IndexedDB browser pada origin yang sama, bukan di server. Gunakan alamat dan port yang sama setiap kali. Menghapus data situs/browser menghapus versi lokal. Ekspor tiap versi untuk menyimpan salinan Excel. Mode lokal ini untuk penelusuran, impor dan ekspor; penyuntingan profil/urutan dan otorisasi verifikator tetap menggunakan backend Supabase.

Pilih **Impor / ekspor Excel → Unduh format**. Sheet Individu dan Pernikahan memakai ID sumber/nomor biasa; tidak ada kolom slug atau UUID. Format memuat metadata profil (termasuk alias, tanggal, lokasi, pendidikan, pekerjaan, biografi, ekonomi, foto), orang tua dan perkawinan. Peristiwa, sumber bukti, status verifikasi dan urutan anak tidak diimpor/ekspor. Nama yang belum diketahui tetap menjadi individu tersendiri dengan penanda ID.

Unggah, beri nama database, periksa ringkasan, pilih tokoh pangkal bila diketahui, lalu simpan. Setiap impor baru membuat versi berikutnya; tidak mengganti versi sebelumnya. Impor ulang permintaan yang gagal menerima jawaban menggunakan ID permintaan yang sama agar tidak membuat versi ganda. Mengganti file/nama/pangkal merupakan permintaan baru. Tanggal dan status yang kosong tetap belum diketahui.

## Backend setelah uji lokal

Push ke GitHub tidak menerapkan migrasi PostgreSQL dan tidak membawa data IndexedDB. Migrasi `supabase/migrations/202611030001_dataset_excel.sql` harus diuji pada restore database aktual, kemudian dipasang sebelum mengaktifkan unggah pada instalasi Supabase. Migrasi mengasumsikan tabel profil/perkawinan/admin yang ada; wrapper urutan menggunakan fungsi `nasab_numbering` yang sudah dipasang. Tidak menjalankan migrasi ini pada produksi selama pengerjaan fitur.

Migrasi memberi semua individu/perkawinan existing `dataset_id=1`, tanpa mengganti UUID, slug atau relasi. Versi disimpan di `nasab_datasets`; foreign key gabungan mencegah relasi lintas versi. Tampilan baca khusus mempertahankan batas baris/kolom view publik jika tersedia. Konsumen lama yang membaca `individuals` langsung tanpa filter harus diperbarui untuk memilih `dataset_id`; jangan aktifkan impor produksi sebelum integrasi pembaca lain ditinjau. Penomoran tetap memakai revisi global existing, sedangkan pangkal tampilan versi baru disimpan per dataset. Verifikasi dan urutan tidak diisi otomatis.

RPC impor memerlukan Admin Nasab dan memvalidasi data kembali di server. Semua baris dan nomor versi disimpan dalam satu transaksi; kegagalan membatalkan semuanya. Riwayat request privat mendukung retry idempotent. Pengeditan profil baru menggunakan wrapper RPC dengan dataset eksplisit; profil existing tidak dapat dipindah versi.

## Pemeriksaan

- `npm run lint` dan `npm run build`.
- `node --import tsx --test tests/dataset-workbook.test.ts tests/nasab-contract.test.ts`.
- `node scripts/test-dataset-import.mjs`: fixture PostgreSQL lokal dengan PGlite workspace; izin, rollback, idempotensi, isolasi dan wrapper urutan.
- `node scripts/test-dataset-browser.mjs`: browser Edge headless melalui Playwright runtime workspace. `NASAB_TEST_URL` memilih alamat dev (default port 3001). Konteks browser terpisah; tidak menyentuh data browser pengguna.
- Uji volume opsional memakai `NASAB_TEST_SEDULURAN=1` dan fixture privat `.local/seduluran-test.xlsx`. File ini hanya untuk pengujian; tidak dimasukkan Git.

Lima tes narasi silsilah lama masih berbeda dengan implementasi `pernah.ts` yang sudah berubah sebelum fitur ini. Perubahan narasi tersebut tidak ditimpa oleh pekerjaan versi/Excel.
