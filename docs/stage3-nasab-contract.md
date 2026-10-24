# Nasab tahap 3 — kontrak dan implementasi

Tanggal: 23 Oktober 2026. Status: implementasi lokal, belum dirilis. Database produksi belum diubah.

Koreksi kompatibilitas lokal: aplikasi memakai mode `legacy` secara default (`individuals`, `marriages`, `events`, `sources`). Mode baru hanya aktif dengan `VITE_NASAB_READ_MODE=contract` setelah migrasi/API lulus. Ini pilihan konfigurasi sebelum request, bukan fallback ketika izin ditolak. Dalam mode legacy, adopsi dan bukti per fakta belum tersedia; UI menyatakan bukti belum diaktifkan. `.env.example` hanya template; konfigurasi lokal berada di `.env.local`. Restart Vite setelah mengganti konfigurasi. Setelah koreksi ini, 24 uji otomatis lulus.

## Ruang lingkup

Nasab menjadi sumber profil, orang tua biologis, perkawinan, peristiwa dan bukti per fakta. UUID sumber tetap menjadi kunci; kode silsilah bukan identitas lintas aplikasi. Registry core.people dan pemetaan identitas yang telah diterapkan tidak diubah oleh pekerjaan ini.

Kamus pernah mengikuti istilah pengguna. Leluhur mencapai 19 tingkat, keturunan 18 tingkat. Anak angkat memerlukan catatan adopsi eksplisit, tidak disimpulkan dari pasangan atau nama keluarga.

## Kontrak baca konsumen

| Sumber | Kontrak yang dibutuhkan | Makna |
|---|---|---|
| Profil | nasab_nawra_people_v1 | Profil yang diizinkan untuk publik; ID parent privat/tidak tersedia menjadi NULL. |
| Perkawinan | nasab_nawra_marriages_v1 | Kedua pihak dapat dibaca. is_active true digunakan untuk hubungan pasangan/ipar/tiri saat ini. |
| Adopsi | nasab_nawra_adoptions_v1 | id, parent_id, child_id; hanya relasi eksplisit dan dipublikasikan, kedua pihak dapat dibaca. Kontrak baru, belum dikonfirmasi tersedia di server. |
| Peristiwa | nasab_nawra_events_v1 | Peristiwa publik milik profil yang dapat dibaca; tanggal kosong tetap tidak diketahui. |
| Sumber | nasab_nawra_sources_v1 | Katalog sumber, tidak otomatis menjadi bukti semua fakta profil. |
| Bukti | nasab_nawra_evidence_v1 | source_id, target, predicate, asserted_value, locator, quotation, review_status. |

Konsumen melakukan pagination berdasarkan UUID naik sampai halaman kosong, bukan berhenti karena jumlah kurang dari 500. Profil/keluarga diterapkan bersama setelah seluruh pembacaan berhasil. Referensi yang tidak dapat dipertemukan menghasilkan INCONSISTENT_SNAPSHOT, bukan silsilah parsial. Pembacaan beberapa request ini belum merupakan snapshot transaksi database: perubahan serentak masih perlu diselesaikan dengan RPC snapshot atau revisi snapshot saat kontrak server dibangun.

Kegagalan kontrak, akses, jaringan dan bentuk data dibedakan melalui kode yang aman. Error mentah, token dan isi konfigurasi tidak ditampilkan. Saat pembacaan produksi gagal, aplikasi tidak menggantinya dengan mock data. Mode demo hanya berlaku bila konfigurasi Supabase memang tidak tersedia.

## Semantik penelusuran

Pembaruan UI Pernah: lihat `pernah-multiple-paths.md`. UI kini menampilkan beberapa hubungan sekaligus melalui `calculatePernah`; prioritas satu hasil di bawah hanya berlaku bagi fungsi kompatibilitas `calculateRelationship`.

- Jalur menggunakan father_id/mother_id, perkawinan aktif, atau adopsi eksplisit. Setiap langkah menyimpan recordId dan field asal.
- Tidak ada hubungan yang disimpulkan hanya karena berada pada tingkat generasi global yang sama.
- Kedua parent sama dan diketahui: saudara kandung. Satu parent sama dan parent lain diketahui berbeda: saudara separuh/Kuwalon. Parent lainnya kosong: hubungan saudara belum lengkap.
- Senioritas membutuhkan dua tanggal lahir lengkap, sah dan berbeda. Tanggal parsial, kosong atau sama tidak menghasilkan tebakan kakak/adik.
- Pakdhe/Budhe/Paklik/Bulik membandingkan saudara dengan orang tua target, termasuk cabang ibu.
- Mas/Mbak/Adik Misan dan Mindhoan mengikuti urutan cabang orang tua/leluhur, bukan usia kedua sepupu. Cabang yang berbeda senioritasnya memakai istilah netral dan peringatan.
- Subjek adalah sebutan bagi target. Contoh: orang tua anak terhadap pasangan anak = Maratuwa; pasangan anak terhadap orang tua = Mantu.
- Perkawinan aktif langsung menjadi hubungan utama; hubungan darah langsung menjadi prioritas berikutnya, lalu kerabat melalui leluhur bersama, lalu afinitas maksimum empat langkah. Ini bukan enumerasi semua jenis hubungan yang mungkin berlaku bersamaan.
- Pembarep/Penengah/Ragil hanya di antara anak dari pasangan orang tua yang sama yang tercatat, dan tidak disimpulkan bila perbandingan tanggal belum cukup.
- Penelusuran membatasi 5.000 jalur, 19 tingkat ke atas/18 ke bawah; UI menampilkan 25 entri per halaman dan maksimal 20 jalur hubungan. Hasil terpotong diberi tanda.
- Leluhur yang muncul melalui beberapa cabang dipertahankan dengan jalur masing-masing. Siklus dihentikan; kalkulator hubungan menahan kesimpulan jika menemukan siklus pada leluhur subjek/target.
- Akses kosong bukan bukti bahwa orang tua, pasangan atau keturunan tidak ada.

## Bukti dan peristiwa

Panel baru menampilkan peristiwa, bukti per predikat dan sumber terpisah. Status draft, reviewed dan disputed dipertahankan; reviewed ditampilkan sebagai “Ditinjau”, bukan kepastian semua fakta. Perkawinan dapat mempunyai bukti sendiri. Tautan internal Docker tidak diterbitkan sebagai URL browser. Tautan klik sementara dibatasi HTTPS pada domain aplikasi Qomaruddin yang dikenal.

Kontrak lama belum mempunyai target event_id/adoption_id dan revisi fakta yang ditinjau. Kebutuhan migrasi berikut:

1. Satu bukti menunjuk tepat satu target profil/perkawinan/peristiwa/adopsi, disertai predicate dan revisi/nilai yang diperiksa.
2. Perubahan fakta menandai tinjauan usang; tidak mempertahankan status ditinjau terhadap nilai baru.
3. Relasi adopsi mempunyai sumber, locator, status tinjauan, aktor kurator, revision, visibility dan audit. Parent biologis tidak ditimpa.
4. Publikasi relasi harus menyaring kedua endpoint dan sumber bukti. Jangan menyimpulkan izin publik hanya dari status ditinjau.
5. Perubahan parent harus menolak self-link/siklus dan konflik penulis melalui transaksi. Deteksi di frontend bukan pengganti constraint/prosedur server.

Bagian ini belum dinyatakan diterapkan. nasab-schema-v1.sql adalah rancangan cutover lama dan tidak boleh langsung dijalankan: file itu mengganti policies dan menjadikan record lama privat, sehingga perlu penyelarasan publikasi/UI/Nawra.

## Urutan penyelesaian dan gerbang rilis

1. Jalankan scripts/inspect-nasab-stage3.sh pada ThinkPad. Script hanya membaca struktur, policies, grants, trigger dan jumlah record; tidak membaca isi profil, tidak menyalin foto.
2. Berdasarkan keluaran aktual, siapkan migrasi khusus yang menjaga data, grants kustom, identitas dan perilaku konsumen lama. Tentukan cutover kontrak baca dan publikasi tanpa membuka profil privat.
3. Uji migrasi pada fresh restore, termasuk akses anon/kurator/runtime, bukti peristiwa/adopsi, stale revision, siklus dan konflik dua sesi. Setelah lulus, baru terapkan transaksi produksi dan uji API.
4. Uji browser mobile/desktop dan rilis frontend GitHub → Cloudflare setelah kontrak server tersedia. Jangan push build ini sebelum gerbang database/API lulus.
5. Uji pengguna: Sholeh Tsani ke Qomaruddin memakai jalur aktual; jumlah anak dari record terkini; pasangan dan dua arah ipar; sumber bukti; profil privat; jalur sintetis 19/18 tingkat. Fixture sintetis tidak menjadi sejarah produksi.

## Pemeriksaan lokal

Perintah: npm.cmd test; npm.cmd run lint; npm.cmd run build. Kasus pengujian berada di tests/relationships.test.ts dan tests/nasab-contract.test.ts. tests/browser-harness.html adalah halaman pengujian lokal dengan data sintetis, bukan entry build produksi.

Hasil terakhir: 22 uji otomatis lulus; TypeScript lulus; build Vite lulus. Peringatan ukuran bundle >500 kB masih ada. Pemeriksaan sintaks Bash lokal tidak berhasil dijalankan karena Git Bash ditolak sandbox Windows; jalankan bash -n pada server sebelum pemeriksaan baca-saja.

Browser belum terverifikasi: instalasi Playwright tidak tersedia karena jaringan sandbox dan pemeriksaan persetujuan otomatis gagal akibat batas penggunaan. Browser bawaan juga tidak dapat menjangkau server localhost. Build/unit test tidak menggantikan pemeriksaan visual maupun bukti produksi.

Tidak ada commit, push, migrasi server, sinkronisasi Nawra, atau backup foto dilakukan dalam perubahan ini.
