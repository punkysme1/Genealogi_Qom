import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Individual } from '../src/types';
import { branchSymbol, lineagePaths, previewChildInsertion, numberingSnapshot, compareSiblingOrder } from '../src/lib/lineage-numbering';
import { generateGenealogyIDs } from '../src/lib/genealogy';
const p = (id: string, parent?: string, order?: number): Individual => ({ id, name: id === 'root' ? 'Kiai Qomaruddin' : id, gender: null, father_id: parent,
  child_order: parent && order ? { [parent]: { position: order, source: 'Kitab fixture', locator: 'hlm. 3' } } : {}, is_verified: false, created_at: '', updated_at: '' });

test('alphabet boundary is unambiguous and rejects invalid ordinals', () => {
  assert.deepEqual([9, 10, 35, 36, 100].map(branchSymbol), ['9', 'A', 'Z', '(36)', '(100)']);
  for (const n of [0, -1, 1.5, NaN]) assert.throws(() => branchSymbol(n));
});
test('dates never supply missing order or override sourced sibling order', () => {
  const a = { ...p('a', 'root', 2), birth_date: '1800-01-01' }, b = { ...p('b', 'root', 1), birth_date: '1900-01-01' };
  assert.equal(compareSiblingOrder(a, b), 1);
  assert.equal(lineagePaths('a', [p('root'), { ...a, child_order: {} }]).paths[0].code, null);
});
test('shortest path means links, not code character length; names and codes align', () => {
  const a = p('a', 'root', 36), b = p('b', 'root', 1), c = p('c', 'b', 1);
  const x = { ...p('x', 'a', 1), mother_id: 'c', child_order: { a: { position: 1, source: 'K', locator: '1' }, c: { position: 1, source: 'K', locator: '2' } } };
  const ids = generateGenealogyIDs(x, [p('root'), a, b, c, x], []);
  assert.equal(ids.displayId, '(36)1'); assert.deepEqual(ids.alphaPaths, ['(36)1', '111']);
  assert.equal(ids.pathIds[0], 'x [bin/binti belum diketahui] a [bin/binti belum diketahui] Kiai Qomaruddin');
});
test('same-size correction invalidates numbering immediately', () => {
  const people = [p('root'), p('a', 'root', 1)];
  assert.equal(generateGenealogyIDs(people[1], people, []).displayId, '1');
  const changed = [people[0], p('a', 'root', 3)];
  assert.equal(generateGenealogyIDs(changed[1], changed, []).displayId, '3');
});
test('insertion shifts later children and identifies downstream impact without mutating input', () => {
  const people = [p('root'), p('a', 'root', 1), p('b', 'root', 2), p('new', 'root'), p('grand', 'b', 1)];
  const before = JSON.stringify(people);
  const preview = previewChildInsertion(people, 'new', 'root', 1, 'K', '3');
  assert.equal(lineagePaths('grand', preview.people).paths[0].code, '31');
  assert.ok(preview.affectedIds.includes('grand')); assert.equal(JSON.stringify(people), before);
});
test('moving an existing child compacts its former slot', () => {
  const people = [p('root'), p('a', 'root', 1), p('b', 'root', 2), p('c', 'root', 3)];
  const next = previewChildInsertion(people, 'a', 'root', 3, 'K', '4').people;
  assert.deepEqual(['a', 'b', 'c'].map(id => lineagePaths(id, next).paths[0].code), ['3', '1', '2']);
});
test('duplicate ranks cannot be presented as a unique code', () => {
  const r = lineagePaths('a', [p('root'), p('a', 'root', 1), p('b', 'root', 1)]);
  assert.equal(r.paths[0].code, null); assert.ok(r.warnings.length);
});
test('missing and ambiguous roots never label an unrelated person as founder', () => {
  assert.equal(lineagePaths('a', [p('a')]).paths.length, 0);
  assert.equal(lineagePaths('a', [p('root'), { ...p('other'), name: 'Kiai Qomaruddin' }, p('a', 'root', 1)]).paths.length, 0);
});
test('budget and cycles are visible, counts are not silently exhaustive', () => {
  const limited = lineagePaths('a', [p('root'), p('a', 'root', 1)], undefined, 1);
  assert.equal(limited.truncated, true);
  const cycle = lineagePaths('a', [p('root'), p('a', 'b', 1), p('b', 'a', 1)]);
  assert.ok(cycle.warnings.some(w => w.includes('Siklus')));
});
test('numbering snapshot ignores photo/date edits and input order but detects relationships', () => {
  const people = [p('root'), p('a', 'root', 1)];
  assert.equal(numberingSnapshot(people), numberingSnapshot([...people].reverse().map(p => ({ ...p, birth_date: '1900-01-01' }))));
  assert.notEqual(numberingSnapshot(people), numberingSnapshot([people[0], p('a', 'root', 2)]));
});


test('configured root UUID wins over names and survives rename', () => {
  const people = [{ ...p('root'), name: 'Renamed founder', numbering_root_id: 'root' }, p('a', 'root', 2)];
  assert.equal(lineagePaths('a', people).paths[0].code, '2');
});
test('plus marks an unlinked person, not an unnumbered descendant', () => {
  const people = [p('root'), p('a', 'root'), p('outsider')];
  assert.equal(generateGenealogyIDs(people[2], people, []).displayId, '(+)');
  assert.equal(generateGenealogyIDs(people[1], people, []).displayId, 'Belum bernomor');
});

test('KH. Abu Ishaq receives +84 from Rosiyah, including remarriage without duplicate codes', () => {
  const rosiyah = { ...p('rosiyah', 'branch', 4), name: 'Rosiyah' };
  const abu = { ...p('abu'), name: 'KH. Abu Ishaq' };
  const people = [p('root'), p('branch', 'root', 8), rosiyah, abu];
  const marriage = { id: 'm', husband_id: 'abu', wife_id: 'rosiyah', is_active: true, created_at: '' };
  assert.equal(generateGenealogyIDs(rosiyah, people, [marriage]).displayId, '84');
  const result = generateGenealogyIDs(abu, people, [marriage, { ...marriage, id: 'm2' }]);
  assert.equal(result.displayId, '+84');
  assert.deepEqual(result.alphaPaths, ['+84']);
  assert.match(result.pathIds[0], /Rosiyah/);
});
test('descendant spouse retains their own code and incomplete spouse codes are never invented', () => {
  const people = [p('root'), p('a', 'root', 2), p('b', 'root', 3), p('outside')];
  const marriage = { id: 'm', husband_id: 'a', wife_id: 'b', is_active: true, created_at: '' };
  assert.equal(generateGenealogyIDs(people[0], people, []).displayId, 'G0');
  assert.equal(generateGenealogyIDs(people[1], people, [marriage]).displayId, '2');
  const incomplete = [people[0], p('b', 'root'), people[3]];
  const result = generateGenealogyIDs(people[3], incomplete, [{ ...marriage, husband_id: 'outside' }]);
  assert.ok(!result.alphaPaths.some(code => code.startsWith('+')));
});
