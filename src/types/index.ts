export type Gender = 'M' | 'F';

export interface Individual {
  id: string;
  name: string;
  ref_code?: string; // Penomoran/Pengkodean
  gender: Gender;
  birth_date?: string;
  death_date?: string;
  birth_place?: string;
  death_place?: string;
  current_location?: string;
  education?: string;
  occupation?: string;
  bio?: string;
  is_verified: boolean;
  verified_by?: string; // Verifikator
  father_id?: string;
  mother_id?: string;
  created_at: string;
  updated_at: string;
}

export type RelationshipType = 
  | 'AYAH' | 'IBU' | 'ANAK' | 'CUCU' | 'KAKEK' | 'NENEK' 
  | 'PAMAN' | 'BIBI' | 'KEPONAKAN' | 'SEPUPU' | 'SAUDARA'
  | 'CAK' | 'DEK' | 'PAKDE' | 'BUDHE' | 'PAKLEK' | 'BULEK' 
  | 'MERTUA' | 'IPAR' | 'MENANTU' | 'TIDAK_ADA_HUBUNGAN';

export interface RelationshipResult {
  fromId: string;
  toId: string;
  type: RelationshipType;
  distance: number;
  description: string;
  commonAncestorId?: string;
}

export interface Marriage {
  id: string;
  husband_id: string;
  wife_id: string;
  marriage_date?: string;
  is_active: boolean;
  created_at: string;
}

export interface Source {
  id: string;
  individual_id: string;
  title: string;
  url?: string;
  description?: string;
  created_at: string;
}

export interface Event {
  id: string;
  individual_id: string;
  type: 'birth' | 'death' | 'marriage' | 'education' | 'other';
  date?: string;
  description: string;
  location?: string;
}
