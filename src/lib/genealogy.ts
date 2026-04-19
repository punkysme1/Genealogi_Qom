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
 * Generates the 3 types of IDs: Base-ID, Path-ID, and Display-ID (Alphanumeric).
 * The Display-ID prioritizes the shortest path that stems from the primary root (Code '1').
 */
export function generateGenealogyIDs(individual: Individual, allIndividuals: Individual[], marriages: Marriage[]) {
  const baseId = individual.id.substring(0, 6).toUpperCase();
  const pathIds = calculatePathIDs(individual.id, allIndividuals, marriages);
  
  // Prioritize paths starting with '1' (Kiai Qomaruddin)
  const significantPaths = pathIds.filter(p => p.startsWith('1'));
  const candidatePaths = significantPaths.length > 0 ? significantPaths : pathIds;

  // Display-ID Logic: 
  // 1. MIN(length(path_id)) within candidates
  // 2. Smallest alphanumeric order
  const sortedPaths = [...candidatePaths].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });
  
  const shortestPath = sortedPaths[0] || '?';
  const displayId = `QMR-${baseId}.${shortestPath}`;
  
  return {
    baseId,
    pathIds,
    displayId,
    shortestPath
  };
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
