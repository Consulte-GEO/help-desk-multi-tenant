import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {assertLegacyTerminalUpdateAllowed} from '../src/infrastructure/legacy-transition-guard.ts';
import {assertSingleWrite} from '../src/infrastructure/write-result.ts';
import {runTransaction} from '../src/infrastructure/transaction.ts';
import type {SqlClient,SqlPool} from '../src/infrastructure/sql.ts';

/** Executes the EXACT method AST from postgres.ts, not a hand-copied method.
 * Dependency-isolated method test, not construction/readiness of the full UoW.
 * The guard, write acknowledgement and transaction runner below are real.
 */
async function adapter(){
 const text=await readFile(new URL('../src/infrastructure/postgres.ts',import.meta.url),'utf8');
 const source=ts.createSourceFile('postgres.ts',text,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
 const cls=source.statements.find(s=>ts.isClassDeclaration(s)&&s.name?.text==='PostgresStore');
 assert.ok(cls&&ts.isClassDeclaration(cls));
 const methods=cls.members.filter(m=>ts.isMethodDeclaration(m)&&m.name.getText(source)==='updateTicket');assert.equal(methods.length,1);
 const method=methods[0]!.getText(source);
 const code=ts.transpileModule('class MethodProbe {constructor(c,p){this.c=c;this.p=p;}'+method+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 return new Function('assertLegacyTerminalUpdateAllowed','assertSingleWrite',code+';return MethodProbe;')(assertLegacyTerminalUpdateAllowed,assertSingleWrite) as new(c:SqlClient,p:{id:string;workspaceId:string})=>{updateTicket(t:any,v:number):Promise<void>};
}
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p={id:id(1),workspaceId:id(2)};
const ticket=()=>({id:id(3),workspaceId:p.workspaceId,accountId:id(4),status:'resolved',version:8,updatedAt:'2026-10-12T12:00:00.000000Z'});
function connection(decision='structured_required'){
 const calls:{sql:string;values:unknown[]}[]=[];let hook=()=>{};let count=1;
 const c:SqlClient={query:async(sql,values=[])=>{calls.push({sql,values});if(sql.includes('to_regclass')){hook();return {command:'SELECT',rowCount:1,rows:[{bindings:true,guard:true}]};}if(sql.includes('hdn_legacy_terminal_update'))return {command:'SELECT',rowCount:1,rows:[{decision}]};return {command:'UPDATE',rowCount:count,rows:[]};},release:()=>{}};
 return {c,calls,hook:(f:()=>void)=>hook=f,count:(v:number)=>count=v};
}
for(const status of ['resolved','closed'])test('actual legacy adapter method rejects bound '+status+' before UPDATE',async()=>{
 const M=await adapter(),f=connection();await assert.rejects(new M(f.c,p).updateTicket({...ticket(),status},7),{code:'structured_workflow_required'});
 assert.equal(f.calls.some(c=>c.sql.startsWith('update')),false);
});
test('actual method preserves the same captured target after its await',async()=>{
 const M=await adapter(),f=connection('legacy_allowed'),t=ticket(),expected=structuredClone(t);
 f.hook(()=>{t.id=id(99);t.status='closed';t.version=900;t.workspaceId=id(100);t.updatedAt='2027-01-01T00:00:00.000Z';});
 await new M(f.c,p).updateTicket(t,7);
 assert.deepEqual(f.calls.at(-1)!.values,[expected.status,expected.version,expected.updatedAt,expected.workspaceId,expected.id,7]);
});
test('actual method keeps the historical one-row write acknowledgement',async()=>{
 const M=await adapter(),f=connection('legacy_allowed');f.count(0);
 await assert.rejects(new M(f.c,p).updateTicket(ticket(),7),{code:'version_conflict'});
});
test('actual nonterminal method remains a single UPDATE',async()=>{const M=await adapter(),f=connection();await new M(f.c,p).updateTicket({...ticket(),status:'open'},7);assert.equal(f.calls.length,1);assert.ok(f.calls[0]!.sql.startsWith('update'));});
test('a captured legacy refusal aborts the owned transaction without the prohibited UPDATE',async()=>{
 const M=await adapter(),f=connection();const controls:string[]=[];let released=0;
 const pool:SqlPool={connect:async()=>({query:async(sql,values)=>{controls.push(sql);if(['BEGIN','ROLLBACK','COMMIT'].includes(sql))return {command:sql,rowCount:null,rows:[]};if(sql.startsWith('select set_config'))return {command:'SELECT',rowCount:1,rows:[{}]};return f.c.query(sql,values);},release:()=>{released++;}}),query:async()=>assert.fail(),end:async()=>{}};
 // A successful SQL reply may still be rejected by the mandatory validator.
 // Capturing that refusal no longer permits COMMIT of earlier writes.
 await assert.rejects(runTransaction(pool,p,async c=>{await new M(c,p).updateTicket(ticket(),7).catch(e=>assert.equal(e.code,'structured_workflow_required'));}),{code:'transaction_validation_failed'});
 assert.equal(f.calls.some(x=>x.sql.startsWith('update')),false);assert.equal(controls.includes('COMMIT'),false);assert.equal(controls.at(-1),'ROLLBACK');assert.equal(released,1);
});
