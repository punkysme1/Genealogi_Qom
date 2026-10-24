BEGIN;
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.nasab_admins WHERE user_id='02ab502f-318f-458e-8c05-f80d09f95d6e')
 THEN RAISE EXCEPTION 'Expected curator missing'; END IF;
END $$;
CREATE TEMP TABLE numbering_fixture AS SELECT gen_random_uuid() AS parent,gen_random_uuid() AS a,gen_random_uuid() AS b;
GRANT SELECT ON numbering_fixture TO authenticated;
INSERT INTO public.individuals(id,name) SELECT parent,'TEST ONLY root' FROM numbering_fixture;
INSERT INTO public.individuals(id,name,father_id) SELECT a,'TEST ONLY A',parent FROM numbering_fixture;
INSERT INTO public.individuals(id,name,father_id) SELECT b,'TEST ONLY B',parent FROM numbering_fixture;
CREATE TEMP TABLE numbering_before AS SELECT revision FROM nasab_numbering.state;
GRANT SELECT ON numbering_before TO authenticated;
SELECT set_config('request.jwt.claim.sub','02ab502f-318f-458e-8c05-f80d09f95d6e',true);
SELECT set_config('request.jwt.claims','{"sub":"02ab502f-318f-458e-8c05-f80d09f95d6e","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT public.qom_nasab_set_child_order(parent,a,1,'Fixture only','1',revision) FROM numbering_fixture CROSS JOIN numbering_before;
SELECT public.qom_nasab_set_child_order(parent,b,1,'Fixture only','2',revision+1) FROM numbering_fixture CROSS JOIN numbering_before;
DO $$ BEGIN
 BEGIN
  PERFORM public.qom_nasab_set_child_order(parent,a,1,'Fixture','3',revision) FROM numbering_fixture CROSS JOIN numbering_before;
  RAISE EXCEPTION 'Stale revision unexpectedly accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 BEGIN
  UPDATE nasab_numbering.child_order SET position=1;
  RAISE EXCEPTION 'Direct write unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM nasab_numbering.child_order o JOIN numbering_fixture f ON o.child_id=f.a WHERE o.position=2)
 OR NOT EXISTS(SELECT 1 FROM nasab_numbering.child_order o JOIN numbering_fixture f ON o.child_id=f.b WHERE o.position=1)
 THEN RAISE EXCEPTION 'Insertion did not shift order'; END IF;
 IF EXISTS(SELECT 1 FROM nasab_numbering.history h CROSS JOIN numbering_before b WHERE h.revision>b.revision AND h.actor IS DISTINCT FROM '02ab502f-318f-458e-8c05-f80d09f95d6e'::uuid)
 THEN RAISE EXCEPTION 'Actor mismatch'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT public.qom_nasab_save_profile_order(a,jsonb_build_object('name','TEST ONLY combined','father_id',parent),
  jsonb_build_array(jsonb_build_object('parent_id',parent,'position',8)),revision)
FROM numbering_fixture CROSS JOIN public.nasab_numbering_state_v1;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM nasab_numbering.child_order o JOIN numbering_fixture f ON o.child_id=f.a WHERE o.position=8 AND o.locator='')
 THEN RAISE EXCEPTION 'Combined save failed'; END IF;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
