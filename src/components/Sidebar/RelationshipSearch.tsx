import { calculateGenerations } from '@/lib/genealogy';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Individual, Marriage, KinshipPath, Adoption } from '@/types';
import { traceLineage, childPosition } from '@/lib/relationships';
import { calculatePernah, describeKinshipPath, groupPernahCards, PernahCard } from '@/lib/pernah';
import { kinshipGlossary } from '@/lib/kinship-terms';
import { X } from 'lucide-react';

interface Props { individuals: Individual[]; marriages: Marriage[]; adoptions: Adoption[]; onClose: () => void; onSelectIndividual: (id: string) => void }
export function RelationshipSearch({ individuals, marriages, adoptions, onClose, onSelectIndividual }: Props) {
  const [mode, setMode] = useState<'relationship' | 'ancestors' | 'descendants'>('relationship');
  const [a, setA] = useState(''), [b, setB] = useState('');
  const [search, setSearch] = useState('');
  const [depth, setDepth] = useState(19), [page, setPage] = useState(0);
  const [alternativeLimit, setAlternativeLimit] = useState(25);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => { setPage(0); setAlternativeLimit(25); }, [a, b, mode, depth]);
  const codes = useMemo(() => calculateGenerations(individuals).shortestPaths, [individuals]);
  const names = useMemo(() => new Map(individuals.map(p => [p.id, p.name])), [individuals]);
  const options = useMemo(() => individuals.filter(p => p.id === a || p.id === b || p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((x, y) => x.name.localeCompare(y.name)), [individuals, search, a, b]);
  const result = useMemo(() => mode === 'relationship' && a && b ? calculatePernah(a, b, individuals, marriages, adoptions) : null, [mode, a, b, individuals, marriages, adoptions]);
  const groups = useMemo(() => groupPernahCards(result?.cards || []), [result]);
  const lineage = useMemo(() => mode !== 'relationship' && a ? traceLineage(a, mode, individuals, depth) : null, [mode, a, individuals, depth]);
  const pathView = (path: KinshipPath) => <div className="space-y-3">
    <ol className="list-decimal pl-5 space-y-2 text-sm">{describeKinshipPath(path, individuals).map((line, i) => <li key={i}>{line}</li>)}</ol>
    <div className="flex flex-wrap gap-2">{[...new Set(path.ids)].map(id => <button key={id} className="text-primary-olive underline text-sm py-2 text-left" onClick={() => onSelectIndividual(id)}>Lihat {names.get(id) || 'profil'}</button>)}</div>
    <details className="text-xs text-ink-light"><summary className="cursor-pointer py-3">Rincian catatan sumber</summary><ol className="space-y-2">{path.steps.map((step, i) => <li key={i} className="break-all">{names.get(step.from)} / {names.get(step.to)} · {step.kind}<br />Catatan {step.recordId} · {step.field}</li>)}</ol></details>
  </div>;
  const cardDetails = (card: PernahCard) => <div className="space-y-4">
    {card.warnings.map(w => <p key={w} className="text-sm text-ink-light">{w}</p>)}
    {card.routes.map((route, i) => <details key={i} open={i === 0} className="space-y-3"><summary className="cursor-pointer py-2 text-sm font-semibold">Jalur {i + 1}</summary>
      {route.path && pathView(route.path)}
      {route.branches && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><h4 className="font-semibold text-sm">Jalur {names.get(a)}</h4>{pathView(route.branches.from)}</div><div className="space-y-2"><h4 className="font-semibold text-sm">Jalur {names.get(b)}</h4>{pathView(route.branches.to)}</div></div>}
    </details>)}
    {card.truncated && <p className="text-amber-800 text-sm">Maksimal 20 jalur ditampilkan untuk acuan ini.</p>}
  </div>;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key !== 'Tab') return;
    const focusable = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, summary, [tabindex="0"]');
    if (!focusable?.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return <div className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-3">
    <div ref={panel} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-labelledby="kinship-title" className="bg-bg rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92dvh] overflow-y-auto p-5 space-y-5">
      <header className="flex items-center justify-between gap-3"><h2 id="kinship-title" className="text-xl font-serif font-bold">Pernah, leluhur, dan keturunan</h2><button aria-label="Tutup penelusuran" onClick={onClose} className="p-3"><X /></button></header>
      <div className="flex flex-wrap gap-2" aria-label="Jenis penelusuran">{([['relationship', 'Pernah'], ['ancestors', 'Leluhur'], ['descendants', 'Keturunan']] as const).map(([key, label]) => <button key={key} aria-pressed={mode === key} className={`px-4 py-3 rounded-xl border ${mode === key ? 'bg-primary-olive text-white' : ''}`} onClick={() => { setMode(key); setDepth(key === 'descendants' ? 18 : 19); }}>{label}</button>)}</div>
      <label className="block text-sm">Saring daftar nama<input type="search" value={search} onChange={e => setSearch(e.target.value)} className="block w-full border rounded-lg p-3 mt-1" placeholder="Ketik bagian nama…" /></label>
      <div className="grid sm:grid-cols-2 gap-3">{(mode === 'relationship' ? ['a', 'b'] : ['a']).map(key => <label key={key} className="block text-sm">{key === 'a' ? (mode === 'relationship' ? 'Tokoh pertama' : 'Tokoh acuan') : 'Tokoh kedua'}<select className="block w-full border rounded-lg p-3 mt-1" value={key === 'a' ? a : b} onChange={e => key === 'a' ? setA(e.target.value) : setB(e.target.value)}><option value="">Pilih tokoh</option>{options.map(p => <option key={p.id} value={p.id}>{p.name} · {codes[p.id] || 'Belum terhubung'}</option>)}</select></label>)}</div>
      {mode !== 'relationship' && <label className="block text-sm">Batas tingkat<select className="ml-3 border p-2 rounded-lg" value={depth} onChange={e => setDepth(Number(e.target.value))}>{Array.from({ length: mode === 'ancestors' ? 19 : 18 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></label>}
      <section aria-live="polite" className="space-y-3">
        {!result && !lineage && <p className="text-sm text-ink-light">Pilih {mode === 'relationship' ? 'dua tokoh' : 'satu tokoh'} untuk menelusuri hubungan yang tercatat.</p>}
        {result && <>
          <h3 className="font-bold">{groups.length ? `${groups.length} kelompok pernah ditemukan` : result.message}</h3>
          <p className="text-sm text-ink-light">Pilih sebutan, lalu leluhur acuannya untuk membuka jalur. Hubungan dihitung dari catatan yang tersedia.</p>
          {result.warnings.map(w => <p key={w} className="text-sm text-ink-light">{w}</p>)}
          {result.truncated && <p className="text-amber-800">Batas penelusuran tercapai; hasil belum mencakup semua jalur.</p>}
          {groups.slice(page * 25, (page + 1) * 25).map((group, index) => <details key={`${a}:${b}:${group.id}`} className="rounded-xl border border-border-olive/40 bg-bg-light p-4">
            <summary className="cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-primary-olive">
              <span className="font-bold text-primary-olive text-lg">{page * 25 + index + 1}. Pernah {group.title}</span>
              <span className="block text-sm font-medium mt-1 leading-relaxed">{group.via}</span>
              <span className="block mt-2 space-y-1">{group.descriptions.map(text => <span key={text} className="block text-sm">{text}</span>)}</span>
              <span className="block text-xs text-ink-light mt-2">Buka jalur hubungan</span>
            </summary>
            <div className="border-t border-border-olive/30 pt-4 mt-2 space-y-4">
              {group.members.map(card => card.ancestorId || group.members.length > 1 ? <details key={card.id} className="border rounded-lg p-3"><summary className="cursor-pointer py-2 font-semibold text-sm">{card.via}</summary><div className="space-y-3 mt-2">{card.descriptions.map(text => <p key={text} className="text-sm">{text}</p>)}{cardDetails(card)}</div></details> : <div key={card.id}>{cardDetails(card)}</div>)}
            </div>
          </details>)}
          {groups.length > 25 && <div className="flex items-center justify-between"><button className="p-3 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Sebelumnya</button><span>{page + 1} / {Math.ceil(groups.length / 25)}</span><button className="p-3 disabled:opacity-40" disabled={(page + 1) * 25 >= groups.length} onClick={() => setPage(page + 1)}>Berikutnya</button></div>}
          {!!result.alternativePaths?.length && <details key={`alternatives:${a}:${b}`} className="border-t pt-3"><summary className="cursor-pointer py-3 font-semibold text-sm">Jalur leluhur alternatif · {result.alternativePaths.length} acuan lanjutan</summary>
            <p className="text-sm text-ink-light my-3">Bagian ini menyimpan jalur lanjutan dari pertemuan lebih dekat dan kelompok segenerasi yang lebih jauh. Detail tetap tersedia, tetapi tidak menambah jumlah kelompok pada ringkasan.</p>
            <div className="space-y-3">{result.alternativePaths.slice(0, alternativeLimit).map(card => <details key={card.id} className="border rounded-lg p-3"><summary className="cursor-pointer py-2 text-sm">{card.via} · {card.depths?.[0]} dan {card.depths?.[1]} langkah</summary><div className="space-y-3 mt-3">{card.descriptions.map(text => <p key={text} className="text-sm">{text}</p>)}{cardDetails(card)}</div></details>)}</div>
            {alternativeLimit < result.alternativePaths.length && <button className="underline p-3 text-sm" onClick={() => setAlternativeLimit(n => n + 25)}>Tampilkan jalur berikutnya</button>}
          </details>}
        </>}
        {lineage && <><p>{new Set(lineage.entries.map(e => e.id)).size} tokoh · {lineage.entries.length} jalur tercatat.</p><p className="text-sm text-ink-light">Orang yang sama dapat muncul melalui beberapa jalur. Orang tua yang tidak tersedia tidak dianggap tidak ada.</p>{lineage.cycleDetected && <p role="alert" className="text-amber-800">Siklus silsilah ditemukan dan dihentikan. Hasil perlu diperiksa kurator.</p>}{lineage.truncated && <p className="text-amber-800">Penelusuran dibatasi tingkat pilihan atau 5.000 jalur; hasil belum lengkap.</p>}{!lineage.entries.length && <p>Belum ada jalur yang dapat dibaca.</p>}{lineage.entries.slice(page * 25, (page + 1) * 25).map((entry, i) => <details key={`${page}-${i}`} className="border rounded-xl p-3"><summary className="cursor-pointer py-2"><strong>{names.get(entry.id)}</strong> · {entry.label} · tingkat {entry.depth}</summary>{pathView(entry.path)}{mode === 'descendants' && entry.depth === 1 && <p className="text-sm mt-3">{childPosition(individuals.find(p => p.id === entry.id)!, individuals) || 'Urutan kelahiran belum dapat dipastikan.'}</p>}</details>)}{lineage.entries.length > 25 && <div className="flex items-center justify-between"><button className="p-3 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Sebelumnya</button><span>{page + 1} / {Math.ceil(lineage.entries.length / 25)}</span><button className="p-3 disabled:opacity-40" disabled={(page + 1) * 25 >= lineage.entries.length} onClick={() => setPage(page + 1)}>Berikutnya</button></div>}</>}
      </section>
      <details className="border-t pt-3"><summary className="cursor-pointer py-2 font-semibold">Kamus sebutan dan batas penafsiran</summary><dl className="space-y-3 mt-3 text-sm">{kinshipGlossary.map(([term, meaning]) => <div key={term}><dt className="font-bold">{term}</dt><dd>{meaning}</dd></div>)}</dl></details>
    </div>
  </div>;
}
