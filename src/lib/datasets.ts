import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImportData } from './dataset-workbook';
export interface Dataset { id: number; name: string; root_id: string | null; created_at?: string }
export const INITIAL_DATASET: Dataset = { id: 1, name: 'Data awal', root_id: null };

export async function readAdminDatasetRows<T extends { id: string }>(client: SupabaseClient, table: 'individuals' | 'marriages', dataset?: Dataset): Promise<T[]> {
  const rows: T[] = [];
  let cursor = '';
  for (;;) {
    let query = client.from(table).select('*').order('id').limit(500);
    if (dataset) query = query.eq('dataset_id', dataset.id);
    if (cursor) query = query.gt('id', cursor);
    const result = await query;
    if (result.error || !Array.isArray(result.data)) throw new Error('Data admin gagal dimuat.');
    if (!result.data.length) return rows;
    for (const row of result.data) { if (typeof row.id !== 'string' || row.id <= cursor) throw new Error('Urutan data admin tidak valid.'); cursor = row.id; rows.push(row as T); }
  }
}

export async function listDatasets(client: SupabaseClient) {
  const result = await client.from('nasab_datasets').select('id,name,root_id,created_at').order('id');
  if (result.error) {
    if (['42P01', 'PGRST205'].includes(result.error.code)) return { available: false, datasets: [INITIAL_DATASET] };
    throw new Error('Daftar database belum dapat dimuat. Coba lagi.');
  }
  if (!Array.isArray(result.data) || !result.data.length) throw new Error('Daftar database kosong.');
  return { available: true, datasets: result.data as Dataset[] };
}

export async function importDataset(client: SupabaseClient, request: string, name: string, data: ImportData, root: string | null) {
  const result = await client.rpc('qom_nasab_import_dataset', { p_request_id: request, p_name: name.trim(), p_people: data.people, p_marriages: data.marriages, p_root_key: root });
  if (result.error) {
    const code = result.error.code;
    if (code === '42501') throw new Error('Hanya Admin Nasab yang dapat mengimpor database.');
    if (code === 'PGRST202') throw new Error('Layanan impor belum terpasang pada server.');
    if (['22023', '23503', '23505', '23514', '22007', '22008', '22P02'].includes(code)) throw new Error('Server menolak data yang tidak valid. Periksa ID, relasi, tanggal, dan pilihan metadata. Tidak ada versi baru yang disimpan.');
    throw new Error('Hasil impor belum dapat dipastikan. Coba Simpan lagi tanpa mengganti file untuk melanjutkan permintaan yang sama.');
  }
  if (!Number.isSafeInteger(result.data) || result.data < 2) throw new Error('Nomor versi dari server tidak valid.');
  return result.data as number;
}
