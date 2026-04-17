/**
 * Javanese Relationship Logic
 * 
 * Generational distance from self:
 * 0: Anak (Child)
 * 1: Putu (Grandchild)
 * 2: Buyut (Great-grandchild)
 * 3: Canggah
 * 4: Wareng
 * 5: Udheng-udheng
 * 6: Gantung Siwur
 * 7: Debog Bosok
 * 8: Galih Asem
 */

export const JAVANESE_DESCENDANT_TERMS = [
  'Anak',
  'Putu',
  'Buyut',
  'Canggah',
  'Wareng',
  'Udheng-udheng',
  'Gantung Siwur',
  'Debog Bosok',
  'Galih Asem',
];

export const JAVANESE_ANCESTOR_TERMS = [
  'Wong Tuwo', // Parents
  'Simbah',    // Grandparents
  'Buyut',     // Great-grandparents
  'Canggah',
  'Wareng',
  'Udheng-udheng',
  'Gantung Siwur',
  'Debog Bosok',
  'Galih Asem',
];

/**
 * Get Javanese term for a descendant based on generational distance.
 * @param distance 0 for children, 1 for grandchildren, etc.
 */
export function getJavaneseDescendantTerm(distance: number): string {
  if (distance < 0) return 'Leluhur';
  return JAVANESE_DESCENDANT_TERMS[distance] || `Keturunan ke-${distance + 1}`;
}

/**
 * Get Javanese term for an ancestor based on generational distance.
 * @param distance 0 for parents, 1 for grandparents, etc.
 */
export function getJavaneseAncestorTerm(distance: number): string {
  if (distance < 0) return 'Keturunan';
  return JAVANESE_ANCESTOR_TERMS[distance] || `Leluhur ke-${distance + 1}`;
}

/**
 * Helper to determine relationship between two individuals.
 * This is a simplified version; a full implementation would trace paths.
 */
export function getRelationshipTerm(distance: number, isAncestor: boolean): string {
  return isAncestor ? getJavaneseAncestorTerm(distance) : getJavaneseDescendantTerm(distance);
}
