import test from 'node:test';import assert from 'node:assert/strict';
const person={kind:'human',workspace_role:null,scopes:['tickets:read'],grants:[{account_id:'a',role:'requester'}]};
const agent={...person,grants:[{account_id:'a',role:'agent'}]};
const load=async()=>{const m=await import('../web/ticket-views.js').catch(()=>null);assert.ok(m,'Consultas rápidas ainda ausentes');return m;};
test('consultas comuns reutilizam situações públicas e não oferecem responsabilidade a solicitante',async()=>{
 const m=await load();assert.deepEqual(m.availableTicketViews(person).map(v=>v.id),['all','waiting','resolved']);
 assert.deepEqual(m.applyTicketView({q:' Relatório ',priority:'high',assignment:'mine',status:'closed'},'waiting',person),{q:'Relatório',priority:'high',status:'waiting_for_you'});
 assert.throws(()=>m.applyTicketView({},'mine',person));assert.throws(()=>m.applyTicketView({},'unassigned',person));
});
test('consultas da equipe usam os filtros nativos e mantêm busca e prioridade',async()=>{
 const m=await load();assert.deepEqual(m.availableTicketViews(agent).map(v=>v.id),['all','waiting','resolved','mine','unassigned']);
 assert.deepEqual(m.applyTicketView({q:'CG-10001',priority:'urgent',status:'resolved'},'mine',agent),{q:'CG-10001',priority:'urgent',assignment:'mine'});
 assert.deepEqual(m.applyTicketView({status:'resolved',assignment:'mine',priority:'low'},'all',agent),{priority:'low'});
 assert.deepEqual(m.applyTicketView({},'unassigned',agent),{assignment:'unassigned'});
});
test('estado ativo descreve a consulta aplicada; combinação manual fica personalizada',async()=>{
 const m=await load();assert.equal(m.activeTicketView({q:'Teste',priority:'high'},agent),'all');
 assert.equal(m.activeTicketView({status:'waiting_for_you'},agent),'waiting');assert.equal(m.activeTicketView({assignment:'mine'},agent),'mine');
 assert.equal(m.activeTicketView({status:'resolved',assignment:'mine'},agent),null);assert.equal(m.activeTicketView({status:'in_progress'},agent),null);
});
test('ausência de leitura, identidade desconhecida ou integração não libera consultas da equipe',async()=>{
 const m=await load();for(const p of [null,{...agent,scopes:[]},{...agent,kind:'unknown'}]){assert.deepEqual(m.availableTicketViews(p),[]);assert.throws(()=>m.applyTicketView({},'all',p));}
 assert.deepEqual(m.availableTicketViews({...agent,kind:'integration',workspace_role:'admin'}).map(v=>v.id),['all','waiting','resolved']);
 assert.deepEqual(m.availableTicketViews({...person,workspace_role:'admin'}).map(v=>v.id),['all','waiting','resolved','mine','unassigned']);
});
test('filtros inválidos e IDs arbitrários são recusados; objetos retornados não alteram presets',async()=>{
 const m=await load();for(const f of [{q:'x'},{priority:'super'},{token:'private'}])assert.throws(()=>m.applyTicketView(f,'all',agent));
 assert.throws(()=>m.applyTicketView({},'__proto__',agent));const options=m.availableTicketViews(agent);options[0]!.label='changed';assert.notEqual(m.availableTicketViews(agent)[0]?.label,'changed');
});
