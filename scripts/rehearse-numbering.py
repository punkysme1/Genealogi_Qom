#!/usr/bin/env python3
"""Restore-only rehearsal. No production migration, no media copy."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import uuid

HERE = Path(__file__).resolve().parent
PROD = 'supabase-db'
RESTORE = 'qom-roadmap-restore-v2-QdyWUR'
DB = 'qom_numbering_' + uuid.uuid4().hex[:12]

def main():
    if os.geteuid() != 0:
        raise SystemExit('Run with sudo')
    os.umask(0o077)
    out = Path('/opt/naracode/backups/qomaruddin-roadmap') / ('numbering-rehearsal-' + uuid.uuid4().hex[:12])
    out.mkdir(mode=0o700)
    started = False

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
        baseline = "SELECT md5(coalesce(jsonb_agg(to_jsonb(i) ORDER BY id)::text,'[]')) FROM public.individuals i;"
        before = run(args(), 'baseline', baseline)
        run(args(), 'migration', "BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';\n"+(HERE/'numbering-candidate.sql').read_text()+"\nCOMMIT;")
        if before != run(args(), 'after-migration', baseline):
            raise RuntimeError('Existing individuals changed')
        run(args(), 'functional-tests', (HERE/'numbering-server-tests.sql').read_text())
        if before != run(args(), 'after-tests', baseline):
            raise RuntimeError('Test rollback did not preserve individuals')
        roots = run(args(), 'root-candidates', "SELECT id,name FROM public.individuals WHERE name ILIKE '%Qomaruddin%' ORDER BY name;")
        print('PASS: fresh database restored; numbering candidate applied only to isolated copy')
        print('PASS: insertion, stale version, direct-write denial and rollback checks passed')
        print('PASS: existing individuals unchanged; no photos copied')
        print('Root candidates (not automatically selected):\n'+roots)
        print('Production NOT migrated; concurrency and application integration still pending.')
        print('Test database: '+DB)
    except Exception as exc:
        print('STOP: '+str(exc))
        raise SystemExit(1)
    finally:
        if started:
            subprocess.run(['docker','stop','--time','20',RESTORE],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=40)
        print('Private backup/log: '+str(out))

if __name__ == '__main__':
    main()
