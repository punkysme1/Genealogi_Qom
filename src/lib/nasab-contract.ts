import { readNumbering } from './numbering-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Individual, Marriage, Event, Source, Adoption } from '../types';

export const NASAB_CONTRACT = 'nasab-public-v1';
export interface Evidence {
  id: string; individual_id: string | null; marriage_id: string | null; related_person_id: string | null;
  source_id: string; predicate: string; asserted_value: string | null; locator: string | null;
  quotation: string | null; review_status: 'draft' | 'reviewed' | 'disputed'; reviewed_at: string | null;
}
export class NasabReadError extends Error {
  constructor(public readonly code: string, public readonly resource: string) {
    super(`Data Nasab belum dapat dibaca (${code}; ${resource}).`);
  }
}
const resources = {
  people: 'nasab_nawra_people_v1', marriages: 'nasab_nawra_marriages_v1',
  events: 'nasab_nawra_events_v1', sources: 'nasab_nawra_sources_v1', evidence: 'nasab_nawra_evidence_v1',
  adoptions: 'nasab_nawra_adoptions_v1',
} as const;
type Resource = keyof typeof resources;
export type NasabReadMode = 'legacy' | 'contract';
const legacyResources = { people: 'individuals', marriages: 'marriages', events: 'events', sources: 'sources' } as const;
type RecordWithId = { id: string; [key: string]: unknown };

// Keyset pagination continues until an empty page, including when the server caps page size.
export async function readContractRows<T>(client: SupabaseClient, resource: Resource, signal?: AbortSignal, filter?: [string, string], mode: NasabReadMode = 'contract'): Promise<T[]> {
  const table = mode === 'contract' ? resources[resource] : legacyResources[resource as keyof typeof legacyResources];
  if (!table) throw new NasabReadError('CONTRACT_NOT_ENABLED', resource);
  const rows: T[] = [];
  let cursor = '';
  for (let page = 0; page < 10000; page++) {
    let query = client.from(table).select('*').order('id', { ascending: true }).limit(500);
    if (cursor) query = query.gt('id', cursor);
    if (filter) query = query.eq(filter[0], filter[1]);
    if (signal) query = query.abortSignal(signal);
    let response;
    try { response = await query; } catch { throw new NasabReadError('NETWORK', resource); }
    if (signal?.aborted) throw new NasabReadError('CANCELLED', resource);
    if (response.error) {
      const code = response.error.code;
      throw new NasabReadError(response.status === 0 || !code ? 'NETWORK' : ['42P01', 'PGRST205'].includes(code) ? 'CONTRACT_UNAVAILABLE' : ['42501', 'PGRST301', 'PGRST302'].includes(code) || [401, 403].includes(response.status) ? 'ACCESS_DENIED' : 'READ_FAILED', resource);
    }
    if (!Array.isArray(response.data)) throw new NasabReadError('INVALID_RESPONSE', resource);
    if (!response.data.length) return rows;
    for (const row of response.data as RecordWithId[]) {
      if (typeof row.id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(row.id) || row.id <= cursor) throw new NasabReadError('INVALID_ORDER', resource);
      if (resource === 'people' && (typeof row.name !== 'string' || (row.gender !== null && !['M', 'F'].includes(row.gender as string)))) throw new NasabReadError('INVALID_PROFILE', resource);
      if (resource === 'marriages' && (typeof row.husband_id !== 'string' || typeof row.wife_id !== 'string' || typeof row.is_active !== 'boolean')) throw new NasabReadError('INVALID_FAMILY', resource);
      if (resource === 'events' && (typeof row.individual_id !== 'string' || typeof row.description !== 'string' || !['birth', 'death', 'marriage', 'education', 'other'].includes(row.type as string))) throw new NasabReadError('INVALID_EVENT', resource);
      if (resource === 'sources' && typeof row.title !== 'string') throw new NasabReadError('INVALID_SOURCE', resource);
      if (resource === 'evidence' && (typeof row.source_id !== 'string' || typeof row.predicate !== 'string' || !['draft', 'reviewed', 'disputed'].includes(row.review_status as string))) throw new NasabReadError('INVALID_EVIDENCE', resource);
      if (resource === 'evidence' && Number(!!row.individual_id) + Number(!!row.marriage_id) !== 1) throw new NasabReadError('INVALID_EVIDENCE_TARGET', resource);
      for (const field of ['birth_date', 'death_date', 'date', 'description', 'title', 'url', 'locator', 'quotation', 'asserted_value']) {
        if (row[field] != null && typeof row[field] !== 'string') throw new NasabReadError('INVALID_FIELD', resource);
      }
      if (resource === 'adoptions' && (typeof row.parent_id !== 'string' || typeof row.child_id !== 'string' || row.parent_id === row.child_id)) throw new NasabReadError('INVALID_ADOPTION', resource);
      cursor = row.id;
      rows.push(row as T);
    }
  }
  throw new NasabReadError('READ_LIMIT', resource);
}

export async function readFamily(client: SupabaseClient, signal?: AbortSignal, mode: NasabReadMode = 'contract') {
  const [people, marriages, adoptions] = await Promise.all([
    readContractRows<Individual>(client, 'people', signal, undefined, mode), readContractRows<Marriage>(client, 'marriages', signal, undefined, mode),
    mode === 'contract' ? readContractRows<Adoption>(client, 'adoptions', signal) : Promise.resolve([] as Adoption[]),
  ]);
  const ids = new Set(people.map(p => p.id));
  if (people.some(p => (p.father_id && !ids.has(p.father_id)) || (p.mother_id && !ids.has(p.mother_id))) || marriages.some(m => !ids.has(m.husband_id) || !ids.has(m.wife_id)) || adoptions.some(a => !ids.has(a.parent_id) || !ids.has(a.child_id))) {
    throw new NasabReadError('INCONSISTENT_SNAPSHOT', 'family');
  }
  const numbered = await readNumbering(client, people);
  return { people: numbered.people, marriages, adoptions };
}

export async function readProfileEvidence(client: SupabaseClient, personId: string, marriageIds: string[], signal?: AbortSignal, mode: NasabReadMode = 'contract') {
  const [events, sources, evidence] = await Promise.all([
    readContractRows<Event>(client, 'events', signal, ['individual_id', personId], mode),
    readContractRows<Source>(client, 'sources', signal, undefined, mode), mode === 'contract' ? readContractRows<Evidence>(client, 'evidence', signal) : Promise.resolve([] as Evidence[]),
  ]);
  const relevant = evidence.filter(e => e.individual_id === personId || (!!e.marriage_id && marriageIds.includes(e.marriage_id)));
  const used = new Set(relevant.map(e => e.source_id));
  if (relevant.some(e => !sources.some(s => s.id === e.source_id))) throw new NasabReadError('INCONSISTENT_SNAPSHOT', 'evidence');
  return { events: events.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id.localeCompare(b.id)), sources: sources.filter(s => s.individual_id === personId || used.has(s.id)), evidence: relevant };
}

export function publicSourceUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    if (['arsip.naracode.id', 'turots.naracode.id', 'nasab.naracode.id', 'sanad.naracode.id'].includes(url.hostname)) return url.href;
  } catch { /* Invalid URLs remain readable as source descriptions, never executable links. */ }
  return undefined;
}
