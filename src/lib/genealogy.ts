import { describeKinshipPath } from './pernah';
import type { Individual, Marriage } from '../types';
import { branchSymbol, createLineageContext, lineagePaths, type LineageContext } from './lineage-numbering';

export function formatLineageNames(ids: string[], people: Individual[], providedMap?: Map<string, Individual>): string {
  const map = providedMap || createLineageContext(people).map;
  return describeKinshipPath({ ids, steps: ids.slice(1).map((to, i) => ({
    from: ids[i], to, kind: 'parent' as const, recordId: ids[i],
    field: map.get(ids[i])?.father_id === to ? 'father_id' : 'mother_id'
  })) }, people).join('; ') || map.get(ids[0])?.name || '';
}

export function suggestHenryCode(parentCode: string | undefined, childrenCount: number): string {
  return `${parentCode || ''}${branchSymbol(childrenCount + 1)}`;
}

function buildSpouseMap(marriages: Marriage[]): Map<string, Set<string>> {
  const spouseMap = new Map<string, Set<string>>();
  for (const m of marriages) {
    if (!spouseMap.has(m.husband_id)) spouseMap.set(m.husband_id, new Set());
    if (!spouseMap.has(m.wife_id)) spouseMap.set(m.wife_id, new Set());
    spouseMap.get(m.husband_id)!.add(m.wife_id);
    spouseMap.get(m.wife_id)!.add(m.husband_id);
  }
  return spouseMap;
}

function spouseCodes(
  id: string,
  people: Individual[],
  marriages: Marriage[],
  options?: {
    context?: LineageContext;
    spouseMap?: Map<string, Set<string>>;
    pathCache?: Map<string, ReturnType<typeof lineagePaths>>;
    includeDescription?: boolean;
  }
) {
  const context = options?.context || createLineageContext(people);
  const spouses = options?.spouseMap
    ? (options.spouseMap.get(id) || new Set<string>())
    : new Set(marriages.filter(m => m.husband_id === id || m.wife_id === id)
        .map(m => m.husband_id === id ? m.wife_id : m.husband_id));
  const includeDesc = options?.includeDescription !== false;
  return [...spouses].flatMap(spouse => {
    const result = options?.pathCache?.get(spouse) || lineagePaths(spouse, people, undefined, 5000, context);
    if (result.truncated) return [];
    const spouseName = context.map.get(spouse)?.name;
    return result.paths.filter(p => p.code && p.depth > 0).map(p => ({
      code: `+${p.code}`,
      depth: p.depth,
      description: includeDesc ? `Melalui pasangan ${spouseName}: ${formatLineageNames(p.ids, people, context.map)}` : '',
    }));
  }).sort((a, b) => a.depth - b.depth || a.code.localeCompare(b.code));
}

export function calculateGenerations(people: Individual[], marriages: Marriage[] = []) {
  const levels: Record<string, number> = {}, ranks: Record<string, number> = {}, shortestPaths: Record<string, string> = {};
  const context = createLineageContext(people);
  const spouseMap = buildSpouseMap(marriages);
  const pathCache = new Map<string, ReturnType<typeof lineagePaths>>();

  for (const person of people) {
    const result = lineagePaths(person.id, people, undefined, 5000, context);
    pathCache.set(person.id, result);
    const first = result.paths[0];
    if (first) {
      levels[person.id] = first.depth;
      shortestPaths[person.id] = first.code || 'Belum bernomor';
    }
  }

  for (const person of people) {
    if (shortestPaths[person.id] !== undefined) continue;
    const result = pathCache.get(person.id)!;
    if (result.rootId && !result.truncated) {
      shortestPaths[person.id] = spouseCodes(person.id, people, marriages, {
        context,
        spouseMap,
        pathCache,
        includeDescription: false,
      })[0]?.code || '(+)';
    }
  }

  // Levels for layout only; spouses do not receive descendant codes.
  for (const marriage of marriages) {
    if (levels[marriage.husband_id] !== undefined && levels[marriage.wife_id] === undefined) levels[marriage.wife_id] = levels[marriage.husband_id];
    else if (levels[marriage.wife_id] !== undefined && levels[marriage.husband_id] === undefined) levels[marriage.husband_id] = levels[marriage.wife_id];
  }
  return { levels, ranks, shortestPaths };
}

export function calculatePathIDs(id: string, people: Individual[]): string[] {
  const context = createLineageContext(people);
  return lineagePaths(id, people, undefined, 5000, context).paths.map(p => p.code || 'Belum bernomor');
}

export function calculateArabicLineage(id: string, people: Individual[]): string[] {
  const context = createLineageContext(people);
  return lineagePaths(id, people, undefined, 5000, context).paths.map(p => formatLineageNames(p.ids, people, context.map));
}

export function generateGenealogyIDs(individual: Individual | null, people: Individual[], marriages: Marriage[],
  providedLevels?: Record<string, number>, _providedRanks?: Record<string, number>, providedPaths?: Record<string, string>, skipPaths = false) {
  const id = individual?.id || '';
  if (skipPaths && id && providedPaths && providedPaths[id] !== undefined) {
    const displayId = providedPaths[id];
    const isAffinal = displayId.startsWith('+') || displayId === '(+)';
    const level = !isAffinal && providedLevels ? providedLevels[id] : undefined;
    return {
      level,
      baseId: level !== undefined ? `G${level}` : '—',
      displayId,
      shortestPath: displayId,
      pathIds: [] as string[],
      alphaPaths: displayId && displayId !== '(+)' ? [displayId] : [],
      truncated: false,
      warnings: [] as string[],
    };
  }
  const context = createLineageContext(people);
  const result = lineagePaths(id, people, undefined, 5000, context);
  const first = result.paths[0];
  const affinal = !first && !result.truncated && result.rootId
    ? spouseCodes(id, people, marriages, { context, includeDescription: !skipPaths })
    : [];
  const displayId = first ? first.code || 'Belum bernomor' : result.truncated || !result.rootId ? 'Jalur belum dapat dipastikan' : affinal[0]?.code || '(+)';
  return { level: first?.depth, baseId: first ? `G${first.depth}` : '—', displayId, shortestPath: displayId,
    pathIds: skipPaths ? [] : [...result.paths.map(p => formatLineageNames(p.ids, people, context.map)), ...affinal.map(p => p.description)],
    alphaPaths: [...result.paths.map(p => p.code || 'Belum bernomor'), ...affinal.map(p => p.code)], truncated: result.truncated, warnings: result.warnings };
}

export async function findSpouse(individualId: string, gender: 'M' | 'F', supabase: any) {
  if (!individualId) return null;
  const column = gender === 'M' ? 'husband_id' : 'wife_id';
  const targetColumn = gender === 'M' ? 'wife_id' : 'husband_id';
  const { data } = await supabase.from('marriages').select(`${targetColumn},deleted_at`).eq(column, individualId).eq('is_active', true).limit(10);
  const active = Array.isArray(data) ? data.filter((row: any) => row.deleted_at == null) : [];
  return active.length === 1 ? active[0][targetColumn] : null;
}
