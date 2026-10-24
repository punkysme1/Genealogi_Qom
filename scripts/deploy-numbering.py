#!/usr/bin/env python3
"""Fresh restore rehearsal, then atomic authorized numbering deployment. No media copies."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import uuid

HERE = Path(__file__).resolve().parent
PROD = 'supabase-db'
RESTORE = 'qom-roadmap-restore-v2-QdyWUR'
DB = 'qom_numbering_deploy_' + uuid.uuid4().hex[:12]

def main():
    if os.geteuid() != 0:
        raise SystemExit('Run with sudo')
    os.umask(0o077)
    out = Path('/opt/naracode/backups/qomaruddin-roadmap') / ('numbering-production-' + uuid.uuid4().hex[:12])
    out.mkdir(mode=0o700)
    started = False
    attempted = False
    committed = False

    def run(args, label, data=None):
        p = subprocess.run(args, input=data, text=True, capture_output=True, timeout=300)
        (out / (label + '.log')).write_text(p.stdout + p.stderr)
        if p.returncode:
            raise RuntimeError(label + ' failed; see private log')
        return p.stdout.strip()

    def inspect(name):
        p = subprocess.run(['docker', 'inspect', name], text=True, capture_output=True, timeout=20)
        if p.returncode:
            raise RuntimeError('Container inspection failed')
        return json.loads(p.stdout)[0]

    def args(db=DB):
        return ['docker','exec','-i','--user','postgres',RESTORE,'psql','-X','-w','-h','/tmp/roadmap-socket','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1','-Atq']

    production_args = ['docker','exec','-i','--user','postgres',PROD,'psql','-X','-w','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq']
    fingerprint_sql = (HERE/'numbering-fingerprint.sql').read_text()
    schema_expression = fingerprint_sql.strip().removeprefix('SELECT ').removesuffix(';')
    normalized_fingerprint = "BEGIN READ ONLY; SET LOCAL search_path='';\n" + fingerprint_sql + '\nCOMMIT;'
    checks = (HERE/'numbering-production-checks.sql').read_text()
    try:
        for line in (HERE / 'SHA256SUMS-NUMBERING').read_text().splitlines():
            digest, name = line.split('  ', 1)
            if Path(name).name != name or hashlib.sha256((HERE / name).read_bytes()).hexdigest() != digest:
                raise RuntimeError('Package checksum mismatch')
        info, prod = inspect(RESTORE), inspect(PROD)
        if info['State']['Running'] or info['HostConfig']['NetworkMode'] != 'none' or info['HostConfig'].get('PortBindings'):
            raise RuntimeError('Expected stopped isolated restore container')
        if any(m['Type']=='bind' for m in info['Mounts']) or not any(m.get('Name') == RESTORE+'-data' and m['Destination']=='/var/lib/postgresql/data' for m in info['Mounts']):
            raise RuntimeError('Restore mounts differ from approved test volume')
        if prod['Image'] != info['Image'] or not prod['State']['Running']:
            raise RuntimeError('Database image/state mismatch')
        if run(production_args,'already-applied',"SELECT to_regnamespace('nasab_numbering') IS NULL;") != 't':
            raise RuntimeError('Numbering schema already present; no automatic rerun')
        expected_schema = run(production_args,'schema-before',normalized_fingerprint)
        if len(expected_schema)!=32 or any(c not in '0123456789abcdef' for c in expected_schema):
            raise RuntimeError('Unexpected fingerprint')
        with (out/'postgres.dump').open('wb') as f, (out/'backup.log').open('wb') as log:
            p = subprocess.run(['docker','exec','--user','postgres',PROD,'pg_dump','-U','postgres','-Fc','-d','postgres'],stdout=f,stderr=log,timeout=300)
        if p.returncode:
            raise RuntimeError('Database backup failed')
        (out/'SHA256SUMS').write_text(hashlib.sha256((out/'postgres.dump').read_bytes()).hexdigest()+'  postgres.dump\n')
        run(['docker','start',RESTORE], 'start'); started = True
        run(['docker','exec','--user','postgres',RESTORE,'sh','-eu','-c',
             'bindir=$(pg_config --bindir); "$bindir/pg_ctl" -D /var/lib/postgresql/data/roadmap-test '
             '-l /var/lib/postgresql/data/roadmap-test/server.log '
             '-o "-k /tmp/roadmap-socket -c listen_addresses= -c shared_preload_libraries=pg_net,pg_stat_statements" -w start'], 'postgres-start')
        run(args('template1'), 'create-test-db', f'CREATE DATABASE {DB} TEMPLATE template0 OWNER postgres;')
        with (out/'postgres.dump').open('rb') as f, (out/'restore.log').open('wb') as log:
            p = subprocess.run(['docker','exec','-i','--user','postgres',RESTORE,'pg_restore','-h','/tmp/roadmap-socket','-U','supabase_admin','-d',DB,'--exit-on-error','--single-transaction'],stdin=f,stdout=log,stderr=log,timeout=300)
        if p.returncode:
            raise RuntimeError('Fresh restore failed')
        if expected_schema != run(args(),'restored-schema',normalized_fingerprint):
            raise RuntimeError('Normalized production/restore structure differs; production not migrated')
        migration = (HERE/'numbering-candidate.sql').read_text()
        root_seed = """
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.individuals WHERE id='5245e51b-d139-4d34-9117-7c58948ec6df' AND name='Kiai Qomaruddin')
 THEN RAISE EXCEPTION 'ROOT_IDENTITY_CHANGED'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','02ab502f-318f-458e-8c05-f80d09f95d6e',true);
SELECT set_config('request.jwt.claims','{"sub":"02ab502f-318f-458e-8c05-f80d09f95d6e","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT public.qom_nasab_set_numbering_root('5245e51b-d139-4d34-9117-7c58948ec6df',0,'Pangkal Kiai Qomaruddin sesuai identitas yang diperiksa bersama kurator');
RESET ROLE;
"""
        baseline = "SELECT md5(coalesce(jsonb_agg(to_jsonb(i) ORDER BY id)::text,'[]')) AS digest FROM public.individuals i"
        transaction = """BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s'; SET LOCAL search_path='';
SELECT pg_advisory_xact_lock(71023,20261023);
LOCK TABLE public.individuals,public.nasab_admins IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN IF ("""+schema_expression+") IS DISTINCT FROM '"+expected_schema+"' THEN RAISE EXCEPTION 'STRUCTURE_DRIFT'; END IF; END $$;\n"+"CREATE TEMP TABLE numbering_data_before ON COMMIT DROP AS "+baseline+";\n"+migration+root_seed+"""
DO $$ BEGIN IF (SELECT digest FROM pg_temp.numbering_data_before) IS DISTINCT FROM (
"""+baseline+"""
) THEN RAISE EXCEPTION 'EXISTING_INDIVIDUALS_CHANGED'; END IF; END $$;
"""+checks+"\nNOTIFY pgrst,'reload schema'; COMMIT; SELECT 'NUMBERING_COMMITTED';"
        (out/'transaction.sql').write_text(transaction)
        run(args(),'rehearsal',transaction)
        run(args(),'functional-tests',(HERE/'numbering-server-tests.sql').read_text())
        run(args(),'rehearsal-verification','BEGIN READ ONLY;'+checks+'COMMIT;')
        print('PASS: fresh backup restored; combined profile/order transaction and rollback passed',flush=True)
        attempted=True
        result=run(production_args,'production-transaction',transaction)
        if 'NUMBERING_COMMITTED' not in result:
            raise RuntimeError('Commit outcome unclear; inspect database before retrying')
        committed=True
        run(production_args,'production-verification','BEGIN READ ONLY;'+checks+'COMMIT;')
        print('PASS: production migration COMMIT; existing individuals unchanged within transaction')
        print('PASS: root UUID set; order storage, revision and combined-save RPC available')
        print('PASS: post-deployment checks passed; no photographs copied or services restarted')
        print('Reload Nasab, reopen the profile, and test saving child order. Browser/API behavior still needs verification.')
    except Exception as exc:
        print('STOP: '+str(exc))
        print('Production committed; inspect verification log.' if committed else 'Deployment attempted; inspect commit state before retry.' if attempted else 'Production migration not attempted.')
        raise SystemExit(1)
    finally:
        if started:
            subprocess.run(['docker','stop','--time','20',RESTORE],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=40)
        print('Private backup/log: '+str(out))

if __name__ == '__main__':
    main()
