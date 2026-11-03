ALTER TABLE public.individuals ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.individuals ADD CONSTRAINT nasab_aliases_bounded
 CHECK (cardinality(aliases) <= 20 AND length(array_to_string(aliases,';')) <= 2000);
COMMENT ON COLUMN public.individuals.aliases IS 'Public name variants approved by the curator. Never store private identity notes here.';

-- Match the installed public read boundary; do not replace or broaden the main view.
DO $$
DECLARE boundary text;
BEGIN
 boundary := CASE WHEN to_regclass('public.nasab_nawra_people_v1') IS NOT NULL
   THEN ' JOIN public.nasab_nawra_people_v1 p ON p.id=i.id' ELSE '' END;
 EXECUTE 'CREATE FUNCTION public.nasab_public_aliases_v1() RETURNS TABLE(person_id uuid, aliases text[])
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='''' AS $body$
 SELECT i.id,i.aliases FROM public.individuals i' || boundary || ' WHERE cardinality(i.aliases)>0 $body$';
END $$;
REVOKE ALL ON FUNCTION public.nasab_public_aliases_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nasab_public_aliases_v1() TO anon,authenticated,service_role,nawra_app;
NOTIFY pgrst,'reload schema';
