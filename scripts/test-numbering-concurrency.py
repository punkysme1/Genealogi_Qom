#!/usr/bin/env python3
"""Two real sessions on a clone of the completed rehearsal. Never connects to production."""
import json
import os
from pathlib import Path
import subprocess
import time
import uuid

CONTAINER = 'qom-roadmap-restore-v2-QdyWUR'
SOURCE = 'qom_numbering_081cabd27d48'
CURATOR = '02ab502f-318f-458e-8c05-f80d09f95d6e'
DB = 'qom_numbering_race_' + uuid.uuid4().hex[:12]

def main():
    if os.geteuid() != 0:
        raise SystemExit('Run with sudo')
    os.umask(0o077)
    out = Path('/opt/naracode/backups/qomaruddin-roadmap') / ('numbering-concurrency-' + uuid.uuid4().hex[:12])
    out.mkdir(mode=0o700)
    started = False
    processes = []
    logs = []

    def args(database=DB):
        return ['docker','exec','-i','--user','postgres',CONTAINER,'psql','-X','-w','-h','/tmp/roadmap-socket','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1','-Atq']

    def run(command, label, data=None):
        p = subprocess.run(command,input=data,text=True,capture_output=True,timeout=60)
        (out/(label+'.log')).write_text(p.stdout+p.stderr)
        if p.returncode:
            raise RuntimeError(label+' failed; inspect private log')
        return p.stdout.strip()

    def query(sql, label, database=DB):
        return run(args(database),label,sql)

    def wait_for(sql, label):
        deadline = time.monotonic()+12
        while time.monotonic()<deadline:
            if query(sql,label) == 't':
                return
            time.sleep(0.2)
        raise RuntimeError(label+' not observed')

    signature = """SELECT md5(jsonb_build_object(
      'people',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.individuals i),
      'state',(SELECT to_jsonb(s) FROM nasab_numbering.state s),
      'orders',(SELECT jsonb_agg(to_jsonb(o) ORDER BY parent_id,child_id) FROM nasab_numbering.child_order o),
      'history',(SELECT jsonb_agg(to_jsonb(h) ORDER BY revision) FROM nasab_numbering.history h))::text);"""

    try:
        raw = run(['docker','inspect','--format','{{json .}}',CONTAINER],'container-inspect')
        info = json.loads(raw)
        if info['State']['Running'] or info['HostConfig']['NetworkMode']!='none' or info['HostConfig'].get('PortBindings'):
            raise RuntimeError('Expected stopped container, network none, no published ports')
        if any(m['Type']=='bind' for m in info['Mounts']) or not any(m.get('Name')==CONTAINER+'-data' and m['Destination']=='/var/lib/postgresql/data' for m in info['Mounts']):
            raise RuntimeError('Unexpected restore mounts')
        run(['docker','start',CONTAINER],'start'); started=True
        run(['docker','exec','--user','postgres',CONTAINER,'sh','-eu','-c',
             'bindir=$(pg_config --bindir); "$bindir/pg_ctl" -D /var/lib/postgresql/data/roadmap-test '
             '-l /var/lib/postgresql/data/roadmap-test/server.log '
             '-o "-k /tmp/roadmap-socket -c listen_addresses= -c shared_preload_libraries=pg_net,pg_stat_statements" -w start'],'postgres-start')
        before = query(signature,'source-before',SOURCE)
        query(f'CREATE DATABASE {DB} TEMPLATE {SOURCE} OWNER postgres;','clone','template1')
        # Constants are generated UUIDs, never user-provided SQL text.
        parent,a,b = [str(uuid.uuid4()) for _ in range(3)]
        query(f"""BEGIN;
        INSERT INTO public.individuals(id,name) VALUES('{parent}','TEST ONLY race parent');
        INSERT INTO public.individuals(id,name,father_id) VALUES('{a}','TEST ONLY A','{parent}'),('{b}','TEST ONLY B','{parent}');
        COMMIT;""",'fixture')

        for case, rollback in [('insert',False),('move',False),('rollback',True)]:
            if case == 'move':
                seed_version = int(query('SELECT revision FROM nasab_numbering.state;','seed-version'))
                query(f"BEGIN; SELECT set_config('request.jwt.claim.sub','{CURATOR}',true); SET LOCAL ROLE authenticated; SELECT public.qom_nasab_set_child_order('{parent}','{b}',2,'Fixture','seed sibling',{seed_version}); COMMIT;", 'seed-second-child')
            version = int(query('SELECT revision FROM nasab_numbering.state;','version-'+case))
            count = int(query('SELECT count(*) FROM nasab_numbering.history;','history-before-'+case))
            tag = uuid.uuid4().hex[:12]
            leader_name, follower_name = 'num_leader_'+tag, 'num_follower_'+tag
            prefix = f"""BEGIN; SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='20s';
            SELECT set_config('request.jwt.claim.sub','{CURATOR}',true);
            SELECT set_config('request.jwt.claims','{{"sub":"{CURATOR}","role":"authenticated"}}',true);
            SET LOCAL ROLE authenticated;"""
            leader_position = 2 if case == 'move' else 1
            leader_sql = f"SELECT public.qom_nasab_set_child_order('{parent}','{a}',{leader_position},'Fixture','{case} leader',{version});"
            follower_sql = f"SELECT public.qom_nasab_set_child_order('{parent}','{b}',1,'Fixture','{case} follower',{version});"
            lf = (out/(case+'-leader.log')).open('w'); logs.append(lf)
            ff = (out/(case+'-follower.log')).open('w'); logs.append(ff)
            leader = subprocess.Popen(args(),stdin=subprocess.PIPE,stdout=lf,stderr=lf,text=True); processes.append(leader)
            leader.stdin.write(f"SET application_name='{leader_name}';"+prefix+leader_sql+'\n'); leader.stdin.flush()
            wait_for(f"SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname='{DB}' AND application_name='{leader_name}' AND state='idle in transaction');",case+'-leader-ready')
            follower = subprocess.Popen(args(),stdin=subprocess.PIPE,stdout=ff,stderr=ff,text=True); processes.append(follower)
            follower.stdin.write(f"SET application_name='{follower_name}';"+prefix+follower_sql+'COMMIT;\n'); follower.stdin.close()
            wait_for(f"SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname='{DB}' AND application_name='{follower_name}' AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0);",case+'-lock-observed')
            print('PASS: '+case+' — second session actually blocked on lock',flush=True)
            leader.stdin.write('ROLLBACK;\n' if rollback else 'COMMIT;\n'); leader.stdin.close()
            if leader.wait(timeout=35)!=0:
                raise RuntimeError(case+' leader failed')
            follower_result = follower.wait(timeout=35)
            lf.flush(); ff.flush()
            if rollback:
                if follower_result!=0:
                    raise RuntimeError('Follower did not proceed after rollback')
            elif follower_result==0 or 'STALE_REVISION' not in (out/(case+'-follower.log')).read_text():
                raise RuntimeError(case+' stale writer was not rejected')
            after_version = int(query('SELECT revision FROM nasab_numbering.state;','version-after-'+case))
            after_count = int(query('SELECT count(*) FROM nasab_numbering.history;','history-after-'+case))
            if after_version!=version+1 or after_count!=count+1:
                raise RuntimeError(case+' recorded more or fewer than one change')
            winner = b if rollback else a
            if query(f"SELECT child_id FROM nasab_numbering.child_order WHERE parent_id='{parent}' AND position={1 if rollback else leader_position};",'winner-'+case)!=winner:
                raise RuntimeError(case+' wrong winning order')
            if query(f"SELECT actor='{CURATOR}'::uuid FROM nasab_numbering.history WHERE revision={after_version};",'actor-'+case)!='t':
                raise RuntimeError(case+' actor mismatch')
            print('PASS: '+case+' — one committed change, correct order/version/actor',flush=True)
        if query(signature,'source-after',SOURCE)!=before:
            raise RuntimeError('Original rehearsal database changed')
        print('PASS: original rehearsal unchanged; production never connected; no photos copied')
        print('Test clone: '+DB)
    except Exception as exc:
        print('STOP: '+str(exc))
        raise SystemExit(1)
    finally:
        for p in processes:
            if p.poll() is None:
                p.kill(); p.wait(timeout=10)
        for log in logs:
            log.close()
        if started:
            subprocess.run(['docker','stop','--time','20',CONTAINER],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=40)
        print('Private log: '+str(out))

if __name__=='__main__':
    main()
