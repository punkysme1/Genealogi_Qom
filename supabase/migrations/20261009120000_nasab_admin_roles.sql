create table if not exists public.nasab_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Admin Nasab',
  created_at timestamptz not null default now()
);

alter table public.nasab_admins enable row level security;
revoke all on public.nasab_admins from public, anon, authenticated;
grant select on public.nasab_admins to authenticated;

drop policy if exists "nasab admins read own membership" on public.nasab_admins;
create policy "nasab admins read own membership" on public.nasab_admins
  for select to authenticated using (user_id = (select auth.uid()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array['individuals', 'marriages', 'sources', 'events'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all privileges on public.%I from public, anon, authenticated', table_name);
    execute format('grant select on public.%I to anon, authenticated', table_name);
    execute format('grant insert, update, delete on public.%I to authenticated', table_name);

    execute format('drop policy if exists %I on public.%I', 'Allow authenticated users full access to ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'Allow public read-only access to ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'nasab admins manage ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'public read ' || table_name, table_name);

    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      'public read ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.nasab_admins a where a.user_id = (select auth.uid()))) with check (exists (select 1 from public.nasab_admins a where a.user_id = (select auth.uid())))',
      'nasab admins manage ' || table_name, table_name
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
