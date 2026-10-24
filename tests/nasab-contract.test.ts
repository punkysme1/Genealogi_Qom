import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readContractRows, readFamily, readProfileEvidence, publicSourceUrl } from '../src/lib/nasab-contract';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function client(tables: Record<string, any[]>, error?: string) {
  return { from(table: string) {
    let cursor = '', filter: [string, unknown] | undefined;
    const q = {
      single() { return Promise.resolve({ data: null, error: {code: 'PGRST205'} }); },
      select() { return q; }, order() { return q; }, limit() { return q; }, abortSignal() { return q; },
      gt(_key: string, value: string) { cursor = value; return q; }, eq(key: string, value: unknown) { filter = [key, value]; return q; },
      then(resolve: (value: any) => void) {
        resolve(error ? { error: { code: error, message: 'PRIVATE ERROR CONTENT' }, data: null } : {
          error: null, data: (tables[table] || []).filter(r => r.id > cursor && (!filter || r[filter[0]] === filter[1])).slice(0, 2),
        });
      },
    };
    return q;
  } } as unknown as SupabaseClient;
}
test('server page cap does not silently truncate family records', async () => {
  const rows = Array.from({ length: 7 }, (_, n) => ({ id: id(n + 1), name: `P${n}`, gender: 'M' }));
  assert.equal((await readContractRows(client({ nasab_nawra_people_v1: rows }), 'people')).length, 7);
});
test('legacy mode reads existing tables without requiring new contract views', async () => {
  const data = await readFamily(client({ individuals: [{ id: id(1), name: 'A', gender: 'M' }], marriages: [] }), undefined, 'legacy');
  assert.equal(data.people.length, 1);
  assert.deepEqual(data.adoptions, []);
});
test('contract mode never falls back to legacy after access denial', async () => {
  await assert.rejects(readFamily(client({ individuals: [{ id: id(1), name: 'A', gender: 'M' }] }, '42501')), /ACCESS_DENIED/);
});
test('missing contract and permission failure remain distinct, without raw errors', async () => {
  await assert.rejects(readContractRows(client({}, '42P01'), 'people'), /CONTRACT_UNAVAILABLE/);
  await assert.rejects(readContractRows(client({}, '42501'), 'people'), /ACCESS_DENIED/);
  try { await readContractRows(client({}, '42P01'), 'people'); } catch (error) { assert.doesNotMatch(String(error), /PRIVATE/); }
});
test('empty sources succeed while dangling family references fail', async () => {
  assert.deepEqual(await readFamily(client({})), { people: [], marriages: [], adoptions: [] });
  await assert.rejects(readFamily(client({ nasab_nawra_people_v1: [{ id: id(1), name: 'A', gender: 'M', father_id: id(2) }] })), /INCONSISTENT_SNAPSHOT/);
});
test('profile evidence includes marriage evidence and excludes unrelated events', async () => {
  const result = await readProfileEvidence(client({
    nasab_nawra_events_v1: [{ id: id(1), individual_id: id(10), type: 'other', description: 'A' }, { id: id(2), individual_id: id(11), type: 'other', description: 'B' }],
    nasab_nawra_sources_v1: [{ id: id(3), title: 'Source' }],
    nasab_nawra_evidence_v1: [{ id: id(4), marriage_id: id(20), source_id: id(3), predicate: 'marriage', review_status: 'disputed' }],
  }), id(10), [id(20)]);
  assert.equal(result.events.length, 1); assert.equal(result.evidence[0].review_status, 'disputed'); assert.equal(result.sources.length, 1);
});
test('bad response shape fails instead of rendering an invented relationship', async () => {
  await assert.rejects(readContractRows(client({ nasab_nawra_people_v1: [{ id: id(1), name: 'A', gender: 'unknown' }] }), 'people'), /INVALID_PROFILE/);
});
test('internal archive hosts and active-content links never become public hyperlinks', () => {
  for (const url of ['javascript:alert(1)', 'http://qomaruddin-paperless:8000/documents/1', 'https://user:pass@arsip.naracode.id/', 'https://localhost/']) assert.equal(publicSourceUrl(url), undefined);
  assert.equal(publicSourceUrl('https://arsip.naracode.id/documents/1/details'), 'https://arsip.naracode.id/documents/1/details');
});
