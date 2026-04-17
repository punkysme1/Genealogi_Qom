import { Individual } from '@/types';

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
