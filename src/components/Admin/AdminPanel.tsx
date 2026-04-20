import React, { useState, useEffect } from 'react';
import { Individual, Event } from '@/types';
import { supabase } from '@/lib/supabase';
import { suggestHenryCode, findSpouse } from '@/lib/genealogy';
import { X, Save, Trash2, UserPlus, ShieldCheck, AlertCircle, Search, ChevronRight, ArrowLeft, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  onClose: () => void;
  selectedIndividual?: Individual | null;
  onRefresh: () => void;
}

export default function AdminPanel({ onClose, selectedIndividual: initialSelected, onRefresh }: AdminPanelProps) {
  const [view, setView] = useState<'list' | 'form'>(initialSelected ? 'form' : 'list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [allIndividuals, setAllIndividuals] = useState<Individual[]>([]);
  const [searchListQuery, setSearchListQuery] = useState('');
  
  const [formData, setFormData] = useState<Partial<Individual>>({
    name: '',
    ref_code: '',
    gender: 'M',
    birth_date: '',
    death_date: '',
    birth_place: '',
    death_place: '',
    current_location: '',
    occupation: '',
    is_verified: false,
    verified_by: '',
    father_id: '',
    mother_id: '',
  });

  const [editingId, setEditingId] = useState<string | null>(initialSelected?.id || null);
  const [marriages, setMarriages] = useState<any[]>([]);
  const [newSpouseId, setNewSpouseId] = useState('');
  const [individualEvents, setIndividualEvents] = useState<any[]>([]);
  const [newEvent, setNewEvent] = useState({
    description: '',
    date: '',
    location: '',
    type: 'other' as const
  });

  useEffect(() => {
    fetchAllIndividuals();
  }, []);

  const fetchAllIndividuals = async () => {
    const { data } = await supabase.from('individuals').select('*').order('name');
    if (data) setAllIndividuals(data);
  };

  const fetchEvents = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('individual_id', id)
        .order('date', { ascending: true });
        
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('cache')) {
          console.warn('Events table missing or schema cache stale');
          return;
        }
        throw error;
      }
      if (data) setIndividualEvents(data);
    } catch (err: any) {
      console.error('Error fetching events:', err);
    }
  };

  const fetchMarriages = async (id: string) => {
    const { data } = await supabase
      .from('marriages')
      .select(`
        *,
        husband:individuals!marriages_husband_id_fkey(name),
        wife:individuals!marriages_wife_id_fkey(name)
      `)
      .or(`husband_id.eq.${id},wife_id.eq.${id}`);
    if (data) setMarriages(data);
  };

  useEffect(() => {
    if (editingId) {
      fetchMarriages(editingId);
      fetchEvents(editingId);
    }
  }, [editingId]);

  const handleAddEvent = async () => {
    if (!editingId || !newEvent.description) return;
    setLoading(true);
    try {
      const eventData = {
        ...newEvent,
        individual_id: editingId,
        date: newEvent.date === '' ? null : newEvent.date
      };
      const { error } = await supabase.from('events').insert([eventData]);
      if (error) throw error;
      setNewEvent({ description: '', date: '', location: '', type: 'other' });
      fetchEvents(editingId);
    } catch (err: any) {
      if (err.message?.includes('public.events')) {
        setError('Tabel "events" belum dibuat di Supabase. Silakan jalankan SQL di tab SQL Editor Supabase.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eId: string) => {
    if (!confirm('Hapus peristiwa ini?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('events').delete().eq('id', eId);
      if (error) throw error;
      if (editingId) fetchEvents(editingId);
    } catch (err: any) {
      if (err.message?.includes('public.events')) {
        setError('Tabel "events" belum dibuat di Supabase.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddMarriage = async () => {
    if (!editingId || !newSpouseId) return;
    setLoading(true);
    try {
      const isMale = formData.gender === 'M';
      const marriageData = {
        husband_id: isMale ? editingId : newSpouseId,
        wife_id: isMale ? newSpouseId : editingId,
        is_active: true
      };
      
      const { error } = await supabase.from('marriages').insert([marriageData]);
      if (error) throw error;
      
      fetchMarriages(editingId);
      setNewSpouseId('');
      fetchAllIndividuals(); // Refresh list to see new connections
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAddChild = (spouseId?: string) => {
    const isMale = formData.gender === 'M';
    setFormData({
      name: '',
      ref_code: '',
      gender: 'M',
      birth_date: '',
      death_date: '',
      birth_place: '',
      death_place: '',
      current_location: '',
      occupation: '',
      is_verified: false,
      verified_by: '',
      father_id: isMale ? (editingId || '') : (spouseId || ''),
      mother_id: isMale ? (spouseId || '') : (editingId || ''),
    });
    setEditingId(null);
    setView('form');
  };

  const handleDeleteMarriage = async (mId: string) => {
    if (!confirm('Hapus data pernikahan ini?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('marriages').delete().eq('id', mId);
      if (error) throw error;
      if (editingId) fetchMarriages(editingId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialSelected) {
      setFormData(initialSelected);
      setEditingId(initialSelected.id);
      setView('form');
    }
  }, [initialSelected]);

  // Spouse auto-fill logic
  useEffect(() => {
    const handleSpouseAutoFill = async () => {
      if (view === 'form' && formData.father_id && !formData.mother_id) {
        const wifeId = await findSpouse(formData.father_id, 'M', supabase);
        if (wifeId) setFormData(prev => ({ ...prev, mother_id: wifeId }));
      } else if (view === 'form' && formData.mother_id && !formData.father_id) {
        const husbandId = await findSpouse(formData.mother_id, 'F', supabase);
        if (husbandId) setFormData(prev => ({ ...prev, father_id: husbandId }));
      }
    };
    handleSpouseAutoFill();
  }, [formData.father_id, formData.mother_id, view]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { id, created_at, updated_at, ...cleanData } = formData as any;
      
      // Automatic Alphanumeric Numbering for NEW individuals (Temporary placeholder - will be recalculated by generator)
      if (!editingId && (!cleanData.ref_code || cleanData.ref_code === '')) {
        cleanData.ref_code = 'ID_PENDING';
      }

      if (cleanData.father_id === '') cleanData.father_id = null;
      if (cleanData.mother_id === '') cleanData.mother_id = null;
      if (cleanData.birth_date === '') cleanData.birth_date = null;
      if (cleanData.death_date === '') cleanData.death_date = null;
      if (cleanData.verified_by === '') cleanData.verified_by = null;
      if (cleanData.ref_code === '') cleanData.ref_code = null;
      if (cleanData.birth_place === '') cleanData.birth_place = null;
      if (cleanData.death_place === '') cleanData.death_place = null;
      if (cleanData.current_location === '') cleanData.current_location = null;
      if (cleanData.occupation === '') cleanData.occupation = null;
      if (cleanData.bio === '') cleanData.bio = null;

      if (editingId) {
        const { error } = await supabase.from('individuals').update(cleanData).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('individuals').insert([cleanData]);
        if (error) throw error;
      }

      setSuccess(true);
      onRefresh();
      fetchAllIndividuals();
      setTimeout(() => {
        setSuccess(false);
        setView('list');
        setEditingId(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (ind: Individual) => {
    setFormData(ind);
    setEditingId(ind.id);
    setView('form');
  };

  const handleAddNew = () => {
    setFormData({
      name: '',
      ref_code: '',
      gender: 'M',
      birth_date: '',
      death_date: '',
      birth_place: '',
      death_place: '',
      current_location: '',
      occupation: '',
      is_verified: false,
      verified_by: '',
      father_id: '',
      mother_id: '',
    });
    setEditingId(null);
    setView('form');
  };

  const handleDelete = async () => {
    if (!editingId || !confirm('Yakin ingin hapus individu ini?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('individuals').delete().eq('id', editingId);
      if (error) throw error;
      onRefresh();
      fetchAllIndividuals();
      setView('list');
      setEditingId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredList = allIndividuals.filter(ind => 
    ind.name.toLowerCase().includes(searchListQuery.toLowerCase()) ||
    ind.ref_code?.toLowerCase().includes(searchListQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-[110] flex items-center justify-end">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="w-full max-w-xl h-full bg-surface shadow-2xl border-l border-border-olive flex flex-col"
      >
        <div className="p-6 border-b border-border-olive flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-serif font-bold text-primary-olive flex items-center gap-2">
              <ShieldCheck size={20} />
              Panel Kontrol Admin
            </h2>
            <p className="text-[11px] text-ink-light uppercase tracking-widest mt-1">Management Silsilah Qomaruddin</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg rounded-full transition-colors">
            <X size={20} className="text-ink-light" />
          </button>
        </div>

        {view === 'list' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 bg-bg/30 border-b border-border-olive space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" size={16} />
                <input 
                  type="text" 
                  placeholder="Cari individu untuk diedit..."
                  value={searchListQuery}
                  onChange={(e) => setSearchListQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-border-olive rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-primary-olive"
                />
              </div>
              <button 
                onClick={handleAddNew}
                className="w-full py-2.5 bg-primary-olive text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-olive/90 transition-all font-sans"
              >
                <UserPlus size={16} /> Tambah Anggota Baru
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredList.map(ind => (
                <button 
                  key={ind.id}
                  onClick={() => handleEditClick(ind)}
                  className="w-full flex items-center justify-between p-3 bg-white border border-border-olive rounded-xl hover:border-primary-olive transition-all group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-tan/20 flex items-center justify-center text-primary-olive font-bold text-xs">
                      {ind.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">{ind.name}</p>
                      <p className="text-[10px] font-mono text-ink-light uppercase">{ind.ref_code || 'No Code'}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-border-olive group-hover:text-primary-olive transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 bg-bg/30 relative flex flex-col">
            <button 
              onClick={() => setView('list')}
              className="flex items-center gap-2 text-ink-light hover:text-primary-olive transition-colors text-xs font-bold mb-6"
            >
              <ArrowLeft size={16} /> Kembali ke Daftar
            </button>

            <form id="admin-form" onSubmit={handleSubmit} className="space-y-8 flex-1">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl flex items-center gap-2">
                  <AlertCircle size={18} /> {error}
                </div>
              )}
              {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-xl flex items-center gap-2">
                  <ShieldCheck size={18} /> Data berhasil diamankan.
                </div>
              )}

              {/* Section: Hubungan - PRIORITIZED */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary-olive border-b border-primary-olive/20 pb-2 italic">Langkah 1: Tentukan Nama Pasangan (Orang Tua)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-ink-light mb-1.5 underline decoration-accent-tan underline-offset-4">ID Ayah</label>
                    <select
                      value={formData.father_id || ''}
                      onChange={(e) => setFormData({ ...formData, father_id: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                    >
                      <option value="">-- Pilih Ayah --</option>
                      {allIndividuals.filter(i => i.gender === 'M' && i.id !== editingId).map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.ref_code || '?'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-light mb-1.5 underline decoration-accent-tan underline-offset-4">ID Ibu</label>
                    <select
                      value={formData.mother_id || ''}
                      onChange={(e) => setFormData({ ...formData, mother_id: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                    >
                      <option value="">-- Pilih Ibu --</option>
                      {allIndividuals.filter(i => i.gender === 'F' && i.id !== editingId).map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.ref_code || '?'})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-ink-light italic">Pasangan akan otomatis terisi jika data pernikahan tersedia.</p>
              </div>

              {/* Section: Identitas Utama */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary-olive border-b border-primary-olive/20 pb-2 italic">Langkah 2: Data Diri Individu</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink-light mb-1.5">Nama Lengkap</label>
                    <input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                      placeholder="Nama individu baru..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-light mb-1.5">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                    >
                      <option value="M">Laki-laki</option>
                      <option value="F">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-light mb-1.5">Kode Alfanumerik (Auto)</label>
                    <div className="px-4 py-2.5 bg-bg border border-dashed border-border-olive rounded-lg text-sm text-ink-light italic">
                      {formData.ref_code || 'Otomatis dihitung sistem'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Key Facts */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary-olive border-b border-primary-olive/20 pb-2 italic">Langkah 3: Detail Kejadian (Lahir & Wafat)</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Lahir */}
                  <div>
                    <label className="block text-xs font-bold text-ink-light mb-1.5">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={formData.birth_date || ''}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-light mb-1.5">Tempat Lahir</label>
                    <input
                      value={formData.birth_place || ''}
                      onChange={(e) => setFormData({ ...formData, birth_place: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                      placeholder="Kabupaten/Kota"
                    />
                  </div>
                  
                  {/* Wafat */}
                  <div>
                    <label className="block text-xs font-bold text-ink-light mb-1.5">Tanggal Wafat (Jika ada)</label>
                    <input
                      type="date"
                      value={formData.death_date || ''}
                      onChange={(e) => setFormData({ ...formData, death_date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-light mb-1.5">Tempat Wafat / Makam</label>
                    <input
                      value={formData.death_place || ''}
                      onChange={(e) => setFormData({ ...formData, death_place: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                      placeholder="Nama Makam/Wilayah"
                    />
                  </div>

                  <div className="col-span-2 pt-2">
                    <label className="block text-xs font-bold text-ink-light mb-1.5 flex items-center gap-1">
                      <MapPin size={12} className="text-primary-olive" /> Domisili / Sebaran Wilayah Saat Ini
                    </label>
                    <input
                      value={formData.current_location || ''}
                      onChange={(e) => setFormData({ ...formData, current_location: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-accent-tan/30 rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                      placeholder="Contoh: Gresik (Kosongkan jika domisili = makam)"
                    />
                    <p className="text-[10px] text-ink-light italic mt-1.5">* Jika sudah wafat, sebaran wilayah otomatis mengambil data 'Tempat Wafat' jika kolom ini kosong.</p>
                  </div>
                </div>
              </div>

              {/* Section: Verifikasi */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary-olive border-b border-primary-olive/20 pb-2">Verifikasi</h3>
                <div className="flex items-center gap-4 bg-surface p-4 rounded-xl border border-border-olive">
                  <input
                    type="checkbox"
                    checked={formData.is_verified}
                    onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                    className="w-5 h-5 rounded border-border-olive text-primary-olive focus:ring-primary-olive"
                  />
                  <div className="flex-1">
                    <input
                      value={formData.verified_by || ''}
                      onChange={(e) => setFormData({ ...formData, verified_by: e.target.value })}
                      disabled={!formData.is_verified}
                      className="w-full px-3 py-1.5 bg-bg border border-border-olive rounded-lg text-xs focus:ring-1 focus:ring-primary-olive focus:outline-none uppercase font-bold disabled:opacity-50"
                      placeholder="Nama Verifikator"
                    />
                  </div>
                </div>
              </div>

              {/* Section: Manajemen Pasangan (Marriage) */}
              {editingId && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary-olive border-b border-primary-olive/20 pb-2 italic">Manajemen Pasangan (Multiple Spouses)</h3>
                  <div className="bg-surface rounded-xl border border-border-olive overflow-hidden">
                    <div className="p-4 space-y-3">
                      {marriages.map((m) => {
                        const spouseId = m.husband_id === editingId ? m.wife_id : m.husband_id;
                        const spouseName = m.husband_id === editingId ? m.wife?.name : m.husband?.name;
                        return (
                          <div key={m.id} className="flex items-center justify-between p-2 bg-bg rounded-lg border border-border-olive/50">
                            <div className="flex flex-col">
                              <span className="text-[13px] font-medium text-ink italic leading-tight">Menikah dengan: {spouseName}</span>
                              <button 
                                type="button"
                                onClick={() => handleQuickAddChild(spouseId)}
                                className="text-[10px] text-primary-olive font-bold uppercase tracking-wider mt-1 hover:underline text-left"
                              >
                                + Tambah Keturunan (Anak)
                              </button>
                            </div>
                            <button 
                              type="button"
                              onClick={() => handleDeleteMarriage(m.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                      {marriages.length === 0 && (
                        <p className="text-xs text-ink-light italic text-center py-2">Belum ada data pernikahan tercatat.</p>
                      )}
                    </div>
                    <div className="p-4 bg-bg border-t border-border-olive flex gap-2">
                      <select 
                        value={newSpouseId}
                        onChange={(e) => setNewSpouseId(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-border-olive rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-olive"
                      >
                        <option value="">-- Tambah Pasangan Baru --</option>
                        {allIndividuals
                          .filter(i => i.gender !== formData.gender && i.id !== editingId)
                          .map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))
                        }
                      </select>
                      <button 
                        type="button"
                        onClick={handleAddMarriage}
                        className="px-4 py-2 bg-primary-olive text-white rounded-lg text-xs font-bold hover:bg-primary-olive/90 transition-all"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Section: Linimasa Hidup (Events) */}
              {editingId && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary-olive border-b border-primary-olive/20 pb-2 italic">Pengelola Linimasa Hidup</h3>
                  <div className="bg-surface rounded-xl border border-border-olive overflow-hidden">
                    <div className="p-4 space-y-3">
                      {individualEvents.map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-2.5 bg-bg rounded-lg border border-border-olive/30 group">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-primary-olive">{event.date}</span>
                            <span className="text-[13px] font-medium text-ink leading-tight">{event.description}</span>
                            {event.location && (
                              <span className="text-[10px] text-ink-light italic flex items-center gap-1 mt-0.5">
                                <MapPin size={10} /> {event.location}
                              </span>
                            )}
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {individualEvents.length === 0 && (
                        <p className="text-xs text-ink-light italic text-center py-2">Belum ada peristiwa khusus tercatat.</p>
                      )}
                    </div>
                    <div className="p-4 bg-bg border-t border-border-olive space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <input 
                          type="text"
                          placeholder="Tahun / Tanggal"
                          value={newEvent.date}
                          onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                          className="px-3 py-2 bg-white border border-border-olive rounded-lg text-xs focus:ring-1 focus:ring-primary-olive"
                        />
                        <input 
                          type="text"
                          placeholder="Lokasi (Opsional)"
                          value={newEvent.location}
                          onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                          className="col-span-2 px-3 py-2 bg-white border border-border-olive rounded-lg text-xs focus:ring-1 focus:ring-primary-olive"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Keterangan peristiwa (contoh: Mondok di...)"
                          value={newEvent.description}
                          onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                          className="flex-1 px-3 py-2 bg-white border border-border-olive rounded-lg text-xs focus:ring-1 focus:ring-primary-olive"
                        />
                        <button 
                          type="button"
                          onClick={handleAddEvent}
                          className="px-4 py-2 bg-primary-olive text-white rounded-lg text-xs font-bold hover:bg-primary-olive/90 transition-all shrink-0"
                        >
                          Tambah
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bio */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary-olive border-b border-primary-olive/20 pb-2">Biografi / Catatan</h3>
                <textarea
                  value={formData.bio || ''}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                  rows={3}
                  placeholder="Sejarah singkat..."
                />
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-border-olive flex gap-4 sticky bottom-0 bg-bg/30">
              <button
                type="submit"
                form="admin-form"
                disabled={loading}
                className="flex-1 py-3 bg-primary-olive text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-olive/90 transition-all shadow-lg shadow-primary-olive/20 font-sans"
              >
                <Save size={18} /> {loading ? 'Menyimpan...' : 'Simpan Data'}
              </button>
              
              {editingId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-100 transition-all"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
