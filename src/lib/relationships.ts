import { compareSiblingOrder, childOrder } from './lineage-numbering';
import type { Individual, Marriage, Adoption, KinshipPath, KinshipStep, RelationshipResult, RelationshipType } from '../types';
import { descendantTerms, generationTerm } from './kinship-terms';

export const getJavaneseDescendantTerm = (level: number) => `${descendantTerms[level] || 'Keturunan'} (G${level + 1})`;

export function compareAge(a: Individual, b: Individual): number {
  return compareSiblingOrder(a, b);
}

export function siblingKind(a: Individual, b: Individual): 'full' | 'half' | 'partial' | null {
  if (a.id === b.id) return null;
  const father = !!a.father_id && a.father_id === b.father_id;
  const mother = !!a.mother_id && a.mother_id === b.mother_id;
  if (father && mother) return 'full';
  if ((father && a.mother_id && b.mother_id) || (mother && a.father_id && b.father_id)) return 'half';
  return father || mother ? 'partial' : null;
}

export function kinshipGraph(people: Individual[], marriages: Marriage[] = [], adoptions: Adoption[] = []) {
  const map = new Map(people.map(p => [p.id, p]));
  const edges = new Map<string, KinshipStep[]>();
  const add = (from: string, to: string, kind: KinshipStep['kind'], recordId: string, field: string) => {
    if (!map.has(from) || !map.has(to)) return;
    edges.set(from, [...(edges.get(from) || []), { from, to, kind, recordId, field }]);
  };
  for (const p of map.values()) for (const field of ['father_id', 'mother_id'] as const) {
    const parent = p[field];
    if (parent) { add(p.id, parent, 'parent', p.id, field); add(parent, p.id, 'child', p.id, field); }
  }
  for (const m of marriages) if (m.is_active === true) {
    add(m.husband_id, m.wife_id, 'spouse', m.id, 'marriages');
    add(m.wife_id, m.husband_id, 'spouse', m.id, 'marriages');
  }
  for (const a of adoptions) {
    add(a.child_id, a.parent_id, 'adoptive_parent', a.id, 'adoptions');
    add(a.parent_id, a.child_id, 'adopted_child', a.id, 'adoptions');
  }
  for (const list of edges.values()) list.sort((a, b) => a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind));
  return { map, edges };
}

export interface LineageEntry { id: string; depth: number; label: string; path: KinshipPath }
export function traceLineage(root: string, direction: 'ancestors' | 'descendants', people: Individual[], depthLimit?: number, maxPaths = 5000) {
  const { map, edges } = kinshipGraph(people);
  const limit = Math.min(direction === 'ancestors' ? 19 : 18, Math.max(1, Math.floor(depthLimit || (direction === 'ancestors' ? 19 : 18))));
  const budget = Math.max(1, Math.min(5000, Math.floor(maxPaths)));
  const entries: LineageEntry[] = [];
  const queue: KinshipPath[] = map.has(root) ? [{ ids: [root], steps: [] }] : [];
  let cycleDetected = false, truncated = false;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const path = queue[cursor];
    for (const edge of edges.get(path.ids.at(-1)!) || []) {
      if (edge.kind !== (direction === 'ancestors' ? 'parent' : 'child')) continue;
      if (path.ids.includes(edge.to)) { cycleDetected = true; continue; }
      if (path.steps.length >= limit || entries.length >= budget) { truncated = true; continue; }
      const next = { ids: [...path.ids, edge.to], steps: [...path.steps, edge] };
      entries.push({ id: edge.to, depth: next.steps.length, label: generationTerm(direction, next.steps.length, map.get(edge.to)?.gender), path: next });
      queue.push(next);
    }
  }
  return { entries, truncated, cycleDetected };
}

export function childPosition(person: Individual, people: Individual[]) {
  const parents = [person.father_id, person.mother_id].filter((id): id is string => !!id);
  const labels = parents.flatMap(id => {
    const parent = people.find(p => p.id === id), order = childOrder(person, id);
    if (!parent || !order || !parent.children_complete) return [];
    const children = people.filter(p => [p.father_id, p.mother_id].includes(id));
    const positions = children.map(p => childOrder(p, id)).sort((a, b) => (a || 0) - (b || 0));
    if (positions.some((n, i) => n !== i + 1) || children.length < 2) return [];
    const label = order === 1 ? 'Anak Pembarep / Mbarep' : order === children.length ? 'Anak Wuragil / Ragil' : 'Anak Penengah / Tengah';
    return [`${label} dari ${parent.name} menurut daftar anak lengkap bersumber`];
  });
  return labels.length ? labels.join('; ') : null;
}

const reversePath = (path: KinshipPath): KinshipPath => ({ ids: [...path.ids].reverse(), steps: [...path.steps].reverse().map(s => ({ ...s, from: s.to, to: s.from, kind: s.kind === 'parent' ? 'child' : s.kind === 'child' ? 'parent' : s.kind })) });
const joinPaths = (a: KinshipPath, b: KinshipPath): KinshipPath => ({ ids: [...a.ids, ...reversePath(b).ids.slice(1)], steps: [...a.steps, ...reversePath(b).steps] });

export function calculateRelationship(fromId: string, toId: string, people: Individual[], marriages: Marriage[] = [], adoptions: Adoption[] = []): RelationshipResult {
  const { map, edges } = kinshipGraph(people, marriages, adoptions);
  const from = map.get(fromId), to = map.get(toId);
  const warnings: string[] = ['Hasil mengikuti data yang dapat dibaca; jalur tercatat belum membuktikan kelengkapan atau kebenaran historis.'];
  let truncated = false;
  const result = (type: RelationshipType, label: string, paths: KinshipPath[] = []): RelationshipResult => ({ fromId, toId, type, label, distance: paths[0]?.steps.length || 0, paths: paths.slice(0, 20), warnings, truncated: truncated || paths.length > 20,
    description: type === 'TIDAK_ADA_HUBUNGAN' ? label : `${from?.name} adalah ${label} bagi ${to?.name}.` });
  if (!from || !to) return result('TIDAK_ADA_HUBUNGAN', 'Profil belum tersedia pada data yang dapat dibaca.');
  if (fromId === toId) return result('DIRI_SENDIRI', 'Diri sendiri', [{ ids: [fromId], steps: [] }]);
  const a = traceLineage(fromId, 'ancestors', people), b = traceLineage(toId, 'ancestors', people);
  truncated = a.truncated || b.truncated;
  if (a.cycleDetected || b.cycleDetected) {
    warnings.push('Siklus orang tua terdeteksi. Perbaiki relasi sebelum menyimpulkan kekerabatan.');
    return result('TIDAK_ADA_HUBUNGAN', 'Perhitungan ditahan karena siklus silsilah.');
  }
  const directSpouses = (edges.get(fromId) || []).filter(e => e.kind === 'spouse' && e.to === toId);
  if (directSpouses.length) {
    warnings.push('Perkawinan aktif ditampilkan sebagai hubungan utama; ini tidak meniadakan jalur kekerabatan darah lain.');
    return result('PASANGAN', 'Bojo / Garwa', directSpouses.map(e => ({ ids: [fromId, toId], steps: [e] })));
  }
  const ancestors = b.entries.filter(p => p.id === fromId);
  if (new Set(ancestors.map(p => p.depth)).size > 1) warnings.push('Terdapat beberapa jarak generasi; sebutan utama mengikuti jalur terpendek.');
  if (ancestors.length) return result('LELUHUR', generationTerm('ancestors', ancestors[0].depth, from.gender), ancestors.map(p => reversePath(p.path)));
  const descendants = a.entries.filter(p => p.id === toId);
  if (new Set(descendants.map(p => p.depth)).size > 1) warnings.push('Terdapat beberapa jarak generasi; sebutan utama mengikuti jalur terpendek.');
  if (descendants.length) return result('KETURUNAN', generationTerm('descendants', descendants[0].depth, from.gender), descendants.map(p => p.path));

  const candidates: { a: LineageEntry; b: LineageEntry; path: KinshipPath }[] = [];
  const byAncestor = new Map<string, LineageEntry[]>();
  for (const entry of b.entries) byAncestor.set(entry.id, [...(byAncestor.get(entry.id) || []), entry]);
  let checked = 0;
  outer: for (const x of a.entries) for (const y of byAncestor.get(x.id) || []) {
    if (++checked > 5000) { truncated = true; break outer; }
    if (x.path.ids.slice(0, -1).some(id => y.path.ids.includes(id))) continue;
    candidates.push({ a: x, b: y, path: joinPaths(x.path, y.path) });
  }
  candidates.sort((x, y) => x.path.steps.length - y.path.steps.length);
  if (candidates.length) {
    const c = candidates[0], x = c.a.depth, y = c.b.depth;
    const paths = candidates.filter(p => p.a.depth === x && p.b.depth === y).map(p => p.path);
    const branchA = map.get(c.a.path.ids[x - 1])!, branchB = map.get(c.b.path.ids[y - 1])!;
    const branchOrders = candidates.filter(p => p.a.depth === x && p.b.depth === y)
      .map(p => Math.sign(compareAge(map.get(p.a.path.ids[x - 1])!, map.get(p.b.path.ids[y - 1])!)));
    const order = new Set(branchOrders).size === 1 ? branchOrders[0] : 0;
    if (new Set(branchOrders).size > 1) warnings.push('Urutan cabang berbeda atau belum lengkap di antara jalur; sebutan senioritas tidak disimpulkan.');
    if (siblingKind(branchA, branchB) === 'partial') warnings.push('Salah satu orang tua pada cabang bersama belum diketahui; hubungan saudara kandung penuh belum dapat dipastikan.');
    if (siblingKind(branchA, branchB) === 'half') warnings.push('Jalur ini melewati saudara seayah atau seibu, bukan saudara kandung penuh.');
    if (x === 1 && y === 1) {
      const kind = siblingKind(from, to);
      const label = kind === 'half' ? 'Sedulur / Sadulur Kuwalon' : kind === 'partial' ? 'Saudara melalui satu orang tua yang tercatat' : order < 0 ? from.gender === 'M' ? 'Kakang / Mas / Kangmas / Raka' : from.gender === 'F' ? 'Mbak / Mbakyu' : 'Kakak' : order > 0 ? from.gender === 'M' ? 'Adhi / Dhik / Dimas / Rayi' : from.gender === 'F' ? 'Adik / Diajeng / Jeng' : 'Adhi / Dhik' : 'Sedulur / Sadulur (urutan silsilah belum diketahui)';
      return result('SAUDARA', label, paths);
    }
    if (x === 1 && y === 2) return result(from.gender === 'M' ? 'PAMAN' : 'BIBI', order < 0 ? from.gender === 'M' ? 'Pakdhe / Bapak Gedhe / Uwa / Pak Puh' : from.gender === 'F' ? 'Budhe / Ibu Gedhe / Uwa / Bu Puh' : 'Kakak orang tua' : order > 0 ? from.gender === 'M' ? 'Paklik / Bapak Cilik / Om' : from.gender === 'F' ? 'Bulik / Ibu Cilik / Tante' : 'Adik orang tua' : `${from.gender === 'M' ? 'Paman' : from.gender === 'F' ? 'Bibi' : 'Saudara orang tua'} (urutan silsilah terhadap orang tua belum diketahui)`, paths);
    if (x === 2 && y === 1) return result('KEPONAKAN', 'Ponakan / Keponakan', paths);
    if (x === y && (x === 2 || x === 3)) {
      const term = x === 2 ? 'Misan' : 'Mindhoan';
      return result('SEPUPU', order < 0 ? `${from.gender === 'M' ? 'Mas' : from.gender === 'F' ? 'Mbak' : 'Kakak cabang'} ${term}` : order > 0 ? `Adik ${term}` : x === 2 ? 'Misanan (urutan cabang belum diketahui)' : 'Mindhoan (urutan cabang belum diketahui)', paths);
    }
    return result('KERABAT', `Kerabat melalui leluhur bersama (${x} tingkat ke atas dari subjek; ${y} dari target)`, paths);
  }

  // Affinal paths use only explicitly active marriages. Adoption is never inferred.
  const queue: KinshipPath[] = [{ ids: [fromId], steps: [] }];
  const matches: { path: KinshipPath; type: RelationshipType; label: string }[] = [];
  const codes = { parent: 'U', child: 'D', spouse: 'S', adoptive_parent: 'A', adopted_child: 'C' };
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const p = queue[cursor];
    if (p.steps.length >= 4) continue;
    for (const e of edges.get(p.ids.at(-1)!) || []) {
      if (p.ids.includes(e.to)) continue;
      if (queue.length >= 5000) { truncated = true; continue; }
      const next = { ids: [...p.ids, e.to], steps: [...p.steps, e] };
      queue.push(next);
      if (e.to !== toId) continue;
      const code = next.steps.map(s => codes[s.kind]).join('');
      let label = '', type: RelationshipType = 'KERABAT';
      if (code === 'S') { label = 'Bojo / Garwa'; type = 'PASANGAN'; }
      if (code === 'A') { label = 'Anak Pupon'; type = 'ANGKAT'; }
      if (code === 'C') { label = 'Orang tua angkat'; type = 'ANGKAT'; }
      if (code === 'DS') { label = 'Maratuwa / Morotuwo'; type = 'MERTUA'; }
      if (code === 'SU') { label = 'Mantu / Anak Mantu'; type = 'MENANTU'; }
      if (code === 'SUU') { label = 'Putu Mantu'; type = 'MENANTU'; }
      if (code === 'DSU') { label = 'Besan'; type = 'BESAN'; }
      if (code === 'UDS' || code === 'SUD') { label = 'Ipe'; type = 'IPAR'; }
      if (code === 'SUDS') { label = 'Pripean'; type = 'PRIPEAN'; }
      if (code === 'SD') {
        const biological = from.gender === 'M' ? to.father_id : from.gender === 'F' ? to.mother_id : undefined;
        if (biological && biological !== fromId) { label = from.gender === 'M' ? 'Bapak Kuwalon' : 'Ibu Kuwalon'; type = 'TIRI'; }
      }
      if (code === 'US') {
        const biological = to.gender === 'M' ? from.father_id : to.gender === 'F' ? from.mother_id : undefined;
        if (biological && biological !== toId) { label = 'Anak Kuwalon'; type = 'TIRI'; }
      }
      if (label) matches.push({ path: next, label, type });
    }
  }
  if (matches.length) {
    const first = matches[0];
    warnings.push('Hubungan perkawinan menggunakan perkawinan berstatus aktif; status masa lampau tidak disimpulkan.');
    return result(first.type, first.label, matches.filter(m => m.label === first.label).map(m => m.path));
  }
  return result('TIDAK_ADA_HUBUNGAN', 'Belum ditemukan jalur pada data yang dapat dibaca dan batas penelusuran.');
}
