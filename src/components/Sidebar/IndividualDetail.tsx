import React, { useState, useEffect } from 'react';
import { Individual, Marriage, Event } from '@/types';
import { getJavaneseDescendantTerm } from '@/lib/relationships';
import { generateGenealogyIDs } from '@/lib/genealogy';
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
  GitBranch
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface IndividualDetailProps {
  individual: Individual | null;
  individuals: Individual[];
  marriages: Marriage[];
  onClose: () => void;
  isAdmin?: boolean;
  onEdit?: (individual: Individual) => void;
}

export default function IndividualDetail({ 
  individual, 
  individuals = [], 
  marriages = [], 
  onClose, 
  isAdmin, 
  onEdit 
}: IndividualDetailProps) {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (individual?.id) {
      fetchEvents(individual.id);
    }
  }, [individual?.id]);

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
        setEvents(data || []);
      }
    } catch (err) {
      setEvents([]);
    }
  };

  if (!individual) return null;

  const { baseId, pathIds, displayId, shortestPath } = generateGenealogyIDs(individual, individuals, marriages);

  const father = individuals.find(i => i?.id === individual.father_id);
  const mother = individuals.find(i => i?.id === individual.mother_id);
  const spouseMarriages = marriages.filter(m => m?.husband_id === individual.id || m?.wife_id === individual.id);
  const spouses = spouseMarriages.map(m => {
    const spouseId = m?.husband_id === individual.id ? m?.wife_id : m?.husband_id;
    return individuals.find(i => i?.id === spouseId);
  }).filter(Boolean);

  const children = individuals.filter(child => child?.father_id === individual.id || child?.mother_id === individual.id);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        className="fixed right-0 top-0 h-full w-[360px] bg-surface shadow-2xl z-50 overflow-y-auto border-l border-border-olive"
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
            <div className="w-20 h-20 bg-accent-tan rounded-full mx-auto mb-4 border-4 border-white shadow-md flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-ink">{individual.name}</h2>
            
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-border-olive w-full shadow-sm">
                <span className="text-[9px] font-bold text-ink-light uppercase tracking-tighter flex items-center gap-1">
                  <Fingerprint size={10} /> Display-ID
                </span>
                <span className="text-[14px] font-mono font-bold text-primary-olive">{displayId}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 w-full">
                <div className="flex flex-col items-center p-2 bg-bg/50 rounded-lg border border-border-olive/50">
                  <span className="text-[8px] font-bold text-ink-light uppercase tracking-tighter flex items-center gap-1">
                    <Link2 size={8} /> Base-ID
                  </span>
                  <span className="text-[12px] font-mono font-medium text-ink-light">{baseId}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-bg/50 rounded-lg border border-border-olive/50">
                  <span className="text-[8px] font-bold text-ink-light uppercase tracking-tighter flex items-center gap-1">
                    <GitBranch size={8} /> Path-ID
                  </span>
                  <div className="flex flex-wrap justify-center gap-1">
                    {pathIds.map((p, i) => (
                      <span key={i} className="text-[10px] font-mono text-ink-light leading-none">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 inline-block bg-primary-olive text-white px-3 py-1 rounded-full text-[11px] font-medium">
              {getJavaneseDescendantTerm(shortestPath.split('.').length - 2)}
            </div>
            
            {individual.is_verified && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-verified-green">
                <ShieldCheck size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Verified by: {individual.verified_by || 'System'}
                </span>
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
                  <span className="font-medium text-ink">{father?.name || '-'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-light text-[10px] font-bold uppercase tracking-wider">Ibu</span>
                  <span className="font-medium text-ink">{mother?.name || '-'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-light text-[10px] font-bold uppercase tracking-wider">Pasangan</span>
                  <div className="flex flex-col gap-1">
                    {spouses.length > 0 ? spouses.map(s => (
                      <span key={s?.id} className="font-medium text-ink italic leading-tight">
                        {s?.name}
                      </span>
                    )) : <span className="font-medium text-ink">-</span>}
                  </div>
                </div>
                {/* ID section already added above, but we keep the children list as it's vital information. 
                    If the user explicitly said "Remove Children Button", and we don't see a button, 
                    maybe we should just keep the list for now but remove any header that looks like a button. */}
                <div className="flex flex-col gap-0.5 pt-2">
                  <span className="text-ink-light text-[10px] font-bold uppercase tracking-wider">Keturunan ({children.length})</span>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-2 mt-1">
                    {children.length > 0 ? children.map(c => (
                      <div key={c.id} className="flex items-center gap-2 group">
                        <div className={`w-1.5 h-1.5 rounded-full ${c.gender === 'M' ? 'bg-blue-400' : 'bg-rose-400'}`} />
                        <span className="text-ink font-medium leading-tight group-hover:text-primary-olive cursor-default transition-colors">{c.name}</span>
                      </div>
                    )) : <span className="text-ink-light italic">Belum ada data</span>}
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
    </AnimatePresence>
  );
}
