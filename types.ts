
export interface LifeEvent {
  date?: string;
  place?: string;
}

export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other',
}

export interface DetailEntry {
  id: string;
  title: string;
  description: string;
  period?: string;
}

export interface Individual {
  id: string;
  name: string;
  gender: Gender;
  photoUrl?: string;
  birth?: LifeEvent;
  death?: LifeEvent;
  description?: string;
  profession?: string;
  notes?: string;
  childInFamilyId?: string; 
  education?: DetailEntry[];
  works?: DetailEntry[];
  sources?: DetailEntry[];
  references?: DetailEntry[];
}

export interface Family {
  id: string;
  spouse1Id?: string;
  spouse2Id?: string;
  marriage?: LifeEvent;
  divorce?: LifeEvent;
  childrenIds: string[];
}

export interface FamilyData {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
  rootIndividualId: string;
}

export interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  date: string;
}
