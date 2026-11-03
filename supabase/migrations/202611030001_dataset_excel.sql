BEGIN;
CREATE TABLE public.nasab_datasets (
  id integer PRIMARY KEY CHECK(id > 0),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
  root_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.nasab_datasets(id,name) VALUES(1,'Data awal');
ALTER TABLE public.nasab_datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY datasets_read ON public.nasab_datasets FOR SELECT TO anon,authenticated USING(true);
GRANT SELECT ON public.nasab_datasets TO anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.nasab_datasets FROM anon,authenticated;

ALTER TABLE public.individuals ADD COLUMN dataset_id integer NOT NULL DEFAULT 1 REFERENCES public.nasab_datasets(id);
ALTER TABLE public.marriages ADD COLUMN dataset_id integer NOT NULL DEFAULT 1 REFERENCES public.nasab_datasets(id);
ALTER TABLE public.individuals ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.individuals ADD CONSTRAINT individuals_dataset_identity UNIQUE(dataset_id,id);
ALTER TABLE public.individuals ADD CONSTRAINT individuals_dataset_father FOREIGN KEY(dataset_id,father_id) REFERENCES public.individuals(dataset_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.individuals ADD CONSTRAINT individuals_dataset_mother FOREIGN KEY(dataset_id,mother_id) REFERENCES public.individuals(dataset_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.marriages ADD CONSTRAINT marriages_dataset_husband FOREIGN KEY(dataset_id,husband_id) REFERENCES public.individuals(dataset_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.marriages ADD CONSTRAINT marriages_dataset_wife FOREIGN KEY(dataset_id,wife_id) REFERENCES public.individuals(dataset_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.nasab_datasets ADD CONSTRAINT datasets_root FOREIGN KEY(id,root_id) REFERENCES public.individuals(dataset_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ON public.marriages(dataset_id,id);

CREATE FUNCTION public.nasab_dataset_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.dataset_id IS DISTINCT FROM OLD.dataset_id THEN RAISE EXCEPTION 'DATASET_IMMUTABLE' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER individuals_dataset_immutable BEFORE UPDATE OF dataset_id ON public.individuals FOR EACH ROW EXECUTE FUNCTION public.nasab_dataset_immutable();
CREATE TRIGGER marriages_dataset_immutable BEFORE UPDATE OF dataset_id ON public.marriages FOR EACH ROW EXECUTE FUNCTION public.nasab_dataset_immutable();

-- Preserve any installed public projection rather than widening its field/row boundary.
DO $$ BEGIN
 IF to_regclass('public.nasab_nawra_people_v1') IS NOT NULL THEN
  EXECUTE 'CREATE VIEW public.nasab_dataset_people_v1 WITH(security_invoker=true) AS SELECT p.*,i.dataset_id FROM public.nasab_nawra_people_v1 p JOIN public.individuals i ON i.id=p.id';
 ELSE
  EXECUTE 'CREATE VIEW public.nasab_dataset_people_v1 WITH(security_invoker=true) AS SELECT * FROM public.individuals';
 END IF;
 IF to_regclass('public.nasab_nawra_marriages_v1') IS NOT NULL THEN
  EXECUTE 'CREATE VIEW public.nasab_dataset_marriages_v1 WITH(security_invoker=true) AS SELECT p.*,i.dataset_id FROM public.nasab_nawra_marriages_v1 p JOIN public.marriages i ON i.id=p.id';
 ELSE
  EXECUTE 'CREATE VIEW public.nasab_dataset_marriages_v1 WITH(security_invoker=true) AS SELECT * FROM public.marriages';
 END IF;
 IF to_regclass('public.nasab_nawra_adoptions_v1') IS NOT NULL THEN
  EXECUTE 'CREATE VIEW public.nasab_dataset_adoptions_v1 WITH(security_invoker=true) AS SELECT a.*,p.dataset_id FROM public.nasab_nawra_adoptions_v1 a JOIN public.individuals p ON p.id=a.parent_id JOIN public.individuals c ON c.id=a.child_id AND c.dataset_id=p.dataset_id';
 ELSE
  EXECUTE 'CREATE VIEW public.nasab_dataset_adoptions_v1 WITH(security_invoker=true) AS SELECT NULL::uuid id,NULL::uuid parent_id,NULL::uuid child_id,NULL::integer dataset_id WHERE false';
 END IF;
END $$;
GRANT SELECT ON public.nasab_dataset_people_v1,public.nasab_dataset_marriages_v1,public.nasab_dataset_adoptions_v1 TO anon,authenticated;

CREATE TABLE public.nasab_dataset_imports (
 request_id uuid PRIMARY KEY, actor uuid NOT NULL, payload_hash text NOT NULL,
 dataset_id integer NOT NULL REFERENCES public.nasab_datasets(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nasab_dataset_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nasab_dataset_imports FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.qom_nasab_import_dataset(p_request_id uuid,p_name text,p_people jsonb,p_marriages jsonb,p_root_key text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE version_id integer; digest text; prior public.nasab_dataset_imports; removed integer; left_count integer;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.nasab_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120
 OR p_people IS NULL OR jsonb_typeof(p_people)<>'array' OR p_marriages IS NULL OR jsonb_typeof(p_marriages)<>'array'
 THEN RAISE EXCEPTION 'INVALID_IMPORT' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_people) NOT BETWEEN 1 AND 20000 OR jsonb_array_length(p_marriages)>20000
 OR octet_length(p_people::text)+octet_length(p_marriages::text)>20000000 THEN RAISE EXCEPTION 'IMPORT_TOO_LARGE' USING ERRCODE='22023'; END IF;
 digest:=md5(jsonb_build_array(p_name,p_people,p_marriages,p_root_key)::text);
 -- Serializes version allocation and retry checks. A failed import consumes no version.
 LOCK TABLE public.nasab_datasets IN EXCLUSIVE MODE;
 SELECT * INTO prior FROM public.nasab_dataset_imports WHERE request_id=p_request_id;
 IF FOUND THEN
  IF prior.actor<>auth.uid() OR prior.payload_hash<>digest THEN RAISE EXCEPTION 'IMPORT_REQUEST_REUSED' USING ERRCODE='22023'; END IF;
  RETURN prior.dataset_id;
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_people) x WHERE jsonb_typeof(x)<>'object')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_marriages) x WHERE jsonb_typeof(x)<>'object') THEN RAISE EXCEPTION 'INVALID_RECORD' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_people) x, jsonb_object_keys(x) k WHERE k<>ALL(ARRAY['key','name','aliases','gender','father','mother','birth_date','death_date','is_alive','birth_place','death_place','current_location','education','occupation','bio','economic_status','profile_photo_url']))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_marriages) x,jsonb_object_keys(x) k WHERE k<>ALL(ARRAY['key','husband','wife','marriage_date','is_active'])) THEN RAISE EXCEPTION 'UNKNOWN_IMPORT_FIELD' USING ERRCODE='22023'; END IF;
 CREATE TEMP TABLE nasab_import_people ON COMMIT DROP AS
 SELECT gen_random_uuid() id,x.* FROM jsonb_to_recordset(p_people) AS x(key text,name text,aliases text[],gender text,father text,mother text,birth_date date,death_date date,is_alive boolean,birth_place text,death_place text,current_location text,education text,occupation text,bio text,economic_status text,profile_photo_url text);
 CREATE TEMP TABLE nasab_import_marriages ON COMMIT DROP AS
 SELECT x.* FROM jsonb_to_recordset(p_marriages) AS x(key text,husband text,wife text,marriage_date date,is_active boolean);
 IF EXISTS(SELECT 1 FROM pg_temp.nasab_import_people WHERE key IS NULL OR length(btrim(key)) NOT BETWEEN 1 AND 100 OR key<>btrim(key) OR length(coalesce(name,''))>10000 OR gender NOT IN('M','F') OR economic_status NOT IN('Kaya','Menengah','Miskin')
 OR cardinality(aliases)>20 OR length(array_to_string(aliases,';'))>2000 OR EXISTS(SELECT 1 FROM unnest(aliases) a WHERE length(a)>120)
 OR (birth_date IS NOT NULL AND death_date<birth_date) OR (death_date IS NOT NULL AND is_alive IS TRUE)
 OR (profile_photo_url IS NOT NULL AND profile_photo_url !~* '^https://'))
 OR EXISTS(SELECT key FROM pg_temp.nasab_import_people GROUP BY key HAVING count(*)>1) THEN RAISE EXCEPTION 'INVALID_INDIVIDUAL' USING ERRCODE='22023'; END IF;
 CREATE UNIQUE INDEX ON pg_temp.nasab_import_people(key);
 IF EXISTS(SELECT 1 FROM pg_temp.nasab_import_people p LEFT JOIN pg_temp.nasab_import_people f ON f.key=p.father LEFT JOIN pg_temp.nasab_import_people m ON m.key=p.mother
 WHERE (p.father IS NOT NULL AND f.id IS NULL) OR (p.mother IS NOT NULL AND m.id IS NULL) OR p.key IN(p.father,p.mother) OR p.father=p.mother OR f.gender='F' OR m.gender='M')
 THEN RAISE EXCEPTION 'INVALID_PARENT_LINK' USING ERRCODE='22023'; END IF;
 CREATE TEMP TABLE nasab_import_remaining ON COMMIT DROP AS SELECT key,father,mother FROM pg_temp.nasab_import_people;
 CREATE UNIQUE INDEX ON pg_temp.nasab_import_remaining(key);
 LOOP
  DELETE FROM pg_temp.nasab_import_remaining p WHERE NOT EXISTS(SELECT 1 FROM pg_temp.nasab_import_remaining q WHERE q.key=p.father OR q.key=p.mother);
  GET DIAGNOSTICS removed=ROW_COUNT;
  EXIT WHEN removed=0;
 END LOOP;
 SELECT count(*) INTO left_count FROM pg_temp.nasab_import_remaining;
 IF left_count>0 THEN RAISE EXCEPTION 'ANCESTRY_CYCLE' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.nasab_import_marriages m LEFT JOIN pg_temp.nasab_import_people h ON h.key=m.husband LEFT JOIN pg_temp.nasab_import_people w ON w.key=m.wife
 WHERE m.key IS NULL OR length(btrim(m.key)) NOT BETWEEN 1 AND 100 OR h.id IS NULL OR w.id IS NULL OR m.husband=m.wife OR h.gender='F' OR w.gender='M')
 OR EXISTS(SELECT key FROM pg_temp.nasab_import_marriages GROUP BY key HAVING count(*)>1)
 OR EXISTS(SELECT husband,wife FROM pg_temp.nasab_import_marriages GROUP BY husband,wife HAVING count(*)>1) THEN RAISE EXCEPTION 'INVALID_MARRIAGE' USING ERRCODE='22023'; END IF;
 IF p_root_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_temp.nasab_import_people WHERE key=p_root_key) THEN RAISE EXCEPTION 'INVALID_ROOT' USING ERRCODE='22023'; END IF;
 SELECT max(id)+1 INTO version_id FROM public.nasab_datasets;
 INSERT INTO public.nasab_datasets(id,name) VALUES(version_id,btrim(p_name));
 INSERT INTO public.individuals(id,dataset_id,name,aliases,slug,gender,birth_date,death_date,is_alive,birth_place,death_place,current_location,education,occupation,bio,economic_status,profile_photo_url,is_verified,father_id,mother_id)
 SELECT p.id,version_id,coalesce(nullif(btrim(p.name),''),'Nama belum diketahui ['||p.key||']'),coalesce(p.aliases,'{}'),p.id::text,p.gender,p.birth_date,p.death_date,p.is_alive,p.birth_place,p.death_place,p.current_location,p.education,p.occupation,p.bio,p.economic_status,p.profile_photo_url,false,f.id,m.id
 FROM pg_temp.nasab_import_people p LEFT JOIN pg_temp.nasab_import_people f ON f.key=p.father LEFT JOIN pg_temp.nasab_import_people m ON m.key=p.mother;
 INSERT INTO public.marriages(dataset_id,husband_id,wife_id,marriage_date,is_active)
 SELECT version_id,h.id,w.id,m.marriage_date,m.is_active FROM pg_temp.nasab_import_marriages m JOIN pg_temp.nasab_import_people h ON h.key=m.husband JOIN pg_temp.nasab_import_people w ON w.key=m.wife;
 UPDATE public.nasab_datasets SET root_id=(SELECT id FROM pg_temp.nasab_import_people WHERE key=p_root_key) WHERE id=version_id;
 INSERT INTO public.nasab_dataset_imports(request_id,actor,payload_hash,dataset_id) VALUES(p_request_id,auth.uid(),digest,version_id);
 RETURN version_id;
END $$;
REVOKE ALL ON FUNCTION public.qom_nasab_import_dataset(uuid,text,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qom_nasab_import_dataset(uuid,text,jsonb,jsonb,text) TO authenticated;

-- Keep the existing atomic profile/order RPC while supplying dataset membership for new profiles.
CREATE FUNCTION public.qom_nasab_save_dataset_profile(p_dataset integer,p_id uuid,p_profile jsonb,p_orders jsonb,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid:=p_id; revision bigint; result jsonb;
BEGIN
 PERFORM nasab_numbering.require_curator();
 SELECT s.revision INTO revision FROM nasab_numbering.state s WHERE singleton FOR UPDATE;
 IF p_expected_revision IS DISTINCT FROM revision THEN RAISE EXCEPTION 'STALE_REVISION' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.nasab_datasets WHERE id=p_dataset) THEN RAISE EXCEPTION 'INVALID_DATASET'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.individuals(dataset_id,name) VALUES(p_dataset,'Profil baru') RETURNING id INTO target;
  SELECT s.revision INTO revision FROM nasab_numbering.state s WHERE singleton;
 ELSIF NOT EXISTS(SELECT 1 FROM public.individuals WHERE id=p_id AND dataset_id=p_dataset) THEN RAISE EXCEPTION 'INVALID_DATASET_PROFILE'; END IF;
 result:=public.qom_nasab_save_profile_order(target,p_profile-'aliases',p_orders,revision);
 IF p_profile ? 'aliases' THEN
  IF jsonb_typeof(p_profile->'aliases')<>'array' OR jsonb_array_length(p_profile->'aliases')>20
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_profile->'aliases') a WHERE length(a)>120)
  OR length((p_profile->'aliases')::text)>2200 THEN RAISE EXCEPTION 'INVALID_ALIASES' USING ERRCODE='22023'; END IF;
  UPDATE public.individuals SET aliases=ARRAY(SELECT jsonb_array_elements_text(p_profile->'aliases')) WHERE id=target;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.qom_nasab_save_dataset_profile(integer,uuid,jsonb,jsonb,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qom_nasab_save_dataset_profile(integer,uuid,jsonb,jsonb,bigint) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
