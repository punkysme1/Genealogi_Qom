import { Individual, Marriage } from '@/types';

/**
 * Henry Numbering System Suggestion
 * 
 * Logic:
 * - If root (no parents): Suggest '1' or '1'
 * - If child: parent_code + (birth_order_index)
 * - If birth_order_index > 9, use parentheses e.g. 1(10)
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
  const sortedForRoot = [...allIndividuals].sort((a, b) => {
    const hasParentsA = a.father_id || a.mother_id ? 1 : 0;
    const hasParentsB = b.father_id || b.mother_id ? 1 : 0;
    if (hasParentsA !== hasParentsB) return hasParentsA - hasParentsB;
    // Seniority by creation date as fallback for root
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
  return sortedForRoot.find(i => i && i.name && i.name.includes('Qomaruddin'));
}

/**
 * Calculates current generation levels and global ranks for all individuals.
 */
export function calculateGenerations(allIndividuals: Individual[]) {
  const levels: Record<string, number> = {};
  const ranks: Record<string, number> = {};
  if (!allIndividuals || allIndividuals.length === 0) return { levels, ranks };

  const root = findRoot(allIndividuals);
  if (!root) return { levels, ranks };

  // Pre-build child map for O(1) lookups
  const childMap = new Map<string, string[]>();
  allIndividuals.forEach(ind => {
    if (ind.father_id) {
      const existing = childMap.get(ind.father_id) || [];
      childMap.set(ind.father_id, [...existing, ind.id]);
    }
    if (ind.mother_id) {
      const existing = childMap.get(ind.mother_id) || [];
      childMap.set(ind.mother_id, [...existing, ind.id]);
    }
  });

  // BFS
  const queue: { id: string, level: number }[] = [{ id: root.id, level: 0 }];
  levels[root.id] = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const { id, level } = current;
    
    const childrenIds = childMap.get(id) || [];
    childrenIds.forEach(childId => {
      if (levels[childId] === undefined || levels[childId] > level + 1) {
        levels[childId] = level + 1;
        queue.push({ id: childId, level: level + 1 });
      }
    });
  }

  // Ranks
  const individualsByLevel: Record<number, Individual[]> = {};
  const indMap = new Map(allIndividuals.map(i => [i.id, i]));

  Object.entries(levels).forEach(([id, level]) => {
    if (!individualsByLevel[level]) individualsByLevel[level] = [];
    const ind = indMap.get(id);
    if (ind) individualsByLevel[level].push(ind);
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

  return { levels, ranks };
}

/**
 * Calculates all possible lineage paths for an individual.
 */
export function calculatePathIDs(individualId: string, allIndividuals: Individual[]): string[] {
  if (!individualId || !allIndividuals || allIndividuals.length === 0) return [];
  
  const root = findRoot(allIndividuals);
  if (!root) return [];
  if (individualId === root.id) return ['G0'];
  
  const paths: string[] = [];
  const indMap = new Map(allIndividuals.map(i => [i.id, i]));
  
  // Build child map with sorted children to ensure stable indexing
  const childMap = new Map<string, string[]>();
  allIndividuals.forEach(ind => {
    const parents = [ind.father_id, ind.mother_id].filter(Boolean) as string[];
    parents.forEach(pId => {
      const existing = childMap.get(pId) || [];
      if (!existing.includes(ind.id)) {
        childMap.set(pId, [...existing, ind.id]);
      }
    });
  });

  // Sort child lists once
  childMap.forEach((ids, pId) => {
    ids.sort((aId, bId) => {
      const a = indMap.get(aId)!;
      const b = indMap.get(bId)!;
      const dateA = a.birth_date || '9999-12-31';
      const dateB = b.birth_date || '9999-12-31';
      return dateA.localeCompare(dateB) || (a.name || '').localeCompare(b.name || '');
    });
  });

  function findPaths(currentId: string, currentPath: string, visited: Set<string>) {
    if (currentId === individualId) {
      paths.push(currentPath || 'G0');
      return;
    }

    if (visited.has(currentId)) return; 
    const children = childMap.get(currentId) || [];
    if (children.length === 0) return;

    visited.add(currentId);
    children.forEach((childId, index) => {
      findPaths(childId, `${currentPath}${toAlphaNumeric(index + 1)}`, new Set(visited));
    });
  }

  findPaths(root.id, '', new Set());
  return Array.from(new Set(paths));
}

/**
 * Optimized generation of IDs.
 */
export function generateGenealogyIDs(
  individual: Individual | null, 
  allIndividuals: Individual[], 
  marriages: Marriage[],
  providedLevels?: Record<string, number>,
  providedRanks?: Record<string, number>,
  skipArabic: boolean = false
) {
  if (!individual || !individual.id) {
    return { baseId: '-', pathIds: [], displayId: '-', shortestPath: '', alphaPaths: [] };
  }

  const { levels, ranks } = (providedLevels && providedRanks) 
    ? { levels: providedLevels, ranks: providedRanks } 
    : calculateGenerations(allIndividuals);
  
  const level = levels[individual.id];
  const rank = ranks[individual.id];
  const baseId = level !== undefined ? `G${level}.${rank}` : 'Outer';
  
  const alphaPaths = calculatePathIDs(individual.id, allIndividuals) || [];
  
  // In-law logic
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

  const sortedAlpha = [...alphaPaths].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const shortestAlpha = sortedAlpha[0] || (individual.name?.includes('Qomaruddin') ? 'G0' : 'Root');

  return {
    baseId,
    pathIds: skipArabic ? [] : (calculateArabicLineage(individual.id, allIndividuals) || []), 
    displayId: shortestAlpha,
    shortestPath: shortestAlpha,
    alphaPaths
  };
}



/**
 * Helper to calculate all lineage paths with names in Arabic style (bin/binti).
 */
export function calculateArabicLineage(individualId: string, allIndividuals: Individual[]): string[] {
  if (!individualId || !allIndividuals || !Array.isArray(allIndividuals)) return [];
  
  const paths: string[] = [];
  const indMap = new Map(allIndividuals.filter(i => i && i.id).map(i => [i.id, i]));
  
  function traceUp(currId: string, chainIds: string[], chainNames: string[]): void {
    const ind = indMap.get(currId);
    if (!ind || !ind.name) return;

    const newChainNames = [...chainNames, ind.name];
    const newChainIds = [...chainIds, ind.id];

    // If root (no parents left) OR we hit Kiai Qomaruddin, stop and save
    if (ind.name.includes('Qomaruddin')) {
      const formattedChain = newChainNames.map((name, idx) => {
        if (idx === newChainNames.length - 1) return name;
        
        // Find the specific individual in this step to check gender
        const currentInd = indMap.get(newChainIds[idx]);
        const nextConnector = currentInd?.gender === 'M' ? 'bin' : 'binti';
        return `${name} ${nextConnector}`;
      }).join(' ');
      paths.push(formattedChain);
      return;
    }

    // Stop if it's a root that is NOT Kiai Qomaruddin
    if (!ind.father_id && !ind.mother_id) {
      return;
    }

    // Use ID for cycle detection to allow repeated names like "Umamah" in different generations
    if (ind.father_id && !chainIds.includes(ind.father_id)) {
      traceUp(ind.father_id, newChainIds, newChainNames);
    }
    
    if (ind.mother_id && !chainIds.includes(ind.mother_id)) {
      traceUp(ind.mother_id, newChainIds, newChainNames);
    }
  }

  traceUp(individualId, [], []);
  return Array.from(new Set(paths));
}

/**
 * Find spouse of an individual from marriages
 */
export async function findSpouse(individualId: string, gender: 'M' | 'F', supabase: any) {
  if (!individualId) return null;
  
  const column = gender === 'M' ? 'husband_id' : 'wife_id';
  const targetColumn = gender === 'M' ? 'wife_id' : 'husband_id';
  
  const { data, error } = await supabase
    .from('marriages')
    .select(targetColumn)
    .eq(column, individualId)
    .eq('is_active', true)
    .limit(1);
    
  if (error || !data || data.length === 0) return null;
  return data[0][targetColumn];
}
