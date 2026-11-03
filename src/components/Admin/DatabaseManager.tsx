import { useEffect, useRef, useState } from 'react';
import { Download, Upload, X, Loader2 } from 'lucide-react';
import type { Individual, Marriage } from '@/types';
import type { Dataset } from '@/lib/datasets';
import type { ImportData } from '@/lib/dataset-workbook';
import { importDataset, readAdminDatasetRows } from '@/lib/datasets';
import { supabase } from '@/lib/supabase';

interface Props { localMode?: boolean; dataset: Dataset; people: Individual[]; marriages: Marriage[]; available: boolean; onClose: () => void; onImported: (id: number) => Promise<void> }
const button = 'min-h-11 px-4 py-2 rounded-lg border border-border-olive focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-olive disabled:opacity-50 disabled:cursor-not-allowed';

export default function DatabaseManager({ localMode = false, dataset, people, marriages, available, onClose, onImported }: Props) {
  const [parsed, setParsed] = useState<ImportData | null>(null);
  const [name, setName] = useState('');
  const [root, setRoot] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [committed, setCommitted] = useState<number | null>(null);
  const request = useRef(crypto.randomUUID());
  const errorRef = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function download(template: boolean) {
    setBusy(true); setError('');
    try {
      const { createDatasetWorkbook, downloadWorkbook } = await import('@/lib/dataset-workbook');
      const [exportPeople, exportMarriages] = template ? [[], []] : localMode ? [people, marriages] : await Promise.all([
        readAdminDatasetRows<Individual>(supabase, 'individuals', available ? dataset : undefined),
        readAdminDatasetRows<Marriage>(supabase, 'marriages', available ? dataset : undefined),
      ]);
      downloadWorkbook(await createDatasetWorkbook(exportPeople, exportMarriages), template ? 'Format_Unggah_Nasab.xlsx' : `Nasab_Versi_${dataset.id}.xlsx`);
    } catch { setError('Excel belum dapat dibuat. Coba lagi.'); }
    finally { setBusy(false); }
  }
  async function inspect(file?: File) {
    setParsed(null); setRoot(''); setCommitted(null); setError(''); setFileName(file?.name || ''); request.current = crypto.randomUUID();
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name) || file.size > 10 * 1024 * 1024) { setError('Pilih file .xlsx berukuran maksimal 10 MB.'); return; }
    setBusy(true);
    try {
      const { parseDatasetWorkbook } = await import('@/lib/dataset-workbook');
      setParsed(await parseDatasetWorkbook(await file.arrayBuffer()));
      if (!name) setName(file.name.replace(/\.xlsx$/i, '').slice(0, 120));
    } catch (e) { setError(e instanceof Error ? e.message : 'Excel tidak dapat dibaca.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!parsed || !name.trim()) return;
    setBusy(true); setError('');
    try {
      const id = committed ?? (localMode ? await (await import('@/lib/local-datasets')).importLocalDataset(request.current, name, parsed, root || null) : await importDataset(supabase, request.current, name, parsed, root || null));
      setCommitted(id);
      await onImported(id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impor belum berhasil.'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="database-manager-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[min(48rem,calc(100%-2rem))] max-h-[90dvh] overflow-y-auto rounded-2xl bg-surface text-ink p-0 shadow-xl backdrop:bg-black/40">
    <div className="p-5 sm:p-7 space-y-5">
      <div className="flex justify-between items-start gap-4"><div><h2 id="database-manager-title" className="font-serif text-2xl font-bold">Impor & ekspor Excel</h2><p className="mt-1 text-sm text-ink-light">Versi {dataset.id} · {dataset.name}</p></div><button aria-label="Tutup impor Excel" className={button} disabled={busy} onClick={onClose}><X size={20}/></button></div>
      <p>Unduh format, isi individu dan pernikahan, lalu unggah untuk membuat versi database baru. Slug dan UUID dibuat otomatis.</p>
      {localMode && <p role="status" className="rounded-lg bg-bg p-3 text-sm">Mode lokal: versi tersimpan di browser ini dan tetap ada setelah muat ulang. Ekspor Excel untuk menyimpan salinan. Menghapus data browser akan menghapus versi lokal.</p>}
      <div className="flex flex-wrap gap-3"><button className={button + ' flex items-center gap-2'} disabled={busy} onClick={() => download(true)}><Download size={18}/> Unduh format</button><button className={button + ' flex items-center gap-2'} disabled={busy || !people.length} onClick={() => download(false)}><Download size={18}/> Ekspor versi ini</button></div>
      {!available && <p role="status" className="p-3 rounded-lg bg-amber-50 text-amber-900">Penyimpanan versi belum diaktifkan pada server. Format Excel tetap dapat diunduh.</p>}
      <div><label htmlFor="database-name" className="block font-semibold mb-2">Nama database baru</label><input id="database-name" value={name} maxLength={120} disabled={busy || committed !== null} onChange={e => { setName(e.target.value); request.current = crypto.randomUUID(); }} placeholder="Contoh: Seduluran" className="w-full border border-border-olive rounded-lg p-3 bg-white"/></div>
      <div><label htmlFor="database-file" className="block font-semibold mb-2">File Excel individu dan pernikahan</label><input id="database-file" type="file" accept=".xlsx" disabled={busy || committed !== null} onChange={e => void inspect(e.target.files?.[0])} className="block w-full min-h-11 text-sm file:mr-3 file:rounded-lg file:border-0 file:px-4 file:py-3 file:bg-primary-olive file:text-white"/><p className="text-sm text-ink-light mt-2">Maksimal 10 MB. Hubungan keluarga memakai nomor atau ID dari sumber.</p></div>
      {error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg bg-rose-50 text-rose-900 p-4">{error}</div>}
      {parsed && <section className="rounded-xl border border-border-olive p-4 space-y-3" aria-label="Ringkasan impor"><h3 className="font-bold">Siap diperiksa: {fileName}</h3><p>{parsed.people.length.toLocaleString('id-ID')} individu · {parsed.marriages.length.toLocaleString('id-ID')} pernikahan</p><ul className="list-disc pl-5 text-sm space-y-1">{parsed.warnings.map(w => <li key={w}>{w}</li>)}</ul><label htmlFor="database-root" className="block font-semibold">Tokoh pangkal silsilah (opsional)</label><select id="database-root" value={root} disabled={busy || committed !== null} onChange={e => { setRoot(e.target.value); request.current = crypto.randomUUID(); }} className="w-full border border-border-olive rounded-lg p-3 bg-white"><option value="">Tetapkan kemudian</option>{parsed.people.map(p => <option key={p.key} value={p.key}>{p.name || 'Nama belum diketahui'} — {p.key}</option>)}</select><p className="text-sm text-ink-light">Urutan anak tetap dikerjakan oleh verifikator. Versi sebelumnya tetap tersedia.</p></section>}
      {committed && <p role="status">Versi {committed} berhasil disimpan. Memuat daftar database…</p>}
      <button className={button + ' bg-primary-olive text-white w-full flex items-center justify-center gap-2'} disabled={busy || !available || !parsed || !name.trim()} onClick={save}>{busy ? <Loader2 size={18} className="animate-spin"/> : <Upload size={18}/>} {committed ? 'Buka versi yang disimpan' : busy ? 'Memproses…' : 'Simpan sebagai versi baru'}</button>
    </div>
  </dialog>;
}
