import type { SupabaseClient } from '@supabase/supabase-js';
import type { Individual } from '../types';

export async function readNumbering(client: SupabaseClient, people: Individual[]) {
  const state = await client.from('nasab_numbering_state_v1').select('revision,root_id,updated_at').single();
  if (state.error) {
    if (['42P01','PGRST205'].includes(state.error.code)) return { people, revision: null, rootId: null };
    throw new Error('Versi penomoran belum dapat dibaca. Muat ulang sebelum menyimpan.');
  }
  const revision = Number(state.data.revision);
  if (!Number.isSafeInteger(revision)) throw new Error('Versi penomoran tidak valid.');
  const orders = new Map<string, NonNullable<Individual['child_order']>>();
  let parentCursor = '', childCursor = '';
  for (;;) {
    let query = client.from('nasab_child_order_v1').select('*').order('parent_id').order('child_id').limit(500);
    if (parentCursor) query = query.or(`parent_id.gt.${parentCursor},and(parent_id.eq.${parentCursor},child_id.gt.${childCursor})`);
    const result = await query;
    if (result.error || !Array.isArray(result.data)) throw new Error('Urutan anak gagal dibaca.');
    if (!result.data.length) break;
    for (const row of result.data) {
      const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
      if (!uuid.test(row.parent_id) || !uuid.test(row.child_id) || `${row.parent_id}/${row.child_id}` <= `${parentCursor}/${childCursor}` || !Number.isSafeInteger(row.position) || row.position<1) throw new Error('Data urutan tidak valid.');
      parentCursor=row.parent_id; childCursor=row.child_id;
      orders.set(row.child_id,{ ...orders.get(row.child_id), [row.parent_id]: {position:row.position, source:row.source, locator:row.locator} });
    }
  }
  const after = await client.from('nasab_numbering_state_v1').select('revision').single();
  if (after.error || Number(after.data.revision)!==revision) throw new Error('Silsilah berubah saat dibaca. Muat ulang.');
  return { people: people.map(p => ({...p,child_order:orders.get(p.id)||{},numbering_root_id:state.data.root_id})), revision, rootId: state.data.root_id };
}
