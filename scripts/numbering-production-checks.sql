DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM nasab_numbering.state WHERE singleton AND revision=1 AND root_id='5245e51b-d139-4d34-9117-7c58948ec6df')
 THEN RAISE EXCEPTION 'NUMBERING_STATE_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM nasab_numbering.child_order) THEN RAISE EXCEPTION 'UNEXPECTED_ORDER_SEED'; END IF;
 IF (SELECT count(*) FROM nasab_numbering.history)<>1 OR NOT EXISTS(SELECT 1 FROM nasab_numbering.history WHERE revision=1 AND reason='root' AND actor='02ab502f-318f-458e-8c05-f80d09f95d6e')
 THEN RAISE EXCEPTION 'HISTORY_MISMATCH'; END IF;
 IF NOT has_function_privilege('authenticated','public.qom_nasab_save_profile_order(uuid,jsonb,jsonb,bigint)','EXECUTE')
 OR has_function_privilege('anon','public.qom_nasab_save_profile_order(uuid,jsonb,jsonb,bigint)','EXECUTE')
 OR has_function_privilege('nawra_app','public.qom_nasab_save_profile_order(uuid,jsonb,jsonb,bigint)','EXECUTE')
 OR has_table_privilege('authenticated','nasab_numbering.child_order','UPDATE')
 OR has_table_privilege('anon','nasab_numbering.history','SELECT')
 THEN RAISE EXCEPTION 'NUMBERING_ACCESS_MISMATCH'; END IF;
END $$;
SET LOCAL ROLE anon;
SELECT revision,root_id FROM public.nasab_numbering_state_v1;
SELECT count(*) FROM public.nasab_child_order_v1;
RESET ROLE;
