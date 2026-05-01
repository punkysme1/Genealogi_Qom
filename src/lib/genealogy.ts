import { Individual, Marriage } from '@/types';

// Simple cache to prevent redundant heavy calculations
const gCache = new Map<string, any>();

/**
 * Henry Numbering System Suggestion
 */
export function suggestHenryCode(parentCode: string | undefined, childrenCount: number): string {
  if (!parentCode) return '1';
  const nextIndex = childrenCount + 1;
  const suffix = nextIndex > 9 ? `(${nextIndex})` : `${nextIndex}`;
  return `${parentCode}${suffix}`;
}

/**
 * Converts a child index (1-based) to an alphanumeric character (1-9, A-Z).
 */
function toAlphaNumeric(index: number): string {
  if (index < 1) return '0';
  if (index <= 9) return index.toString();
  if (index <= 35) return String.fromCharCode(65 + (index - 10)); // 10 -> A, 11 -> B...
  return `(${index})`; // Fallback for more than 35 siblings
}

function findRoot(allIndividuals: Individual[]) {
  return allIndividuals.find(i => i && i.name && i.name.includes('Qomaruddin'));
}

/**
 * Calculates current generation levels, shortest paths, and global ranks for all individuals.
 */
export function calculateGenerations(allIndividuals: Individual[], marriages: Marriage[] = []) {
  const levels: Record<string, number> = {};
  const ranks: Record<string, number> = {};
  const shortestPaths: Record<string, string> = {};
  
  if (!allIndividuals || allIndividuals.length === 0) return { levels, ranks, shortestPaths };

  const indMap = new Map(allIndividuals.map(i => [i.id, i]));
  const childMap = new Map<string, string[]>();
  
  allIndividuals.forEach(ind => {
    const parents = [ind.father_id, ind.mother_id].filter(Boolean) as string[];
    parents.forEach(pId => {
      if (!childMap.has(pId)) childMap.set(pId, []);
      if (!childMap.get(pId)!.includes(ind.id)) childMap.get(pId)!.push(ind.id);
    });
  });

  // Sort children by birth date for stable alphanumeric indexing
  childMap.forEach((ids) => {
    ids.sort((aId, bId) => {
      const a = indMap.get(aId)!;
      const b = indMap.get(bId)!;
      return (a.birth_date || '9999-12-31').localeCompare(b.birth_date || '9999-12-31') || 
             (a.name || '').localeCompare(b.name || '');
    });
  });

  // 1. BFS to find shortest path and depth
  const root = findRoot(allIndividuals);
  const queue: { id: string, level: number, path: string }[] = [];
  const visited = new Set<string>();

  if (root) {
    queue.push({ id: root.id, level: 0, path: '' });
    levels[root.id] = 0;
    shortestPaths[root.id] = '';
  }

  while (queue.length > 0) {
    const { id, level, path } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const children = childMap.get(id) || [];
    children.forEach((childId, index) => {
      if (!visited.has(childId)) {
        const char = toAlphaNumeric(index + 1);
        const childPath = `${path}${char}`;
        const childLevel = level + 1;

        // If not assigned or shorter path found
        if (levels[childId] === undefined || childLevel < levels[childId]) {
          levels[childId] = childLevel;
          shortestPaths[childId] = childPath;
          queue.push({ id: childId, level: childLevel, path: childPath });
        }
      }
    });
  }

  // 2. Handle In-laws and isolated nodes (sync levels)
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    marriages.forEach(m => {
      const hL = levels[m.husband_id];
      const wL = levels[m.wife_id];
      
      // Case 1: Husband has a level, Wife does not (In-law)
      if (hL !== undefined && wL === undefined) {
        levels[m.wife_id] = hL;
        shortestPaths[m.wife_id] = shortestPaths[m.husband_id] ? `${shortestPaths[m.husband_id]}+` : 'Root+';
        changed = true;
      }
      // Case 2: Wife has a level, Husband does not (In-law)
      else if (wL !== undefined && hL === undefined) {
        levels[m.husband_id] = wL;
        shortestPaths[m.husband_id] = shortestPaths[m.wife_id] ? `${shortestPaths[m.wife_id]}+` : 'Root+';
        changed = true;
      }
      // Case 3: Both have levels but we are NOT syncing them anymore 
      // to avoid pulling a G4 up to G6 just because of a spouse.
      // Visualization will handle the vertical displacement.
    });
  }

  // 3. Ranks - stable sorting by birth date within level
  const individualsByLevel: Record<number, Individual[]> = {};
  allIndividuals.forEach(ind => {
    const level = levels[ind.id] || 0;
    if (!individualsByLevel[level]) individualsByLevel[level] = [];
    individualsByLevel[level].push(ind);
  });

  Object.entries(individualsByLevel).forEach(([levelStr, members]) => {
    members.sort((a, b) => {
      const dateA = a?.birth_date || '9999-12-31';
      const dateB = b?.birth_date || '9999-12-31';
      return dateA.localeCompare(dateB) || (a.name || '').localeCompare(b.name || '');
    });
    members.forEach((m, idx) => {
      ranks[m.id] = idx + 1;
    });
  });

  return { levels, ranks, shortestPaths };
}

/**
 * Calculates all possible lineage paths for an individual.
 */
export function calculatePathIDs(individualId: string, allIndividuals: Individual[]): string[] {
  if (!individualId || !allIndividuals || allIndividuals.length === 0) return [];
  
  const root = findRoot(allIndividuals);
  if (!root) return [];
  if (individualId === root.id) return ['G0'];
  
  const indMap = new Map(allIndividuals.map(i => [i.id, i]));
  const childMap = new Map<string, string[]>();
  
  allIndividuals.forEach(ind => {
    const parents = [ind.father_id, ind.mother_id].filter(Boolean) as string[];
    parents.forEach(pId => {
      if (!childMap.has(pId)) childMap.set(pId, []);
      const cList = childMap.get(pId)!;
      if (!cList.includes(ind.id)) cList.push(ind.id);
    });
  });

  // Sort children once
  childMap.forEach((ids, pId) => {
    ids.sort((aId, bId) => {
      const a = indMap.get(aId)!;
      const b = indMap.get(bId)!;
      return (a.birth_date || '9999-12-31').localeCompare(b.birth_date || '9999-12-31') || 
             (a.name || '').localeCompare(b.name || '');
    });
  });

  const paths: string[] = [];
  function findPaths(currentId: string, currentPath: string, visited: Set<string>) {
    if (visited.has(currentId) || paths.length > 20) return;
    
    if (currentId === individualId) {
      paths.push(currentPath || 'G0');
      return;
    }

    const children = childMap.get(currentId) || [];
    const newVisited = new Set(visited);
    newVisited.add(currentId);

    children.forEach((childId, index) => {
      findPaths(childId, `${currentPath}${toAlphaNumeric(index + 1)}`, newVisited);
    });
  }

  findPaths(root.id, '', new Set());
  return Array.from(new Set(paths));
}

/**
 * Optimized generation of IDs with caching.
 */
export function generateGenealogyIDs(
  individual: Individual | null, 
  allIndividuals: Individual[], 
  marriages: Marriage[],
  providedLevels?: Record<string, number>,
  providedRanks?: Record<string, number>,
  providedPaths?: Record<string, string>,
  skipPaths: boolean = false
) {
  if (!individual || !individual.id) {
    return { baseId: '-', pathIds: [], displayId: '-', shortestPath: '', alphaPaths: [] };
  }

  // Cache hit logic
  const key = `${individual.id}-${allIndividuals.length}-${marriages.length}-${skipPaths ? 's' : 'f'}`;
  if (gCache.has(key)) return gCache.get(key);

  let levels: Record<string, number>;
  let ranks: Record<string, number>;
  let shortestPaths: Record<string, string>;

  if (providedLevels && providedRanks && providedPaths) {
    levels = providedLevels;
    ranks = providedRanks;
    shortestPaths = providedPaths;
  } else {
    const gen = calculateGenerations(allIndividuals, marriages);
    levels = gen.levels;
    ranks = gen.ranks;
    shortestPaths = gen.shortestPaths;
  }
  
  const level = levels[individual.id];
  const rank = ranks[individual.id];
  const baseId = level !== undefined ? `G${level}${rank !== undefined ? '.' + rank : ''}` : 'Outer';
  
  // Use the pre-calculated shortest path as the primary display ID
  const bfsShortest = shortestPaths[individual.id];
  let shortestAlpha = bfsShortest === '' ? 'G0' : (bfsShortest || (individual.name?.includes('Qomaruddin') ? 'G0' : 'Root'));

  if (skipPaths) {
    const result = {
      level,
      baseId,
      pathIds: [],
      displayId: shortestAlpha,
      shortestPath: shortestAlpha,
      alphaPaths: [shortestAlpha]
    };
    gCache.set(key, result);
    return result;
  }

  // If not skipping, we do the full analysis for multiple paths
  let alphaPaths = calculatePathIDs(individual.id, allIndividuals) || [];
  
  // In-law logic if not a direct descendant
  if (alphaPaths.length === 0 && !individual.name?.includes('Qomaruddin')) {
    const spouseMarriages = marriages.filter(m => m.husband_id === individual.id || m.wife_id === individual.id);
    for (const m of spouseMarriages) {
      const spouseId = m.husband_id === individual.id ? m.wife_id : m.husband_id;
      if (spouseId) {
        const spousePaths = calculatePathIDs(spouseId, allIndividuals) || [];
        if (spousePaths.length > 0) {
          const allSpouseMarriages = marriages
            .filter(sm => sm.husband_id === spouseId || sm.wife_id === spouseId)
            .sort((a, b) => (a.marriage_date || a.created_at || '').localeCompare(b.marriage_date || b.created_at || ''));
          
          const mIndex = allSpouseMarriages.findIndex(sm => sm.id === m.id);
          const plusSuffix = '+'.repeat(mIndex !== -1 ? mIndex + 1 : 1);
          spousePaths.forEach(p => alphaPaths.push(`${p}${plusSuffix}`));
        }
      }
    }
  }

  // Ensure we have at least 'Root' if still empty
  if (alphaPaths.length === 0) {
    alphaPaths = [individual.name?.includes('Qomaruddin') ? 'G0' : 'Root'];
  }

  const finalShortestAlpha = alphaPaths.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];

  const result = {
    level,
    baseId,
    pathIds: (calculateArabicLineage(individual.id, allIndividuals) || []), 
    displayId: finalShortestAlpha,
    shortestPath: finalShortestAlpha,
    alphaPaths
  };

  gCache.set(key, result);
  return result;
}

/**
 * Helper to calculate all lineage paths with names in Arabic style (bin/binti).
 */
export function calculateArabicLineage(individualId: string, allIndividuals: Individual[]): string[] {
  if (!individualId || !allIndividuals) return [];
  
  const paths: string[] = [];
  const indMap = new Map(allIndividuals.map(i => [i.id, i]));
  
  function traceUp(currId: string, chainIds: string[], chainNames: string[]): void {
    const ind = indMap.get(currId);
    if (!ind || !ind.name || chainIds.includes(currId)) return;

    const newChainNames = [...chainNames, ind.name];
    const newChainIds = [...chainIds, ind.id];

    if (ind.name.includes('Qomaruddin')) {
      const formattedChain = newChainNames.map((name, idx) => {
        if (idx === newChainNames.length - 1) return name;
        const currentInd = indMap.get(newChainIds[idx]);
        const nextConnector = currentInd?.gender === 'M' ? 'bin' : 'binti';
        return `${name} ${nextConnector}`;
      }).join(' ');
      paths.push(formattedChain);
      return;
    }

    if (ind.father_id) traceUp(ind.father_id, newChainIds, newChainNames);
    if (ind.mother_id) traceUp(ind.mother_id, newChainIds, newChainNames);
  }

  traceUp(individualId, [], []);
  return Array.from(new Set(paths));
}

/**
 * Find spouse of an individual
 */
export async function findSpouse(individualId: string, gender: 'M' | 'F', supabase: any) {
  if (!individualId) return null;
  const column = gender === 'M' ? 'husband_id' : 'wife_id';
  const targetColumn = gender === 'M' ? 'wife_id' : 'husband_id';
  const { data } = await supabase.from('marriages').select(targetColumn).eq(column, individualId).eq('is_active', true).limit(1);
  return data && data.length > 0 ? data[0][targetColumn] : null;
}
