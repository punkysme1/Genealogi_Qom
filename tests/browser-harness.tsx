import React from 'react';
import { createRoot } from 'react-dom/client';
import { RelationshipSearch } from '../src/components/Sidebar/RelationshipSearch';
import '../src/index.css';
import type { Individual } from '../src/types';

const make = (id: string, father_id?: string, mother_id?: string, birth_date?: string): Individual => ({ id, name: `UJI ${id}`, father_id, mother_id, birth_date, gender: 'M', is_verified: false, created_at: '', updated_at: '' });
const people = [make('Eyang'), make('Simbah'), make('Kakang', 'Eyang', 'Simbah', '1900-01-01'), make('Adhi', 'Eyang', 'Simbah', '1905-01-01'), make('Anak Kakang', 'Kakang'), make('Anak Adhi', 'Adhi')];
function Harness() {
  const [open, setOpen] = React.useState(true);
  const [selected, setSelected] = React.useState('');
  return <><h1>Data sintetis untuk uji lokal</h1><button onClick={() => setOpen(true)}>Buka penelusuran</button><p role="status">Dipilih: {selected || 'belum ada'}</p>{open && <RelationshipSearch individuals={people} marriages={[]} adoptions={[]} onClose={() => setOpen(false)} onSelectIndividual={setSelected} />}</>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
