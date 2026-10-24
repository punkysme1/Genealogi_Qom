import type { Individual } from '../types';

export function branchSymbol(position: number): string {
  if (!Number.isSafeInteger(position) || position < 1) throw new Error('Urutan harus bilangan bulat positif.');
  return position <= 9 ? String(position) : position <= 35 ? String.fromCharCode(55 + position) : `(${position})`;
}

export function childOrder(child: Individual, parentId: string): number | undefined {
  const entry = child.child_order?.[parentId];
  if (![child.father_id, child.mother_id].includes(parentId) || !entry || !Number.isSafeInteger(entry.position) || entry.position < 1 || !entry.source?.trim()) return undefined;
  return entry.position;
}

export function compareSiblingOrder(a: Individual, b: Individual): number {
  const comparisons = [a.father_id, a.mother_id].filter((id): id is string => !!id && [b.father_id, b.mother_id].includes(id))
    .map(id => { const x = childOrder(a, id), y = childOrder(b, id); return x && y ? Math.sign(x - y) : undefined; })
    .filter((n): n is number => n !== undefined);
  return comparisons.length && new Set(comparisons).size === 1 ? comparisons[0] : 0;
}

export interface NumberedPath { ids: string[]; code: string | null; depth: number }
export function lineagePaths(personId: string, people: Individual[], rootId?: string, limit = 5000) {
  const configured = people.find(p => Object.prototype.hasOwnProperty.call(p, 'numbering_root_id'));
  if (!rootId && configured) rootId = configured.numbering_root_id || '__unconfigured__';
  const roots = people.filter(p => /^(kiai|kyai|kh\.?|k\.h\.)?\s*qomaruddin$/i.test(p.name.trim()));
  const root = rootId ? people.find(p => p.id === rootId) : roots.length === 1 ? roots[0] : undefined;
  const paths: NumberedPath[] = [];
  const warnings = new Set<string>();
  if (!root) return { paths, truncated: false, warnings: ['Tokoh pangkal Kiai Qomaruddin belum ditetapkan secara unik.'], rootId: undefined };
  const map = new Map(people.map(p => [p.id, p]));
  const positions = new Map<string, number>();
  for (const child of people) for (const parent of new Set([child.father_id, child.mother_id])) if (parent) {
    const position = childOrder(child, parent);
    if (position) { const key = `${parent}:${position}`; positions.set(key, (positions.get(key) || 0) + 1); }
  }
  let visits = 0, truncated = false;
  const walk = (id: string, ids: string[], segments: string[], complete: boolean) => {
    if (++visits > limit) { truncated = true; return; }
    if (ids.includes(id)) { warnings.add('Siklus orang tua ditemukan; jalur tersebut dihentikan.'); return; }
    const person = map.get(id);
    if (!person) { warnings.add('Profil pada jalur belum tersedia.'); return; }
    const next = [...ids, id];
    if (id === root.id) { paths.push({ ids: next, code: complete ? segments.slice().reverse().join('') || 'G0' : null, depth: ids.length }); return; }
    if (next.length > 100) { truncated = true; return; }
    for (const parent of [...new Set([person.father_id, person.mother_id].filter((p): p is string => !!p))].sort()) {
      const position = childOrder(person, parent);
      const valid = !!position && positions.get(`${parent}:${position}`) === 1;
      if (!valid) warnings.add('Ada urutan anak yang belum bersumber atau bertabrakan; kode jalur belum lengkap.');
      walk(parent, next, [...segments, valid ? branchSymbol(position!) : '?'], complete && valid);
    }
  };
  walk(personId, [], [], true);
  paths.sort((a, b) => a.depth - b.depth || a.ids.join('/').localeCompare(b.ids.join('/')));
  return { paths, truncated, warnings: [...warnings], rootId: root.id };
}

// Pure preview: persistence must use one server transaction with a revision check.
export function previewChildInsertion(people: Individual[], childId: string, parentId: string, position: number, source: string, locator: string) {
  branchSymbol(position);
  const child = people.find(p => p.id === childId);
  if (!child || ![child.father_id, child.mother_id].includes(parentId) || !source.trim() || !locator.trim()) throw new Error('Hubungan orang tua, sumber, dan lokasi rujukan wajib diisi.');
  const old = childOrder(child, parentId);
  const updated = people.map(p => {
    const current = childOrder(p, parentId);
    if (p.id === childId) return { ...p, child_order: { ...p.child_order, [parentId]: { position, source: source.trim(), locator: locator.trim() } } };
    if (!current) return p;
    const compacted = old && current > old ? current - 1 : current;
    const shifted = compacted >= position ? compacted + 1 : compacted;
    return shifted === current ? p : { ...p, child_order: { ...p.child_order, [parentId]: { ...p.child_order![parentId], position: shifted } } };
  });
  const affected = new Set(updated.filter((p, i) => p !== people[i]).map(p => p.id));
  let changed = true;
  while (changed) { changed = false; for (const p of people) if (!affected.has(p.id) && [p.father_id, p.mother_id].some(id => id && affected.has(id))) { affected.add(p.id); changed = true; } }
  return { people: updated, affectedIds: [...affected] };
}

export function numberingSnapshot(people: Individual[]) {
  // Canonical input for a server-issued revision; this is not an official document number.
  return JSON.stringify(people.map(p => ({ id: p.id, father: p.father_id || null, mother: p.mother_id || null,
    order: Object.entries(p.child_order || {}).sort(([a], [b]) => a.localeCompare(b)), complete: p.children_complete === true }))
    .sort((a, b) => a.id.localeCompare(b.id)));
}
