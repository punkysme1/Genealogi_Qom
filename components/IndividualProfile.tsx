
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFamily } from '../hooks/useFamilyData';
import { Individual, Family, LifeEvent, Gender, DetailEntry } from '../types';
import { MaleIcon, FemaleIcon } from './Icons';

const EventCard: React.FC<{ title: string; event?: LifeEvent; detail?: string }> = ({ title, event, detail }) => {
    if (!event?.date && !event?.place && !detail) return null;
    return (
        <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-24 text-right">
                <p className="text-sm font-semibold text-gray-400">{title}</p>
                <p className="text-sm text-gray-500">{event?.date || 'Unknown date'}</p>
            </div>
            <div className="relative flex-shrink-0">
                <div className="h-full w-0.5 bg-base-300"></div>
                <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-accent rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-base-100"></div>
            </div>
            <div className="flex-grow pb-8">
                <p className="font-medium text-gray-300">{detail || event?.place || 'Unknown location'}</p>
            </div>
        </div>
    );
};

const FamilyMemberLink: React.FC<{ individual?: Individual, relationship?: string }> = ({ individual, relationship }) => {
    if (!individual) return null;
    return (
        <Link to={`/individual/${individual.id}`} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-base-300 transition-colors">
            <img src={individual.photoUrl || 'https://picsum.photos/seed/person/50/50'} alt={individual.name} className="w-10 h-10 rounded-full object-cover" />
            <div>
                <p className="font-semibold text-white">{individual.name}</p>
                {relationship && <p className="text-sm text-gray-400">{relationship}</p>}
            </div>
        </Link>
    );
};

const DescendantTree: React.FC<{ descendants: any[] }> = ({ descendants }) => {
    if (descendants.length === 0) return null;
    return (
        <ul className="pl-6 border-l border-base-300 space-y-2">
            {descendants.map(desc => (
                <li key={desc.id}>
                    <FamilyMemberLink individual={desc} relationship="Keturunan" />
                    <DescendantTree descendants={desc.children} />
                </li>
            ))}
        </ul>
    );
};

const DetailSection: React.FC<{title: string, items?: DetailEntry[]}> = ({ title, items}) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="mb-8">
            <h3 className="text-xl font-bold text-white mb-4 border-b border-base-300 pb-2">{title}</h3>
            <ul className="space-y-4">
                {items.map(item => (
                    <li key={item.id} className="bg-base-100/50 p-4 rounded-lg">
                        <p className="font-semibold text-accent">{item.title} {item.period && <span className="text-gray-400 font-normal text-sm">({item.period})</span>}</p>
                        <p className="text-gray-300 whitespace-pre-wrap">{item.description}</p>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export const IndividualProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { data } = useFamily();
    const [activeTab, setActiveTab] = useState('overview');

    if (!id || !data.individuals.has(id)) {
        return <div className="text-center p-8 text-xl text-error">Individu tidak ditemukan.</div>;
    }

    const individual = data.individuals.get(id)!;

    const parentFamily = individual.childInFamilyId ? data.families.get(individual.childInFamilyId) : undefined;
    const parents = {
        father: parentFamily?.spouse1Id ? data.individuals.get(parentFamily.spouse1Id) : undefined,
        mother: parentFamily?.spouse2Id ? data.individuals.get(parentFamily.spouse2Id) : undefined,
    };

    const spouseFamilies = Array.from(data.families.values()).filter(f => f.spouse1Id === id || f.spouse2Id === id);

    const getDescendants = (personId: string): any[] => {
        const descendantsList: any[] = [];
        const familiesAsSpouse = Array.from(data.families.values()).filter(f => f.spouse1Id === personId || f.spouse2Id === personId);
        
        for (const family of familiesAsSpouse) {
            for (const childId of family.childrenIds) {
                const child = data.individuals.get(childId);
                if (child) {
                    descendantsList.push({
                        ...child,
                        children: getDescendants(childId)
                    });
                }
            }
        }
        return descendantsList;
    };
    
    const descendants = getDescendants(individual.id);

    const TabButton: React.FC<{tabName: string; label: string}> = ({tabName, label}) => (
         <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 font-semibold border-b-2 transition-colors ${activeTab === tabName ? 'text-accent border-accent' : 'text-gray-400 border-transparent hover:text-white hover:border-gray-500'}`}
        >
            {label}
        </button>
    )

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="bg-base-200 shadow-xl rounded-lg overflow-hidden">
                <div className="md:flex bg-base-300/30 p-8">
                    <div className="md:flex-shrink-0">
                        <img className="h-48 w-48 rounded-full object-cover mx-auto ring-4 ring-primary" src={individual.photoUrl || 'https://picsum.photos/seed/person/200/200'} alt={individual.name} />
                        <div className="flex items-center justify-center mt-4 space-x-2 text-gray-400">
                             {individual.gender === Gender.Male ? <MaleIcon className="w-6 h-6 text-blue-400" /> : <FemaleIcon className="w-6 h-6 text-pink-400" />}
                            <span>{individual.gender}</span>
                        </div>
                    </div>
                    <div className="p-8 w-full">
                        <div className="uppercase tracking-wide text-sm text-accent font-semibold">{individual.profession || 'Informasi Pribadi'}</div>
                        <h1 className="block mt-1 text-4xl leading-tight font-bold text-white">{individual.name}</h1>
                        <p className="mt-4 text-gray-300">{individual.description || 'Tidak ada deskripsi yang tersedia.'}</p>
                    </div>
                </div>

                <div className="border-b border-base-300 px-8">
                    <nav className="-mb-px flex space-x-6">
                        <TabButton tabName="overview" label="Gambaran" />
                        <TabButton tabName="family" label="Keluarga" />
                        <TabButton tabName="descendants" label="Keturunan" />
                        <TabButton tabName="details" label="Detail & Sumber" />
                    </nav>
                </div>

                <div className="p-8">
                    {activeTab === 'overview' && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-6">Fakta dan Peristiwa</h2>
                            <div className="relative">
                                <EventCard title="Lahir" event={individual.birth} />
                                {spouseFamilies.map(family => {
                                    const spouse = data.individuals.get(family.spouse1Id === id ? family.spouse2Id! : family.spouse1Id!);
                                    return family.marriage && <EventCard key={`m-${family.id}`} title="Menikah" event={family.marriage} detail={`dengan ${spouse?.name || 'Tidak Dikenal'}`} />
                                })}
                                <EventCard title="Meninggal" event={individual.death} />
                            </div>
                             {individual.notes && (
                                <div className="mt-8">
                                    <h2 className="text-2xl font-bold text-white mb-4">Catatan Pribadi</h2>
                                    <p className="text-gray-300 whitespace-pre-wrap bg-base-100/50 p-4 rounded-lg">{individual.notes}</p>
                                </div>
                             )}
                        </div>
                    )}
                    {activeTab === 'family' && (
                         <div>
                            <h2 className="text-2xl font-bold text-white mb-6">Keluarga</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="font-semibold text-gray-400 mb-2 border-b border-base-300 pb-2">Orang Tua</h3>
                                    <div className="space-y-2 mt-4">
                                        <FamilyMemberLink individual={parents.father} relationship="Ayah" />
                                        <FamilyMemberLink individual={parents.mother} relationship="Ibu" />
                                    </div>
                                </div>
                                <div>
                                    {spouseFamilies.map((family, index) => {
                                        const spouse = data.individuals.get(family.spouse1Id === id ? family.spouse2Id! : family.spouse1Id!)
                                        const children = family.childrenIds.map(cid => data.individuals.get(cid));
                                        return (
                                            <div key={family.id} className="mb-6">
                                                <h3 className="font-semibold text-gray-400 mb-2 border-b border-base-300 pb-2">
                                                    Pasangan {spouseFamilies.length > 1 ? index + 1 : ''}
                                                </h3>
                                                <div className="space-y-2 mt-4">
                                                   <FamilyMemberLink individual={spouse} relationship="Pasangan" />
                                                </div>

                                                {children.length > 0 && (
                                                    <>
                                                        <h4 className="font-semibold text-gray-500 mt-4 mb-2">Anak-anak</h4>
                                                        <div className="space-y-2 pl-4">
                                                            {children.map(child => (
                                                                <FamilyMemberLink key={child!.id} individual={child} />
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'descendants' && (
                        <div>
                             <h2 className="text-2xl font-bold text-white mb-6">Pohon Keturunan</h2>
                             {descendants.length > 0 ? (
                                <DescendantTree descendants={descendants}/>
                             ) : (
                                <p className="text-gray-400">Tidak ada keturunan yang tercatat.</p>
                             )}
                        </div>
                    )}
                     {activeTab === 'details' && (
                        <div>
                            <DetailSection title="Pendidikan" items={individual.education} />
                            <DetailSection title="Karya" items={individual.works} />
                            <DetailSection title="Sumber Data" items={individual.sources} />
                            <DetailSection title="Referensi" items={individual.references} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
