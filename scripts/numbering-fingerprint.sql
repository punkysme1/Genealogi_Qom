SELECT md5(jsonb_build_object(
 'columns',(SELECT jsonb_agg(to_jsonb(x) ORDER BY table_name,ordinal_position) FROM (
   SELECT table_name,column_name,ordinal_position,data_type,is_nullable,column_default
   FROM information_schema.columns WHERE table_schema='public' AND table_name IN('individuals','nasab_admins')) x),
 'tables',(SELECT jsonb_agg(to_jsonb(x) ORDER BY relname) FROM (
   SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('individuals','nasab_admins')) x),
 'constraints',(SELECT jsonb_agg(to_jsonb(x) ORDER BY relname,conname) FROM (
   SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition
   FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN('individuals','nasab_admins')) x),
 'policies',(SELECT jsonb_agg(to_jsonb(x) ORDER BY tablename,policyname) FROM (
   SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN('individuals','nasab_admins')) x),
 'grants',(SELECT jsonb_agg(to_jsonb(x) ORDER BY table_name,grantee,privilege_type) FROM (
   SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name IN('individuals','nasab_admins')) x),
 'triggers',(SELECT jsonb_agg(to_jsonb(x) ORDER BY relname,tgname) FROM (
   SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition,pg_get_functiondef(t.tgfoid) AS function_definition
   FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE NOT t.tgisinternal AND n.nspname='public' AND c.relname IN('individuals','nasab_admins')) x)
)::text);
