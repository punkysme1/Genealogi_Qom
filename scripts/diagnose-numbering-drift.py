import json
import hashlib
import os
from pathlib import Path
import re
import subprocess

RESTORE='qom-roadmap-restore-v2-QdyWUR'
LOG=Path('/opt/naracode/backups/qomaruddin-roadmap/numbering-production-3165beab45ff')
SQL=(Path(__file__).resolve().parent/'numbering-structure-details.sql').read_text()

def run(args,data=None):
    p=subprocess.run(args,input=data,text=True,capture_output=True,timeout=45)
    if p.returncode:
        (LOG/'drift-diagnostic-error.log').write_text(p.stderr)
        raise RuntimeError('Diagnostic failed; private log saved')
    return p.stdout.strip()

def query(container,db,sql,role='supabase_admin',normalized=False):
    args=['docker','exec','-i','--user','postgres',container,'psql','-X','-w','-Atq','-v','ON_ERROR_STOP=1']
    args+=['-h','/tmp/roadmap-socket'] if container==RESTORE else []
    args+=['-U',role,'-d',db]
    return run(args,'BEGIN READ ONLY; SET LOCAL statement_timeout=\'20s\';'+("SET LOCAL search_path='';" if normalized else '')+sql+' COMMIT;')

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()

def differences(a,b):
    keys={'columns':['table_name','column_name'],'tables':['relname'],'constraints':['relname','conname'],
          'policies':['tablename','policyname'],'grants':['table_name','grantee','privilege_type'],'triggers':['relname','tgname']}
    count=0
    for category,fields in keys.items():
        left={tuple(str(r[f]) for f in fields):r for r in a.get(category) or []}
        right={tuple(str(r[f]) for f in fields):r for r in b.get(category) or []}
        for key in sorted(left.keys()|right.keys()):
            x,y=left.get(key),right.get(key)
            if x==y: continue
            count+=1
            print('Object: '+category+' | '+' | '.join(key))
            if x is None or y is None:
                print('Missing in: '+('production' if x is None else 'restore'));continue
            for field in sorted(x.keys()|y.keys()):
                if x.get(field)!=y.get(field):
                    print(json.dumps({'field':field,'production_sha256':digest(x.get(field)),'restore_sha256':digest(y.get(field))}))
    print('Differing objects: '+str(count))

def main():
    if os.geteuid()!=0: raise SystemExit('Run with sudo')
    os.umask(0o077)
    started=False
    try:
        info=json.loads(run(['docker','inspect','--format','{{json .}}',RESTORE]))
        if info['State']['Running'] or info['HostConfig']['NetworkMode']!='none' or info['HostConfig'].get('PortBindings'):
            raise RuntimeError('Expected stopped isolated restore container')
        if any(m['Type']=='bind' for m in info['Mounts']) or not any(m.get('Name')==RESTORE+'-data' and m['Destination']=='/var/lib/postgresql/data' for m in info['Mounts']):
            raise RuntimeError('Unexpected test mounts')
        run(['docker','start',RESTORE]);started=True
        run(['docker','exec','--user','postgres',RESTORE,'sh','-eu','-c',
            'bindir=$(pg_config --bindir); "$bindir/pg_ctl" -D /var/lib/postgresql/data/roadmap-test -l /var/lib/postgresql/data/roadmap-test/server.log -o "-k /tmp/roadmap-socket -c listen_addresses= -c shared_preload_libraries=pg_net,pg_stat_statements" -w start'])
        expected=(LOG/'restored-schema.log').read_text().strip()
        before=(LOG/'schema-before.log').read_text().strip()
        if not re.fullmatch('[0-9a-f]{32}',expected+'' ) or not re.fullmatch('[0-9a-f]{32}',before):
            raise RuntimeError('Unexpected original fingerprint log')
        # Compare exact original SQL rendering before considering normalization.
        hashsql='SELECT md5(('+SQL.strip().removesuffix(';')+')::text);'
        dbs=query(RESTORE,'template1',"SELECT datname FROM pg_database WHERE datname LIKE 'qom_numbering_deploy_%' ORDER BY datname;").splitlines()
        matched=[]
        for db in dbs:
            if not re.fullmatch('qom_numbering_deploy_[0-9a-f]{12}',db): continue
            if query(RESTORE,db,hashsql)==expected: matched.append(db)
        if not matched: raise RuntimeError('No restore with original fingerprint found')
        db=matched[-1]
        print('Matching restore schemas: '+str(len(matched)))
        current=query('supabase-db','postgres',hashsql,'postgres')
        print('Production fingerprint unchanged since failed attempt: '+str(current==before))
        a=json.loads(query('supabase-db','postgres',SQL,'postgres'))
        b=json.loads(query(RESTORE,db,SQL))
        (LOG/'drift-production-private.json').write_text(json.dumps(a,indent=2))
        (LOG/'drift-restore-private.json').write_text(json.dumps(b,indent=2))
        differences(a,b)
        an=json.loads(query('supabase-db','postgres',SQL,'postgres',True))
        bn=json.loads(query(RESTORE,db,SQL,'supabase_admin',True))
        print('Equal with explicit empty search_path: '+str(an==bn))
        if an!=bn: differences(an,bn)
        print('PASS: read-only diagnosis finished; no migration or media copy')
    finally:
        if started: subprocess.run(['docker','stop','--time','20',RESTORE],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=40)

if __name__=='__main__': main()
