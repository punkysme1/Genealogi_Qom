import { Individual, Marriage } from '@/types';

export const MOCK_INDIVIDUALS: Individual[] = [
  {
    id: '1',
    name: 'Kyai Qomaruddin',
    gender: 'M',
    birth_date: '1750-01-01',
    death_date: '1820-01-01',
    is_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Nyai Hafshoh',
    gender: 'F',
    is_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Kyai Sholih',
    gender: 'M',
    father_id: '1',
    mother_id: '2',
    is_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Nyai Sholih',
    gender: 'F',
    is_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Kyai Ahmad',
    gender: 'M',
    father_id: '3',
    mother_id: '4',
    is_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const MOCK_MARRIAGES: Marriage[] = [
  {
    id: 'm1',
    husband_id: '1',
    wife_id: '2',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'm2',
    husband_id: '3',
    wife_id: '4',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];
