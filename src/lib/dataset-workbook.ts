import ExcelJS from 'exceljs';
import type { Individual, Marriage } from '../types';

// Public workbook vocabulary follows the profile form; technical identifiers stay on the server.
export const PERSON_COLUMNS = ['ID Individu', 'Nama Lengkap', 'Nama Lain', 'Jenis Kelamin', 'ID Ayah', 'ID Ibu', 'Tanggal Lahir', 'Tanggal Wafat', 'Status Hidup', 'Tempat Lahir', 'Tempat Wafat', 'Domisili', 'Pendidikan', 'Pekerjaan', 'Biografi', 'Status Ekonomi', 'URL Foto'] as const;
export const MARRIAGE_COLUMNS = ['ID Pernikahan', 'ID Suami', 'ID Istri', 'Tanggal Nikah', 'Status Pernikahan'] as const;
export type ImportPerson = { key: string; name: string; aliases: string[]; gender: 'M' | 'F' | null; father: string | null; mother: string | null; birth_date: string | null; death_date: string | null; is_alive: boolean | null; birth_place: string | null; death_place: string | null; current_location: string | null; education: string | null; occupation: string | null; bio: string | null; economic_status: string | null; profile_photo_url: string | null };
export type ImportMarriage = { key: string; husband: string; wife: string; marriage_date: string | null; is_active: boolean | null };
export interface ImportData { people: ImportPerson[]; marriages: ImportMarriage[]; warnings: string[] }
const MAX_ROWS = 20000;

function text(value: ExcelJS.CellValue, where: string): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  throw new Error(`${where}: gunakan nilai biasa, bukan rumus, tautan Excel, atau objek.`);
}
function iso(value: string, where: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
    throw new Error(`${where}: tanggal harus yyyy-mm-dd atau tanggal Excel yang valid.`);
  return value;
}
function choice<T>(value: string, values: Record<string, T>, where: string): T {
  if (!(value in values)) throw new Error(`${where}: nilai “${value}” tidak dikenal.`);
  return values[value];
}
function rows(wb: ExcelJS.Workbook, name: string, columns: readonly string[]) {
  const sheet = wb.getWorksheet(name);
  if (!sheet) throw new Error(`Sheet ${name} tidak ditemukan. Gunakan format yang diunduh dari Nasab.`);
  if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > columns.length) throw new Error(`${name}: maksimal ${MAX_ROWS} baris; jangan tambahkan kolom di luar format.`);
  columns.forEach((c, i) => { if (sheet.getCell(1, i + 1).text !== c) throw new Error(`${name}: kolom ${i + 1} harus “${c}”.`); });
  const result: { values: string[]; row: number }[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const values = columns.map((c, i) => text(row.getCell(i + 1).value, `${name} baris ${n}, ${c}`));
    if (values.some(Boolean)) result.push({ values, row: n });
  });
  return result;
}

export async function parseDatasetWorkbook(buffer: ArrayBuffer): Promise<ImportData> {
  if (buffer.byteLength > 10 * 1024 * 1024) throw new Error('Ukuran Excel maksimal 10 MB.');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer, { ignoreNodes: ['dataValidations', 'conditionalFormatting', 'drawing', 'extLst'] });
  const people = rows(wb, 'Individu', PERSON_COLUMNS).map(({ values: v, row }): ImportPerson => {
    const at = (c: number) => `Individu baris ${row}, ${PERSON_COLUMNS[c]}`;
    if (!v[0]) throw new Error(`${at(0)} wajib diisi (nomor biasa atau ID sumber).`);
    if (v.some(x => x.length > 10000) || v[0].length > 100) throw new Error(`Individu baris ${row}: isi terlalu panjang.`);
    const aliases = v[2].split(';').map(x => x.trim()).filter(Boolean);
    if (aliases.length > 20 || aliases.some(x => x.length > 120) || aliases.join(';').length > 2000) throw new Error(`${at(2)}: maksimal 20 nama, masing-masing 120 karakter.`);
    return { key: v[0], name: v[1], aliases, gender: choice(v[3], { '': null, 'Tidak diketahui': null, 'Laki-laki': 'M', 'Perempuan': 'F' }, at(3)), father: v[4] || null, mother: v[5] || null,
      birth_date: iso(v[6], at(6)), death_date: iso(v[7], at(7)), is_alive: choice(v[8], { '': null, 'Tidak diketahui': null, Hidup: true, Wafat: false }, at(8)),
      birth_place: v[9] || null, death_place: v[10] || null, current_location: v[11] || null, education: v[12] || null, occupation: v[13] || null, bio: v[14] || null,
      economic_status: choice(v[15], { '': null, Kaya: 'Kaya', Menengah: 'Menengah', Miskin: 'Miskin' }, at(15)), profile_photo_url: v[16] || null };
  });
  const marriages = rows(wb, 'Pernikahan', MARRIAGE_COLUMNS).map(({ values: v, row }): ImportMarriage => ({ key: v[0], husband: v[1], wife: v[2], marriage_date: iso(v[3], `Pernikahan baris ${row}`), is_active: choice(v[4], { '': null, 'Tidak diketahui': null, Aktif: true, 'Tidak aktif': false }, `Pernikahan baris ${row}, status`) }));
  return validateDataset({ people, marriages, warnings: [] });
}

export function validateDataset(data: ImportData): ImportData {
  if (!data.people.length || data.people.length > MAX_ROWS || data.marriages.length > MAX_ROWS) throw new Error('Isi minimal satu individu; maksimal 20.000 individu/pernikahan.');
  const map = new Map<string, ImportPerson>();
  for (const p of data.people) {
    if (!p.key || map.has(p.key)) throw new Error(`ID individu kosong atau berulang: ${p.key}.`);
    map.set(p.key, p);
    if (p.death_date && p.birth_date && p.death_date < p.birth_date) throw new Error(`Individu ${p.key}: tanggal wafat mendahului lahir.`);
    if (p.death_date && p.is_alive === true) throw new Error(`Individu ${p.key}: status hidup bertentangan dengan tanggal wafat.`);
    if (p.profile_photo_url && !/^https:\/\//i.test(p.profile_photo_url)) throw new Error(`Individu ${p.key}: URL foto harus HTTPS.`);
  }
  for (const p of data.people) {
    for (const [key, gender, label] of [[p.father, 'F', 'ayah'], [p.mother, 'M', 'ibu']] as const) {
      if (key && (!map.has(key) || key === p.key)) throw new Error(`Individu ${p.key}: ID ${label} ${key} tidak valid.`);
      if (key && map.get(key)?.gender === gender) throw new Error(`Individu ${p.key}: jenis kelamin ${label} bertentangan.`);
    }
    if (p.father && p.father === p.mother) throw new Error(`Individu ${p.key}: ayah dan ibu tidak boleh sama.`);
  }
  // Iterative topological traversal also handles long chains without overflowing the call stack.
  const remaining = new Map(data.people.map(p => [p.key, Number(!!p.father) + Number(!!p.mother)]));
  const children = new Map<string, string[]>();
  for (const p of data.people) for (const parent of [p.father, p.mother]) if (parent) children.set(parent, [...(children.get(parent) || []), p.key]);
  const ready = data.people.filter(p => remaining.get(p.key) === 0).map(p => p.key);
  for (let i = 0; i < ready.length; i++) for (const child of children.get(ready[i]) || []) { const n = remaining.get(child)! - 1; remaining.set(child, n); if (n === 0) ready.push(child); }
  if (ready.length !== data.people.length) throw new Error('Hubungan orang tua membentuk siklus. Periksa kembali ID ayah dan ibu.');
  const ids = new Set<string>(), pairs = new Set<string>();
  for (const m of data.marriages) {
    if (!m.key || m.key.length > 100 || ids.has(m.key)) throw new Error(`ID pernikahan kosong atau berulang: ${m.key}.`);
    ids.add(m.key);
    if (!map.has(m.husband) || !map.has(m.wife) || m.husband === m.wife) throw new Error(`Pernikahan ${m.key}: ID pasangan tidak valid.`);
    if (map.get(m.husband)?.gender === 'F' || map.get(m.wife)?.gender === 'M') throw new Error(`Pernikahan ${m.key}: jenis kelamin pasangan bertentangan.`);
    const pair = JSON.stringify([m.husband, m.wife]);
    if (pairs.has(pair)) throw new Error(`Pernikahan ${m.key}: pasangan yang sama tercatat lebih dari sekali.`);
    pairs.add(pair);
  }
  const warnings: string[] = [];
  const unnamed = data.people.filter(p => !p.name).length;
  if (unnamed) warnings.push(`${unnamed} individu tanpa nama akan ditampilkan sebagai “Nama belum diketahui [ID]”.`);
  const unknown = data.people.filter(p => p.is_alive === null).length;
  if (unknown) warnings.push(`${unknown} individu memiliki status hidup belum diketahui.`);
  warnings.push('Semua individu pada versi baru belum terverifikasi. Urutan anak tidak diimpor.');
  return { ...data, warnings };
}

export async function createDatasetWorkbook(people: Individual[] = [], marriages: Marriage[] = []) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nasab Qomaruddin';
  const keys = new Map(people.map((p, i) => [p.id, String(i + 1)]));
  const date = (v?: string) => v ? new Date(`${v}T00:00:00Z`) : null;
  const pRows = people.map(p => [keys.get(p.id), p.name, (p.aliases || []).join('; '), p.gender === 'M' ? 'Laki-laki' : p.gender === 'F' ? 'Perempuan' : 'Tidak diketahui', keys.get(p.father_id || '') || '', keys.get(p.mother_id || '') || '', date(p.birth_date), date(p.death_date), p.is_alive === true ? 'Hidup' : p.is_alive === false ? 'Wafat' : 'Tidak diketahui', p.birth_place, p.death_place, p.current_location, p.education, p.occupation, p.bio, p.economic_status, p.profile_photo_url]);
  const mRows = marriages.map((m, i) => [String(i + 1), keys.get(m.husband_id), keys.get(m.wife_id), date(m.marriage_date), m.is_active === true ? 'Aktif' : m.is_active === false ? 'Tidak aktif' : 'Tidak diketahui']);
  if (marriages.some(m => !keys.has(m.husband_id) || !keys.has(m.wife_id))) throw new Error('Data pasangan belum lengkap. Muat ulang sebelum ekspor.');
  for (const [name, headers, records, widths] of [['Individu', PERSON_COLUMNS, pRows, [18, 32, 32, 22, 16, 16, 19, 19, 22, 25, 25, 25, 25, 25, 50, 20, 45]], ['Pernikahan', MARRIAGE_COLUMNS, mRows, [20, 18, 18, 20, 24]]] as const) {
    const sheet = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
    sheet.columns = headers.map((header, i) => ({ header, width: widths[i] }));
    records.forEach(row => sheet.addRow(row));
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, records.length + 1), column: headers.length } };
    sheet.getRow(1).height = 30;
    sheet.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF344536' } }; });
    sheet.eachRow((row, n) => { if (n > 1) { row.height = 23; row.eachCell(c => { c.font = { name: 'Arial', size: 11 }; if (c.value instanceof Date) c.numFmt = 'yyyy-mm-dd'; }); } });
  }
  const guide = wb.addWorksheet('Panduan');
  guide.columns = [{ width: 28 }, { width: 105 }];
  [ ['Format Nasab', 'Individu dan pernikahan — versi format 1'], ['ID biasa', 'Gunakan nomor 1, 2, 3 atau ID dari sumber. Tidak perlu slug atau UUID. ID wajib unik dalam sheet.'], ['Hubungan keluarga', 'ID Ayah, ID Ibu, ID Suami dan ID Istri mengacu ke ID Individu. Nama saja tidak cukup karena bisa sama.'], ['Nama belum diketahui', 'Nama boleh kosong jika identitas belum diketahui. Aplikasi memberi penanda dengan ID sumber.'], ['Tanggal', 'Tanggal Excel atau teks yyyy-mm-dd. Kosong berarti belum diketahui, bukan 1 Januari.'], ['Nama lain', 'Pisahkan dengan titik koma (;). Maksimal 20 nama.'], ['Pilihan jenis kelamin', 'Laki-laki / Perempuan / Tidak diketahui'], ['Pilihan status hidup', 'Hidup / Wafat / Tidak diketahui'], ['Pilihan status pernikahan', 'Aktif / Tidak aktif / Tidak diketahui. Tidak aktif tidak selalu berarti cerai.'], ['Pilihan status ekonomi', 'Kaya / Menengah / Miskin atau kosong.'], ['Versi baru', 'Setiap unggah yang disimpan membuat database versi baru. Versi yang ada tidak ditimpa.'], ['Verifikasi', 'Unggah hanya profil dan pernikahan. Urutan anak serta verifikasi dikerjakan di aplikasi.'], ['Ruang lingkup ekspor', 'Metadata profil dan pernikahan. Bukti, peristiwa, urutan anak dan status verifikasi bukan isi format ini.'], ['Pengisian', 'Jangan ubah header. Gunakan nilai biasa, bukan rumus. Maksimal 20.000 baris per sheet dan 10 MB.'] ].forEach(row => { const r = guide.addRow(row); r.height = 34; r.alignment = { wrapText: true, vertical: 'middle' }; });
  guide.getRow(1).font = { bold: true, size: 14 };
  return wb.xlsx.writeBuffer();
}

export function downloadWorkbook(buffer: ExcelJS.Buffer, filename: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
