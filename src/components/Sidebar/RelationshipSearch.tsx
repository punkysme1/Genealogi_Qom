import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Individual } from '@/types';
import { calculateRelationship } from '@/lib/relationships';
import { Search, Users, ArrowRightLeft, X, UserCheck, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RelationshipSearchProps {
  individuals: Individual[];
  onClose: () => void;
  onSelectIndividual: (id: string) => void;
}

export const RelationshipSearch: React.FC<RelationshipSearchProps> = ({ 
  individuals, 
  onClose,
  onSelectIndividual
}) => {
  const [personA, setPersonA] = useState<string>('');
  const [personB, setPersonB] = useState<string>('');
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');

  const filteredA = useMemo(() => {
    if (searchA.length < 2) return [];
    const matches = individuals
      .filter(i => i.name.toLowerCase().includes(searchA.toLowerCase()));
    
    // Deduplicate matches
    return Array.from(new Map(matches.map(i => [i.id, i])).values())
      .slice(0, 5);
  }, [individuals, searchA]);

  const filteredB = useMemo(() => {
    if (searchB.length < 2) return [];
    const matches = individuals
      .filter(i => i.name.toLowerCase().includes(searchB.toLowerCase()));
    
    // Deduplicate matches
    return Array.from(new Map(matches.map(i => [i.id, i])).values())
      .slice(0, 5);
  }, [individuals, searchB]);

  const result = useMemo(() => {
    if (!personA || !personB) return null;
    return calculateRelationship(personA, personB, individuals);
  }, [personA, personB, individuals]);

  const getPersonName = (id: string) => individuals.find(i => i.id === id)?.name || 'Unknown';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
    >
      <div className="bg-bg w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-border-olive/30">
        <div className="p-4 bg-primary-olive text-white flex justify-between items-center bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Users className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight uppercase tracking-widest font-serif">Kalkulator Hubungan</h2>
              <p className="text-[10px] opacity-80 uppercase font-medium">Cek Kekerabatan Antar Dzurriyat</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 relative">
            {/* Person A Search */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-ink-light tracking-widest pl-1">Individu Pertama (Subjek)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-border-olive" size={16} />
                <input 
                  type="text"
                  placeholder="Cari nama individu A..."
                  value={personA ? getPersonName(personA) : searchA}
                  onChange={(e) => {
                    setSearchA(e.target.value);
                    if (personA) setPersonA('');
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-bg-light border border-border-olive/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-olive/20 transition-all font-medium italic"
                />
                {personA && (
                  <button onClick={() => setPersonA('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 hover:bg-rose-50 p-1 rounded-full"><X size={14} /></button>
                )}
              </div>
              <AnimatePresence>
                {searchA.length >= 2 && !personA && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute z-10 w-full bg-white border border-border-olive shadow-lg rounded-xl mt-1 overflow-hidden">
                    {filteredA.length > 0 ? filteredA.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => { setPersonA(p.id); setSearchA(''); }}
                        className="w-full text-left p-3 hover:bg-primary-olive/5 text-xs font-medium italic text-ink border-b border-border-olive/10 last:border-0"
                      >
                        {p.name}
                      </button>
                    )) : <div className="p-3 text-xs text-ink-light italic">Tidak ditemukan</div>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex justify-center -my-3 z-10 relative">
              <div className="w-10 h-10 bg-primary-olive rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-bg rotate-90 sm:rotate-0">
                <ArrowRightLeft size={18} />
              </div>
            </div>

            {/* Person B Search */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-ink-light tracking-widest pl-1">Individu Kedua (Target)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-border-olive" size={16} />
                <input 
                  type="text"
                  placeholder="Cari nama individu B..."
                  value={personB ? getPersonName(personB) : searchB}
                  onChange={(e) => {
                    setSearchB(e.target.value);
                    if (personB) setPersonB('');
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-bg-light border border-border-olive/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-olive/20 transition-all font-medium italic"
                />
                {personB && (
                  <button onClick={() => setPersonB('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 hover:bg-rose-50 p-1 rounded-full"><X size={14} /></button>
                )}
              </div>
              <AnimatePresence>
                {searchB.length >= 2 && !personB && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute z-10 w-full bg-white border border-border-olive shadow-lg rounded-xl mt-1 overflow-hidden">
                    {filteredB.length > 0 ? filteredB.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => { setPersonB(p.id); setSearchB(''); }}
                        className="w-full text-left p-3 hover:bg-primary-olive/5 text-xs font-medium italic text-ink border-b border-border-olive/10 last:border-0"
                      >
                        {p.name}
                      </button>
                    )) : <div className="p-3 text-xs text-ink-light italic">Tidak ditemukan</div>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Results Area */}
          <div className="bg-bg-light rounded-3xl p-6 border-2 border-dashed border-border-olive/50 min-h-[160px] flex flex-col items-center justify-center text-center">
            <AnimatePresence mode="wait">
              {!result ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  <HelpCircle className="mx-auto text-border-olive/50" size={48} />
                  <p className="text-xs text-ink-light italic font-medium">Pilih dua individu untuk melihat <br/>bagaimana mereka terhubung dalam silsilah.</p>
                </motion.div>
              ) : (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="space-y-4 w-full">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-olive text-white rounded-full text-sm font-bold shadow-md shadow-primary-olive/30 shadow-primary-olive/30 uppercase tracking-widest ring-4 ring-primary-olive/10">
                    <UserCheck size={18} />
                    {result.type.replace('_', ' ')}
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-serif font-bold text-ink leading-tight">
                      {getPersonName(personA)} adalah <span className="text-secondary-rust italic underline decoration-secondary-rust/30 underline-offset-4">{result.description.split('adalah ')[1]}</span> {getPersonName(personB)}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <button 
                        onClick={() => onSelectIndividual(personA)}
                        className="text-[10px] font-bold text-primary-olive hover:underline"
                      >
                        Lihat {getPersonName(personA)} →
                      </button>
                      <span className="text-zinc-300">•</span>
                      <button 
                        onClick={() => onSelectIndividual(personB)}
                        className="text-[10px] font-bold text-primary-olive hover:underline"
                      >
                        Lihat {getPersonName(personB)} →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="p-4 bg-bg-light border-t border-border-olive/20 flex justify-between items-center sm:px-6">
          <p className="text-[10px] text-ink-light italic font-medium max-w-[70%] leading-tight text-left">
            *Hubungan dihitung berdasarkan silsilah keturunan langsung (Nasab) dan kekerabatan sosial (Cak/Dek).
          </p>
          <button 
            onClick={() => { setPersonA(''); setPersonB(''); setSearchA(''); setSearchB(''); }}
            className="text-[11px] font-bold text-ink-light hover:text-rose-500 transition-colors uppercase tracking-widest"
          >
            Reset
          </button>
        </div>
      </div>
    </motion.div>
  );
};
