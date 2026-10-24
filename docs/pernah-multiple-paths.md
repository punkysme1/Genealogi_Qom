# Pernah: beberapa hubungan untuk satu pasangan tokoh

23 Oktober 2026 — penyempurnaan berdasarkan contoh kurator. Implementasi lokal, belum rilis Cloudflare. Tidak mengubah catatan historis, identity registry, atau struktur database.

## Perilaku tampilan

Pilihan tokoh pertama dan kedua menghasilkan kelompok sebutan. Semua Mingempat digabung dalam satu kartu dengan daftar leluhur; demikian juga Minglimo dan sebutan segenerasi lainnya. Membuka kelompok menampilkan pilihan leluhur, lalu jalur masing-masing. UUID leluhur, kedalaman dan bukti langkah tidak digabung meskipun namanya sama. Hubungan langsung/perkawinan mempertahankan penjelasan dua arah. UUID dan field disimpan di rincian sumber, bukan isi utama.

Contoh kurator: Ponakan melalui Lilik Mughiroh dan Durratun Nasihah; Minglimo dari KH. Abu Ishaq Madyani; Mingnem dari KH. Harun. Model tidak menghentikan pencarian ketika hubungan pertama ditemukan. Hubungan melalui perkawinan tetap diperiksa meskipun sudah ada leluhur bersama.

Untuk contoh Ponakan, narasi mengalir dari keponakan: anak dari ibu → ibu adalah kakak/adik dari saudara → saudara adalah pasangan paman/bibi. Hubungan saudara dapat diringkas untuk keterbacaan, tetapi kedua langkah melalui orang tua bersama tetap tersedia pada catatan sumber. Kata anak digunakan secara netral, tanpa menebak bin/binti.

## Definisi dan batas

- Mingempat, Minglimo dan Mingnem mengikuti definisi proyek yang diberikan kurator: jarak empat/lima/enam langkah parent dari kedua tokoh ke leluhur acuan. Leluhur = 0, anak = 1. Ini bukan penerapan rumus derajat sepupu Barat.
- Kedua tokoh harus benar-benar mempunyai jalur ke UUID leluhur yang sama. Kesamaan tingkat generasi global atau nama leluhur tidak cukup.
- Semua leluhur bersama yang ditemukan dapat menjadi acuan, termasuk leluhur di atas leluhur bersama yang lebih dekat. Kedua jalur disimpan terpisah; tidak dibentuk lintasan palsu yang mengulangi node.
- Misanan/Mindhoan membutuhkan dua cabang berbeda di bawah leluhur bersama, sehingga saudara kandung tidak berubah menjadi Misanan hanya karena kakeknya sama.
- Dua jalur ke leluhur bersama dengan panjang berbeda tidak menghasilkan sebutan Anak/Cucu/Cicit. Jalur itu tetap tersedia dalam bagian tertutup “Jalur leluhur alternatif”, dengan jumlah langkah masing-masing. Aturan ini menggantikan label selisih generasi sebelumnya yang keliru. Sebutan keturunan hanya diberikan bila jalur parent benar-benar menghubungkan kedua tokoh secara langsung. Identitas dan generasi biologis pasangan tidak disatukan untuk mengatasi perbedaan jalur.
- Paklik/Bulik melalui pasangan ditentukan dari usia saudara orang tua terhadap orang tua, bukan usia pasangannya. Bila tanggal lahir belum cukup, gunakan Paman/Bibi dan catatan keterbatasan.
- Perkawinan hanya digunakan bila is_active=true. Perkawinan nonaktif memerlukan kontrak waktu/riwayat tersendiri; tidak otomatis dianggap aktif.
- Batas leluhur 19 tingkat, jalur afinitas empat langkah, maksimal 5.000 pasangan jalur/kunjungan, dan 20 jalur per kartu tetap diberi tanda bila terpotong. UI menampilkan 25 kelompok per halaman, serta jalur alternatif bertahap per 25 acuan.
- Fungsi calculateRelationship lama dipertahankan untuk kompatibilitas satu hasil; UI Pernah memakai calculatePernah yang mengembalikan banyak kartu.

## Bukti pengujian

tests/pernah.test.ts mencakup: tiga sebutan bersamaan; membalik pilihan tokoh; usia saudara tidak diketahui; perkawinan nonaktif; tanpa leluhur bersama; kedalaman berbeda; saudara tidak dianggap sepupu; siklus; narasi anak netral. Fixture memakai nama contoh tetapi seluruh UUID/topologi/tanggal dibuat untuk tes. Hasil bukan konfirmasi riwayat keluarga produksi.

Pengujian data aktual Gus Oni–Ahmad Maghfur tetap dilakukan pada aplikasi yang membaca server. Jika salah satu kartu belum muncul, periksa hubungan parent, perkawinan aktif, tanggal atau jalur leluhur; jangan menambahkan hubungan hanya untuk membuat hasil cocok dengan contoh.

Regresi keluarga antarcabang: fixture sintetis Umamah–Mahfudz menghasilkan jalur 4–4, 6–6, 4–6 dan 6–4 ke leluhur yang sama. Yang sama panjang tetap menjadi acuan kelompok; yang berbeda panjang hanya menjadi rincian penelusuran. Kedua tokoh tidak menjadi cucu satu sama lain. Tes tambahan membuktikan kelompok Mingempat/Minglimo tetap menyimpan semua UUID dan jalurnya, termasuk nama leluhur yang sama. Produksi tidak diubah.

## Aturan ringkasan terbaru (menggantikan aturan selisih sebelumnya)

Sesuai koreksi kurator: selisih cabang 1 = Ponakan, 2 = Putu, 3 = Buyut, 4 = Canggah, dan seterusnya mengikuti kamus keturunan. Deskripsi selalu menyebut cabang dan membedakannya dari keturunan langsung.

Ringkasan hanya mempertahankan jalur yang belum bertemu pada tokoh atau pasangan leluhur tercatat yang lebih dekat. Jalur yang sekadar memperpanjang pertemuan tersebut tetap disimpan sebagai detail lanjutan. Pemeriksaan dilakukan per pasangan jalur, bukan menghapus semua leluhur lebih jauh secara global. Dengan demikian cabang independen tetap dapat menghasilkan Mingempat, Buyut, atau Ponakan. Perkawinan historis yang tercatat juga menjadi penanda pertemuan pasangan leluhur untuk penyaringan ini; tidak dipakai untuk menyatakan pasangan masih aktif.

Jumlah hubungan aktual tidak dipatok menjadi empat: mengikuti data dan jalur yang tersedia. Tidak ada perubahan database.

Penyederhanaan ringkasan terbaru: dari semua kartu segenerasi yang masih tersedia setelah penyaringan jalur, tampilkan hanya tingkat terdekat. Jika tingkat terdekat 6 (Mingnem), tingkat 7–10 dipindahkan ke detail meskipun berasal dari akar berbeda. Semua leluhur pada tingkat terdekat tetap digabung. Ponakan/Putu/Buyut dan hubungan langsung/perkawinan tidak terkena filter ini. Ini kebijakan tampilan, bukan penghapusan atau pernyataan bahwa semua jalurnya identik. Jika tingkat terdekat 7, tingkat 7 tetap tampil. Dua tes regresi tambahan; total 42 tes lokal lulus, TypeScript dan build lulus.
