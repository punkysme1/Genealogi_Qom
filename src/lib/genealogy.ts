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

/**
 * Calculates generation levels and global ranks for all individuals.
 * Generation G0 = Kiai Qomaruddin.
 */
export function calculateGenerations(allIndividuals: Individual[]) {
  const levels: Record<string, number> = {};
  if (!allIndividuals || !Array.isArray(allIndividuals)) return { levels, ranks: {} as Record<string, number> };

  const root = allIndividuals.find(i => i && i.name && i.name.includes('Qomaruddin'));
  
  if (!root) return { levels, ranks: {} as Record<string, number> };

  // BFS to find shortest path depth from Qomaruddin
  const queue: { id: string, level: number }[] = [{ id: root.id, level: 0 }];
  levels[root.id] = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !current.id) continue;
    const { id, level } = current;
    
    const children = allIndividuals.filter(i => i && (i.father_id === id || i.mother_id === id));
    
    children.forEach(child => {
      if (child && child.id && (levels[child.id] === undefined || levels[child.id] > level + 1)) {
        levels[child.id] = level + 1;
        queue.push({ id: child.id, level: level + 1 });
      }
    });
  }

  // Calculate global ranks per level
  const ranks: Record<string, number> = {};
  const individualsByLevel: Record<number, Individual[]> = {};

  allIndividuals.forEach(ind => {
    if (!ind) return;
    const level = levels[ind.id];
    if (level !== undefined) {
      if (!individualsByLevel[level]) individualsByLevel[level] = [];
      individualsByLevel[level].push(ind);
    }
  });

  Object.entries(individualsByLevel).forEach(([levelStr, members]) => {
    // Sort by birth date, then name
    members.sort((a, b) => {
      const dateA = a?.birth_date || '9999-12-31';
      const dateB = b?.birth_date || '9999-12-31';
      const nameA = a?.name || '';
      const nameB = b?.name || '';
      return dateA.localeCompare(dateB) || nameA.localeCompare(nameB);
    });
    members.forEach((m, idx) => {
      if (m && m.id) ranks[m.id] = idx + 1;
    });
  });

  return { levels, ranks };
}

/**
 * Calculates all possible lineage paths for an individual using recursive tracing.
 */
export function calculatePathIDs(individualId: string, allIndividuals: Individual[]): string[] {
  if (!individualId || !allIndividuals || !Array.isArray(allIndividuals)) return [];
  
  const paths: string[] = [];
  const root = allIndividuals.find(i => i && i.name && i.name.includes('Qomaruddin'));
  if (!root) return [];
  
  const indMap = new Map(allIndividuals.filter(i => i && i.id).map(i => [i.id, i]));
  
  function findPaths(currentId: string, currentPath: string, visited: Set<string>) {
    if (currentId === individualId) {
      paths.push(currentPath || 'G0');
    }

    if (!currentId || visited.has(currentId)) return; 
    const nextVisited = new Set(visited);
    nextVisited.add(currentId);

    const children = allIndividuals.filter(i => i && (i.father_id === currentId || i.mother_id === currentId));
    
    children.sort((a, b) => {
      const dateA = a?.birth_date || '9999-12-31';
      const dateB = b?.birth_date || '9999-12-31';
      const nameA = a?.name || '';
      const nameB = b?.name || '';
      return dateA.localeCompare(dateB) || nameA.localeCompare(nameB);
    });

    children.forEach((child, index) => {
      if (!child || !child.id) return;
      const nextPath = `${currentPath}${toAlphaNumeric(index + 1)}`;
      findPaths(child.id, nextPath, nextVisited);
    });
  }

  findPaths(root.id, '', new Set());
  return Array.from(new Set(paths));
}

/**
 * Generates the 3 types of IDs: Base-ID, Path-ID, and Display-ID.
 */
export function generateGenealogyIDs(individual: Individual | null, allIndividuals: Individual[], marriages: Marriage[]) {
  if (!individual || !individual.id) {
    return {
      baseId: '-',
      pathIds: [], 
      displayId: '-',
      shortestPath: '',
      alphaPaths: []
    };
  }

  const { levels, ranks } = calculateGenerations(allIndividuals);
  
  const level = levels[individual.id];
  const rank = ranks[individual.id];

  // Base-ID: G[Level].[Rank]
  const baseId = level !== undefined ? `G${level}.${rank}` : 'Outer';
  
  // Alphanumeric paths for Display-ID logic
  const alphaPaths = calculatePathIDs(individual.id, allIndividuals) || [];
  const sortedAlpha = [...alphaPaths].sort((a, b) => a.length - b.length || a.localeCompare(b));
  
  // Display-ID: Shortest Alphanumeric
  const shortestAlpha = sortedAlpha[0] || (individual.name && individual.name.includes('Qomaruddin') ? 'G0' : 'Root');
  const displayId = shortestAlpha;

  // Path-ID: Arabic Lineage as requested (bin/binti)
  const pathIds = calculateArabicLineage(individual.id, allIndividuals) || [];

  return {
    baseId,
    pathIds, 
    displayId,
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
