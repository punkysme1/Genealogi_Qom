import { describeKinshipPath } from './pernah';
import type { Individual, Marriage } from '../types';
import { branchSymbol, lineagePaths } from './lineage-numbering';

export function formatLineageNames(ids: string[], people: Individual[]): string {
  const map = new Map(people.map(p => [p.id, p]));
  return describeKinshipPath({ ids, steps: ids.slice(1).map((to, i) => ({
    from: ids[i], to, kind: 'parent' as const, recordId: ids[i],
    field: map.get(ids[i])?.father_id === to ? 'father_id' : 'mother_id'
  })) }, people).join('; ') || map.get(ids[0])?.name || '';
}

export function suggestHenryCode(parentCode: string | undefined, childrenCount: number): string {
  return `${parentCode || ''}${branchSymbol(childrenCount + 1)}`;
}

function spouseCodes(id: string, people: Individual[], marriages: Marriage[]) {
  const names = new Map(people.map(p => [p.id, p.name]));
  const spouses = new Set(marriages.filter(m => m.husband_id === id || m.wife_id === id)
    .map(m => m.husband_id === id ? m.wife_id : m.husband_id));
  return [...spouses].flatMap(spouse => {
    const result = lineagePaths(spouse, people);
    if (result.truncated) return [];
    return result.paths.filter(p => p.code && p.depth > 0).map(p => ({ code: `+${p.code}`, depth: p.depth,
      description: `Melalui pasangan ${names.get(spouse)}: ${formatLineageNames(p.ids, people)}` }));
  }).sort((a,b) => a.depth-b.depth || a.code.localeCompare(b.code));
}

export function calculateGenerations(people: Individual[], marriages: Marriage[] = []) {
  const levels: Record<string, number> = {}, ranks: Record<string, number> = {}, shortestPaths: Record<string, string> = {};
  for (const person of people) {
    const result = lineagePaths(person.id, people);
    const first = result.paths[0];
    if (first) { levels[person.id] = first.depth; shortestPaths[person.id] = first.code || 'Belum bernomor'; }
    else if (result.rootId && !result.truncated) shortestPaths[person.id] = spouseCodes(person.id, people, marriages)[0]?.code || '(+)';
  }
  // Levels for layout only; spouses do not receive descendant codes.
  for (const marriage of marriages) {
    if (levels[marriage.husband_id] !== undefined && levels[marriage.wife_id] === undefined) levels[marriage.wife_id] = levels[marriage.husband_id];
    else if (levels[marriage.wife_id] !== undefined && levels[marriage.husband_id] === undefined) levels[marriage.husband_id] = levels[marriage.wife_id];
  }
  return { levels, ranks, shortestPaths };
}

export function calculatePathIDs(id: string, people: Individual[]): string[] {
  return lineagePaths(id, people).paths.map(p => p.code || 'Belum bernomor');
}

export function calculateArabicLineage(id: string, people: Individual[]): string[] {
  const names = new Map(people.map(p => [p.id, p.name]));
  return lineagePaths(id, people).paths.map(p => formatLineageNames(p.ids, people));
}

export function generateGenealogyIDs(individual: Individual | null, people: Individual[], marriages: Marriage[],
  providedLevels?: Record<string, number>, providedRanks?: Record<string, number>, providedPaths?: Record<string, string>, skipPaths = false) {
  const result = lineagePaths(individual?.id || '', people);
  const first = result.paths[0];
  const affinal = !first && !result.truncated && result.rootId ? spouseCodes(individual?.id || '', people, marriages) : [];
  const displayId = first ? first.code || 'Belum bernomor' : result.truncated || !result.rootId ? 'Jalur belum dapat dipastikan' : affinal[0]?.code || '(+)';
  const names = new Map(people.map(p => [p.id, p.name]));
  return { level: first?.depth, baseId: first ? `G${first.depth}` : '—', displayId, shortestPath: displayId,
    pathIds: skipPaths ? [] : [...result.paths.map(p => formatLineageNames(p.ids, people)), ...affinal.map(p => p.description)],
    alphaPaths: [...result.paths.map(p => p.code || 'Belum bernomor'), ...affinal.map(p => p.code)], truncated: result.truncated, warnings: result.warnings };
}

export async function findSpouse(individualId: string, gender: 'M' | 'F', supabase: any) {
  if (!individualId) return null;
  const column = gender === 'M' ? 'husband_id' : 'wife_id';
  const targetColumn = gender === 'M' ? 'wife_id' : 'husband_id';
  const { data } = await supabase.from('marriages').select(targetColumn).eq(column, individualId).eq('is_active', true).limit(2);
  return data && data.length === 1 ? data[0][targetColumn] : null;
}
