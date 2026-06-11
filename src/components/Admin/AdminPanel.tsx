import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Individual, Event, Marriage } from '@/types';
import { supabase } from '@/lib/supabase';
import { suggestHenryCode, findSpouse, generateGenealogyIDs, calculateGenerations } from '@/lib/genealogy';
import { cn, generateRandomSlug } from '@/lib/utils';
import { X, Save, Trash2, UserPlus, ShieldCheck, AlertCircle, Search, ChevronRight, ArrowLeft, MapPin, RefreshCcw, Upload, Settings, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  onClose: () => void;
  selectedIndividual?: Individual | null;
  actionType?: 'edit' | 'add_child';
  onRefresh: () => void;
}

export default function AdminPanel({ onClose, selectedIndividual: initialSelected, actionType = 'edit', onRefresh }: AdminPanelProps) {
  const [view, setView] = useState<'list' | 'form'>(initialSelected ? 'form' : 'list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [allIndividuals, setAllIndividuals] = useState<Individual[]>([]);
  const [allMarriages, setAllMarriages] = useState<Marriage[]>([]);
  const [searchListQuery, setSearchListQuery] = useState('');

  const filteredList = useMemo(() => {
    return allIndividuals.filter(ind => 
      ind.name.toLowerCase().includes(searchListQuery.toLowerCase())
    );
  }, [allIndividuals, searchListQuery]);

  const enrichedList = useMemo(() => {
    const { levels, ranks, shortestPaths } = calculateGenerations(allIndividuals, allMarriages);
    return filteredList.map(ind => ({
      ...ind,
      genData: generateGenealogyIDs(ind, allIndividuals, allMarriages, levels, ranks, shortestPaths, true)
    }));
  }, [filteredList, allIndividuals, allMarriages]);
  
  const [formData, setFormData] = useState<Partial<Individual>>({
    name: '',
    slug: '',
    gender: 'M',
    birth_date: '',
    death_date: '',
    birth_place: '',
    death_place: '',
    current_location: '',
    occupation: '',
    is_alive: true,
    is_verified: false,
    verified_by: '',
    verification_type: 'Manuskrip',
    verification_source: '',
    economic_status: 'Menengah',
    profile_photo_url: '',
    father_id: '',
    mother_id: '',
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState(() => {
    return (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || localStorage.getItem('cloudinary_cloud_name') || '';
  });
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState(() => {
    return (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string) || localStorage.getItem('cloudinary_upload_preset') || '';
  });
  const [showCloudinaryConfig, setShowCloudinaryConfig] = useState(false);
  const [uploadingField, setUploadingField] = useState<'profile_photo_url' | 'verification_source' | null>(null);

  const [cloudinaryTempConfig, setCloudinaryTempConfig] = useState({
    cloudName: '',
    uploadPreset: ''
  });

  const handleSaveCloudinaryConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setCloudinaryCloudName(cloudinaryTempConfig.cloudName);
    setCloudinaryUploadPreset(cloudinaryTempConfig.uploadPreset);
    localStorage.setItem('cloudinary_cloud_name', cloudinaryTempConfig.cloudName);
    localStorage.setItem('cloudinary_upload_preset', cloudinaryTempConfig.uploadPreset);
    setShowCloudinaryConfig(false);
    
    // Trigger file selection if we were waiting for setup
    if (uploadingField === 'profile_photo_url') {
      setTimeout(() => photoInputRef.current?.click(), 200);
    } else if (uploadingField === 'verification_source') {
      setTimeout(() => docInputRef.current?.click(), 200);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>, field: 'profile_photo_url' | 'verification_source') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
      setUploadingField(field);
      setCloudinaryTempConfig({
        cloudName: cloudinaryCloudName,
        uploadPreset: cloudinaryUploadPreset
      });
      setShowCloudinaryConfig(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('upload_preset', cloudinaryUploadPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
        method: 'POST',
        body: formDataUpload,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Gagal mengupload ke Cloudinary.');
      }

      const data = await res.json();
      const secureUrl = data.secure_url;

      setFormData(prev => ({
        ...prev,
        [field]: secureUrl
      }));
      
      e.target.value = '';
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(`Gagal Upload: ${err.message || 'Periksa konfigurasi Cloudinary Anda.'}`);
    } finally {
      setLoading(false);
      setUploadingField(null);
    }
  };

  const [editingId, setEditingId] = useState<string | null>(initialSelected?.id || null);
  const [marriages, setMarriages] = useState<any[]>([]);
  const [newSpouseId, setNewSpouseId] = useState('');
  const [newMarriageDate, setNewMarriageDate] = useState('');
  const [individualEvents, setIndividualEvents] = useState<any[]>([]);
  const [newEvent, setNewEvent] = useState({
    description: '',
    date: '',
    location: '',
    type: 'other' as const
  });

  useEffect(() => {
    fetchAllIndividuals();
    fetchAllMarriages();
  }, []);

  const fetchAllIndividuals = async () => {
    const { data } = await supabase.from('individuals').select('*').order('name');
    if (data) {
      const uniqueData = Array.from(new Map(data.map(i => [i.id, i])).values());
      setAllIndividuals(uniqueData);
    }
  };

  const fetchAllMarriages = async () => {
    const { data } = await supabase.from('marriages').select('*');
    if (data) {
      const uniqueData = Array.from(new Map(data.map(m => [m.id, m])).values());
      setAllMarriages(uniqueData);
    }
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
    if (data) {
      const uniqueMarriages = Array.from(new Map(data.map(m => [m.id, m])).values());
      setMarriages(uniqueMarriages);
    }
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
        marriage_date: newMarriageDate || null,
        is_active: true
      };
      
      const { error } = await supabase.from('marriages').insert([marriageData]);
      if (error) throw error;
      
      fetchMarriages(editingId);
      setNewSpouseId('');
      setNewMarriageDate('');
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
      slug: '',
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

  // Auto-sync is_alive and death_date
  useEffect(() => {
    if (formData.death_date && formData.death_date !== '' && formData.is_alive !== false) {
      setFormData(prev => ({ ...prev, is_alive: false }));
    }
  }, [formData.death_date]);

  useEffect(() => {
    if (formData.is_alive === true && formData.death_date !== '') {
      setFormData(prev => ({ ...prev, death_date: '' }));
    }
  }, [formData.is_alive]);

  useEffect(() => {
    if (initialSelected) {
      if (actionType === 'add_child') {
        const isMale = initialSelected.gender === 'M';
        setFormData({
          name: '',
          slug: '',
          gender: 'M',
          birth_date: '',
          death_date: '',
          birth_place: '',
          death_place: '',
          current_location: '',
          occupation: '',
          is_alive: true,
          is_verified: false,
          verified_by: '',
          verification_type: 'Manuskrip',
          verification_source: '',
          economic_status: 'Menengah',
          profile_photo_url: '',
          father_id: isMale ? initialSelected.id : '',
          mother_id: isMale ? '' : initialSelected.id,
        });
        setEditingId(null);
        setView('form');
      } else {
        setFormData(initialSelected);
        setEditingId(initialSelected.id);
        setView('form');
      }
    }
  }, [initialSelected, actionType]);

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
      // Ensure slug is generated if missing for new entry
      let currentSlug = formData.slug;
      if (!editingId && (!currentSlug || currentSlug.trim() === '')) {
        currentSlug = generateRandomSlug(8);
      }

      // Strip virtual fields that don't exist in the database schema
      const { 
        id, 
        created_at, 
        updated_at, 
        baseId, 
        displayId, 
        shortestPath, 
        alphaPaths,
        genData,
        level,
        rank,
        pathIds,
        ...dataToSubmit 
      } = { ...formData, slug: currentSlug } as any;
      
      if (dataToSubmit.father_id === '') dataToSubmit.father_id = null;
      if (dataToSubmit.mother_id === '') dataToSubmit.mother_id = null;
      if (dataToSubmit.birth_date === '') dataToSubmit.birth_date = null;
      if (dataToSubmit.death_date === '') dataToSubmit.death_date = null;
      if (dataToSubmit.verified_by === '') dataToSubmit.verified_by = null;
      if (dataToSubmit.is_alive === undefined) dataToSubmit.is_alive = true;
      if (dataToSubmit.birth_place === '') dataToSubmit.birth_place = null;
      if (dataToSubmit.death_place === '') dataToSubmit.death_place = null;
      if (dataToSubmit.current_location === '') dataToSubmit.current_location = null;
      if (dataToSubmit.occupation === '') dataToSubmit.occupation = null;
      if (dataToSubmit.bio === '') dataToSubmit.bio = null;
      if (dataToSubmit.profile_photo_url === '') dataToSubmit.profile_photo_url = null;
      if (dataToSubmit.verification_source === '') dataToSubmit.verification_source = null;

      if (editingId) {
        const { error } = await supabase.from('individuals').update(dataToSubmit).eq('id', editingId);
        if (error) {
          // If slug column is the problem, try without it as fallback but warn
          if (error.message.includes('slug') || error.code === 'PGRST116') {
            const { slug: _, ...noSlugData } = dataToSubmit;
            const { error: retryError } = await supabase.from('individuals').update(noSlugData).eq('id', editingId);
            if (retryError) throw retryError;
            setError('Catatan: Kolom "slug" tidak ditemukan di database. Data disimpan tanpa slug.');
          } else {
            throw error;
          }
        }
      } else {
        const { error } = await supabase.from('individuals').insert([dataToSubmit]);
        if (error) {
          // Fallback if slug column missing
          if (error.message.includes('slug') || error.code === 'PGRST116') {
            const { slug: _, ...noSlugData } = dataToSubmit;
            const { error: retryError } = await supabase.from('individuals').insert([noSlugData]);
            if (retryError) throw retryError;
            setError('Catatan: Kolom "slug" tidak ditemukan di database. Data disimpan tanpa slug.');
          } else {
            throw error;
          }
        }
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

  const handleAddChildFor = (ind: Individual) => {
    const isMale = ind.gender === 'M';
    setFormData({
      name: '',
      slug: '',
      gender: 'M',
      birth_date: '',
      death_date: '',
      birth_place: '',
      death_place: '',
      current_location: '',
      occupation: '',
      is_alive: true,
      is_verified: false,
      verified_by: '',
      verification_type: 'Manuskrip',
      verification_source: '',
      economic_status: 'Menengah',
      profile_photo_url: '',
      father_id: isMale ? ind.id : '',
      mother_id: isMale ? '' : ind.id,
    });
    setEditingId(null);
    setView('form');
  };

  const handleAddNew = () => {
    setFormData({
      name: '',
      slug: '',
      gender: 'M',
      birth_date: '',
      death_date: '',
      birth_place: '',
      death_place: '',
      current_location: '',
      occupation: '',
      is_alive: true,
      is_verified: false,
      verified_by: '',
      verification_type: 'Manuskrip',
      verification_source: '',
      economic_status: 'Menengah',
      profile_photo_url: '',
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
              {enrichedList.map(ind => (
                <div 
                  key={ind.id}
                  className="w-full flex items-center justify-between p-3 bg-white border border-border-olive rounded-xl hover:border-primary-olive transition-all group"
                >
                  <button 
                    onClick={() => handleEditClick(ind)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent-tan/20 flex items-center justify-center text-primary-olive font-bold text-xs shrink-0">
                      {ind.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink group-hover:text-primary-olive transition-colors">{ind.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-mono font-bold bg-primary-olive/10 text-primary-olive px-1 rounded border border-primary-olive/20 uppercase">
                          {ind.genData.displayId || 'ID_PENDING'}
                        </span>
                        <span className="text-[9px] font-mono text-ink-light uppercase">
                          {ind.genData.baseId}
                        </span>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <button
                      type="button"
                      onClick={() => handleAddChildFor(ind)}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-200/50 transition-colors shadow-xs"
                      title={`Tambah keturunan langsung untuk ${ind.name}`}
                    >
                      + Anak
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleEditClick(ind)}
                      className="text-border-olive hover:text-primary-olive transition-colors"
                      title="Edit data individu"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
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
                        <option key={i.id} value={i.id}>{i.name}</option>
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
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink-light mb-1.5 flex items-center justify-between">
                      <span>Status Kehidupan</span>
                      <span className={formData.is_alive ? "text-emerald-600 font-black" : "text-rose-600 font-black"}>
                        {formData.is_alive ? 'MASIH HIDUP' : 'SUDAH WAFAT'}
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, is_alive: true})}
                        className={cn(
                          "py-2.5 rounded-lg border text-xs font-bold transition-all",
                          formData.is_alive ? "bg-emerald-500 text-white border-emerald-600" : "bg-white text-emerald-600 border-border-olive"
                        )}
                      >
                        Hidup
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, is_alive: false})}
                        className={cn(
                          "py-2.5 rounded-lg border text-xs font-bold transition-all",
                          !formData.is_alive ? "bg-rose-500 text-white border-rose-600" : "bg-white text-rose-600 border-border-olive"
                        )}
                      >
                        Wafat
                      </button>
                    </div>
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
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink-light mb-1.5 flex justify-between items-center">
                      <span>Custom Slug (Alfanumerik)</span>
                      <button 
                        type="button"
                        onClick={() => setFormData({ ...formData, slug: generateRandomSlug(8) })}
                        className="text-[9px] text-primary-olive hover:underline flex items-center gap-1"
                      >
                        <RefreshCcw size={10} /> Acak Slug
                      </button>
                    </label>
                    <input
                      value={formData.slug || ''}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none font-mono"
                      placeholder="e.g. x7y2z9a1"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink-light mb-1.5 flex justify-between items-center">
                      <span>Foto Profil (URL)</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setCloudinaryTempConfig({ cloudName: cloudinaryCloudName, uploadPreset: cloudinaryUploadPreset });
                          setUploadingField(null);
                          setShowCloudinaryConfig(true);
                        }}
                        className="text-[10px] text-primary-olive hover:underline flex items-center gap-1 font-medium"
                        title="Metode Cloudinary Upload Setup"
                      >
                        <Settings size={11} /> Setup Cloudinary
                      </button>
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={formData.profile_photo_url || ''}
                        onChange={(e) => setFormData({ ...formData, profile_photo_url: e.target.value })}
                        className="flex-1 px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none"
                        placeholder="https://example.com/photo.jpg"
                      />
                      <input 
                        type="file" 
                        ref={photoInputRef} 
                        onChange={(e) => handleUploadFile(e, 'profile_photo_url')}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => photoInputRef.current?.click()}
                        className="px-4 bg-accent-tan/20 border border-accent-tan/30 text-primary-olive text-xs font-bold rounded-lg hover:bg-accent-tan/30 transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                      >
                        {uploadingField === 'profile_photo_url' ? (
                          <Loader2 size={14} className="animate-spin text-primary-olive" />
                        ) : (
                          <Upload size={14} />
                        )}
                        Unggah Foto
                      </button>
                    </div>
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
                    <label className="block text-xs font-bold text-ink-light mb-1.5 underline decoration-accent-tan underline-offset-4">Alfanumerik / Kode Generasi (Auto)</label>
                    <div className="px-4 py-2.5 bg-bg border border-dashed border-border-olive rounded-lg text-sm text-ink-light italic flex gap-2">
                       <span className="font-bold text-primary-olive">{(formData as any).genData?.displayId || '?'}</span>
                       <span className="opacity-50">{(formData as any).genData?.baseId || '?'}</span>
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
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink-light mb-1.5 italic underline decoration-primary-olive/30">Status Ekonomi & Pekerjaan (Hanya Admin)</label>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {['Miskin', 'Menengah', 'Kaya'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setFormData({ ...formData, economic_status: status as any })}
                          className={cn(
                            "py-2 rounded-lg border text-[10px] font-bold transition-all",
                            formData.economic_status === status 
                              ? "bg-primary-olive text-white border-primary-olive" 
                              : "bg-white text-primary-olive border-border-olive"
                          )}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                    <input
                      value={formData.occupation || ''}
                      onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-border-olive rounded-lg text-xs focus:ring-1 focus:ring-primary-olive focus:outline-none placeholder:italic"
                      placeholder="Pekerjaan / Jabatan..."
                    />
                  </div>
                </div>
              </div>

              {/* Section: Verifikasi */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary-olive border-b border-primary-olive/20 pb-2">Sistem Verifikasi Berlapis</h3>
                <div className="bg-surface p-5 rounded-xl border border-border-olive space-y-4 shadow-inner-white">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.is_verified}
                      onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                      className="w-5 h-5 rounded border-border-olive text-primary-olive focus:ring-primary-olive"
                    />
                    <span className="text-sm font-bold text-ink italic">Tandai sebagai data terverifikasi</span>
                  </div>
                  
                  {formData.is_verified && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 gap-4 pt-2 border-t border-border-olive/30"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-ink-light mb-1.5 uppercase">Sumber Verifikasi</label>
                          <select
                            value={formData.verification_type || 'Manuskrip'}
                            onChange={(e) => setFormData({ ...formData, verification_type: e.target.value as any })}
                            className="w-full px-3 py-2 bg-white border border-border-olive rounded-lg text-xs focus:ring-1 focus:ring-primary-olive focus:outline-none font-bold"
                          >
                            <option value="Manuskrip">Manuskrip</option>
                            <option value="Dokumen">Dokumen</option>
                            <option value="Verifikator">Verifikator</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-ink-light mb-1.5 uppercase">Nama Verifikator/Pemaraf</label>
                          <input
                            value={formData.verified_by || ''}
                            onChange={(e) => setFormData({ ...formData, verified_by: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-border-olive rounded-lg text-xs focus:ring-1 focus:ring-primary-olive focus:outline-none font-mono"
                            placeholder="E.g. Tim Ittihaf"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-ink-light mb-1.5 uppercase flex justify-between items-center">
                          <span>Referensi Sumber (Judul Buku/Kode Dokumen)</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            value={formData.verification_source || ''}
                            onChange={(e) => setFormData({ ...formData, verification_source: e.target.value })}
                            className="flex-1 px-3 py-2 bg-white border border-border-olive rounded-lg text-xs focus:ring-1 focus:ring-primary-olive focus:outline-none italic"
                            placeholder="E.g. Manuskrip Kertojoyo Bagian A3"
                          />
                          <input 
                            type="file" 
                            ref={docInputRef} 
                            onChange={(e) => handleUploadFile(e, 'verification_source')}
                            accept="image/*,application/pdf"
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => docInputRef.current?.click()}
                            className="px-3 bg-accent-tan/20 border border-accent-tan/30 text-primary-olive text-[11px] font-bold rounded-lg hover:bg-accent-tan/30 transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                          >
                            {uploadingField === 'verification_source' ? (
                              <Loader2 size={12} className="animate-spin text-primary-olive" />
                            ) : (
                              <Upload size={12} />
                            )}
                            Unggah Dokumen
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
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
                              {m.marriage_date && (
                                <span className="text-[10px] text-primary-olive font-bold mt-0.5">Tgl Menikah: {new Date(m.marriage_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                              )}
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
                    <div className="p-4 bg-bg border-t border-border-olive space-y-2">
                      <div className="flex gap-2">
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
                        <input 
                          type="date"
                          value={newMarriageDate}
                          onChange={(e) => setNewMarriageDate(e.target.value)}
                          className="w-32 px-3 py-2 bg-white border border-border-olive rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-olive"
                          title="Tanggal Pernikahan"
                        />
                        <button 
                          type="button"
                          onClick={handleAddMarriage}
                          className="px-4 py-2 bg-primary-olive text-white rounded-lg text-xs font-bold hover:bg-primary-olive/90 transition-all font-sans"
                        >
                          Tambah
                        </button>
                      </div>
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

      {/* Cloudinary Integration Config Modal */}
      <AnimatePresence>
        {showCloudinaryConfig && (
          <div className="fixed inset-0 bg-ink/65 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full border border-border-olive font-sans relative"
            >
              <button 
                type="button"
                onClick={() => setShowCloudinaryConfig(false)}
                className="absolute top-4 right-4 p-1 hover:bg-bg rounded-full transition-colors text-ink-light"
              >
                <X size={18} />
              </button>
              
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent-tan/20 flex items-center justify-center text-primary-olive">
                  <Settings size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-ink text-base">Konfigurasi Cloudinary</h3>
                  <p className="text-[10px] text-ink-light italic">Unsigned Upload integration</p>
                </div>
              </div>

              <div className="bg-bg p-3.5 rounded-xl border border-border-olive/40 text-xs text-ink mb-5 space-y-1.5 leading-relaxed">
                <p className="font-semibold text-primary-olive">Cara mendapatkan info ini:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Masuk/Daftar ke akun gratis Anda di <span className="font-mono text-primary-olive text-[11px]">cloudinary.com</span></li>
                  <li>Ambil <span className="font-medium text-ink">Cloud Name</span> Anda dari dasbor utama.</li>
                  <li>Buka <span className="font-medium text-ink">Settings (ikon gerigi) &gt; Upload</span>, gulir ke bawah ke <span className="font-medium text-ink">Upload Presets</span>.</li>
                  <li>Buat preset baru, pastikan Signing Mode diatur ke <span className="font-bold text-amber-700">Unsigned</span>. Salin Nama Preset tersebut.</li>
                </ol>
              </div>

              <form onSubmit={handleSaveCloudinaryConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-ink-light mb-1.5 uppercase">Cloud Name</label>
                  <input 
                    required
                    type="text"
                    value={cloudinaryTempConfig.cloudName}
                    onChange={(e) => setCloudinaryTempConfig({ ...cloudinaryTempConfig, cloudName: e.target.value.trim() })}
                    placeholder="e.g. dkarruwdb"
                    className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-light mb-1.5 uppercase">Upload Preset (Unsigned)</label>
                  <input 
                    required
                    type="text"
                    value={cloudinaryTempConfig.uploadPreset}
                    onChange={(e) => setCloudinaryTempConfig({ ...cloudinaryTempConfig, uploadPreset: e.target.value.trim() })}
                    placeholder="e.g. preset_unsigned_123"
                    className="w-full px-4 py-2.5 bg-surface border border-border-olive rounded-lg text-sm focus:ring-1 focus:ring-primary-olive focus:outline-none font-mono"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCloudinaryConfig(false)}
                    className="flex-1 py-2.5 border border-border-olive text-ink-light font-bold rounded-lg text-xs hover:bg-bg transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-primary-olive text-white font-bold rounded-lg text-xs hover:bg-primary-olive/95 transition-all shadow-sm"
                  >
                    Simpan & Lanjutkan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
