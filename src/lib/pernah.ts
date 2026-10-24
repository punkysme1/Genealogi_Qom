import type { Individual, Marriage, Adoption, KinshipPath } from '../types';
import { calculateRelationship, compareAge, kinshipGraph, siblingKind, traceLineage } from './relationships';
import { descendantTerms } from './kinship-terms';

export interface PernahRoute {
  path?: KinshipPath;
  branches?: { from: KinshipPath; to: KinshipPath };
  narrative: string[];
}
export interface PernahCard {
  id: string;
  title: string;
  via: string;
  descriptions: string[];
  routes: PernahRoute[];
  warnings: string[];
  truncated: boolean;
  ancestorId?: string;
  depths?: [number, number];
}
export interface PernahResult { cards: PernahCard[]; alternativePaths?: PernahCard[]; warnings: string[]; truncated: boolean; message?: string }
export interface PernahGroup { id: string; title: string; via: string; descriptions: string[]; members: PernahCard[] }

// Summary preference: keep the nearest equal-generation category, regardless
// of which root supplied it. Unequal-generation and direct relations stay visible.
export function nearestGenerationSummary(cards: PernahCard[]) {
  const equalDepth = (card: PernahCard) => card.ancestorId && card.depths && card.depths[0] === card.depths[1] ? card.depths[0] : undefined;
  const depths = cards.map(equalDepth).filter((depth): depth is number => depth !== undefined);
  const nearest = depths.length ? Math.min(...depths) : undefined;
  const visible: PernahCard[] = [], deferred: PernahCard[] = [];
  for (const card of cards) {
    const depth = equalDepth(card);
    if (depth !== undefined && nearest !== undefined && depth > nearest) {
      deferred.push({ ...card, descriptions: [
        `Acuan generasi ke-${depth} tetap tersedia untuk penelusuran. Ringkasan hanya menampilkan kelompok segenerasi terdekat, yaitu ${sharedGenerationTerm(nearest)}.`,
        ...card.descriptions,
      ] });
    } else visible.push(card);
  }
  return { visible, deferred };
}

export function pernahDistance(card: PernahCard): number {
  const distances = card.routes.map(route => route.path?.steps.length ??
    (route.branches ? route.branches.from.steps.length + route.branches.to.steps.length : Infinity));
  return distances.length ? Math.min(...distances) : card.depths ? card.depths[0] + card.depths[1] : Infinity;
}

export function groupPernahCards(cards: PernahCard[]): PernahGroup[] {
  const groups = new Map<string, PernahGroup>();
  for (const card of [...cards].sort((a, b) => pernahDistance(a) - pernahDistance(b))) {
    const key = `term:${card.title}`;
    const group = groups.get(key);
    if (group) {
      group.members.push(card);
    } else groups.set(key, { id: key, title: card.title, via: card.via,
      descriptions: card.descriptions,
      members: [card] });
  }
  return [...groups.values()].map(group => {
    if (group.members.length === 1) return group;
    const ancestors = new Map<string, string>();
    const otherContexts = new Set<string>();
    for (const member of group.members) {
      if (member.ancestorId) ancestors.set(member.ancestorId, member.via.replace(/^Dari /, ''));
      else otherContexts.add(member.via);
    }
    return { ...group,
      via: [ancestors.size ? `Dari ${[...ancestors.values()].join(', ')}` : '', ...otherContexts].filter(Boolean).join(' · '),
      descriptions: ['Pilih acuan untuk melihat arah hubungan dan jalurnya. Setiap acuan tetap memiliki penjelasan tersendiri.'],
    };
  });
}

// Shared-ancestor depth counts parent links: ancestor = 0, child = 1.
// Minglimo/Mingnem follow the curator's project vocabulary, not a cousin-degree formula.
export function sharedGenerationTerm(depth: number) {
  return ({ 2: 'Misanan', 3: 'Mindhoan', 4: 'Mingempat', 5: 'Minglimo', 6: 'Mingnem' } as Record<number, string>)[depth]
    || `Kerabat segenerasi ke-${depth}`;
}

export function collateralTerm(gap: number) {
  return gap === 1 ? 'Ponakan' : descendantTerms[gap - 1] || `Kerabat selisih ${gap} generasi`;
}

function siblingSentence(a: Individual, b: Individual) {
  const kind = siblingKind(a, b);
  const order = compareAge(a, b);
  const relation = order < 0 ? 'kakak' : order > 0 ? 'adik' : 'saudara';
  const qualifier = kind === 'half' ? ' (seayah atau seibu)' : kind === 'partial' ? ' (satu orang tua bersama tercatat; data orang tua lainnya belum lengkap)' : '';
  return `${a.name} adalah ${relation} dari ${b.name}${qualifier}.`;
}

export function describeKinshipPath(path: KinshipPath, people: Individual[]): string[] {
  const map = new Map(people.map(p => [p.id, p]));
  const lines: string[] = [];
  const lineage = (ids: string[]) => ids.map((id, index) => {
    const person = map.get(id), parent = map.get(ids[index + 1]);
    let name = person?.name || 'Profil belum tersedia';
    if (!parent) return name;
    // Avoid repeating an explicitly stored patronymic when it matches this edge.
    const suffix = name.match(/^(.*?)\s+(?:bin|binti)\s+(.+)$/i);
    if (suffix && suffix[2].trim().toLocaleLowerCase() === parent.name.trim().toLocaleLowerCase()) name = suffix[1];
    else if (suffix) name = `“${name}”`;
    const link = person?.gender === 'M' ? 'bin' : person?.gender === 'F' ? 'binti' : '[bin/binti belum diketahui]';
    return `${name} ${link}`;
  }).join(' ');
  for (let i = 0; i < path.steps.length; i++) {
    const step = path.steps[i], next = path.steps[i + 1];
    const from = map.get(step.from), to = map.get(step.to);
    if (!from || !to) continue;
    if (step.kind === 'parent' || step.kind === 'child') {
      const ids = [step.from, step.to];
      while (path.steps[i + 1]?.kind === step.kind && path.steps[i + 1].from === ids.at(-1)) ids.push(path.steps[++i].to);
      lines.push(lineage(step.kind === 'child' ? ids.reverse() : ids));
      continue;
    }
    if (step.kind === 'spouse') lines.push(`${from.name} adalah ${from.gender === 'M' ? 'suami' : from.gender === 'F' ? 'istri' : 'pasangan'} dari ${to.name}.`);
    if (step.kind === 'adoptive_parent') lines.push(`${from.name} adalah anak angkat dari ${to.name}.`);
    if (step.kind === 'adopted_child') lines.push(`${from.name} adalah orang tua angkat dari ${to.name}.`);
  }
  return lines;
}

function uncleTerm(uncle: Individual, relatedSibling: Individual, parent: Individual) {
  const order = compareAge(relatedSibling, parent);
  if (order > 0) return uncle.gender === 'M' ? 'Paklik' : uncle.gender === 'F' ? 'Bulik' : 'Pasangan adik orang tua';
  if (order < 0) return uncle.gender === 'M' ? 'Pakdhe' : uncle.gender === 'F' ? 'Budhe' : 'Pasangan kakak orang tua';
  return uncle.gender === 'M' ? 'Paman' : uncle.gender === 'F' ? 'Bibi' : 'Pasangan saudara orang tua';
}

function reverse(path: KinshipPath): KinshipPath {
  const inverse = { parent: 'child', child: 'parent', spouse: 'spouse', adoptive_parent: 'adopted_child', adopted_child: 'adoptive_parent' } as const;
  return { ids: [...path.ids].reverse(), steps: [...path.steps].reverse().map(s => ({ ...s, from: s.to, to: s.from, kind: inverse[s.kind] })) };
}

export function calculatePernah(fromId: string, toId: string, people: Individual[], marriages: Marriage[] = [], adoptions: Adoption[] = []): PernahResult {
  const { map, edges } = kinshipGraph(people, marriages, adoptions);
  const from = map.get(fromId), to = map.get(toId);
  const cards = new Map<string, PernahCard>();
  const warnings: string[] = [];
  let truncated = false;
  if (!from || !to) return { cards: [], warnings, truncated, message: 'Profil belum tersedia pada data yang dapat dibaca.' };
  const upFrom = traceLineage(fromId, 'ancestors', people), upTo = traceLineage(toId, 'ancestors', people);
  if (upFrom.cycleDetected || upTo.cycleDetected) return { cards: [], warnings: ['Perbaiki relasi orang tua yang berputar sebelum menarik kesimpulan.'], truncated: false, message: 'Perhitungan ditahan karena siklus silsilah.' };
  truncated = upFrom.truncated || upTo.truncated;
  const add = (card: PernahCard) => {
    const current = cards.get(card.id);
    if (!current) { cards.set(card.id, card); return; }
    current.warnings = [...new Set([...current.warnings, ...card.warnings])];
    for (const route of card.routes) {
      const signature = JSON.stringify(route.path || route.branches);
      if (current.routes.some(r => JSON.stringify(r.path || r.branches) === signature)) continue;
      if (current.routes.length >= 20) { current.truncated = true; continue; }
      current.routes.push(route);
    }
  };

  // Preserve direct, sibling and blood uncle/nephew relationships; enumerate shared
  // ancestors separately so a closest ancestor does not hide an older one.
  const primary = calculateRelationship(fromId, toId, people, marriages, adoptions);
  if (['DIRI_SENDIRI', 'LELUHUR', 'KETURUNAN', 'SAUDARA', 'PAMAN', 'BIBI', 'KEPONAKAN'].includes(primary.type)) {
    const inverse = calculateRelationship(toId, fromId, people, marriages, adoptions);
    add({ id: `blood:${primary.type}`, title: ['PAMAN', 'BIBI', 'KEPONAKAN'].includes(primary.type) ? 'Ponakan' : primary.label || primary.type,
      via: 'Hubungan darah', descriptions: fromId === toId ? [primary.description] : [primary.description, inverse.description],
      routes: (primary.paths || []).map(path => ({ path, narrative: describeKinshipPath(path, people) })), warnings: primary.warnings || [], truncated: !!primary.truncated });
  }
  if (fromId === toId) return { cards: [...cards.values()], warnings, truncated };

  // Include every shared ancestor, including roots above an already-shared branch.
  // Keep two rootward paths rather than manufacture a simple path with repeated nodes.
  const byAncestor = new Map<string, typeof upTo.entries>();
  for (const entry of upTo.entries) byAncestor.set(entry.id, [...(byAncestor.get(entry.id) || []), entry]);
  let pairs = 0;
  outer: for (const a of upFrom.entries) for (const b of byAncestor.get(a.id) || []) {
    if (++pairs > 5000) { truncated = true; break outer; }
    if (a.depth < 2 || b.depth < 2) continue;
    // Misanan/Mindhoan require distinct branches. A more distant named root
    // (Minglimo/Mingnem) remains an explicit root-relative generation statement.
    const sharedBelowRoot = a.path.ids.slice(0, -1).some(id => b.path.ids.slice(0, -1).includes(id));
    if (a.depth === b.depth && a.depth <= 3 && sharedBelowRoot) continue;
    // Direct ancestor/descendant pairs should not be mislabeled as cousins.
    if (a.path.ids.includes(toId) || b.path.ids.includes(fromId)) continue;
    const ancestor = map.get(a.id)!;
    const gap = Math.abs(a.depth - b.depth);
    const title = gap === 0 ? sharedGenerationTerm(a.depth) : collateralTerm(gap);
    add({ id: `ancestor:${ancestor.id}:${a.depth}:${b.depth}`, title, via: `Dari ${ancestor.name}`,
      ancestorId: ancestor.id, depths: [a.depth, b.depth],
      descriptions: gap === 0
        ? [`${from.name} dan ${to.name} sama-sama keturunan generasi ke-${a.depth} dari ${ancestor.name}.`]
        : [`${a.depth > b.depth ? from.name : to.name} pernah ${title} terhadap ${a.depth > b.depth ? to.name : from.name}, melalui cabang ${ancestor.name}.`,
          `${from.name}: ${a.depth} langkah; ${to.name}: ${b.depth} langkah. Sebutan kekerabatan cabang (selisih ${gap}), bukan keturunan langsung.`],
      routes: [{ branches: { from: a.path, to: b.path }, narrative: [] }], warnings: [], truncated: false });
  }

  const queue: KinshipPath[] = [{ ids: [fromId], steps: [] }];
  const codes = { parent: 'U', child: 'D', spouse: 'S', adoptive_parent: 'A', adopted_child: 'C' };
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const path = queue[cursor];
    if (path.steps.length >= 4) continue;
    for (const edge of edges.get(path.ids.at(-1)!) || []) {
      if (path.ids.includes(edge.to)) continue;
      if (queue.length >= 5000) { truncated = true; continue; }
      const next = { ids: [...path.ids, edge.to], steps: [...path.steps, edge] };
      queue.push(next);
      if (edge.to !== toId) continue;
      const code = next.steps.map(s => codes[s.kind]).join('');
      let title = '', forward = '', backward = '', via = 'Melalui perkawinan aktif';
      let route = next;
      const notes: string[] = [];
      if (code === 'UUDS' || code === 'SUDD') {
        const nephewFirst = code === 'UUDS';
        const nephew = nephewFirst ? from : to, uncle = nephewFirst ? to : from;
        const parent = map.get(next.ids[nephewFirst ? 1 : 3])!, partner = map.get(next.ids[nephewFirst ? 3 : 1])!;
        if (!siblingKind(parent, partner)) continue;
        const term = uncleTerm(uncle, partner, parent);
        title = 'Ponakan';
        forward = `${nephew.name} adalah Ponakan / Keponakan ${uncle.name} melalui perkawinan.`;
        backward = `${uncle.name} adalah ${term} ${nephew.name}, melalui ${partner.name}.`;
        via = `Melalui ${parent.name} dan ${partner.name}`;
        route = nephewFirst ? next : reverse(next);
        if (!compareAge(partner, parent)) notes.push('Pakdhe/Paklik atau Budhe/Bulik belum dapat ditentukan: urutan silsilah saudara orang tua belum diketahui.');
        if (siblingKind(parent, partner) !== 'full') notes.push('Jalur saudara orang tua belum menunjukkan dua orang tua kandung yang sama.');
      }
      const pairs: Record<string, [string, string, string]> = {
        S: ['Bojo / Garwa', 'Bojo / Garwa', 'Bojo / Garwa'],
        DS: ['Maratuwa / Mantu', 'Maratuwa / Morotuwo', 'Mantu / Anak Mantu'],
        SU: ['Maratuwa / Mantu', 'Mantu / Anak Mantu', 'Maratuwa / Morotuwo'],
        SUU: ['Putu Mantu', 'Putu Mantu', 'Eyang dari pasangan'],
        DDS: ['Putu Mantu', 'Eyang dari pasangan', 'Putu Mantu'],
        DSU: ['Besan', 'Besan', 'Besan'], UDS: ['Ipe', 'Ipe', 'Ipe'], SUD: ['Ipe', 'Ipe', 'Ipe'],
        SUDS: ['Pripean', 'Pripean', 'Pripean'],
        A: ['Anak Pupon', 'Anak Pupon', 'Orang tua angkat'], C: ['Anak Pupon', 'Orang tua angkat', 'Anak Pupon'],
      };
      if (pairs[code]) {
        const [t, f, b] = pairs[code]; title = t; forward = `${from.name} adalah ${f} bagi ${to.name}.`; backward = `${to.name} adalah ${b} bagi ${from.name}.`;
        if (code === 'A' || code === 'C') via = 'Relasi adopsi tercatat';
      }
      if (code === 'SD' || code === 'US') {
        const adult = code === 'SD' ? from : to, child = code === 'SD' ? to : from;
        const biological = adult.gender === 'M' ? child.father_id : adult.gender === 'F' ? child.mother_id : undefined;
        if (!biological || biological === adult.id) continue;
        title = 'Kuwalon'; forward = `${child.name} adalah Anak Kuwalon ${adult.name}.`;
        backward = `${adult.name} adalah ${adult.gender === 'M' ? 'Bapak' : 'Ibu'} Kuwalon ${child.name}.`;
      }
      if (!title) continue;
      // Descriptions and intermediary identities belong to the grouping key: different
      // marriages must not acquire another path's seniority label or explanation.
      add({ id: `affinal:${title}:${forward}:${backward}`, title, via, descriptions: [forward, backward], routes: [{ path: route, narrative: describeKinshipPath(route, people) }], warnings: notes, truncated: false });
    }
  }
  const result = [...cards.values()].sort((a, b) => Number(!!a.ancestorId) - Number(!!b.ancestorId)
    || (a.depths?.[0] || 0) + (a.depths?.[1] || 0) - (b.depths?.[0] || 0) - (b.depths?.[1] || 0)
    || a.title.localeCompare(b.title) || a.via.localeCompare(b.via));
  const alternativePaths: PernahCard[] = [];
  const relationships: PernahCard[] = [];
  // A farther root adds no new relationship when both paths already meet at
  // a closer person or a recorded ancestral couple. Keep these routes as detail.
  const spouses = new Map<string, Set<string>>();
  for (const marriage of marriages) {
    if (!map.has(marriage.husband_id) || !map.has(marriage.wife_id)) continue;
    for (const [x, y] of [[marriage.husband_id, marriage.wife_id], [marriage.wife_id, marriage.husband_id]]) {
      if (!spouses.has(x)) spouses.set(x, new Set());
      spouses.get(x)!.add(y);
    }
  }
  for (const card of result) {
    if (!card.ancestorId) { relationships.push(card); continue; }
    const kept: PernahRoute[] = [], redundant: PernahRoute[] = [];
    for (const route of card.routes) {
      const left = route.branches?.from.ids.slice(1, -1) || [];
      const right = new Set(route.branches?.to.ids.slice(1, -1) || []);
      const nearerMeeting = left.some(id => right.has(id) || [...(spouses.get(id) || [])].some(partner => right.has(partner)));
      (nearerMeeting ? redundant : kept).push(route);
    }
    if (kept.length) relationships.push({ ...card, routes: kept });
    if (redundant.length) alternativePaths.push({ ...card, routes: redundant,
      descriptions: [`Jalur menuju ${map.get(card.ancestorId)?.name} ini sudah bertemu pada tokoh atau pasangan leluhur yang lebih dekat. Tidak dihitung sebagai hubungan tambahan.`] });
  }
  if (result.some(c => c.ancestorId)) warnings.push('Ringkasan memakai pertemuan terdekat pada setiap cabang. Sebutan Ponakan/Putu/Buyut lintas cabang mengikuti selisih generasi dan bukan klaim keturunan langsung.');
  const summary = nearestGenerationSummary(relationships);
  alternativePaths.push(...summary.deferred);
  if (summary.deferred.length) warnings.push('Hanya kelompok segenerasi terdekat ditampilkan pada ringkasan; generasi yang lebih jauh tetap tersedia di rincian.');
  return { cards: summary.visible, alternativePaths, warnings, truncated,
    message: summary.visible.length ? undefined : alternativePaths.length ? 'Leluhur bersama ditemukan; lihat rincian jalur alternatif.' : 'Belum ditemukan jalur pada data yang dapat dibaca dan batas penelusuran.' };
}
