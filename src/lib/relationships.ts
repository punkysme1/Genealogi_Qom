import { Individual, RelationshipResult, RelationshipType } from '@/types';
import { calculateGenerations } from './genealogy';

/**
 * Returns the Javanese term for a descendant level.
 * G0 = Root (Kiai Qomaruddin)
 * G1 = Anak
 * G2 = Cucu
 * G3 = Cicit (Buyut)
 * G4 = Canggah
 * G5 = Wareng
 * G6 = Udhek-udhek
 * G7 = Gantung Siwur
 */
export function getJavaneseDescendantTerm(level: number): string {
  const terms = [
    'Anak (G1)',
    'Cucu (G2)',
    'Cicit / Buyut (G3)',
    'Canggah (G4)',
    'Wareng (G5)',
    'Udhek-udhek (G6)',
    'Gantung Siwur (G7)',
    'Petarangan (G8)',
    'Simbok (G9)',
  ];
  return terms[level] || `Keturunan (G${level + 1})`;
}

/**
 * Calculates the relationship between two individuals.
 */
export function calculateRelationship(
  fromId: string,
  toId: string,
  allIndividuals: Individual[]
): RelationshipResult {
  const noRelation: RelationshipResult = {
    fromId,
    toId,
    type: 'TIDAK_ADA_HUBUNGAN',
    distance: 0,
    description: 'Tidak ada hubungan darah yang ditemukan melalui Kiai Qomaruddin.',
  };

  if (!fromId || !toId || fromId === toId) return noRelation;

  const indMap = new Map(allIndividuals.map(i => [i.id, i]));
  const from = indMap.get(fromId);
  const to = indMap.get(toId);

  if (!from || !to) return noRelation;

  const { levels } = calculateGenerations(allIndividuals);
  const fromLevel = levels[fromId];
  const toLevel = levels[toId];

  if (fromLevel === undefined || toLevel === undefined) return noRelation;

  // 1. Check Direct Descent
  const isDescendant = (childId: string, ancestorId: string, visited: Set<string> = new Set()): boolean => {
    if (visited.has(childId) || visited.size > 50) return false;
    const child = indMap.get(childId);
    if (!child) return false;
    if (child.father_id === ancestorId || child.mother_id === ancestorId) return true;
    
    const newVisited = new Set(visited);
    newVisited.add(childId);

    return (child.father_id ? isDescendant(child.father_id, ancestorId, newVisited) : false) || 
           (child.mother_id ? isDescendant(child.mother_id, ancestorId, newVisited) : false);
  };

  if (isDescendant(toId, fromId)) {
    const diff = toLevel - fromLevel;
    if (diff === 1) {
      return {
        fromId, toId, type: from.gender === 'M' ? 'AYAH' : 'IBU',
        distance: 1,
        description: `Subjek adalah ${from.gender === 'M' ? 'Ayah' : 'Ibu'} dari target.`
      };
    }
    if (diff === 2) {
      return {
        fromId, toId, type: from.gender === 'M' ? 'KAKEK' : 'NENEK',
        distance: 2,
        description: `Subjek adalah ${from.gender === 'M' ? 'Kakek' : 'Nenek'} dari target.`
      };
    }
    return {
      fromId, toId, type: from.gender === 'M' ? 'KAKEK' : 'NENEK',
      distance: diff,
      description: `Subjek adalah Buyut/Leluhur dari target (Selisih ${diff} generasi).`
    };
  }

  if (isDescendant(fromId, toId)) {
    const diff = fromLevel - toLevel;
    if (diff === 1) {
      return {
        fromId, toId, type: 'ANAK',
        distance: 1,
        description: `Subjek adalah Anak dari target.`
      };
    }
    if (diff === 2) {
      return {
        fromId, toId, type: 'CUCU',
        distance: 2,
        description: `Subjek adalah Cucu dari target.`
      };
    }
    return {
      fromId, toId, type: 'CUCU',
      distance: diff,
      description: `Subjek adalah Cicit/Keturunan dari target (Selisih ${diff} generasi).`
    };
  }

  // 2. Lateral Relationships (Same or Different Generation)
  // Logic based on requested terms: Cak/Dek, Pakde/Budhe, Paklek/Bulek, Ponakan.
  
  const getAgeRank = (person: Individual) => {
    return person.birth_date || '9999-12-31';
  };

  // Find immediate parent of 'from' to compare with 'to' for uncle/aunt logic
  const fromParentId = from.father_id || from.mother_id;
  const fromParent = fromParentId ? indMap.get(fromParentId) : null;

  if (fromLevel === toLevel) {
    // Same generation
    const isOlder = getAgeRank(from) < getAgeRank(to);
    if (isOlder) {
      return {
        fromId, toId, type: from.gender === 'M' ? 'CAK' : 'BUDHE',
        distance: 0,
        description: `Subjek lebih tua dari target di generasi yang sama (${from.gender === 'M' ? 'Cak' : 'Mbak'}).`
      };
    } else {
      return {
        fromId, toId, type: 'DEK',
        distance: 0,
        description: `Subjek lebih muda dari target di generasi yang sama (Dek).`
      };
    }
  }

  // One generation apart: Uncle/Aunt or Nephew
  if (fromLevel === toLevel - 1) {
    // 'from' is parent generation. 'to' is child generation.
    // Need to compare 'from' age with 'to's parent age.
    const toFather = to.father_id ? indMap.get(to.father_id) : null;
    const toMother = to.mother_id ? indMap.get(to.mother_id) : null;
    const toParent = toFather || toMother;

    if (toParent) {
      const isOlderThanParent = getAgeRank(from) < getAgeRank(toParent);
      if (isOlderThanParent) {
        return {
          fromId, toId, type: from.gender === 'M' ? 'PAKDE' : 'BUDHE',
          distance: 1,
          description: `Subjek adalah kakak dari orang tua target (${from.gender === 'M' ? 'Pakde' : 'Budhe'}).`
        };
      } else {
        return {
          fromId, toId, type: from.gender === 'M' ? 'PAKLEK' : 'BULEK',
          distance: 1,
          description: `Subjek adalah adik dari orang tua target (${from.gender === 'M' ? 'Paklek' : 'Bulek'}).`
        };
      }
    }
    
    return {
      fromId, toId, type: from.gender === 'M' ? 'PAMAN' : 'BIBI',
      distance: 1,
      description: `Subjek berada di tingkat orang tua target (${from.gender === 'M' ? 'Paman' : 'Bibi'}).`
    };
  }

  if (fromLevel === toLevel + 1) {
    // 'from' is child generation, 'to' is parent generation.
    return {
      fromId, toId, type: 'KEPONAKAN',
      distance: 1,
      description: `Subjek adalah Keponakan dari target.`
    };
  }

  // Fallback for larger gaps
  if (fromLevel < toLevel) {
    return {
      fromId, toId, type: from.gender === 'M' ? 'PAMAN' : 'BIBI',
      distance: toLevel - fromLevel,
      description: `Subjek adalah Leluhur Sampingan (Paman/Bibi tingkat ${toLevel - fromLevel}).`
    };
  } else {
    return {
      fromId, toId, type: 'KEPONAKAN',
      distance: fromLevel - toLevel,
      description: `Subjek adalah Keturunan Sampingan (Keponakan tingkat ${fromLevel - toLevel}).`
    };
  }
}
