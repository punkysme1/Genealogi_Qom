import type { Individual, Marriage } from '../types';
import type { Dataset } from './datasets';
import type { ImportData } from './dataset-workbook';
interface LocalDataset extends Dataset { people: Individual[]; marriages: Marriage[]; request?: string }
const STORE = 'datasets';
async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('qomaruddin-nasab-local-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Penyimpanan lokal tidak tersedia pada browser ini.'));
  });
}
async function all(): Promise<LocalDataset[]> {
  const db = await open();
  try { return await new Promise((resolve, reject) => { const r = db.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  finally { db.close(); }
}
export async function ensureLocalSeed() {
  if ((await all()).length) return;
  const response = await fetch('/__nasab-local/seed');
  if (!response.ok) throw new Error('Backup awal lokal belum tersedia. Jalankan npm run setup:local terlebih dahulu.');
  const seed = await response.json();
  if (!Array.isArray(seed.individuals) || !Array.isArray(seed.marriages)) throw new Error('Backup awal lokal tidak valid.');
  const people: Individual[] = seed.individuals.map((p: Individual) => ({ ...p, dataset_id: 1, is_alive: p.is_alive == null ? null : Boolean(p.is_alive), is_verified: Boolean(p.is_verified) }));
  const marriages: Marriage[] = seed.marriages.map((m: Marriage) => ({ ...m, dataset_id: 1, is_active: m.is_active == null ? null : Boolean(m.is_active) }));
  const db = await open();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE), check = store.get(1);
    check.onsuccess = () => { if (!check.result) store.add({ id: 1, name: 'Data awal', root_id: '5245e51b-d139-4d34-9117-7c58948ec6df', people, marriages }); };
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(new Error('Backup awal belum dapat disimpan di browser.'));
  }); } finally { db.close(); }
}
export async function listLocalDatasets(): Promise<Dataset[]> {
  await ensureLocalSeed();
  return (await all()).map(({ people, marriages, request, ...d }) => d).sort((a, b) => a.id - b.id);
}
export async function readLocalDataset(id: number) {
  const dataset = (await all()).find(d => d.id === id);
  if (!dataset) throw new Error('Versi database lokal tidak ditemukan.');
  return { people: dataset.people.map(p => ({ ...p, numbering_root_id: dataset.root_id })), marriages: dataset.marriages, adoptions: [] };
}
export async function importLocalDataset(request: string, name: string, data: ImportData, root: string | null): Promise<number> {
  const { validateDataset } = await import('./dataset-workbook');
  validateDataset(data);
  if (!name.trim() || name.trim().length > 120 || (root && !data.people.some(p => p.key === root))) throw new Error('Nama database atau tokoh pangkal tidak valid.');
  const keys = new Map(data.people.map(p => [p.key, crypto.randomUUID()]));
  const now = new Date().toISOString();
  const people = data.people.map(({ key, father, mother, ...p }) => ({ ...p, id: keys.get(key)!, name: p.name || `Nama belum diketahui [${key}]`, father_id: father ? keys.get(father) : null, mother_id: mother ? keys.get(mother) : null, slug: keys.get(key), is_verified: false, created_at: now, updated_at: now }));
  const marriages = data.marriages.map(m => ({ id: crypto.randomUUID(), husband_id: keys.get(m.husband)!, wife_id: keys.get(m.wife)!, marriage_date: m.marriage_date, is_active: m.is_active, created_at: now }));
  const db = await open();
  try { return await new Promise<number>((resolve, reject) => {
    let version = 0;
    const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE), r = store.getAll();
    r.onsuccess = () => {
      const existing = r.result as LocalDataset[];
      const prior = existing.find(d => d.request === request);
      if (prior) { version = prior.id; return; }
      version = Math.max(0, ...existing.map(d => d.id)) + 1;
      store.add({ id: version, name: name.trim(), root_id: root ? keys.get(root) : null, request, created_at: now, people: people.map(p => ({ ...p, dataset_id: version })), marriages: marriages.map(m => ({ ...m, dataset_id: version })) });
    };
    tx.oncomplete = () => resolve(version);
    tx.onabort = () => reject(new Error('Database lokal belum tersimpan. Periksa ruang penyimpanan browser.'));
  }); } finally { db.close(); }
}
