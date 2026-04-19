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
  if (index < 1) return '?';
  if (index <= 9) return index.toString();
  if (index <= 35) return String.fromCharCode(65 + (index - 10)); // 10 -> A (65), 11 -> B (66)...
  return '?'; // Should not happen in this context usually
}

/**
 * Calculates all possible lineage paths for an individual using recursive tracing.
 * Uses alphanumeric encoding (1-9, A-Z) and removes separators.
 * Prioritizes "Kiai Qomaruddin" as the primary root (Code '1').
 */
export function calculatePathIDs(individualId: string, allIndividuals: Individual[], marriages: Marriage[]): string[] {
  const paths: string[] = [];
  
  // Designate roots: individuals without parents
  const rawRoots = allIndividuals.filter(i => !i.father_id && !i.mother_id);
  
  // Prioritize Kiai Qomaruddin as index 1 if found
  const roots = [...rawRoots].sort((a, b) => {
    const isQomaruddinA = a.name.includes('Qomaruddin');
    const isQomaruddinB = b.name.includes('Qomaruddin');
    if (isQomaruddinA && !isQomaruddinB) return -1;
    if (!isQomaruddinA && isQomaruddinB) return 1;
    return a.name.localeCompare(b.name);
  });
  
  function findPaths(currentId: string, currentPath: string, visited: Set<string>) {
    // Current individual matches target
    if (currentId === individualId) {
      paths.push(currentPath);
    }

    if (visited.has(currentId)) return; // Prevent cycles
    const nextVisited = new Set(visited);
    nextVisited.add(currentId);

    // Find children
    const children = allIndividuals.filter(i => i.father_id === currentId || i.mother_id === currentId);
    
    // Stable sibling sorting (by birth date then name)
    children.sort((a, b) => {
      const dateA = a.birth_date || '9999-12-31';
      const dateB = b.birth_date || '9999-12-31';
      return dateA.localeCompare(dateB) || a.name.localeCompare(b.name);
    });

    children.forEach((child, index) => {
      const siblingIndex = index + 1;
      const nextPath = `${currentPath}${toAlphaNumeric(siblingIndex)}`;
      findPaths(child.id, nextPath, nextVisited);
    });
  }

  roots.forEach((root, idx) => {
    const rootCode = toAlphaNumeric(idx + 1);
    findPaths(root.id, rootCode, new Set());
  });

  return Array.from(new Set(paths));
}

/**
 * Generates the 3 types of IDs: Base-ID, Path-ID, and Display-ID.
 * 
 * 1. Base-ID: Patronymic string (e.g., "Aqib bin Abdurrohman").
 * 2. Display-ID: The most significant patronymic link.
 * 3. Path-ID: List of full lineage strings in Arabic style.
 */
export function generateGenealogyIDs(individual: Individual, allIndividuals: Individual[], marriages: Marriage[]) {
  const getParentName = (id: string | null) => {
    if (!id) return null;
    return allIndividuals.find(i => i.id === id)?.name || null;
  };

  const fatherName = getParentName(individual.father_id);
  const motherName = getParentName(individual.mother_id);
  const connector = individual.gender === 'M' ? 'bin' : 'binti';

  // Base Patronimic: Name + Parent
  const primaryParentName = fatherName || motherName;
  const baseId = primaryParentName ? `${individual.name} ${connector} ${primaryParentName}` : individual.name;
  
  // Display ID should be concise but informative
  const displayId = primaryParentName ? `${connector} ${primaryParentName}` : 'Root';

  // Trace all paths and convert to Arabic Name strings
  // We'll reuse the logic but map it to names
  const rawPaths = calculatePathIDs(individual.id, allIndividuals, marriages);
  
  // Since we want full Arabic paths, we need a separate function for naming
  const arabicPaths = calculateArabicLineage(individual.id, allIndividuals);

  return {
    baseId,
    pathIds: arabicPaths, // Show full Arabic paths
    displayId,
    shortestPath: rawPaths[0] || ''
  };
}

/**
 * Helper to calculate all lineage paths with names in Arabic style (bin/binti).
 */
export function calculateArabicLineage(individualId: string, allIndividuals: Individual[]): string[] {
  const paths: string[] = [];
  const indMap = new Map(allIndividuals.map(i => [i.id, i]));
  
  function traceUp(currId: string, currentChain: string[]): void {
    const ind = indMap.get(currId);
    if (!ind) return;

    const newChain = [...currentChain, ind.name];

    // If root (no parents left) OR we hit Kiai Qomaruddin, stop and save
    if (ind.name.includes('Qomaruddin')) {
      const formattedChain = newChain.map((name, idx) => {
        if (idx === newChain.length - 1) return name;
        const currentInd = allIndividuals.find(i => i.name === name);
        const nextConnector = currentInd?.gender === 'M' ? 'bin' : 'binti';
        return `${name} ${nextConnector}`;
      }).join(' ');
      paths.push(formattedChain);
      return;
    }

    // Stop if it's a root that is NOT Kiai Qomaruddin (to hide dead-end paths)
    if (!ind.father_id && !ind.mother_id) {
      return;
    }

    if (ind.father_id) traceUp(ind.father_id, newChain);
    if (ind.mother_id) traceUp(ind.mother_id, newChain);
  }

  traceUp(individualId, []);
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
