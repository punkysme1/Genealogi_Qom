import React, { useState, useEffect, useMemo } from 'react';
import { Individual, Marriage, Event } from '@/types';
import { getJavaneseDescendantTerm } from '@/lib/relationships';
import { generateGenealogyIDs } from '@/lib/genealogy';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, 
  MapPin, 
  GraduationCap, 
  Briefcase, 
  History,
  Info,
  X,
  User,
  ShieldCheck,
  Star,
  Fingerprint,
  Link2,
  GitBranch,
  CreditCard,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface IndividualDetailProps {
  individual: Individual | null;
  individuals: Individual[];
  marriages: Marriage[];
  onClose: () => void;
  isAdmin?: boolean;
  onEdit?: (individual: Individual) => void;
  onSelectIndividual?: (individual: Individual) => void;
}

const DEFAULT_PHOTO = 'https://res.cloudinary.com/dkarruwdb/image/upload/v1778391420/GENEALOGI_coklat_nll05k.png';

export default function IndividualDetail({ 
  individual, 
  individuals = [], 
  marriages = [], 
  onClose, 
  isAdmin, 
  onEdit,
  onSelectIndividual
}: IndividualDetailProps) {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (individual?.id) {
      fetchEvents(individual.id);
    }
  }, [individual?.id]);

  const { 
    level,
    baseId, 
    pathIds, 
    displayId, 
    shortestPath, 
    alphaPaths
  } = useMemo(() => {
    if (!individual) {
      return { level: 0, baseId: '-', pathIds: [], displayId: '-', shortestPath: '', alphaPaths: [] };
    }
    
    return generateGenealogyIDs(individual, individuals, marriages);
  }, [individual?.id, individuals, marriages]);

  // These calculations depend on individual, but we move them after useMemo to keep hooks at top
  const father = useMemo(() => individuals.find(i => i?.id === individual?.father_id), [individual?.father_id, individuals]);
  const mother = useMemo(() => individuals.find(i => i?.id === individual?.mother_id), [individual?.mother_id, individuals]);
  
  const spousesWithMarriage = useMemo(() => {
    if (!individual) return [];
    const spouseMarriages = marriages.filter(m => m?.husband_id === individual.id || m?.wife_id === individual.id);
    const uniqueMarriages = Array.from(new Map(spouseMarriages.map(m => [m.id, m])).values());
    
    return uniqueMarriages.map(m => {
      const spouseId = m?.husband_id === individual.id ? m?.wife_id : m?.husband_id;
      const spouse = individuals.find(i => i?.id === spouseId);
      return { spouse, marriage: m };
    }).filter(item => !!item.spouse);
  }, [individual?.id, individuals, marriages]);

  const children = useMemo(() => {
    if (!individual) return [];
    
    const childList = individuals
      .filter(child => child?.father_id === individual.id || child?.mother_id === individual.id);
    
    // Ensure unique children by ID
    const uniqueChildren = Array.from(new Map(childList.map(c => [c.id, c])).values());
    
    return uniqueChildren.sort((a, b) => {
        const dateA = a?.birth_date || '9999-12-31';
        const dateB = b?.birth_date || '9999-12-31';
        const nameA = a?.name || '';
        const nameB = b?.name || '';
        return dateA.localeCompare(dateB) || nameA.localeCompare(nameB);
      });
  }, [individual?.id, individuals]);

  const siblings = useMemo(() => {
    if (!individual) return [];
    if (!individual.father_id && !individual.mother_id) return [];
    
    const siblingList = individuals.filter(ind => {
      if (ind.id === individual.id) return false;
      const shareFather = individual.father_id && ind.father_id === individual.father_id;
      const shareMother = individual.mother_id && ind.mother_id === individual.mother_id;
      return shareFather || shareMother;
    });
    
    // Ensure unique siblings
    const uniqueSiblings = Array.from(new Map(siblingList.map(s => [s.id, s])).values());
    
    return uniqueSiblings.sort((a, b) => {
      const dateA = a?.birth_date || '9999-12-31';
      const dateB = b?.birth_date || '9999-12-31';
      return dateA.localeCompare(dateB);
    });
  }, [individual?.id, individual?.father_id, individual?.mother_id, individuals]);

  const fetchEvents = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('individual_id', id)
        .order('date', { ascending: true });
      
      if (error) {
        console.warn('Events table mismatch or missing:', error.message);
        setEvents([]);
      } else {
        const uniqueEvents = Array.from(new Map((data || []).map(e => [e.id, e])).values());
        setEvents(uniqueEvents);
      }
    } catch (err) {
      setEvents([]);
    }
  };

  // Guard against missing individual - parent should ideally handle this but we keep a safe fallback
  if (!individual) return null;

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 h-full w-full sm:w-[360px] bg-surface shadow-2xl z-[50] overflow-y-auto border-l border-border-olive"
    >
      <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            {isAdmin ? (
              <button 
                onClick={() => individual && onEdit?.(individual)}
                className="flex items-center gap-1.5 px-3 py-1 bg-primary-olive text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary-olive/90 transition-all font-sans"
              >
                Edit Data & Linimasa
              </button>
            ) : (
              <div />
            )}
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-bg rounded-full transition-colors"
            >
              <X size={18} className="text-ink-light" />
            </button>
          </div>

          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-accent-tan rounded-2xl mx-auto mb-4 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden relative group">
              <img 
                src={individual.profile_photo_url || DEFAULT_PHOTO} 
                alt={individual.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_PHOTO;
                }}
              />
            </div>
            <h2 className="text-xl font-bold text-ink leading-tight px-4">{individual.name}</h2>
            
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                (individual.is_alive === false || individual.death_date) 
                  ? "bg-zinc-100 text-zinc-500 border-zinc-300" 
                  : "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm shadow-emerald-100"
              )}>
                {(individual.is_alive === false || individual.death_date) ? 'Sudah Wafat' : 'Masih Hidup'}
              </span>
              {individual.current_location && individual.is_alive !== false && !individual.death_date && (
                <span className="flex items-center gap-1 text-[10px] text-ink-light bg-bg px-2 py-1 rounded-full border border-border-olive/30 italic">
                  <MapPin size={10} className="text-primary-olive" /> {individual.current_location}
                </span>
              )}
            </div>
            
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-border-olive w-full shadow-sm group relative">
                <span className="text-[10px] font-bold text-ink-light uppercase tracking-widest flex items-center gap-1.5 mb-1 cursor-help">
                  <Fingerprint size={12} className="text-primary-olive" /> Nasab Utama (Alfanumerik)
                  <Info size={10} className="text-accent-tan" />
                </span>
                <span className="text-[14px] font-bold text-primary-olive tracking-tight text-center">{displayId}</span>
                
                {/* Tooltip Explanation */}
                <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-ink text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl border border-white/10 leading-relaxed">
                  <p className="font-bold border-b border-white/20 pb-1 mb-2 text-accent-tan">Cara Membaca Kode:</p>
                  <ul className="space-y-1 text-white/80">
                    <li>• Tiap karakter = 1 Generasi</li>
                    <li>• <span className="text-white font-bold">1-9</span> = Anak ke-1 s/d 9</li>
                    <li>• <span className="text-white font-bold">A-Z</span> = Anak ke-10 s/d 35</li>
                    <li>• <span className="text-white font-bold">(n)</span> = Anak ke-36+ (kembali ke angka)</li>
                    <li>• <span className="text-white font-bold">+</span> = Pasangan (Menantu)</li>
                    <li className="pt-1 italic opacity-60 text-[9px]">Contoh: 2(40)+ (Istri pertama dari anak k-40)</li>
                    <li className="italic opacity-60 text-[9px]">Note: ++ untuk istri ke-2, dst.</li>
                  </ul>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2 w-full">
                <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-border-olive/60">
                  <span className="text-[8px] font-bold text-ink-light uppercase tracking-tighter flex items-center gap-1 mb-1">
                    <Link2 size={10} /> Kode Generasi & Urutan (Base-ID)
                  </span>
                  <span className="text-[11px] font-bold text-ink text-center">{baseId}</span>
                  <span className="text-[7px] text-ink-light uppercase font-medium mt-0.5 whitespace-nowrap">Format G[Gen].[No]</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-border-olive/60">
                  <span className="text-[8px] font-bold text-ink-light uppercase tracking-tighter flex items-center gap-1 mb-1">
                    <GitBranch size={10} /> Macam Jalur (Format Arab: bin/binti)
                  </span>
                  <div className="flex flex-col gap-2 w-full max-h-48 overflow-y-auto px-2 mt-1">
                    {pathIds && pathIds.length > 0 ? pathIds.map((p, i) => (
                      <div key={i} className="text-[9px] font-medium text-primary-olive bg-accent-tan/10 p-1.5 rounded border border-accent-tan/20 leading-relaxed text-center group relative cursor-help italic">
                        {p}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-ink text-white text-[8px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl font-mono not-italic">
                          Shortcode: {alphaPaths && alphaPaths[i] ? alphaPaths[i] : displayId}
                        </div>
                      </div>
                    )) : (
                      <div className="text-[9px] italic text-ink-light text-center p-2 bg-bg border border-border-olive/50 rounded">
                        Belum terhubung ke Kiai Qomaruddin
                      </div>
                    )}
                  </div>
                  <span className="text-[7px] text-ink-light uppercase font-medium mt-1">Ditemukan {pathIds.length} Jalur</span>
                </div>
              </div>
            </div>

            <div className="mt-4 inline-block bg-primary-olive text-white px-3 py-1 rounded-full text-[11px] font-medium">
              {shortestPath === 'Root' || shortestPath === 'G0' || shortestPath === '' || level === 0 
                ? 'Pendiri / Leluhur Utama' 
                : getJavaneseDescendantTerm(level - 1)}
            </div>
            
            {individual.is_verified && (
              <div className="mt-4 p-3 bg-verified-green/5 border border-verified-green/20 rounded-xl max-w-[280px] mx-auto group cursor-help relative">
                <div className="flex items-center justify-center gap-1.5 text-verified-green">
                  <ShieldCheck size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-wider italic">Data Terverifikasi</span>
                </div>
                
                {/* Verification Detail Tooltip-like Info */}
                <div className="mt-1 flex flex-col items-center">
                  <span className="text-[9px] text-ink-light font-bold flex items-center gap-1">
                    <FileText size={10} /> {individual.verification_type || 'Manuskrip'}
                  </span>
                  {isAdmin && individual.verification_source && (
                    <a 
                      href={individual.verification_source} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[8px] text-primary-olive font-bold underline decoration-primary-olive/30 truncate max-w-full px-2 mt-0.5 hover:text-ink transition-colors flex items-center gap-1"
                    >
                      <Link2 size={8} /> Klik Lihat Data
                    </a>
                  )}
                  {individual.verified_by && (
                    <div className="mt-1 pt-1 border-t border-verified-green/10 w-full text-[8px] text-verified-green font-bold text-center">
                      Paraf: {individual.verified_by}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {isAdmin && (individual.economic_status || individual.occupation) && (
              <div className="mt-3 flex flex-col items-center gap-2">
                {individual.economic_status && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-border-olive rounded-full shadow-sm text-ink-light">
                    <CreditCard size={12} className="text-primary-olive" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Ekonomi:</span>
                    <span className={cn(
                      "text-[9px] font-black uppercase whitespace-nowrap",
                      individual.economic_status === 'Kaya' ? 'text-emerald-600' : 
                      individual.economic_status === 'Menengah' ? 'text-primary-olive' : 'text-rose-500'
                    )}>
                      {individual.economic_status}
                    </span>
                  </div>
                )}
                {individual.occupation && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-border-olive rounded-full shadow-sm text-ink-light">
                    <Briefcase size={12} className="text-primary-olive" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Pekerjaan:</span>
                    <span className="text-[9px] font-black uppercase tracking-tight text-ink">
                      {individual.occupation}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-8">
            {/* Detail Info */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-light mb-4 text-primary-olive border-b border-border-olive pb-2">Informasi Keluarga</h3>
              <div className="space-y-3 text-[12px]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-light text-[10px] font-bold uppercase tracking-wider">Ayah</span>
                  {father ? (
                    <button 
                      onClick={() => onSelectIndividual?.(father)}
                      className="text-left font-medium text-ink hover:text-primary-olive transition-colors underline decoration-border-olive/30 underline-offset-2"
                    >
                      {father.name}
                    </button>
                  ) : (
                    <span className="font-medium text-ink opacity-40">-</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-light text-[10px] font-bold uppercase tracking-wider">Ibu</span>
                  {mother ? (
                    <button 
                      onClick={() => onSelectIndividual?.(mother)}
                      className="text-left font-medium text-ink hover:text-primary-olive transition-colors underline decoration-border-olive/30 underline-offset-2"
                    >
                      {mother.name}
                    </button>
                  ) : (
                    <span className="font-medium text-ink opacity-40">-</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-light text-[10px] font-bold uppercase tracking-wider">Suami/Istri</span>
                  <div className="flex flex-col gap-1">
                    {spousesWithMarriage.length > 0 ? spousesWithMarriage.map(({ spouse, marriage }) => (
                      <div key={marriage.id} className="flex flex-col">
                        <button 
                          onClick={() => spouse && onSelectIndividual?.(spouse)}
                          className="text-left font-medium text-ink italic leading-tight hover:text-primary-olive transition-colors underline decoration-border-olive/30 underline-offset-2"
                        >
                          {spouse?.name}
                        </button>
                        {marriage.marriage_date && (
                          <span className="text-[10px] text-ink-light italic">
                            Menikah: {new Date(marriage.marriage_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    )) : <span className="font-medium text-ink opacity-40">-</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-light text-[10px] font-bold uppercase tracking-wider">Saudara Kandung/Tiri ({siblings.length})</span>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-2 mt-1">
                    {siblings.length > 0 ? siblings.map(s => (
                      <button 
                        key={s.id} 
                        onClick={() => onSelectIndividual?.(s)}
                        className="w-full flex items-center gap-2 group text-left"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${s.gender === 'M' ? 'bg-blue-400' : 'bg-rose-400'}`} />
                        <span className="text-ink font-medium leading-tight group-hover:text-primary-olive transition-colors">
                          {s.name}
                        </span>
                      </button>
                    )) : <span className="font-medium text-ink opacity-40">-</span>}
                  </div>
                </div>
                {/* ID section already added above, but we keep the children list as it's vital information. 
                    If the user explicitly said "Remove Children Button", and we don't see a button, 
                    maybe we should just keep the list for now but remove any header that looks like a button. */}
                <div className="flex flex-col gap-0.5 pt-2">
                  <span className="text-ink-light text-[10px] font-bold uppercase tracking-wider">Keturunan ({children.length})</span>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-2 mt-1">
                    {children.length > 0 ? children.map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => onSelectIndividual?.(c)}
                        className="w-full flex items-center gap-2 group text-left"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${c.gender === 'M' ? 'bg-blue-400' : 'bg-rose-400'}`} />
                        <span className="text-ink font-medium leading-tight group-hover:text-primary-olive transition-colors">
                          {c.name}
                        </span>
                      </button>
                    )) : <span className="text-ink-light italic text-[11px]">Belum ada data</span>}
                  </div>
                </div>
              </div>
            </section>

            {/* Bio */}
            {individual.bio && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-light mb-2">Biografi</h3>
                <p className="text-[12px] text-ink italic leading-relaxed whitespace-pre-wrap">
                  "{individual.bio}"
                </p>
              </section>
            )}

            {/* Timeline */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-light mb-4">Linimasa Hidup</h3>
              <div className="relative pl-5 border-l border-border-olive space-y-6 pb-4">
                {individual.birth_date && (
                  <div className="relative">
                    <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-accent-tan" />
                    <p className="text-[10px] font-bold text-primary-olive">{new Date(individual.birth_date).getFullYear()}</p>
                    <p className="text-[12px] text-ink font-bold">Kelahiran</p>
                    <p className="text-[11px] text-ink-light italic">{individual.birth_place ? `di ${individual.birth_place}` : ''}</p>
                  </div>
                )}

                {/* Custom Events */}
                {events.map((event) => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-primary-olive shadow-sm" />
                    <p className="text-[10px] font-bold text-primary-olive">{event.date ? (event.date.length === 4 ? event.date : new Date(event.date).getFullYear()) : '—'}</p>
                    <p className="text-[12px] text-ink font-medium leading-tight">{event.description}</p>
                    {event.location && (
                      <p className="text-[10px] text-ink-light italic flex items-center gap-1 mt-0.5">
                        <MapPin size={8} /> {event.location}
                      </p>
                    )}
                  </div>
                ))}

                {individual.death_date && (
                  <div className="relative">
                    <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-ink-light" />
                    <p className="text-[10px] font-bold text-ink-light">{new Date(individual.death_date).getFullYear()}</p>
                    <p className="text-[12px] text-ink font-bold">Wafat</p>
                    <p className="text-[11px] text-ink-light italic">{individual.death_place ? `dimakamkan di ${individual.death_place}` : ''}</p>
                  </div>
                )}

                {(!individual.birth_date && !individual.death_date && events.length === 0) && (
                  <p className="text-[11px] text-ink-light italic">Data linimasa belum tersedia</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </motion.div>
  );
}
