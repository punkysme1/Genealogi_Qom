import React, { useState } from 'react';
import { useFamily } from '../hooks/useFamilyData';
import { Individual, Family } from '../types';
import { EditIcon, DeleteIcon, PlusIcon } from './Icons';
import { Modal } from './Modal';
import { AdminIndividualForm } from './AdminIndividualForm';
import { AdminFamilyForm } from './AdminFamilyForm';

export const AdminPage: React.FC = () => {
    const { data, addIndividual, updateIndividual, deleteIndividual, addFamily, updateFamily, deleteFamily } = useFamily();

    const [isIndividualModalOpen, setIndividualModalOpen] = useState(false);
    const [isFamilyModalOpen, setFamilyModalOpen] = useState(false);
    const [editingIndividual, setEditingIndividual] = useState<Individual | null>(null);
    const [editingFamily, setEditingFamily] = useState<Family | null>(null);

    const individuals = Array.from(data.individuals.values());
    const families = Array.from(data.families.values());

    const openIndividualModal = (individual: Individual | null = null) => {
        setEditingIndividual(individual);
        setIndividualModalOpen(true);
    };

    const openFamilyModal = (family: Family | null = null) => {
        setEditingFamily(family);
        setFamilyModalOpen(true);
    };

    const handleSaveIndividual = (individualData: Individual | Omit<Individual, 'id'>) => {
        if ('id' in individualData) {
            updateIndividual(individualData as Individual);
        } else {
            addIndividual(individualData as Omit<Individual, 'id'>);
        }
        setIndividualModalOpen(false);
    };

    const handleSaveFamily = (familyData: Family | Omit<Family, 'id'>) => {
        if ('id' in familyData) {
            updateFamily(familyData as Family);
        } else {
            addFamily(familyData as Omit<Family, 'id'>);
        }
        setFamilyModalOpen(false);
    };
    
    const handleDeleteIndividual = (id: string) => {
        if(window.confirm("Apakah Anda yakin ingin menghapus individu ini? Tindakan ini tidak dapat diurungkan.")){
            deleteIndividual(id);
        }
    };
    
    const handleDeleteFamily = (id: string) => {
        if(window.confirm("Apakah Anda yakin ingin menghapus keluarga ini? Ini akan menghapus hubungan pasangan dan orang tua-anak.")){
            deleteFamily(id);
        }
    };

    const getSpouseName = (id?: string) => id ? data.individuals.get(id)?.name : 'N/A';

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-4xl font-bold text-white mb-8">Panel Admin</h1>

            {/* Individuals Section */}
            <div className="bg-base-200 p-6 rounded-lg shadow-xl mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Kelola Individu</h2>
                    <button onClick={() => openIndividualModal()} className="flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-md">
                        <PlusIcon className="w-5 h-5 mr-2" /> Tambah Individu
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-base-300">
                                <th className="p-3">Nama</th>
                                <th className="p-3 hidden md:table-cell">Tanggal Lahir</th>
                                <th className="p-3 hidden md:table-cell">Tanggal Meninggal</th>
                                <th className="p-3">Tindakan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {individuals.map(ind => (
                                <tr key={ind.id} className="border-b border-base-300 hover:bg-base-300/50">
                                    <td className="p-3 font-medium">{ind.name}</td>
                                    <td className="p-3 hidden md:table-cell">{ind.birth?.date || '-'}</td>
                                    <td className="p-3 hidden md:table-cell">{ind.death?.date || '-'}</td>
                                    <td className="p-3 flex items-center space-x-2">
                                        <button onClick={() => openIndividualModal(ind)} className="p-2 text-blue-400 hover:text-blue-300"><EditIcon/></button>
                                        <button onClick={() => handleDeleteIndividual(ind.id)} className="p-2 text-error hover:text-red-400"><DeleteIcon/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Families Section */}
            <div className="bg-base-200 p-6 rounded-lg shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Kelola Keluarga</h2>
                    <button onClick={() => openFamilyModal()} className="flex items-center bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-md">
                        <PlusIcon className="w-5 h-5 mr-2" /> Tambah Keluarga
                    </button>
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-base-300">
                                <th className="p-3">Pasangan 1</th>
                                <th className="p-3">Pasangan 2</th>
                                <th className="p-3 hidden md:table-cell">Jumlah Anak</th>
                                <th className="p-3">Tindakan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {families.map(fam => (
                                <tr key={fam.id} className="border-b border-base-300 hover:bg-base-300/50">
                                    <td className="p-3 font-medium">{getSpouseName(fam.spouse1Id)}</td>
                                    <td className="p-3 font-medium">{getSpouseName(fam.spouse2Id)}</td>
                                    <td className="p-3 hidden md:table-cell">{fam.childrenIds.length}</td>
                                    <td className="p-3 flex items-center space-x-2">
                                        <button onClick={() => openFamilyModal(fam)} className="p-2 text-blue-400 hover:text-blue-300"><EditIcon/></button>
                                        <button onClick={() => handleDeleteFamily(fam.id)} className="p-2 text-error hover:text-red-400"><DeleteIcon/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isIndividualModalOpen} onClose={() => setIndividualModalOpen(false)} title={editingIndividual ? 'Edit Individu' : 'Tambah Individu Baru'}>
                <AdminIndividualForm 
                    onSave={handleSaveIndividual} 
                    onClose={() => setIndividualModalOpen(false)} 
                    initialData={editingIndividual}
                />
            </Modal>
            
            <Modal isOpen={isFamilyModalOpen} onClose={() => setFamilyModalOpen(false)} title={editingFamily ? 'Edit Keluarga' : 'Tambah Keluarga Baru'}>
                <AdminFamilyForm
                    onSave={handleSaveFamily}
                    onClose={() => setFamilyModalOpen(false)}
                    initialData={editingFamily}
                />
            </Modal>
        </div>
    );
};
