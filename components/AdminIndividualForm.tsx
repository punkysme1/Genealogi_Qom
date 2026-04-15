
import React, { useState, useEffect } from 'react';
import { Individual, Gender, Family, DetailEntry } from '../types';
import { useFamily } from '../hooks/useFamilyData';
import { DeleteIcon, PlusIcon } from './Icons';

interface AdminIndividualFormProps {
  onSave: (individual: any) => void;
  onClose: () => void;
  initialData?: Individual | null;
}

const emptyIndividual: Omit<Individual, 'id'> = {
  name: '',
  gender: Gender.Male,
  photoUrl: '',
  birth: { date: '', place: '' },
  death: { date: '', place: '' },
  description: '',
  profession: '',
  notes: '',
  childInFamilyId: '',
  education: [],
  works: [],
  sources: [],
  references: [],
};

const DetailEntrySection: React.FC<{
  title: string;
  entries: DetailEntry[];
  updateEntries: (entries: DetailEntry[]) => void;
}> = ({ title, entries, updateEntries }) => {

  const addEntry = () => {
    const newEntry: DetailEntry = { id: `detail-${Date.now()}`, title: '', description: '', period: '' };
    updateEntries([...entries, newEntry]);
  };

  const removeEntry = (id: string) => {
    updateEntries(entries.filter(entry => entry.id !== id));
  };
  
  const handleEntryChange = (id: string, field: keyof DetailEntry, value: string) => {
      const updatedEntries = entries.map(entry => 
        entry.id === id ? { ...entry, [field]: value } : entry
      );
      updateEntries(updatedEntries);
  };

  return (
    <fieldset className="border border-base-300 p-4 rounded-md space-y-4">
      <legend className="px-2 font-semibold text-gray-300">{title}</legend>
      {entries.map((entry, index) => (
        <div key={entry.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 bg-base-100/50 rounded">
            <input type="text" placeholder="Judul/Institusi" value={entry.title} onChange={e => handleEntryChange(entry.id, 'title', e.target.value)} className="w-full bg-base-300 p-2 rounded-md" />
            <input type="text" placeholder="Deskripsi/URL" value={entry.description} onChange={e => handleEntryChange(entry.id, 'description', e.target.value)} className="w-full bg-base-300 p-2 rounded-md" />
            <div className="flex items-center gap-2">
                <input type="text" placeholder="Periode" value={entry.period} onChange={e => handleEntryChange(entry.id, 'period', e.target.value)} className="w-full bg-base-300 p-2 rounded-md" />
                <button type="button" onClick={() => removeEntry(entry.id)} className="p-2 text-error hover:text-red-400">
                    <DeleteIcon className="w-5 h-5"/>
                </button>
            </div>
        </div>
      ))}
      <button type="button" onClick={addEntry} className="flex items-center text-sm bg-accent/20 hover:bg-accent/40 text-accent font-semibold py-1 px-3 rounded-md">
        <PlusIcon className="w-4 h-4 mr-1"/> Tambah {title}
      </button>
    </fieldset>
  );
};


export const AdminIndividualForm: React.FC<AdminIndividualFormProps> = ({ onSave, onClose, initialData }) => {
  const [formData, setFormData] = useState<Omit<Individual, 'id'> | Individual>(initialData ? JSON.parse(JSON.stringify(initialData)) : emptyIndividual);
  const { data: familyData } = useFamily();

  useEffect(() => {
    setFormData(initialData ? JSON.parse(JSON.stringify(initialData)) : emptyIndividual);
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEventChange = (e: React.ChangeEvent<HTMLInputElement>, eventType: 'birth' | 'death', field: 'date' | 'place') => {
      const { value } = e.target;
      setFormData(prev => ({
          ...prev,
          [eventType]: {
              ...(prev[eventType] || {}),
              [field]: value
          }
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const renderFamilyOption = (family: Family) => {
    const spouse1 = family.spouse1Id ? familyData.individuals.get(family.spouse1Id)?.name : 'N/A';
    const spouse2 = family.spouse2Id ? familyData.individuals.get(family.spouse2Id)?.name : 'N/A';
    return `Family of ${spouse1} & ${spouse2} (${family.id})`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Nama</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-base-300 p-2 rounded-md" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Jenis Kelamin</label>
          <select name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-base-300 p-2 rounded-md">
            {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">URL Foto</label>
          <input type="text" name="photoUrl" value={formData.photoUrl || ''} onChange={handleChange} className="w-full bg-base-300 p-2 rounded-md" />
        </div>
         <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Profesi</label>
          <input type="text" name="profession" value={formData.profession || ''} onChange={handleChange} className="w-full bg-base-300 p-2 rounded-md" />
        </div>
      </div>

      <fieldset className="border border-base-300 p-4 rounded-md">
        <legend className="px-2 font-semibold text-gray-300">Kelahiran</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input type="text" placeholder="Tanggal (e.g., 21 Apr 1926)" value={formData.birth?.date || ''} onChange={e => handleEventChange(e, 'birth', 'date')} className="w-full bg-base-100 p-2 rounded-md" />
            <input type="text" placeholder="Tempat" value={formData.birth?.place || ''} onChange={e => handleEventChange(e, 'birth', 'place')} className="w-full bg-base-100 p-2 rounded-md" />
        </div>
      </fieldset>
      
      <fieldset className="border border-base-300 p-4 rounded-md">
        <legend className="px-2 font-semibold text-gray-300">Kematian</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input type="text" placeholder="Tanggal" value={formData.death?.date || ''} onChange={e => handleEventChange(e, 'death', 'date')} className="w-full bg-base-100 p-2 rounded-md" />
            <input type="text" placeholder="Tempat" value={formData.death?.place || ''} onChange={e => handleEventChange(e, 'death', 'place')} className="w-full bg-base-100 p-2 rounded-md" />
        </div>
      </fieldset>
      
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Anak dari Keluarga</label>
        <select name="childInFamilyId" value={formData.childInFamilyId || ''} onChange={handleChange} className="w-full bg-base-300 p-2 rounded-md">
            <option value="">Tidak ada</option>
            {Array.from(familyData.families.values()).map(f => (
                <option key={f.id} value={f.id}>{renderFamilyOption(f)}</option>
            ))}
        </select>
      </div>

      <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Deskripsi</label>
          <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={3} className="w-full bg-base-300 p-2 rounded-md" />
      </div>
       <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Catatan</label>
          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} className="w-full bg-base-300 p-2 rounded-md" />
      </div>
      
      <DetailEntrySection title="Pendidikan" entries={formData.education || []} updateEntries={(e) => setFormData(prev => ({...prev, education: e}))} />
      <DetailEntrySection title="Karya" entries={formData.works || []} updateEntries={(e) => setFormData(prev => ({...prev, works: e}))} />
      <DetailEntrySection title="Sumber" entries={formData.sources || []} updateEntries={(e) => setFormData(prev => ({...prev, sources: e}))} />
      <DetailEntrySection title="Referensi" entries={formData.references || []} updateEntries={(e) => setFormData(prev => ({...prev, references: e}))} />


      <div className="flex justify-end space-x-4 pt-4">
        <button type="button" onClick={onClose} className="bg-base-300 hover:bg-opacity-80 text-white font-bold py-2 px-4 rounded-md">Batal</button>
        <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-md">Simpan</button>
      </div>
    </form>
  );
};
