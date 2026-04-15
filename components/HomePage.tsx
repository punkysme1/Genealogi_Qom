
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFamily } from '../hooks/useFamilyData';
import { Individual, Gender } from '../types';
import { MaleIcon, FemaleIcon, SearchIcon } from './Icons';

const IndividualCard: React.FC<{ individual: Individual }> = ({ individual }) => {
    return (
        <Link to={`/individual/${individual.id}`} className="block bg-base-200 rounded-lg shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center p-4">
                <img className="h-20 w-20 rounded-full object-cover" src={individual.photoUrl || 'https://picsum.photos/seed/person/100/100'} alt={individual.name} />
                <div className="ml-4 flex-grow">
                    <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold text-white">{individual.name}</h3>
                        {individual.gender === Gender.Male ? <MaleIcon className="w-5 h-5 text-blue-400" /> : <FemaleIcon className="w-5 h-5 text-pink-400" />}
                    </div>
                    <p className="text-sm text-gray-400">{individual.profession || 'No profession listed'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {individual.birth?.date || '????'} - {individual.death?.date || '????'}
                    </p>
                </div>
            </div>
        </Link>
    );
};


export const HomePage: React.FC = () => {
    const { data } = useFamily();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredIndividuals = useMemo(() => {
        const individuals = Array.from(data.individuals.values());
        if (!searchTerm) {
            return individuals;
        }
        return individuals.filter(ind =>
            ind.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ind.birth?.date?.includes(searchTerm) ||
            ind.birth?.place?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data.individuals, searchTerm]);

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">Daftar Individu</h1>
                <p className="text-lg text-gray-400">Jelajahi semua individu dalam silsilah keluarga.</p>
            </div>
            <div className="relative mb-8">
                <input
                    type="text"
                    placeholder="Cari berdasarkan nama, tanggal, atau tempat..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-base-200 border border-base-300 rounded-lg py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <SearchIcon className="w-5 h-5 text-gray-400" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredIndividuals.map(individual => (
                    <IndividualCard key={individual.id} individual={individual} />
                ))}
            </div>
             {filteredIndividuals.length === 0 && (
                <div className="text-center py-16 col-span-full">
                    <p className="text-xl text-gray-500">Tidak ada hasil yang ditemukan.</p>
                </div>
             )}
        </div>
    );
};
