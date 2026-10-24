export type Gender = 'M' | 'F' | null;

export interface Individual {
  numbering_root_id?: string | null;
  child_order?: Record<string, { position: number; source: string; locator: string }>;
  children_complete?: boolean;
  birth_date_status?: 'sourced' | 'estimated' | 'placeholder' | 'unknown';
  id: string;
  name: string;
  slug?: string;
  gender: Gender;
  birth_date?: string;
  death_date?: string;
  birth_place?: string;
  death_place?: string;
  current_location?: string;
  education?: string;
  occupation?: string;
  bio?: string;
  is_alive?: boolean;
  is_verified: boolean;
  verified_by?: string; // Legacy field
  verification_type?: 'Manuskrip' | 'Dokumen' | 'Verifikator';
  verification_source?: string;
  economic_status?: 'Kaya' | 'Menengah' | 'Miskin';
  profile_photo_url?: string;
  father_id?: string;
  mother_id?: string;
  created_at: string;
  updated_at: string;
}

export type RelationshipType = 
  | 'AYAH' | 'IBU' | 'ANAK' | 'CUCU' | 'KAKEK' | 'NENEK' 
  | 'PAMAN' | 'BIBI' | 'KEPONAKAN' | 'SEPUPU' | 'SAUDARA'
  | 'CAK' | 'DEK' | 'PAKDE' | 'BUDHE' | 'PAKLEK' | 'BULEK' 
  | 'MERTUA' | 'IPAR' | 'MENANTU' | 'TIDAK_ADA_HUBUNGAN'
  | 'DIRI_SENDIRI' | 'LELUHUR' | 'KETURUNAN' | 'PASANGAN' | 'BESAN' | 'PRIPEAN'
  | 'TIRI' | 'ANGKAT' | 'KERABAT';

export interface RelationshipResult {
  fromId: string;
  toId: string;
  type: RelationshipType;
  distance: number;
  description: string;
  commonAncestorId?: string;
  label?: string;
  paths?: KinshipPath[];
  warnings?: string[];
  truncated?: boolean;
}

export interface KinshipStep {
  from: string;
  to: string;
  kind: 'parent' | 'child' | 'spouse' | 'adoptive_parent' | 'adopted_child';
  recordId: string;
  field: string;
}
export interface KinshipPath { ids: string[]; steps: KinshipStep[] }
export interface Adoption { id: string; parent_id: string; child_id: string }

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
