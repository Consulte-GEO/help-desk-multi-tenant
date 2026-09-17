import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('every literal DOM target used by app.js exists once in the shipped HTML',()=>{
 const ids=[...source('web/index.html').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size,'Duplicate HTML ids');
 const used=[...source('web/app.js').matchAll(/\$\('([a-z0-9_-]+)'\)/g)].map(m=>m[1]);
 assert.deepEqual([...new Set(used)].filter(id=>!ids.includes(id)),[],'Missing static DOM targets');
});
test('relative JS imports of app.js are included in both demo and static build',()=>{
 const names=[...source('web/app.js').matchAll(/from '\.\/([^']+\.js)'/g)].map(m=>m[1]!);
 for(const name of names){assert.ok(source('scripts/build.mjs').includes("'"+name+"'"),`build missing ${name}`);assert.ok(source('scripts/demo.ts').includes("'/"+name+"'"),`demo missing ${name}`);}
});

test('OpenAPI separates current detail actions from mutation and list snapshots',()=>{
 const spec=JSON.parse(source('docs/openapi.json'));const response=(p:string,m:string,code='200')=>spec.paths[p][m].responses[code].content['application/json'].schema.$ref;
 assert.equal(response('/tickets/{ticket_id}','get'),'#/components/schemas/TicketDetail');
 assert.equal(response('/tickets/{ticket_id}','patch'),'#/components/schemas/Ticket');
 assert.equal(response('/tickets','post','201'),'#/components/schemas/Ticket');
 assert.ok(!('available_actions' in spec.components.schemas.Ticket.properties));
 assert.equal(spec.components.schemas.TicketDetail.properties.available_actions.$ref,'#/components/schemas/TicketActions');
 assert.equal(spec.components.schemas.TicketActions.additionalProperties,false);
});
