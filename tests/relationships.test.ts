import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRelationship as relationship, traceLineage, siblingKind, childPosition, compareAge, getJavaneseDescendantTerm } from '../src/lib/relationships';
import { generationTerm, descendantTerms, ancestorTerms } from '../src/lib/kinship-terms';
import type { Individual, Marriage } from '../src/types';

const person = (id: string, father_id?: string, mother_id?: string, birth_date?: string, gender: 'M' | 'F' = 'M'): Individual => ({ id, name: id, father_id, mother_id, birth_date, gender, is_verified: false, created_at: '', updated_at: '' });
const marriage = (id: string, husband_id: string, wife_id: string, is_active = true): Marriage => ({ id, husband_id, wife_id, is_active, created_at: '' });
const family = [person('grandpa'), person('grandma', undefined, undefined, undefined, 'F'), person('older', 'grandpa', 'grandma', '1900-01-01'), person('younger', 'grandpa', 'grandma', '1905-01-01'), person('child1', 'older'), person('child2', 'younger'), person('grandchild1', 'child1'), person('grandchild2', 'child2')];

for (const [id, order] of [['older', 1], ['younger', 2]] as const) {
  family.find(p => p.id === id)!.child_order = Object.fromEntries(['grandpa', 'grandma'].map(parent => [parent, { position: order, source: 'Fixture kitab', locator: '1' }]));
}
family[0].children_complete = true; family[1].children_complete = true;

test('unrelated people never become siblings from generation level', () => {
  assert.equal(relationship('a', 'b', [person('root'), person('a', 'root'), person('b')]).type, 'TIDAK_ADA_HUBUNGAN');
});
test('self and missing profile have different results', () => {
  assert.equal(relationship('a', 'a', [person('a')]).type, 'DIRI_SENDIRI');
  assert.equal(relationship('a', 'missing', [person('a')]).type, 'TIDAK_ADA_HUBUNGAN');
});
test('full, half and partially known siblings are distinguished', () => {
  assert.equal(siblingKind(person('a', 'f', 'm'), person('b', 'f', 'm')), 'full');
  assert.equal(siblingKind(person('a', 'f', 'm'), person('b', 'f', 'm2')), 'half');
  assert.equal(siblingKind(person('a', 'f'), person('b', 'f', 'm')), 'partial');
  assert.match(relationship('older', 'younger', family).label!, /Kakang/);
});
test('unknown or invalid birth date never implies younger', () => {
  assert.equal(compareAge(person('a'), person('b', undefined, undefined, '1900-01-01')), 0);
  assert.equal(compareAge(person('a', undefined, undefined, '1900-02-30'), person('b', undefined, undefined, '1900-03-01')), 0);
  const people = family.map(p => p.id === 'older' ? { ...p, birth_date: undefined, child_order: undefined } : p);
  assert.match(relationship('older', 'child2', people).label!, /belum diketahui/);
});
test('uncle follows either maternal or paternal branch and proven age', () => {
  assert.match(relationship('older', 'child2', family).label!, /Pakdhe/);
  assert.match(relationship('younger', 'child1', family).label!, /Paklik/);
  const people = [...family, person('maternal', undefined, 'younger')];
  assert.match(relationship('older', 'maternal', people).label!, /Pakdhe/);
  assert.match(relationship('child2', 'older', family).label!, /Ponakan/);
});
test('first/second cousin seniority follows ancestor branch, not their ages', () => {
  const people = family.map(p => p.id === 'child1' ? { ...p, birth_date: '1950-01-01' } : p.id === 'child2' ? { ...p, birth_date: '1940-01-01' } : p);
  assert.equal(relationship('child1', 'child2', people).label, 'Mas Misan');
  assert.equal(relationship('child2', 'child1', people).label, 'Adik Misan');
  assert.equal(relationship('grandchild1', 'grandchild2', people).label, 'Mas Mindhoan');
});
test('lineage supports 19 ancestors and 18 descendants without cycles', () => {
  const people = Array.from({ length: 22 }, (_, i) => person(`p${i}`, i ? `p${i - 1}` : undefined));
  const up = traceLineage('p21', 'ancestors', people), down = traceLineage('p0', 'descendants', people);
  assert.equal(up.entries.length, 19); assert.equal(up.entries.at(-1)?.label, 'Eyang Warih Galih');
  assert.equal(down.entries.length, 18); assert.equal(down.entries.at(-1)?.label, 'Trah Tumerah');
  assert.equal(up.truncated, true); assert.equal(down.truncated, true);
  assert.equal(relationship('p0', 'p5', people).distance, 5);
});
test('cycles stop safely and prevent a relationship assertion', () => {
  const people = [person('a', 'b'), person('b', 'a')];
  assert.equal(traceLineage('a', 'ancestors', people).cycleDetected, true);
  assert.equal(relationship('a', 'b', people).type, 'TIDAK_ADA_HUBUNGAN');
});
test('pedigree collapse preserves two paths, privacy gaps do not create nodes', () => {
  const people = [person('g'), person('a', 'g'), person('b', 'g'), person('c', 'a', 'b'), person('private-child', 'not-visible')];
  assert.equal(traceLineage('c', 'ancestors', people).entries.filter(e => e.id === 'g').length, 2);
  assert.equal(traceLineage('private-child', 'ancestors', people).entries.length, 0);
  assert.equal(traceLineage('g', 'descendants', people, 18, 1).truncated, true);
});
test('all requested generation labels retain project ordering', () => {
  assert.equal(descendantTerms.length, 18); assert.equal(ancestorTerms.length, 19);
  assert.equal(generationTerm('descendants', 8), 'Gropak Senthe');
  assert.equal(generationTerm('ancestors', 10), 'Eyang Galih Asem');
  assert.equal(getJavaneseDescendantTerm(8), 'Debog Bosok (G9)');
});
test('child position requires sourced order and a complete list', () => {
  assert.match(childPosition(family[2], family)!, /Pembarep/);
  assert.match(childPosition(family[3], family)!, /Ragil/);
  assert.equal(childPosition({ ...family[2], child_order: undefined }, family), null);
  assert.equal(childPosition(person('child1', 'older'), family), null);
});
test('marriage, parents-in-law, children-in-law, besan, Ipe and Pripean have paths', () => {
  const people = [...family, person('spouse', 'parent'), person('parent'), person('other-spouse')];
  const marriages = [marriage('m1', 'child1', 'spouse'), marriage('m2', 'younger', 'other-spouse')];
  assert.equal(relationship('child1', 'spouse', people, marriages).type, 'PASANGAN');
  assert.equal(relationship('older', 'spouse', people, marriages).type, 'MERTUA');
  assert.equal(relationship('spouse', 'older', people, marriages).type, 'MENANTU');
  assert.equal(relationship('older', 'parent', people, marriages).type, 'BESAN');
  assert.equal(relationship('older', 'other-spouse', people, marriages).type, 'IPAR');
  const extended = [...people, person('older-spouse')];
  assert.equal(relationship('older-spouse', 'other-spouse', extended, [...marriages, marriage('m3', 'older', 'older-spouse')]).type, 'PRIPEAN');
});
test('inactive marriage is not treated as a current spouse or step relation', () => {
  assert.equal(relationship('a', 'b', [person('a'), person('b')], [marriage('m', 'a', 'b', false)]).type, 'TIDAK_ADA_HUBUNGAN');
});
test('an explicit active spouse takes precedence when the spouses are also cousins', () => {
  assert.equal(relationship('child1', 'child2', family, [marriage('m', 'child1', 'child2')]).type, 'PASANGAN');
});
test('unknown gender keeps kinship labels neutral', () => {
  const people = family.map(p => p.id === 'older' ? { ...p, gender: null } : p);
  assert.equal(relationship('older', 'younger', people).label, 'Kakak');
  assert.equal(relationship('older', 'child2', people).label, 'Kakak orang tua');
});
test('step and adoption require explicit evidence of relationship kind', () => {
  const people = [person('father'), person('mother', undefined, undefined, undefined, 'F'), person('stepfather'), person('child', 'father', 'mother'), person('adopted')];
  const marriages = [marriage('m', 'stepfather', 'mother')];
  assert.equal(relationship('stepfather', 'child', people, marriages).label, 'Bapak Kuwalon');
  assert.equal(relationship('child', 'stepfather', people, marriages).label, 'Anak Kuwalon');
  assert.equal(relationship('adopted', 'father', people, marriages).type, 'TIDAK_ADA_HUBUNGAN');
  assert.equal(relationship('adopted', 'father', people, marriages, [{ id: 'a', parent_id: 'father', child_id: 'adopted' }]).label, 'Anak Pupon');
  assert.equal(relationship('stepfather', 'child', people.map(p => p.id === 'child' ? { ...p, father_id: undefined } : p), marriages).type, 'TIDAK_ADA_HUBUNGAN');
});
