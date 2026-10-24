import React, { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase, nasabReadMode } from '@/lib/supabase';
import { NasabReadError, readProfileEvidence, publicSourceUrl } from '@/lib/nasab-contract';

export const ProfileEvidence: React.FC<{ personId: string; marriageIds: string[] }> = ({ personId, marriageIds }) => {
  const [data, setData] = useState<Awaited<ReturnType<typeof readProfileEvidence>> | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const marriageKey = [...marriageIds].sort().join(',');
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    if (!isSupabaseConfigured) { setError('Mode contoh: peristiwa dan bukti server belum dimuat.'); return; }
    readProfileEvidence(supabase, personId, marriageKey ? marriageKey.split(',') : [], controller.signal, nasabReadMode)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof NasabReadError ? reason.message : 'Peristiwa dan bukti belum dapat dibaca.'); });
    return () => controller.abort();
  }, [personId, marriageKey, attempt]);
  return <section className="space-y-4 text-sm" aria-label="Peristiwa dan bukti sumber">
    <h3 className="font-bold">Peristiwa dan bukti sumber</h3>
    {error ? <p role="alert">{error} {isSupabaseConfigured && <button className="underline p-2" onClick={() => setAttempt(n => n + 1)}>Coba lagi</button>}</p> : !data ? <p role="status">Memuat peristiwa dan bukti…</p> : <>
      {data.events.length === 0 && <p>Belum ada peristiwa tambahan yang dipublikasikan.</p>}
      {data.events.map(event => <article key={event.id} className="border rounded-lg p-3"><p className="font-semibold">{event.date || 'Tanggal belum diketahui'} · {event.type}</p><p>{event.description}</p>{event.location && <p>{event.location}</p>}<p className="text-xs text-ink-light break-all">Peristiwa {event.id}</p></article>)}
      <p className="text-xs text-ink-light">Status profil tidak otomatis memverifikasi setiap fakta. Bukti di bawah melekat pada predikat atau relasi yang disebutkan, bukan seluruh biografi.</p>
      {!data.evidence.length && <p>{nasabReadMode === 'legacy' ? 'Pembacaan bukti per fakta belum diaktifkan; menunggu kontrak database baru.' : 'Belum ada bukti per fakta yang dipublikasikan.'}</p>}
      {data.evidence.map(e => {
        const source = data.sources.find(s => s.id === e.source_id);
        const url = publicSourceUrl(source?.url);
        return <article key={e.id} className="border rounded-lg p-3 space-y-2">
          <h4 className="font-semibold">{e.predicate} · {({ draft: 'Tercatat, belum ditinjau', reviewed: 'Ditinjau', disputed: 'Diperdebatkan' })[e.review_status]}</h4>
          {e.asserted_value && <p>{e.asserted_value}</p>}
          <p>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline">{source?.title}</a> : source?.title || 'Sumber belum tersedia'}</p>
          <p>Lokasi rujukan: {e.locator || 'Belum dicatat'}</p>
          {e.quotation && <blockquote className="border-l-2 pl-3 whitespace-pre-wrap">{e.quotation}</blockquote>}
          <p className="text-xs text-ink-light break-all">Bukti {e.id}{e.marriage_id ? ` · Perkawinan ${e.marriage_id}` : ''}</p>
        </article>;
      })}
      {data.sources.filter(s => !data.evidence.some(e => e.source_id === s.id)).map(s => <p key={s.id}>Sumber profil: {s.title} <span className="text-ink-light">(belum ditautkan pada fakta tertentu)</span></p>)}
    </>}
  </section>;
}
