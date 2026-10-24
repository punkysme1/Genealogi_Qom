# Penomoran silsilah — status 23 Oktober 2026

## Keputusan kurator

Nomor cabang mengikuti urutan anak dalam kitab, bukan tanggal lahir atau urutan input. Admin menyebut orang tua acuan, posisi anak, sumber dan halaman/lembar. Penyisipan menggeser posisi berikutnya dan kode turunannya. UUID individu tidak berubah. Kode utama mengikuti jalur orang tua–anak terpendek menuju Kiai Qomaruddin, dihitung menurut jumlah hubungan. Perkawinan bukan jalur keturunan.

Satu segmen: 1–9, A–Z untuk 10–35, (36) dan seterusnya. Jalur dengan urutan hilang/duplikat tidak diberikan kode definitif. Kesamaan panjang jalur sementara diputuskan deterministik berdasarkan ID jalur; pilihan utama kurator dan riwayat kode belum dipersistenkan.

## Sudah diimplementasikan lokal

- Tipe `child_order[parentId] = {position, source, locator}` sebagai bentuk baca aplikasi. Penyimpanan server dapat memakai tabel relasi dan memproyeksikan bentuk ini melalui kontrak.
- Nomor dan senioritas tidak dihitung dari tanggal lahir. Urutan ayah dan ibu dapat berbeda; konflik arah menghasilkan senioritas tidak diketahui.
- Pembarep/penengah/ragil memerlukan daftar anak lengkap, posisi unik dan berurutan, serta rujukan tiap posisi.
- Mesin penelusuran mempertahankan beberapa jalur, mendeteksi siklus dan melaporkan batas traversal. Nama jalur dan kode menggunakan urutan hasil yang sama.
- Cache berbasis jumlah individu dihapus; koreksi tanpa penambahan individu langsung tercermin.
- Selector Pernah menampilkan kode silsilah atau status belum bernomor, bukan potongan UUID.
- Admin: pratinjau penyisipan/pemindahan urutan beserta dampak ke keturunan. Tidak menyimpan. Simpan profil secara sengaja mengecualikan metadata penomoran.
- Profil: kode belum lengkap ditandai; orang tidak terhubung tidak diberi label pendiri; tampilan bukan dokumen pengesahan.
- Pengujian lokal: 52 tes, TypeScript, Vite build lulus. Peringatan ukuran bundle tetap ada. Uji browser interaktif dan produksi belum dilakukan.

## Gerbang server sebelum aktivasi

Jalankan `scripts/inspect-nasab-stage3.sh` baca-saja di ThinkPad. Diperlukan definisi tabel, constraint, grants, RLS dan trigger aktual. Jangan menjalankan skema lama sebagai migrasi pengganti.

Migrasi harus menyediakan:

1. Relasi urutan anak bersumber per orang tua, constraint nomor positif dan keunikan (orang tua, posisi), serta kepastian kecocokan dengan hubungan ayah/ibu. Status kelengkapan daftar bersumber per orang tua. Tidak mengimpor tanggal lahir sebagai urutan secara otomatis.
2. Identitas pangkal eksplisit melalui UUID, bukan pencarian nama; preferensi jalur utama untuk jarak sama.
3. RPC kurator untuk menyisipkan/memindahkan urutan dalam satu transaksi, lock daftar/versi sebelum membaca, expected_revision untuk menolak perubahan usang. Menggeser nomor tanpa benturan constraint sementara, lalu audit aktor, alasan, sumber, posisi lama/baru dan versi. Preview frontend bukan otoritas untuk menulis.
4. Versi silsilah terpisah dari updated_at profil. Foto/biografi tidak mengubah versi penomoran. Koreksi orang tua/urutan/pangkal harus mengubah versi dan mempertahankan kode/jalur lama.
5. Hak baca mengikuti privasi individu; tulis hanya kurator Supabase Auth. Pembaca Nawra tidak boleh mengubah urutan. Perubahan profil biasa tidak boleh mengubah metadata urutan di luar RPC.
6. Rehearsal pada restore, uji dua sesi bersaing, rollback, grants, urutan kedua orang tua, penghapusan/perubahan orang tua, dan tampilan aplikasi sebelum produksi.

## Bukti pengajuan beasiswa — belum diimplementasikan

Dokumen perlu snapshot tersimpan dan ID penerbitan: UUID individu, nama saat terbit, kode utama dan seluruh jalur, UUID/nama setiap simpul, kedalaman, sumber hubungan beserta locator, versi silsilah, waktu, aktor dan status pemeriksaan. Jumlah jalur yang terpotong tidak boleh disebut total. Penerbitan harus ditolak bila traversal belum lengkap atau bukti wajib belum tersedia. Jumlah jalur bukan skor kekuatan bukti.

Verifikasi QR menunjuk dokumen snapshot, bukan profil hidup yang berubah. Halaman verifikasi membedakan sah pada versi penerbitan, sudah digantikan, atau dicabut tanpa membocorkan data keluarga privat. Keputusan beasiswa tetap wewenang lembaga. Belum ada nomor dokumen, sertifikat atau status verifikasi resmi yang diterbitkan oleh implementasi lokal ini.

## Kurasi data lama

Tanggal buatan tidak otomatis dihapus. Kurator perlu menandai mana sourced/estimated/placeholder/unknown lalu memasukkan urutan menurut kitab. Sebelum kurasi itu, kode historis berbasis tanggal tidak dianggap kode bersumber. Peralihan lokal sengaja menampilkan belum bernomor dan tidak menebak senioritas. Jangan rilis ke Cloudflare sebelum dampak transisi ini ditinjau dan data urutan siap.

## Hasil preflight produksi dan kandidat backend

Hasil pengguna: PostgreSQL 17.6; individuals belum memiliki metadata urutan; nasab_admins menjadi pemeriksa hak tulis; tidak ada trigger individuals/marriages atau view nasab_nawra. Keberadaan policy belum sendirinya membuktikan RLS aktif: kandidat memeriksa relrowsecurity sebelum membuat objek.

Kandidat `scripts/numbering-candidate.sql` menambahkan schema privat, tabel urutan dengan constraint unik tertunda, state revisi, riwayat perubahan, RPC penyisipan dan penetapan pangkal, serta view baca security_invoker. Trigger perubahan hubungan orang tua menaikkan versi dan membuang urutan yang tidak lagi cocok. Profil/foto biasa tidak menaikkan versi. Hak tulis langsung urutan ditutup; RPC memerlukan role authenticated, UUID kurator yang disepakati, dan keanggotaan nasab_admins. Kandidat tidak mengubah tanggal maupun mengisi urutan dari data lama.

17 pemeriksaan PostgreSQL lokal (PGlite, fixture sintetis) lulus, termasuk penolakan anon/nonkurator/runtime, versi usang, pergeseran, pemindahan, edit profil, perubahan orang tua, riwayat privat, dan rollback. Kasus rehearsal server juga dijalankan lokal. Ini belum membuktikan kompatibilitas restore produksi atau persaingan dua koneksi nyata.

`rehearse-numbering.py` hanya membuat backup database baru, merestore ke database baru pada container uji terisolasi yang telah digunakan sebelumnya, menerapkan kandidat di salinan, menjalankan fixture lalu rollback, dan menghentikan container uji. Produksi tidak dimigrasi. Container harus mula-mula berhenti, jaringan none, tanpa port/bind mount, dan image sama dengan database produksi. Foto tidak disalin. Jangan menjalankan SQL kandidat langsung pada produksi.

Masih perlu: completeness bersumber, pilihan jalur setara tersimpan, penyambungan read/write frontend ke RPC, snapshot bukti beasiswa, uji konkurensi sebenarnya, rehearsal dan deploy produksi. Root kandidat ditampilkan oleh rehearsal untuk penetapan UUID eksplisit.

## Rehearsal ThinkPad berhasil

Pengguna melaporkan PASS pada database uji `qom_numbering_081cabd27d48`, log privat `numbering-rehearsal-41a7e473d3f0`. Migrasi kandidat, penyisipan, penolakan versi usang, izin tulis langsung, dan rollback lulus. Individu existing tidak berubah. Produksi belum dimigrasi.

Pangkal yang cocok adalah Kiai Qomaruddin (`5245e51b-d139-4d34-9117-7c58948ec6df`), berbeda dari dua tokoh lain yang namanya mengandung Qomaruddin. UUID ini belum ditulis ke state produksi.

Uji berikutnya `test-numbering-concurrency.py` mengkloning database rehearsal tersebut dalam container terisolasi. Dua proses psql terpisah dipaksa bersaing; pg_stat_activity dan pg_blocking_pids membuktikan lock, kemudian diuji commit pertama/penolakan versi usang dan rollback pertama/keberhasilan writer kedua. Menguji penyisipan serta pemindahan posisi, satu penambahan revisi/riwayat dan aktor. Script diperiksa sintaks lokal; hasil konkurensi nyata masih menunggu ThinkPad. Tidak membuat backup foto atau menghubungi container produksi.

## Penyederhanaan formulir yang diminta kurator

Langkah 1 menjadi Orang Tua dan Urutan Anak: pilihan Ayah langsung diikuti Anak ke-… dari [nama ayah], dan pilihan Ibu diikuti Anak ke-… dari [nama ibu]. Tidak ada pilihan orang tua acuan kedua, kolom sumber/halaman tambahan, atau panel dampak. Bagian verifikasi existing menjadi tempat rujukan. Status verifikasi individu tidak otomatis mengesahkan setiap hubungan atau kelengkapan semua anak.

Kolom urutan saat ini nonaktif dengan keterangan eksplisit karena backend belum diterapkan dan penyimpanan gabungan belum terhubung. Tidak ada nomor yang diam-diam dibuang saat simpan profil. Setelah backend terhubung, simpan profil dan dua urutan harus satu transaksi/versi, lalu salin rujukan dari bagian verifikasi ke riwayat. Jika rujukan belum diisi, bedakan catatan urutan belum diverifikasi dari bukti bersumber; jangan mengarang halaman untuk memenuhi constraint kandidat. Kandidat SQL saat ini masih mensyaratkan locator sehingga perlu disesuaikan dan diuji sebelum rilis.

Uji konkurensi ThinkPad dilaporkan lulus untuk insert/move/rollback, pada clone qom_numbering_race_4b963c155d8a; log numbering-concurrency-03b4166dc468. Rehearsal asal tetap utuh dan produksi tidak tersentuh.

## Formulir aktif dan kandidat v2

Input anak-ke kini dapat diketik setelah orang tua dipilih. Draf tidak dimasukkan diam-diam ke tabel individuals. Jika backend belum tersedia, simpan dengan perubahan urutan ditolak sebelum profil berubah, dengan pesan jelas dan isian tetap ada. Jika tersedia, satu RPC menyimpan profil dan dua urutan secara atomik dengan expected revision. Rujukan memakai verification_source existing; locator opsional; rujukan kosong diberi label catatan admin belum dirujuk, tidak dibuat halaman fiktif.

Read adapter membaca state, paginasi urutan, lalu mengecek versi lagi. Awalan (+) ditampilkan untuk profil tanpa jalur langsung tercatat; bila pangkal ambigu atau traversal terpotong tidak menyimpulkan (+). Pasangan otomatis hanya dipilih jika tepat satu pasangan aktif ditemukan. Banyak perkawinan tidak mereset nomor anak per orang tua.

52 tes frontend lulus, TypeScript/build lulus; uji PostgreSQL gabungan dan rollback juga lulus lokal. Paket rehearsal v2 menambahkan uji combined save tanpa locator. Produksi belum diperbarui. Kelengkapan daftar, preferensi jalur setara, snapshot sertifikat dan rilis tetap pending.

## Paket produksi disiapkan setelah rehearsal v2

Pengguna melaporkan rehearsal v2 lulus di qom_numbering_d06e3842d359, log numbering-rehearsal-09507c264a4d. Skrip deploy-numbering.py memeriksa schema belum ada, backup baru, restore baru, membandingkan fingerprint columns/constraints/policies/grants/triggers/RLS, rehearsal transaksi penuh dan combined save, lalu transaksi produksi dengan table lock, cek fingerprint di dalam lock, checksum individu sebelum/sesudah, seed root UUID dan validasi akses. Verifikasi pascapenerapan dilakukan dalam transaksi baca-saja. Tidak menyalin foto atau restart aplikasi. Pelaksanaan produksi masih menunggu output pengguna.

Aplikasi membawa numbering_root_id dari state ke mesin jalur, menghapus field virtual itu dari payload profil. 54 tes frontend, TypeScript dan build lulus. SQL verifikasi deployment dan view anon juga lulus pada PGlite. Uji browser/API setelah penerapan tetap diperlukan. Dokumen beasiswa dan kelengkapan anak masih belum tersedia.

## Koreksi pembanding produksi v2

Diagnosis pengguna pada numbering-production-3165beab45ff membuktikan fingerprint produksi tidak berubah. Tiga objek berbeda tampilannya (FK nasab_admins ke auth.users dan dua policy yang memakai auth.uid). Dengan search_path kosong eksplisit seluruh struktur identik. Paket produksi v2 menetapkan search_path kosong dalam transaksi pembacaan fingerprint produksi, restore, serta transaksi migrasi; referensi tabel temporer diberi schema pg_temp. Tidak ada objek, policy, grants atau field yang dikecualikan dari pemeriksaan.

Regresi test-numbering-fingerprint.mjs mereproduksi mismatch search_path, membuktikan normalisasi menghasilkan fingerprint sama, lalu menambahkan kolom nyata dan memastikan fingerprint tetap berbeda. Uji kandidat SQL kembali lulus. Paket belum dijalankan di produksi; menunggu hasil pengguna.
