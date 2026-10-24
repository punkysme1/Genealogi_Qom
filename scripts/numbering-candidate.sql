-- Candidate only: rehearse on a fresh restore before production.
-- The caller must wrap this entire file in one transaction.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='individuals' AND c.relrowsecurity)
  THEN RAISE EXCEPTION 'individuals RLS must be enabled'; END IF;
END $$;

CREATE SCHEMA nasab_numbering;
REVOKE ALL ON SCHEMA nasab_numbering FROM PUBLIC;
CREATE TABLE nasab_numbering.state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  revision bigint NOT NULL DEFAULT 0,
  root_id uuid REFERENCES public.individuals(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO nasab_numbering.state(singleton) VALUES(true);
CREATE TABLE nasab_numbering.child_order (
  parent_id uuid NOT NULL REFERENCES public.individuals(id),
  child_id uuid NOT NULL REFERENCES public.individuals(id),
  position integer NOT NULL CHECK(position > 0),
  source text NOT NULL CHECK(length(btrim(source)) > 0),
  locator text NOT NULL DEFAULT '',
  PRIMARY KEY(parent_id,child_id),
  CONSTRAINT numbering_unique_position UNIQUE(parent_id,position) DEFERRABLE INITIALLY DEFERRED,
  CHECK(parent_id <> child_id)
);
CREATE INDEX ON nasab_numbering.child_order(child_id);
CREATE TABLE nasab_numbering.history (
  revision bigint PRIMARY KEY,
  actor uuid,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text NOT NULL,
  payload jsonb NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA nasab_numbering FROM PUBLIC,anon,authenticated,service_role,nawra_app;
ALTER TABLE nasab_numbering.state ENABLE ROW LEVEL SECURITY;
ALTER TABLE nasab_numbering.child_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE nasab_numbering.history ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION nasab_numbering.require_curator() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'authenticated'
    OR auth.uid() IS DISTINCT FROM '02ab502f-318f-458e-8c05-f80d09f95d6e'::uuid
    OR NOT EXISTS(SELECT 1 FROM public.nasab_admins WHERE user_id=auth.uid())
  THEN RAISE EXCEPTION 'CURATOR_REQUIRED' USING ERRCODE='42501'; END IF;
END $$;

CREATE FUNCTION nasab_numbering.record_change(p_reason text,p_payload jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v bigint;
BEGIN
  UPDATE nasab_numbering.state SET revision=revision+1,updated_at=clock_timestamp()
    WHERE singleton RETURNING revision INTO v;
  INSERT INTO nasab_numbering.history(revision,actor,reason,payload)
    VALUES(v,auth.uid(),p_reason,p_payload);
  RETURN v;
END $$;

CREATE FUNCTION public.qom_nasab_set_child_order(
  p_parent uuid,p_child uuid,p_position integer,p_source text,p_locator text,p_expected_revision bigint
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v bigint; old_position integer; before_rows jsonb; after_rows jsonb;
BEGIN
  PERFORM nasab_numbering.require_curator();
  -- Lock before reading both the version and the sibling positions.
  SELECT revision INTO v FROM nasab_numbering.state WHERE singleton FOR UPDATE;
  IF p_expected_revision IS DISTINCT FROM v THEN RAISE EXCEPTION 'STALE_REVISION' USING ERRCODE='40001'; END IF;
  IF p_position IS NULL OR p_position<1 OR p_source IS NULL OR btrim(p_source)=''
  THEN RAISE EXCEPTION 'ORDER_SOURCE_REQUIRED' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.individuals WHERE id=p_child AND p_parent IN(father_id,mother_id))
  THEN RAISE EXCEPTION 'PARENT_LINK_MISMATCH' USING ERRCODE='22023'; END IF;
  SELECT jsonb_agg(to_jsonb(o) ORDER BY position) INTO before_rows FROM nasab_numbering.child_order o WHERE parent_id=p_parent;
  SELECT position INTO old_position FROM nasab_numbering.child_order WHERE parent_id=p_parent AND child_id=p_child;
  DELETE FROM nasab_numbering.child_order WHERE parent_id=p_parent AND child_id=p_child;
  IF old_position IS NOT NULL THEN
    UPDATE nasab_numbering.child_order SET position=position-1 WHERE parent_id=p_parent AND position>old_position;
  END IF;
  UPDATE nasab_numbering.child_order SET position=position+1 WHERE parent_id=p_parent AND position>=p_position;
  INSERT INTO nasab_numbering.child_order VALUES(p_parent,p_child,p_position,btrim(p_source),coalesce(btrim(p_locator),''));
  SELECT jsonb_agg(to_jsonb(o) ORDER BY position) INTO after_rows FROM nasab_numbering.child_order o WHERE parent_id=p_parent;
  RETURN nasab_numbering.record_change('child_order',jsonb_build_object('parent_id',p_parent,'before',before_rows,'after',after_rows));
END $$;

CREATE FUNCTION public.qom_nasab_set_numbering_root(p_root uuid,p_expected_revision bigint,p_reason text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v bigint; old_root uuid;
BEGIN
  PERFORM nasab_numbering.require_curator();
  SELECT revision,root_id INTO v,old_root FROM nasab_numbering.state WHERE singleton FOR UPDATE;
  IF p_expected_revision IS DISTINCT FROM v THEN RAISE EXCEPTION 'STALE_REVISION' USING ERRCODE='40001'; END IF;
  IF p_root IS NULL OR NOT EXISTS(SELECT 1 FROM public.individuals WHERE id=p_root) OR p_reason IS NULL OR btrim(p_reason)=''
  THEN RAISE EXCEPTION 'ROOT_AND_REASON_REQUIRED' USING ERRCODE='22023'; END IF;
  UPDATE nasab_numbering.state SET root_id=p_root WHERE singleton;
  RETURN nasab_numbering.record_change('root',jsonb_build_object('before',old_root,'after',p_root,'reason',p_reason));
END $$;

-- Existing profile writes remain valid. Changes to topology invalidate stale previews.
CREATE FUNCTION nasab_numbering.track_parent_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before_orders jsonb;
BEGIN
  IF TG_OP='UPDATE' AND NEW.father_id IS NOT DISTINCT FROM OLD.father_id AND NEW.mother_id IS NOT DISTINCT FROM OLD.mother_id THEN RETURN NEW; END IF;
  PERFORM 1 FROM nasab_numbering.state WHERE singleton FOR UPDATE;
  IF TG_OP IN('UPDATE','DELETE') THEN
    SELECT jsonb_agg(to_jsonb(o)) INTO before_orders FROM nasab_numbering.child_order o
    WHERE child_id=OLD.id OR parent_id=OLD.id;
  END IF;
  IF TG_OP='DELETE' THEN
    DELETE FROM nasab_numbering.child_order WHERE child_id=OLD.id OR parent_id=OLD.id;
    UPDATE nasab_numbering.state SET root_id=NULL WHERE root_id=OLD.id;
  ELSIF TG_OP='UPDATE' THEN
    DELETE FROM nasab_numbering.child_order WHERE child_id=NEW.id
      AND parent_id IS DISTINCT FROM NEW.father_id AND parent_id IS DISTINCT FROM NEW.mother_id;
  END IF;
  PERFORM nasab_numbering.record_change('parent_link',jsonb_build_object(
    'operation',TG_OP,'id',CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
    'before',CASE WHEN TG_OP<>'INSERT' THEN jsonb_build_object('father',OLD.father_id,'mother',OLD.mother_id) END,
    'after',CASE WHEN TG_OP<>'DELETE' THEN jsonb_build_object('father',NEW.father_id,'mother',NEW.mother_id) END,
    'previous_orders',before_orders));
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER nasab_numbering_parent_change BEFORE INSERT OR UPDATE OR DELETE ON public.individuals
FOR EACH ROW EXECUTE FUNCTION nasab_numbering.track_parent_change();

-- These reads use invoker rights and the same visible individuals as Nasab.
GRANT USAGE ON SCHEMA nasab_numbering TO anon,authenticated;
GRANT SELECT ON nasab_numbering.state,nasab_numbering.child_order TO anon,authenticated;
CREATE POLICY numbering_state_read ON nasab_numbering.state FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY numbering_order_read ON nasab_numbering.child_order FOR SELECT TO anon,authenticated USING(
  EXISTS(SELECT 1 FROM public.individuals WHERE id=parent_id) AND EXISTS(SELECT 1 FROM public.individuals WHERE id=child_id)
);
CREATE VIEW public.nasab_numbering_state_v1 WITH(security_invoker=true) AS SELECT * FROM nasab_numbering.state;
CREATE VIEW public.nasab_child_order_v1 WITH(security_invoker=true) AS SELECT * FROM nasab_numbering.child_order;
GRANT SELECT ON public.nasab_numbering_state_v1,public.nasab_child_order_v1 TO anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nasab_numbering FROM PUBLIC,anon,authenticated,service_role,nawra_app;
REVOKE ALL ON FUNCTION public.qom_nasab_set_child_order(uuid,uuid,integer,text,text,bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.qom_nasab_set_numbering_root(uuid,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qom_nasab_set_child_order(uuid,uuid,integer,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qom_nasab_set_numbering_root(uuid,bigint,text) TO authenticated;

-- One transaction for profile and both parental orders. Verification stays in the existing form.
CREATE FUNCTION public.qom_nasab_save_profile_order(p_id uuid,p_profile jsonb,p_orders jsonb,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v bigint; target uuid; columns_sql text; item jsonb; parent uuid; position_value integer; reference_text text;
BEGIN
  PERFORM nasab_numbering.require_curator();
  SELECT revision INTO v FROM nasab_numbering.state WHERE singleton FOR UPDATE;
  IF p_expected_revision IS DISTINCT FROM v THEN RAISE EXCEPTION 'STALE_REVISION' USING ERRCODE='40001'; END IF;
  IF p_profile IS NULL OR jsonb_typeof(p_profile)<>'object' OR p_orders IS NULL OR jsonb_typeof(p_orders)<>'array' OR jsonb_array_length(p_orders)>2
  THEN RAISE EXCEPTION 'INVALID_PROFILE_ORDERS' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_profile) AS k(key) WHERE key <> ALL(ARRAY[
    'name','slug','gender','birth_date','death_date','birth_place','death_place','current_location','education','occupation','bio',
    'is_alive','is_verified','verified_by','verification_type','verification_source','economic_status','profile_photo_url','father_id','mother_id']))
  THEN RAISE EXCEPTION 'UNKNOWN_PROFILE_FIELD' USING ERRCODE='22023'; END IF;
  IF NOT (p_profile ? 'name') OR length(btrim(coalesce(p_profile->>'name','')))=0
  THEN RAISE EXCEPTION 'NAME_REQUIRED' USING ERRCODE='22023'; END IF;
  SELECT string_agg(format('%I',key),',' ORDER BY key) INTO columns_sql FROM jsonb_object_keys(p_profile) AS k(key);
  target:=coalesce(p_id,gen_random_uuid());
  IF p_id IS NULL THEN
    EXECUTE format('INSERT INTO public.individuals(id,%s) SELECT $2,%s FROM jsonb_populate_record(NULL::public.individuals,$1)',columns_sql,columns_sql) USING p_profile,target;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM public.individuals WHERE id=target) THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE='22023'; END IF;
    EXECUTE format('UPDATE public.individuals SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public.individuals,$1)) WHERE id=$2',columns_sql,columns_sql) USING p_profile,target;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_orders) x GROUP BY x->>'parent_id' HAVING count(*)>1)
  THEN RAISE EXCEPTION 'DUPLICATE_PARENT_ORDER' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_orders) LOOP
    parent:=(item->>'parent_id')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.individuals WHERE id=target AND parent IN(father_id,mother_id))
    THEN RAISE EXCEPTION 'PARENT_LINK_MISMATCH' USING ERRCODE='22023'; END IF;
    SELECT revision INTO v FROM nasab_numbering.state WHERE singleton;
    IF item->>'position' IS NULL THEN
      DELETE FROM nasab_numbering.child_order WHERE parent_id=parent AND child_id=target;
      PERFORM nasab_numbering.record_change('clear_child_order',jsonb_build_object('parent',parent,'child',target));
    ELSE
      position_value:=(item->>'position')::integer;
      reference_text:=nullif(btrim(p_profile->>'verification_source'),'');
      PERFORM public.qom_nasab_set_child_order(parent,target,position_value,
        coalesce(reference_text,'Catatan urutan admin; rujukan belum diisi'),'',v);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('id',target,'revision',(SELECT revision FROM nasab_numbering.state WHERE singleton));
END $$;
REVOKE ALL ON FUNCTION public.qom_nasab_save_profile_order(uuid,jsonb,jsonb,bigint) FROM PUBLIC,anon,service_role,nawra_app;
GRANT EXECUTE ON FUNCTION public.qom_nasab_save_profile_order(uuid,jsonb,jsonb,bigint) TO authenticated;
