import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables are missing or use placeholder values. ' +
    'The app will use mock data for preview purposes.'
  );
}

// Only initialize if variables exist to avoid crashing the app
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

/**
 * Example of a Recursive CTE query for fetching generations.
 * Note: This would typically be a stored procedure or executed via .rpc()
 */
export const GET_DESCENDANTS_SQL = `
WITH RECURSIVE family_tree AS (
    -- Base case: the root individual
    SELECT id, name, father_id, mother_id, 0 as generation
    FROM individuals
    WHERE id = $1

    UNION ALL

    -- Recursive step: find children
    SELECT i.id, i.name, i.father_id, i.mother_id, ft.generation + 1
    FROM individuals i
    JOIN family_tree ft ON (i.father_id = ft.id OR i.mother_id = ft.id)
    WHERE ft.generation < 9 -- Limit to 9 generations as requested
)
SELECT * FROM family_tree;
`;
