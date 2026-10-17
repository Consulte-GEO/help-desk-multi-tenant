import test from 'node:test';import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';import {createBorrowedPostgresUnitOfWork} from '../src/infrastructure/postgres.ts';import {runTransaction} from '../src/infrastructure/transaction.ts';
import {principal} from './fixtures.ts';import type {SqlPool} from '../src/infrastructure/sql.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const window={updated_from:'2026-10-17T03:00:00.000100Z',updated_before:'2026-10-17T03:00:00.000200Z'};
function fixture(local:boolean){const calls:{sql:string;args?:unknown[]}[]=[],p=principal({id:id(2),workspaceId:id(1),workspaceRole:'admin',grants:[]}),contexts=[{accountId:id(3),productInstanceId:id(4),connectionId:id(5),tenantId:'mrv'}];
 const pool:SqlPool={query:async()=>{throw Error('Unexpected separate connection');},end:async()=>{},connect:async()=>({release(){},async query(sql,args){calls.push({sql,args});if(sql.includes('cg_local_prepare_ticket_collection'))return {command:'SELECT',rowCount:1,rows:[{source:contexts}]};if(sql.includes('count(*)'))return {command:'SELECT',rowCount:1,rows:[{total:'0',received:'0',in_progress:'0',waiting_for_you:'0',resolved:'0',closed:'0'}]};return {command:['BEGIN','COMMIT','ROLLBACK'].includes(sql)?sql:'SELECT',rowCount:0,rows:[]};}})};
 return {calls,run:(summary:boolean,filters:Record<string,string>)=>runTransaction(pool,p,async c=>{const s=new HelpdeskService(createBorrowedPostgresUnitOfWork(c,p,{consulteGeoLocal:local,localCollection:local}));return summary?s.summarize(p,filters):s.list(p,{limit:1,...filters});})};
}
for(const local of [false,true])for(const summary of [false,true])for(const privateStatus of [false,true])test(`window SQL binds after optional namespace/private parameters local=${local} summary=${summary} private=${privateStatus}`,async()=>{
 const f=fixture(local),privateFilter:Record<string,string>=privateStatus?{internal_status:'new'}:{};await f.run(summary,{...privateFilter,...window});const q=f.calls.find(c=>c.sql.includes('from helpdesk_core.tickets'))!;assert.ok(q);
 const first=(summary?11:13)+(local?1:0)+(privateStatus?2:0);assert.equal(q.args?.[first-1],window.updated_from);assert.equal(q.args?.[first],window.updated_before);assert.equal(q.args?.length,first+1);
 assert.ok(q.sql.includes('and updated_at >= $'+first+'::timestamptz'));assert.ok(q.sql.includes('and updated_at < $'+(first+1)+'::timestamptz'));assert.doesNotMatch(q.sql,/2026-10-17|internal_notes|ticket_messages/);
 if(summary)assert.doesNotMatch(q.sql,/limit/i);else assert.ok(q.sql.indexOf('and updated_at >=')<q.sql.indexOf('limit $5'));
 if(local)assert.ok(q.sql.includes('cg_local_ticket_directory'));if(privateStatus)assert.ok(q.sql.includes('helpdesk_auth.is_operator'));
 const old=fixture(local);await old.run(summary,privateFilter);const oldQuery=old.calls.find(c=>c.sql.includes('from helpdesk_core.tickets'))!;assert.equal(oldQuery.args?.length,first-1);assert.doesNotMatch(oldQuery.sql,/and updated_at [<>]=? \$/);
 const solo=fixture(local);await solo.run(summary,{...privateFilter,updated_before:window.updated_before});const one=solo.calls.find(c=>c.sql.includes('from helpdesk_core.tickets'))!;assert.equal(one.args?.length,first);assert.equal(one.args?.[first-1],window.updated_before);assert.ok(one.sql.includes('and updated_at < $'+first+'::timestamptz'));assert.doesNotMatch(one.sql,/and updated_at >= \$/);
});
for(const local of [false,true])for(const summary of [false,true])test(`all four temporal bounds bind after namespace and private status local=${local} summary=${summary}`,async()=>{
 const f=fixture(local),filters={internal_status:'new',created_from:'2026-10-01T00:00:00.000Z',created_before:'2026-10-02T00:00:00.000Z',...window};await f.run(summary,filters);const q=f.calls.find(c=>c.sql.includes('from helpdesk_core.tickets'))!,first=(summary?11:13)+(local?1:0)+2;
 assert.deepEqual(q.args?.slice(first-1),[filters.created_from,filters.created_before,window.updated_from,window.updated_before]);
 for(const [n,column,operator]of [[0,'created_at','>='],[1,'created_at','<'],[2,'updated_at','>='],[3,'updated_at','<']] as const)assert.ok(q.sql.includes(`and ${column} ${operator} $${first+n}::timestamptz`));
});
