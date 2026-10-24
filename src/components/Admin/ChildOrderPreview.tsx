import React, { useState } from 'react';
import type { Individual } from '@/types';
import { lineagePaths, previewChildInsertion } from '@/lib/lineage-numbering';

export function ChildOrderPreview({ childId, people }: { key?: string; childId: string; people: Individual[] }) {
  const child = people.find(p => p.id === childId);
  const [parent, setParent] = useState(''), [position, setPosition] = useState('');
  const [source, setSource] = useState(''), [locator, setLocator] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof previewChildInsertion> | null>(null);
  const [error, setError] = useState('');
  if (!child) return null;
  const reset = () => { setPreview(null); setError(''); };
  return <fieldset className="p-4 border rounded-xl space-y-3">
    <legend className="font-semibold">Urutan anak menurut kitab — pratinjau</legend>
    <p className="text-sm">Pilih orang tua yang menjadi acuan. Penyisipan menggeser urutan berikutnya dan memengaruhi kode keturunannya. Tanggal lahir tidak digunakan.</p>
    <label className="block">Orang tua acuan<select className="block border p-2 w-full" value={parent} onChange={e => { setParent(e.target.value); reset(); }}><option value="">Pilih orang tua</option>{[child.father_id, child.mother_id].filter(Boolean).map(id => <option key={id} value={id}>{people.find(p => p.id === id)?.name}</option>)}</select></label>
    <label className="block">Urutan anak<input className="block border p-2" type="number" min="1" step="1" value={position} onChange={e => { setPosition(e.target.value); reset(); }} /></label>
    <label className="block">Kitab / sumber<input className="block border p-2 w-full" value={source} onChange={e => { setSource(e.target.value); reset(); }} /></label>
    <label className="block">Halaman / lembar / lokasi<input className="block border p-2 w-full" value={locator} onChange={e => { setLocator(e.target.value); reset(); }} /></label>
    <button type="button" className="border rounded p-2" onClick={() => { try { setPreview(previewChildInsertion(people, childId, parent, Number(position), source, locator)); setError(''); } catch (e) { setError((e as Error).message); } }}>Lihat dampak penyisipan</button>
    {error && <p role="alert">{error}</p>}
    {preview && <div><p>{preview.affectedIds.length} individu berpotensi terdampak, termasuk keturunan.</p><ul>{preview.affectedIds.slice(0, 25).map(id => <li key={id}>{people.find(p => p.id === id)?.name}: {lineagePaths(id, people).paths[0]?.code || 'Belum bernomor'} → {lineagePaths(id, preview.people).paths[0]?.code || 'Belum bernomor'}</li>)}</ul>{preview.affectedIds.length > 25 && <p>Ditampilkan 25 individu pertama.</p>}</div>}
    <p className="text-sm text-amber-800">Pratinjau belum disimpan. Penyimpanan urutan akan diaktifkan setelah migrasi database dan uji penyisipan atomik lulus. Tombol simpan profil tidak menyimpan pratinjau ini.</p>
  </fieldset>;
}
