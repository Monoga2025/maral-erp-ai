#!/usr/bin/env python3
"""Read-only planner and guarded additive MARAL master-data recovery."""
from __future__ import annotations
import argparse, csv, hashlib, io, json, re, subprocess, sys
from dataclasses import dataclass
from typing import Any

SOURCE_SERVICE = "maral_os_maral_os_postgres"
TARGET_CONTAINER = "maral-current-db-20261025"
SOURCE_DB = TARGET_DB = "maral_os"
CANDIDATE_DB = "maral_recovery_20261026"
TABLE_COLUMNS = {
    "Client": ("id","name","company","rut","city","department","phone","whatsapp","email","address","category","howFound","allowWhiteLabel","creditLimit","paymentDays","factoringStatus","notes","previousNames","active","isProvider","purchaseFrequency","merlinCode","ownerName","purchaseContactName","secretaryName","otherContactName","purchaseVolumeScore","companySizeScore","friendlinessLevel","competitors","callNotes","productLines","tags","segment","interestTags","lifetimeValue","lastOrderAt","optedOut","optedOutAt","optedOutReason","bestContactWindow","createdAt","updatedAt"),
    "Product": ("id","reference","name","line","category","priceList","priceDistributor","cost","warrantyYears","stock","minStock","unit","location","specs","applications","active","isKit","createdAt","updatedAt"),
    "Tag": ("id","name","color","description","createdAt"), "ClientTag": ("clientId","tagId"),
}
ALLOWED_TABLES = tuple(TABLE_COLUMNS)

@dataclass
class Plan:
    client_id_map: dict[str,str]
    product_id_map: dict[str,str]
    tag_id_map: dict[str,str]
    clients_to_insert: list[dict[str,Any]]
    products_to_insert: list[dict[str,Any]]
    tags_to_insert: list[dict[str,Any]]
    client_tags_to_insert: list[dict[str,Any]]
    source_coverage: dict[str,int]
    source_link_pairs: list[dict[str,str]]
    @property
    def additions(self):
        return {"Client":len(self.clients_to_insert),"Product":len(self.products_to_insert),"Tag":len(self.tags_to_insert),"ClientTag":len(self.client_tags_to_insert)}
    def payload(self):
        return {"Client":self.clients_to_insert,"Product":self.products_to_insert,"Tag":self.tags_to_insert,"ClientTag":self.client_tags_to_insert,
                "_sourceCoverage":{"clients":[{"sourceId":k,"targetId":v} for k,v in self.client_id_map.items()],
                                  "products":[{"sourceId":k,"targetId":v} for k,v in self.product_id_map.items()],
                                  "tags":[{"sourceId":k,"targetId":v} for k,v in self.tag_id_map.items()],
                                  "links":self.source_link_pairs}}

def _key(row, field):
    v=row.get(field) if field else None
    return v.strip() if isinstance(v,str) and v.strip() else None

def _index(rows, field):
    d={}
    if field:
        for row in rows:
            k=_key(row,field)
            if k is not None: d.setdefault(k,[]).append(row)
    return d

def _resolve_identity(source,target,primary,secondary=None):
    ids={r["id"]:r for r in target}
    if len(ids)!=len(target): raise ValueError("duplicate target ID")
    tp,ts=_index(target,primary),_index(target,secondary)
    sp,ss=_index(source,primary),_index(source,secondary)
    mapping,adds={},[]; seen=set()
    for row in source:
        sid=row["id"]
        if sid in seen: raise ValueError("duplicate source ID")
        seen.add(sid); byid=ids.get(sid); pk,sk=_key(row,primary),_key(row,secondary)
        p=tp.get(pk,[]) if pk else []; s=ts.get(sk,[]) if sk else []
        pm=p[0] if len(p)==1 and len(sp.get(pk,[]))==1 else None
        sm=s[0] if len(s)==1 and len(ss.get(sk,[]))==1 else None
        matches={r["id"] for r in (byid,pm,sm) if r}
        if len(matches)>1: raise ValueError("identity keys resolve to different target records")
        if byid and (_key(byid,primary)!=pk or (secondary and _key(byid,secondary)!=sk)):
            raise ValueError("source/target ID collision with inconsistent keys")
        if pm and secondary and sk and _key(pm,secondary) not in (None,sk): raise ValueError("primary match conflicts with secondary key")
        if sm and pk and _key(sm,primary) not in (None,pk): raise ValueError("secondary match conflicts with primary key")
        mapping[sid]=matches.pop() if matches else sid
        if not matches and not byid and not pm and not sm: adds.append(row)
        elif not byid and not pm and not sm: adds.append(row)
    return mapping,adds

def build_plan(sc,tc,sp,tp,stags,ttags,slinks,tlinks=None):
    needed={x["tagId"] for x in slinks}; tags=[x for x in stags if x["id"] in needed]
    cm,ca=_resolve_identity(sc,tc,"rut","merlinCode")
    pm,pa=_resolve_identity(sp,tp,"reference")
    tm,ta=_resolve_identity(tags,ttags,"name")
    existing={(x["clientId"],x["tagId"]) for x in (tlinks or [])}; links=[]
    for link in slinks:
        if link["clientId"] not in cm or link["tagId"] not in tm: raise ValueError("unmapped source link")
        pair=(cm[link["clientId"]],tm[link["tagId"]])
        if pair not in existing: existing.add(pair); links.append({"clientId":pair[0],"tagId":pair[1]})
    link_pairs=[{"targetClientId":cm[x["clientId"]],"targetTagId":tm[x["tagId"]]} for x in slinks]
    return Plan(cm,pm,tm,ca,pa,ta,links,{"Client":len(sc),"Product":len(sp),"Tag":len(tags),"ClientTag":len(slinks)},link_pairs)

def quote_identifier(value):
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*",value): raise ValueError("unsafe SQL identifier")
    return '"'+value+'"'

def _readonly_prefix(): return "SET TRANSACTION READ ONLY; "

def _capture_sql(tables, all_table_names=None):
    def union(names):
        return " UNION ALL ".join(f"SELECT '{n}'::text tablename,COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb) rows FROM public.{quote_identifier(n)} r" for n in names)
    table_lits=",".join("'"+x.replace("'","''")+"'" for x in tables)
    fq_lits=",".join("to_regclass('public.\""+x+"\"')" for x in tables)
    full=f"(SELECT COALESCE(jsonb_object_agg(tablename,rows ORDER BY tablename),'{{}}'::jsonb) FROM ({union(all_table_names)}) full_rows)" if all_table_names else "'{}'::jsonb"
    return f"""WITH master_rows AS ({union(tables)}), schema_rows AS (
 SELECT c.table_name,jsonb_agg(jsonb_build_object('name',c.column_name,'type',format_type(a.atttypid,a.atttypmod),'nullable',c.is_nullable='YES','default',c.column_default,'enumLabels',en.labels) ORDER BY c.column_name) cols
 FROM information_schema.columns c JOIN pg_attribute a ON a.attrelid=(quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass AND a.attname=c.column_name
 LEFT JOIN LATERAL (SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) labels FROM pg_enum e WHERE e.enumtypid=a.atttypid) en ON true
 WHERE c.table_schema='public' AND c.table_name IN ({table_lits}) GROUP BY c.table_name
), fk_rows AS (SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'definition',pg_get_constraintdef(oid),'validated',convalidated) ORDER BY conrelid::regclass::text,conname) v FROM pg_constraint WHERE contype='f' AND conrelid IN ({fq_lits})),
deps AS (SELECT (SELECT count(*) FROM public.\"ProductComponent\") AS productcomponents,(SELECT count(*) FROM public.\"Category\") AS categories,(SELECT count(*) FROM public.\"Segment\") AS segments),
master_doc AS (SELECT COALESCE(jsonb_object_agg(tablename,rows ORDER BY tablename),'{{}}'::jsonb) v FROM master_rows),
doc AS (SELECT jsonb_build_object('rows',master_doc.v,'schema',(SELECT jsonb_object_agg(table_name,cols) FROM schema_rows),'foreignKeys',(SELECT v FROM fk_rows),'dependencies',(SELECT to_jsonb(deps) FROM deps),'fullTarget',{full}) v FROM master_doc)
SELECT v || jsonb_build_object('digest',md5(v::text),'baselineDigest',md5((v->'fullTarget')::text)) FROM doc"""

def _table_names_sql(): return "SELECT COALESCE(json_agg(tablename ORDER BY tablename),'[]'::json) FROM pg_tables WHERE schemaname='public'"

def synthetic_schema():
    return {t:[{"name":c,"type":"text","nullable":True,"default":None,"enumLabels":None} for c in cs] for t,cs in TABLE_COLUMNS.items()}

def validate_schema(source,target,source_fks=None,target_fks=None,dependencies=None):
    for table,supported in TABLE_COLUMNS.items():
        if table not in source or table not in target: raise ValueError("required master table missing")
        sm={c["name"]:c for c in source[table]}; tm={c["name"]:c for c in target[table]}
        if set(sm)!=set(supported) or set(tm)!=set(supported): raise ValueError(f"unsupported columns in {table}")
        def norm(d): return sorted((n,x["type"],x["nullable"],x.get("default"),tuple(x.get("enumLabels") or ())) for n,x in d.items())
        if norm(sm)!=norm(tm): raise ValueError(f"schema drift for {table}")
    if source_fks is not None and target_fks is not None:
        norm_fk=lambda rows: sorted((x.get("table"),x.get("definition"),x.get("validated")) for x in rows)
        if norm_fk(source_fks)!=norm_fk(target_fks): raise ValueError("foreign-key drift")
    if source_fks is not None:
        definitions=" ".join(str(item.get("definition", "")) for item in source_fks)
        if 'FOREIGN KEY ("clientId") REFERENCES "Client"' not in definitions or 'FOREIGN KEY ("tagId") REFERENCES "Tag"' not in definitions:
            raise ValueError("required ClientTag foreign keys missing")
        if any(item.get("validated") is not True for item in source_fks): raise ValueError("unvalidated master foreign key")
    if dependencies:
        for side in ("source","target"):
            if dependencies[side].get("productcomponents") != 0 or dependencies[side].get("categories") != 0:
                raise ValueError("unexpected ProductComponent or Category dependency rows")

def encode_payload_csv(payload):
    s=io.StringIO(newline=""); csv.writer(s,lineterminator="\n").writerow([json.dumps(payload,ensure_ascii=False,separators=(",",":"))]); return s.getvalue()

def _snapshot_select(names):
    return "SELECT COALESCE(jsonb_object_agg(tablename,rows ORDER BY tablename),'{}'::jsonb) FROM ("+" UNION ALL ".join(f"SELECT '{n}'::text tablename,COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb) rows FROM public.{quote_identifier(n)} r" for n in names)+") s"

def render_atomic_sql(payload,columns,target_digest,source_digest,additions,source_coverage=None,all_table_names=None):
    for t in ALLOWED_TABLES:
        if tuple(columns.get(t,()))!=TABLE_COLUMNS[t] or len(payload.get(t,[]))!=additions[t]: raise ValueError("payload/schema mismatch")
    if not re.fullmatch(r"[a-f0-9]{32}",target_digest): raise ValueError("invalid target digest")
    names=sorted(all_table_names or list(ALLOWED_TABLES))
    table_literals=",".join("'"+name.replace("'","''")+"'" for name in names)
    lock_sql="LOCK TABLE "+", ".join("public."+quote_identifier(name) for name in names)+" IN SHARE ROW EXCLUSIVE MODE;"
    sql=["\\set ON_ERROR_STOP on","BEGIN;","SET LOCAL lock_timeout='10s';","SET LOCAL statement_timeout='5min';",lock_sql,
         f"DO $$ BEGIN IF (SELECT array_agg(tablename::text ORDER BY tablename) FROM pg_tables WHERE schemaname='public') IS DISTINCT FROM ARRAY[{table_literals}]::text[] THEN RAISE EXCEPTION 'table catalog drift'; END IF; END $$;",
         "CREATE TEMP TABLE recovery_before(doc jsonb NOT NULL) ON COMMIT DROP;","INSERT INTO recovery_before "+_snapshot_select(names)+";",
         f"DO $$ BEGIN IF md5((SELECT doc::text FROM recovery_before)) <> '{target_digest}' THEN RAISE EXCEPTION 'target baseline drift'; END IF; END $$;",
         "CREATE TEMP TABLE recovery_payload(doc jsonb NOT NULL) ON COMMIT DROP;","COPY recovery_payload(doc) FROM STDIN WITH (FORMAT csv);","\\."]
    for t in ALLOWED_TABLES:
        cols=','.join(quote_identifier(x) for x in columns[t]); sql.append(f"INSERT INTO public.{quote_identifier(t)} ({cols}) SELECT {cols} FROM jsonb_populate_recordset(NULL::public.{quote_identifier(t)},(SELECT doc->'{t}' FROM recovery_payload));")
    sql.extend(["SET CONSTRAINTS ALL IMMEDIATE;","CREATE TEMP TABLE recovery_after(doc jsonb NOT NULL) ON COMMIT DROP;","INSERT INTO recovery_after "+_snapshot_select(names)+";",
    """DO $$ DECLARE b jsonb;a jsonb;t text;oldrow jsonb; BEGIN SELECT doc INTO b FROM recovery_before;SELECT doc INTO a FROM recovery_after;
FOR t IN SELECT key FROM jsonb_each(b) LOOP
 IF t NOT IN ('Client','Product','Tag','ClientTag') AND a->t IS DISTINCT FROM b->t THEN RAISE EXCEPTION 'unallowed table changed'; END IF;
 IF t IN ('Client','Product','Tag','ClientTag') THEN FOR oldrow IN SELECT value FROM jsonb_array_elements(b->t) LOOP
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a->t) newer WHERE newer.value IS NOT DISTINCT FROM oldrow) THEN RAISE EXCEPTION 'prior row changed'; END IF; END LOOP; END IF;
END LOOP; END $$;"""])
    for t in ALLOWED_TABLES:
        sql.append(f"DO $$ BEGIN IF jsonb_array_length((SELECT doc->'{t}' FROM recovery_after))-jsonb_array_length((SELECT doc->'{t}' FROM recovery_before))<>{additions[t]} THEN RAISE EXCEPTION 'addition count mismatch';END IF;END $$;")
        sql.append(f"DO $$ BEGIN IF EXISTS(SELECT 1 FROM jsonb_array_elements((SELECT doc->'{t}' FROM recovery_payload)) w WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements((SELECT doc->'{t}' FROM recovery_after)) a WHERE a.value=w.value)) THEN RAISE EXCEPTION 'planned row missing';END IF;END $$;")
    if source_coverage:
        for kind, table in (("clients","Client"),("products","Product"),("tags","Tag")):
            expected=source_coverage.get(table,0)
            sql.append(f"DO $$ BEGIN IF jsonb_array_length((SELECT doc->'_sourceCoverage'->'{kind}' FROM recovery_payload))<>{expected} THEN RAISE EXCEPTION 'source coverage count';END IF; IF EXISTS(SELECT 1 FROM jsonb_array_elements((SELECT doc->'_sourceCoverage'->'{kind}' FROM recovery_payload)) x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements((SELECT doc->'{table}' FROM recovery_after)) y WHERE y.value->>'id'=x.value->>'targetId')) THEN RAISE EXCEPTION 'source identity not represented';END IF;END $$;")
    if source_coverage:
        expected=source_coverage.get("ClientTag",0)
        sql.append(f"DO $$ BEGIN IF jsonb_array_length((SELECT doc->'_sourceCoverage'->'links' FROM recovery_payload))<>{expected} THEN RAISE EXCEPTION 'source link coverage count';END IF; IF EXISTS(SELECT 1 FROM jsonb_array_elements((SELECT doc->'_sourceCoverage'->'links' FROM recovery_payload)) x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements((SELECT doc->'ClientTag' FROM recovery_after)) y WHERE y.value->>'clientId'=x.value->>'targetClientId' AND y.value->>'tagId'=x.value->>'targetTagId')) THEN RAISE EXCEPTION 'source link absent';END IF;END $$;")
    sql.extend(["COMMIT;","SELECT 'RECOVERY_COMMITTED';"])
    return "\n".join(sql)+"\n"

def classify_apply_result(returncode,stdout):
    if returncode==0 and "RECOVERY_COMMITTED" in stdout: return "committed"
    return "uncertain"
def classify_postcommit_verification(ok): return "committed" if ok else "committed_verification_uncertain"

def _run(argv,stdin=None):
    try: p=subprocess.run(argv,input=stdin,text=True,capture_output=True,check=False)
    except OSError as e: raise RuntimeError("Docker/psql unavailable") from e
    if p.returncode: raise RuntimeError("database command failed; output suppressed")
    return p.stdout

def _docker_shell(readonly):
    opts="-c default_transaction_read_only=on" if readonly else ""
    return f"export PGOPTIONS='{opts}'; exec psql -X -qAt -v ON_ERROR_STOP=1 -U \"$POSTGRES_USER\" -d \"$1\""

def _docker_psql(container,database,sql,readonly):
    if not re.fullmatch(r"[a-z][a-z0-9_]{2,62}",database): raise ValueError("invalid database")
    shell=_docker_shell(readonly)
    try: p=subprocess.run(["docker","exec","-i",container,"sh","-c",shell,"runner",database],input=sql,text=True,capture_output=True,check=False)
    except OSError as e: raise RuntimeError("Docker/psql unavailable") from e
    if p.returncode and not readonly: return p.stdout,p.returncode
    if p.returncode: raise RuntimeError("readonly database query failed; output suppressed")
    return p.stdout,0

def _resolve_source_container():
    out=_run(["docker","ps","--filter",f"label=com.docker.swarm.service.name={SOURCE_SERVICE}","--format","{{.ID}}"])
    ids=[x.strip() for x in out.splitlines() if x.strip()]
    if len(ids)!=1: raise RuntimeError("expected one source task")
    return ids[0]

def _capture(container,database,tables,readonly,all_table_names=None):
    sql="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;"+_capture_sql(tables,all_table_names)+";COMMIT;"
    out,_=_docker_psql(container,database,sql,readonly)
    return json.loads(out.strip().splitlines()[-1])

def build_apply_stream(plan,target_digest,source_digest,all_table_names):
    sql=render_atomic_sql(plan.payload(),TABLE_COLUMNS,target_digest,source_digest,plan.additions,plan.source_coverage,all_table_names)
    marker="COPY recovery_payload(doc) FROM STDIN WITH (FORMAT csv);\n\\.\n"
    if marker not in sql: raise RuntimeError("internal COPY stream marker missing")
    return sql.replace(marker,"COPY recovery_payload(doc) FROM STDIN WITH (FORMAT csv);\n"+encode_payload_csv(plan.payload())+"\\.\n",1)

def _apply(container,database,plan,target_digest,source_digest,all_table_names):
    stream=build_apply_stream(plan,target_digest,source_digest,all_table_names)
    return _docker_psql(container,database,stream,False)

def _list_tables(container,database):
    out,_=_docker_psql(container,database,_table_names_sql(),True); return json.loads(out.strip())

def _capture_schema_fks(capture): return capture["schema"],capture.get("foreignKeys")

def validate_apply_mode(candidate,execute,live,expected_source,expected_target):
    if not execute or candidate==live: raise ValueError("explicit candidate/live apply and --execute required")
    if live and (not expected_source or not expected_target): raise ValueError("live requires fresh source and target receipts")

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__); modes=parser.add_mutually_exclusive_group()
    modes.add_argument("--candidate-apply",action="store_true"); modes.add_argument("--live-allow",action="store_true")
    parser.add_argument("--candidate-db",default=CANDIDATE_DB); parser.add_argument("--execute",action="store_true")
    parser.add_argument("--expected-source-fingerprint"); parser.add_argument("--expected-target-fingerprint"); args=parser.parse_args(argv)
    if args.candidate_apply and not re.fullmatch(r"maral_recovery_[a-z0-9_]{1,40}",args.candidate_db): raise ValueError("unsafe candidate name")
    if args.execute: validate_apply_mode(args.candidate_apply,True,args.live_allow,args.expected_source_fingerprint,args.expected_target_fingerprint)
    src_container=_resolve_source_container(); db=args.candidate_db if args.candidate_apply else TARGET_DB
    tables=list(ALLOWED_TABLES); target_names=_list_tables(TARGET_CONTAINER,db)
    source=_capture(src_container,SOURCE_DB,tables,True)
    target=_capture(TARGET_CONTAINER,db,tables,True,target_names)
    deps={"source":source["dependencies"],"target":target["dependencies"]}
    validate_schema(source["schema"],target["schema"],source.get("foreignKeys"),target.get("foreignKeys"),deps)
    sr,tr=source["rows"],target["rows"]
    plan=build_plan(sr["Client"],tr["Client"],sr["Product"],tr["Product"],sr["Tag"],tr["Tag"],sr["ClientTag"],tr["ClientTag"])
    sd,td=source["digest"],target["digest"]
    if args.expected_source_fingerprint and args.expected_source_fingerprint!=sd: raise ValueError("source receipt mismatch")
    if args.expected_target_fingerprint and args.expected_target_fingerprint!=td: raise ValueError("target receipt mismatch")
    print(json.dumps({"sourceCounts":{k:len(v) for k,v in sr.items()},"targetCounts":{k:len(v) for k,v in tr.items()},"sourceFingerprint":sd,"targetFingerprint":td,"plannedAdditions":plan.additions},sort_keys=True))
    if args.execute:
        out,rc=_apply(TARGET_CONTAINER,db,plan,target["baselineDigest"],sd,target_names); state=classify_apply_result(rc,out)
        if state!="committed":
            print(json.dumps({"apply":"uncertain","action":"read-only reconciliation only; do not replay"}),file=sys.stderr); return 3
        try: source_after=_capture(src_container,SOURCE_DB,tables,True); intact=source_after["digest"]==sd
        except Exception: intact=False
        final=classify_postcommit_verification(intact)
        print(json.dumps({"apply":final,"sourceUnchanged":intact,"inserted":plan.additions},sort_keys=True))
        if not intact:return 4
    return 0
if __name__=="__main__":
    try: raise SystemExit(main())
    except Exception:
        print("recovery stopped; inspect protected evidence, never replay uncertain apply",file=sys.stderr); raise SystemExit(2)
