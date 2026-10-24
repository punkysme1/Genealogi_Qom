#!/usr/bin/env bash
set -euo pipefail
# Read only. No image copies, credentials, user rows or production mutations.
docker exec -i supabase-db psql -X -w -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='3s';
SELECT current_database() AS database, current_setting('server_version') AS version;
SELECT c.relname AS object, c.relkind AS kind, c.relrowsecurity AS rls,
  pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND (c.relname IN ('individuals','marriages','events','sources','nasab_evidence_links','nasab_adoptions','nasab_admins','nasab_change_log') OR c.relname LIKE 'nasab_nawra_%')
ORDER BY c.relname;
SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('individuals','marriages','events','sources','nasab_evidence_links','nasab_adoptions','nasab_admins','nasab_change_log')
ORDER BY table_name,ordinal_position;
SELECT c.relname AS table_name, k.conname, pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('individuals','marriages','events','sources','nasab_evidence_links','nasab_adoptions')
ORDER BY c.relname,k.conname;
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('individuals','marriages','events','sources','nasab_evidence_links','nasab_adoptions','nasab_admins')
ORDER BY tablename,policyname;
SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated','nawra_app')
AND (table_name IN ('individuals','marriages','events','sources','nasab_evidence_links','nasab_adoptions') OR table_name LIKE 'nasab_nawra_%')
ORDER BY table_name,grantee,privilege_type;
SELECT c.relname AS table_name,t.tgname AS trigger_name,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname='public'
AND c.relname IN ('individuals','marriages','events','sources','nasab_evidence_links','nasab_adoptions')
ORDER BY c.relname,t.tgname;
SELECT c.relname AS view_name, md5(pg_get_viewdef(c.oid,true)) AS definition_md5,c.reloptions
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='v' AND c.relname LIKE 'nasab_nawra_%'
ORDER BY c.relname;
SELECT format('SELECT %L AS table_name, count(*) AS records FROM public.%I;',c.relname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
AND c.relname IN ('individuals','marriages','events','sources','nasab_evidence_links','nasab_adoptions')
ORDER BY c.relname
\gexec
COMMIT;
SQL
printf '\nPASS: pemeriksaan baca-saja selesai; tidak ada migrasi, restart, atau backup foto.\n'
