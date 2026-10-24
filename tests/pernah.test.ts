import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePernah, describeKinshipPath, groupPernahCards, nearestGenerationSummary, type PernahCard } from '../src/lib/pernah';
import type { Individual, Marriage } from '../src/types';

// Synthetic topology illustrates the curator's example; these are not historical records.
const p = (id: string, name: string, father_id?: string, mother_id?: string, gender: 'M' | 'F' = 'M', birth_date?: string): Individual => ({ id, name, father_id, mother_id, gender, birth_date, is_verified: false, created_at: '', updated_at: '' });
const people = [
  p('harun', 'KH. Harun'), p('ishaq', 'KH. Abu Ishaq Madyani', 'harun'),
  p('g1', 'Cabang Gus 1', 'ishaq'), p('g2', 'Cabang Gus 2', 'g1'), p('g3', 'Cabang Gus 3', 'g2'), p('g4', 'Cabang Gus 4', 'g3'),
  p('a1', 'Cabang Ahmad 1', 'ishaq'), p('a2', 'Cabang Ahmad 2', 'a1'), p('a3', 'Cabang Ahmad 3', 'a2'), p('a4', 'Cabang Ahmad 4', 'a3'),
  p('gp', 'Orang tua saudara 1'), p('gm', 'Orang tua saudara 2', undefined, undefined, 'F'),
  p('lilik', 'Lilik Mughiroh', 'gp', 'gm', 'F', '1970-01-01'),
  p('durratun', 'Durratun Nasihah', 'gp', 'gm', 'F', '1975-01-01'),
  p('gus', 'Gus Oni', 'g4'), p('ahmad', 'Ahmad Maghfur', 'a4', 'lilik'),
];
for (const [id, position] of [['lilik', 1], ['durratun', 2]] as const) {
  people.find(p => p.id === id)!.child_order = { gp: { position, source: 'Fixture kitab', locator: '1' }, gm: { position, source: 'Fixture kitab', locator: '1' } };
}
const marriages: Marriage[] = [{ id: 'm', husband_id: 'gus', wife_id: 'durratun', is_active: true, created_at: '' }];

test('nearest equal generation keeps Mingnem and all unequal-generation terms', () => {
  const make = (id: string, title: string, depths: [number, number]): PernahCard => ({ id, title, depths, ancestorId: id, via: `Dari ${id}`, descriptions: [id], routes: [], warnings: [], truncated: false });
  const cards = [make('a', 'Ponakan', [5, 6]), make('b', 'Mingnem', [6, 6]), make('c', 'Mingnem', [6, 6]),
    make('d', 'Putu', [5, 7]), make('e', 'Buyut', [5, 8]), ...[7, 8, 9, 10].map(n => make(`g${n}`, `Kerabat segenerasi ke-${n}`, [n, n]))];
  const before = JSON.stringify(cards);
  const summary = nearestGenerationSummary(cards);
  assert.deepEqual(groupPernahCards(summary.visible).map(g => g.title), ['Ponakan', 'Mingnem', 'Putu', 'Buyut']);
  assert.equal(summary.visible.filter(c => c.title === 'Mingnem').length, 2);
  assert.equal(summary.deferred.length, 4);
  assert.equal(JSON.stringify(cards), before);
});

test('higher equal generation remains visible when no closer equal-generation category exists', () => {
  const card: PernahCard = { id: 'a', title: 'Kerabat segenerasi ke-7', ancestorId: 'a', depths: [7, 7], via: 'Dari A', descriptions: [], routes: [], warnings: [], truncated: false };
  assert.deepEqual(nearestGenerationSummary([card]).visible, [card]);
  assert.deepEqual(nearestGenerationSummary([]), { visible: [], deferred: [] });
});

test('all matching terms group without losing opposite directions or marriage contexts', () => {
  const make = (id: string, title: string, ancestorId?: string, depths?: [number, number]): PernahCard => ({
    id, title, ancestorId, depths, via: ancestorId ? `Dari ${ancestorId}` : 'Melalui pasangan',
    descriptions: [`Arah khusus ${id}`], routes: [], warnings: [], truncated: false,
  });
  const cards = [make('a', 'Putu', 'KH. Abu Ishaq Rengel', [8, 6]), make('b', 'Putu', 'Rosiyah Harun', [8, 6]),
    make('c', 'Putu', 'Rosiyah Harun', [6, 8]), make('d', 'Ponakan', 'Leluhur lain', [3, 4]), make('e', 'Ponakan'), make('f', 'Buyut', 'Leluhur ketiga', [4, 7])];
  const before = JSON.stringify(cards);
  const groups = groupPernahCards(cards);
  assert.equal(groups.length, 3);
  const putu = groups.find(g => g.title === 'Putu')!;
  assert.equal(putu.via, 'Dari KH. Abu Ishaq Rengel, Rosiyah Harun');
  assert.equal(putu.members.length, 3);
  assert.deepEqual(putu.members.map(m => m.descriptions[0]), ['Arah khusus a', 'Arah khusus b', 'Arah khusus c']);
  assert.equal(groups.find(g => g.title === 'Ponakan')?.members.length, 2);
  assert.equal(JSON.stringify(cards), before);
});

test('Ponakan and nearest Minglimo remain; extending Mingnem stays in details', () => {
  const result = calculatePernah('gus', 'ahmad', people, marriages);
  assert.deepEqual(result.cards.map(c => c.title), ['Ponakan', 'Minglimo']);
  assert.equal(result.truncated, false);
  const [nephew, fifth] = result.cards;
  const sixth = result.alternativePaths!.find(c => c.ancestorId === 'harun')!;
  assert.match(nephew.descriptions[0], /Ahmad Maghfur adalah Ponakan \/ Keponakan Gus Oni/);
  assert.match(nephew.descriptions[1], /Gus Oni adalah Paklik Ahmad Maghfur/);
  assert.equal(nephew.routes.length, 2); // one proven sibling path through each parent
  assert.ok(nephew.routes[0].narrative.some(line => line.includes('Ahmad Maghfur bin Lilik Mughiroh')));
  assert.ok(nephew.routes[0].narrative.includes('Durratun Nasihah adalah istri dari Gus Oni.'));
  assert.ok(nephew.routes[0].narrative.every(line => !line.includes('anak dari')));
  assert.equal(fifth.ancestorId, 'ishaq'); assert.deepEqual(fifth.depths, [5, 5]);
  assert.equal(sixth.ancestorId, 'harun'); assert.deepEqual(sixth.depths, [6, 6]);
  assert.equal(fifth.routes[0].branches?.from.steps.length, 5);
  assert.equal(sixth.routes[0].branches?.to.steps.length, 6);
});
test('swapping the two selected people keeps the same relationships and correct direction', () => {
  const result = calculatePernah('ahmad', 'gus', people, marriages);
  assert.deepEqual(result.cards.map(c => c.title), ['Ponakan', 'Minglimo']);
  assert.match(result.cards[0].descriptions[1], /Gus Oni adalah Paklik Ahmad Maghfur/);
  assert.equal(result.cards[1].routes[0].branches?.from.ids[0], 'ahmad');
});
test('unknown sibling order does not guess Paklik from the spouses own age', () => {
  const unknown = people.map(person => person.id === 'lilik' ? { ...person, birth_date: undefined, child_order: undefined } : person.id === 'gus' ? { ...person, birth_date: '1980-01-01' } : person);
  const nephew = calculatePernah('gus', 'ahmad', unknown, marriages).cards.find(c => c.title === 'Ponakan')!;
  assert.match(nephew.descriptions[1], /Paman/);
  assert.doesNotMatch(nephew.descriptions[1], /Paklik/);
  assert.ok(nephew.warnings.length);
});
test('inactive marriage removes affinal Ponakan while preserving both ancestor references', () => {
  const result = calculatePernah('gus', 'ahmad', people, [{ ...marriages[0], is_active: false }]);
  assert.deepEqual(result.cards.map(c => c.title), ['Minglimo']);
});
test('same generation without a shared ancestor is not Minglimo or another relation', () => {
  const disconnected = people.map(person => person.id === 'a1' ? { ...person, father_id: undefined } : person);
  assert.equal(calculatePernah('gus', 'ahmad', disconnected, []).cards.length, 0);
});
test('unequal distances are stated rather than labeled Minglimo', () => {
  const extended = [...people, p('child', 'Anak Ahmad', 'ahmad')];
  const ancestorCard = calculatePernah('gus', 'child', extended, []).cards.find(c => c.ancestorId === 'ishaq')!;
  assert.deepEqual(ancestorCard.depths, [5, 6]);
  assert.equal(ancestorCard.title, 'Ponakan');
});
test('siblings are not mislabeled as first cousins merely through their grandparents', () => {
  const extended = [...people, p('sib', 'Saudara Ahmad', 'a4', 'lilik')];
  const result = calculatePernah('ahmad', 'sib', extended);
  assert.ok(result.cards.some(c => c.id === 'blood:SAUDARA'));
  assert.ok(!result.cards.some(c => c.title === 'Misanan' || c.title === 'Mindhoan'));
});
test('cycle detection still stops the multi-relationship result', () => {
  const cyclic = people.map(person => person.id === 'harun' ? { ...person, father_id: 'gus' } : person);
  const result = calculatePernah('gus', 'ahmad', cyclic, marriages);
  assert.equal(result.cards.length, 0); assert.match(result.message!, /siklus/);
});
test('path narrative uses bin/binti based on the child gender', () => {
  const result = calculatePernah('ahmad', 'gus', people, marriages);
  const path = result.cards[0].routes[0].path!;
  assert.match(describeKinshipPath(path, people)[0], /^Ahmad Maghfur bin Lilik Mughiroh binti /);
});

function branches(leftDepth: number, rightDepth: number) {
  const records = [p('root', 'Leluhur acuan')];
  for (const [prefix, depth] of [['left', leftDepth], ['right', rightDepth]] as const) {
    for (let n = 1; n <= depth; n++) records.push(p(`${prefix}${n}`, `${prefix}${n}`, n === 1 ? 'root' : `${prefix}${n - 1}`));
  }
  return records;
}

test('unequal ancestor paths never assign child/grandchild roles in either direction', () => {
  for (const [left, right] of [[3, 5], [3, 6], [4, 7], [3, 7]]) {
    const records = branches(left, right);
    for (const [a, b] of [[`left${left}`, `right${right}`], [`right${right}`, `left${left}`]]) {
      const result = calculatePernah(a, b, records);
      assert.equal(result.cards.length, 1);
      const alternative = result.cards.find(c => c.ancestorId === 'root')!;
      assert.equal(alternative.title, ({2:'Putu',3:'Buyut',4:'Canggah'} as Record<number,string>)[right-left]);
      assert.ok(alternative.routes[0].branches);
      assert.match(alternative.descriptions[1], /bukan keturunan langsung/);
    }
  }
});

test('actual direct descent remains distinct from the collateral generation label', () => {
  const records = [p('root', 'Root'), p('child', 'Child', 'root'), p('grandchild', 'Grandchild', 'child'), p('greatgrandchild', 'Greatgrandchild', 'grandchild')];
  const result = calculatePernah('greatgrandchild', 'root', records);
  assert.equal(result.cards[0].title, 'Buyut / Cicit');
  assert.equal(result.cards[0].via, 'Hubungan darah');
  assert.equal(result.cards.length, 1);
});

// Synthetic regression for two cousins descending from a couple whose own
// rootward paths have different lengths. Names illustrate the reported case.
function intertwinedFamily() {
  return [p('r', 'KH. Abdurrahim'), p('yaqub', 'KH. Yaqub', 'r'), p('mahfudz', 'Mahfudz', 'yaqub'),
    p('zakariya', 'KH. Zakariya', 'r'), p('mujtaba', 'Mujtaba', 'zakariya'), p('aminah', 'Aminah', 'mujtaba', undefined, 'F'),
    p('umamah', 'Umamah', undefined, 'aminah', 'F'),
    p('lilik', 'Lilik Mughiroh', 'mahfudz', 'umamah', 'F'), p('durratun', 'Durratun Nasihah', 'mahfudz', 'umamah', 'F'),
    p('maghfur', 'Ahmad Maghfur', undefined, 'lilik'), p('abdurrahman', 'Abdurrahman Nawawi', undefined, 'durratun')];
}

test('intertwined married branches do not turn cousins into each others grandchildren', () => {
  const records = intertwinedFamily();
  const couples: Marriage[] = [{ id: 'couple', husband_id: 'mahfudz', wife_id: 'umamah', is_active: true, created_at: '' }];
  for (const [a, b] of [['maghfur', 'abdurrahman'], ['abdurrahman', 'maghfur']]) {
    const result = calculatePernah(a, b, records, couples);
    assert.ok(result.cards.some(card => card.title === 'Misanan'));
    assert.ok(result.cards.every(card => !/Anak|Putu|Cucu|Buyut|Cicit|Canggah/.test(card.title)));
    const unequal = result.alternativePaths!.filter(card => card.ancestorId === 'r' && card.depths?.[0] !== card.depths?.[1]);
    assert.deepEqual(unequal.map(card => card.depths).sort(), [[4, 6], [6, 4]]);
    assert.ok(unequal.every(card => card.routes[0].branches));
    const sameRoot = result.cards.filter(card => card.ancestorId === 'r');
    assert.deepEqual(sameRoot, []);
  }
});

test('Mingempat merges different ancestors, retaining separate paths and IDs', () => {
  const result = calculatePernah('maghfur', 'abdurrahman', intertwinedFamily());
  const groups = groupPernahCards([...result.cards, ...(result.alternativePaths || [])]);
  const fourth = groups.filter(group => group.title === 'Mingempat');
  assert.equal(fourth.length, 1);
  assert.deepEqual(new Set(fourth[0].members.map(card => card.ancestorId)), new Set(['r', 'mujtaba']));
  assert.match(fourth[0].via, /KH. Abdurrahim/); assert.match(fourth[0].via, /Mujtaba/);
  for (const card of fourth[0].members) {
    assert.ok(card.routes.every(route => route.branches?.from.ids.at(-1) === card.ancestorId && route.branches?.to.ids.at(-1) === card.ancestorId));
  }
  assert.equal(groups.filter(group => group.title === 'Misanan').length, 1);
  assert.deepEqual(new Set(groups.find(group => group.title === 'Misanan')!.members.map(card => card.ancestorId)), new Set(['mahfudz', 'umamah']));
});

test('grouping keeps distinct ancestors with identical names and does not mutate cards', () => {
  const result = calculatePernah('maghfur', 'abdurrahman', intertwinedFamily().map(person => person.id === 'mujtaba' ? { ...person, name: 'KH. Abdurrahim' } : person));
  const before = JSON.stringify(result.cards);
  const group = groupPernahCards([...result.cards, ...(result.alternativePaths || [])]).find(item => item.title === 'Mingempat')!;
  assert.equal(group.members.length, 2);
  assert.equal(new Set(group.members.map(card => card.ancestorId)).size, 2);
  assert.equal(JSON.stringify(result.cards), before);
});

test('Minglimo also merges several ancestors without losing their routes', () => {
  const records = [...intertwinedFamily(), p('childA', 'Anak A', 'maghfur'), p('childB', 'Anak B', 'abdurrahman')];
  const result = calculatePernah('childA', 'childB', records);
  const fifth = groupPernahCards([...result.cards, ...(result.alternativePaths || [])]).filter(group => group.title === 'Minglimo');
  assert.equal(fifth.length, 1);
  assert.deepEqual(new Set(fifth[0].members.map(card => card.ancestorId)), new Set(['r', 'mujtaba']));
  assert.ok(fifth[0].members.every(card => card.routes.length > 0));
});


test('groups are ranked by shortest route rather than relationship category', () => {
  const card = (title: string, depths: [number, number]) => ({ id: title, title, via: title, descriptions: [], routes: [], warnings: [], truncated: false, depths });
  const groups = groupPernahCards([card('Buyut', [5, 2]), card('Ponakan', [5, 4]), card('Misanan', [2, 2])]);
  assert.deepEqual(groups.map(g => g.title), ['Misanan', 'Buyut', 'Ponakan']);
});


test('unknown gender is explicit and existing matching patronymic is not duplicated', () => {
  const persons = [p('c', 'Nafisah binti Syahronah'), p('m', 'Syahronah'), p('g', 'Asma')].map((person, i) => ({ ...person, gender: i === 0 ? 'F' as const : null }));
  const path = { ids: ['c', 'm', 'g'], steps: [
    { from: 'c', to: 'm', kind: 'parent' as const, recordId: 'c', field: 'mother_id' },
    { from: 'm', to: 'g', kind: 'parent' as const, recordId: 'm', field: 'mother_id' }
  ] };
  assert.deepEqual(describeKinshipPath(path, persons), ['Nafisah binti Syahronah [bin/binti belum diketahui] Asma']);
});


test('patronymic stored in a name stays quoted when it is not the linked parent name', () => {
  const records = [ { ...p('child', 'Umamah bin Sholeh Tsani'), gender: 'F' as const }, p('parent', 'KH. Nawawi (KH. Sholeh Tsani)') ];
  const path = { ids: ['child', 'parent'], steps: [{ from: 'child', to: 'parent', kind: 'parent' as const, recordId: 'child', field: 'father_id' }] };
  assert.deepEqual(describeKinshipPath(path, records), ['“Umamah bin Sholeh Tsani” binti KH. Nawawi (KH. Sholeh Tsani)']);
});
