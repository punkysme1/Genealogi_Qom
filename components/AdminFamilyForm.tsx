import React, { useState, useEffect } from 'react';
import { Family, Individual, LifeEvent } from '../types';
import { useFamily } from '../hooks/useFamilyData';

interface AdminFamilyFormProps {
  onSave: (family: any) => void;
  onClose: () => void;
  initialData?: Family | null;
}

const emptyFamily: Omit<Family, 'id'> = {
  spouse1Id: '',
  spouse2Id: '',
  childrenIds: [],
  marriage: { date: '', place: ''},
  divorce: { date: '', place: ''}
};

export const AdminFamilyForm: React.FC<AdminFamilyFormProps> = ({ onSave, onClose, initialData }) => {
  const [formData, setFormData] = useState<Omit<Family, 'id'> | Family>(initialData || emptyFamily);
  const { data: familyData } = useFamily();
  const individuals = Array.from(familyData.individuals.values());

  useEffect(() => {
    setFormData(initialData || emptyFamily);
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value || undefined }));
  };

  const handleChildrenChange = (childId: string) => {
      setFormData(prev => {
          const currentChildren = prev.childrenIds || [];
          const newChildren = currentChildren.includes(childId)
            ? currentChildren.filter(id => id !== childId)
            : [...currentChildren, childId];
          return { ...prev, childrenIds: newChildren };
      });
  };
  
  const handleEventChange = (e: React.ChangeEvent<HTMLInputElement>, eventType: 'marriage' | 'divorce', field: 'date' | 'place') => {
      const { value } = e.target;
      setFormData(prev => ({
          ...prev,
          [eventType]: {
              ...prev[eventType],
              [field]: value
          }
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Pasangan 1</label>
                <select name="spouse1Id" value={formData.spouse1Id || ''} onChange={handleChange} className="w-full bg-base-300 p-2 rounded-md">
                    <option value="">Pilih Individu</option>
                    {individuals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Pasangan 2</label>
                <select name="spouse2Id" value={formData.spouse2Id || ''} onChange={handleChange} className="w-full bg-base-300 p-2 rounded-md">
                    <option value="">Pilih Individu</option>
                    {individuals.filter(p => p.id !== formData.spouse1Id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
        </div>
      
        <fieldset className="border border-base-300 p-4 rounded-md">
            <legend className="px-2 font-semibold text-gray-300">Pernikahan</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input type="text" placeholder="Tanggal" value={formData.marriage?.date} onChange={e => handleEventChange(e, 'marriage', 'date')} className="w-full bg-base-100 p-2 rounded-md" />
                <input type="text" placeholder="Tempat" value={formData.marriage?.place} onChange={e => handleEventChange(e, 'marriage', 'place')} className="w-full bg-base-100 p-2 rounded-md" />
            </div>
        </fieldset>
      
        <fieldset className="border border-base-300 p-4 rounded-md">
            <legend className="px-2 font-semibold text-gray-300">Perceraian</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input type="text" placeholder="Tanggal" value={formData.divorce?.date} onChange={e => handleEventChange(e, 'divorce', 'date')} className="w-full bg-base-100 p-2 rounded-md" />
                <input type="text" placeholder="Tempat" value={formData.divorce?.place} onChange={e => handleEventChange(e, 'divorce', 'place')} className="w-full bg-base-100 p-2 rounded-md" />
            </div>
        </fieldset>

        <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Anak-anak</label>
            <div className="max-h-60 overflow-y-auto bg-base-300 p-4 rounded-md grid grid-cols-2 md:grid-cols-3 gap-2">
                {individuals
                    .filter(p => p.id !== formData.spouse1Id && p.id !== formData.spouse2Id)
                    .map(p => (
                    <label key={p.id} className="flex items-center space-x-2 p-1 rounded hover:bg-base-100">
                        <input
                            type="checkbox"
                            checked={formData.childrenIds?.includes(p.id)}
                            onChange={() => handleChildrenChange(p.id)}
                            className="form-checkbox h-4 w-4 text-primary bg-gray-700 border-gray-600 rounded"
                        />
                        <span>{p.name}</span>
                    </label>
                ))}
            </div>
        </div>

      <div className="flex justify-end space-x-4 pt-4">
        <button type="button" onClick={onClose} className="bg-base-300 hover:bg-opacity-80 text-white font-bold py-2 px-4 rounded-md">Batal</button>
        <button type="submit" className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-md">Simpan</button>
      </div>
    </form>
  );
};
