// Project vocabulary supplied by the curator, 23 October 2026.
export const KINSHIP_VOCABULARY_VERSION = 'qomaruddin-2026-10-23';
export const descendantTerms = ['Anak', 'Putu', 'Buyut', 'Canggah', 'Wareng', 'Udheg-udheg',
  'Gantung Siwur', 'Gropak Senthe', 'Debog Bosok', 'Galih Asem', 'Gropak Waton', 'Cendheng',
  'Giyeng', 'Cumpleng', 'Ampleng', 'Menyaman', 'Menya-menya', 'Trah Tumerah'] as const;
export const ancestorTerms = ['Orang tua', 'Simbah / Mbah / Eyang', ...descendantTerms.slice(2).map(t => `Eyang ${t}`), 'Eyang Warih Galih'];
ancestorTerms[16] = 'Eyang Menyo-menyo (Menya-menya)';
export function generationTerm(direction: 'ancestors' | 'descendants', depth: number, gender?: string | null) {
  if (depth === 0) return 'Diri sendiri';
  if (direction === 'ancestors' && depth === 1) return gender === 'M' ? 'Bapak / Bapa / Rama' : gender === 'F' ? 'Ibu / Emak / Simbok / Biyung / Sibu' : 'Orang tua';
  if (direction === 'ancestors' && depth === 2) return gender === 'M' ? 'Eyang Kakung' : gender === 'F' ? 'Eyang Putri' : ancestorTerms[1];
  if (direction === 'descendants' && depth === 1) return gender === 'M' ? 'Anak Putra / Jaler' : gender === 'F' ? 'Anak Putri / Estri' : 'Anak';
  if (direction === 'descendants' && depth === 2) return 'Putu / Cucu';
  if (direction === 'descendants' && depth === 3) return 'Buyut / Cicit';
  return (direction === 'ancestors' ? ancestorTerms : descendantTerms)[depth - 1]
    || `${direction === 'ancestors' ? 'Leluhur' : 'Keturunan'} tingkat ${depth}`;
}
export const kinshipGlossary = [
  ['Sedulur / Sadulur', 'Saudara kandung; kedua orang tua sama dan diketahui.'],
  ['Kakang / Mas / Kangmas / Raka', 'Kakak laki-laki; urutan usia harus diketahui.'],
  ['Mbak / Mbakyu', 'Kakak perempuan.'], ['Adhi / Dhik / Dimas / Rayi', 'Adik laki-laki; Adhi/Dhik dapat digunakan umum.'],
  ['Adik / Diajeng / Jeng', 'Adik perempuan.'], ['Anak Pembarep / Mbarep', 'Anak pertama dalam daftar anak yang tercatat, bila urutannya diketahui.'],
  ['Anak Penengah / Tengah', 'Anak di antara sulung dan bungsu.'], ['Anak Wuragil / Ragil', 'Anak terakhir dalam daftar anak yang tercatat.'],
  ['Ponakan / Keponakan', 'Anak saudara.'], ['Pakdhe / Bapak Gedhe / Uwa / Pak Puh', 'Kakak laki-laki orang tua.'],
  ['Budhe / Ibu Gedhe / Uwa / Bu Puh', 'Kakak perempuan orang tua.'], ['Paklik / Bapak Cilik / Om', 'Adik laki-laki orang tua.'],
  ['Bulik / Ibu Cilik / Tante', 'Adik perempuan orang tua.'], ['Misanan', 'Sepupu pertama; leluhur bersama kakek/nenek.'],
  ['Mas / Mbak Misan; Adik Misan', 'Cabang kakak atau adik orang tua; bukan perbandingan umur kedua sepupu.'],
  ['Mindhoan', 'Sepupu kedua; leluhur bersama buyut.'], ['Mas / Mbak Mindhoan; Adik Mindhoan', 'Cabang kakak atau adik kakek/nenek.'],
  ['Mingempat', 'Dalam kamus proyek ini: keduanya memiliki jalur generasi ke-4 dari leluhur acuan. Semua leluhur acuan pada tingkat ini ditampilkan dalam satu kelompok.'],
  ['Minglimo', 'Dalam kamus proyek ini: keduanya keturunan generasi ke-5 dari leluhur acuan yang disebutkan.'],
  ['Selisih generasi lintas cabang', 'Sebutan pernah: selisih 1 Ponakan, 2 Putu, 3 Buyut, 4 Canggah, dan seterusnya. Ini sebutan melalui cabang leluhur, bukan keturunan langsung.'],
  ['Mingnem', 'Dalam kamus proyek ini: keduanya keturunan generasi ke-6 dari leluhur acuan yang disebutkan. Leluhur acuan dihitung sebagai tingkat 0.'],
  ['Bojo / Garwa', 'Pasangan perkawinan yang tercatat.'], ['Maratuwa / Morotuwo', 'Orang tua pasangan.'],
  ['Mantu / Anak Mantu', 'Pasangan anak.'], ['Putu Mantu', 'Pasangan cucu.'], ['Ipe', 'Saudara pasangan atau pasangan saudara; jalur ditampilkan.'],
  ['Pripean', 'Pasangan dari saudara pasangan.'], ['Besan', 'Orang tua dari pasangan anak.'],
  ['Bapak Kuwalon / Ibu Kuwalon', 'Pasangan orang tua, dengan orang tua kandung yang berbeda dan diketahui.'],
  ['Anak Kuwalon', 'Anak pasangan, dengan orang tua kandung yang berbeda dan diketahui.'],
  ['Sedulur / Sadulur Kuwalon', 'Seayah beda ibu atau seibu beda ayah; bukan otomatis saudara tanpa hubungan darah.'],
  ['Anak Pupon', 'Anak angkat; membutuhkan relasi adopsi eksplisit, bukan tebakan dari perkawinan.'],
  ['Varian ejaan', 'Udheg-udheg / Udhek-udhek; Menya-menya / Menyo-menyo; Trah Tumerah / Tumerah.'],
] as const;
