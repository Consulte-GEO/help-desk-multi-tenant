import test from 'node:test';import assert from 'node:assert/strict';
const path='../web/portal-ui.js';
const ui=await import(path).catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
test('UX04 count is unavailable, not zero, for invalid input',()=>{assert.equal(typeof ui.countText,'function');for(const v of [null,undefined,-1,1.5,NaN,Infinity,'4',{},Number.MAX_SAFE_INTEGER+1])assert.equal(ui.countText(v),'Indisponível');});
test('UX04 count preserves zero and locale grouping',()=>{assert.equal(typeof ui.countText,'function');assert.equal(ui.countText(0),'0');assert.equal(ui.countText(1234),'1.234');});
test('UX04 metric requires explicit availability and an admissible value',()=>{assert.equal(typeof ui.metricText,'function');for(const v of [null,{value:0},{availability:'unavailable',value:42},{availability:'error',value:3},{availability:'available',value:null},{availability:'available',value:{}},{availability:'available',value:-1},{availability:'available',value:Infinity}])assert.equal(ui.metricText(v),'Indisponível');});
test('UX04 available zero and decimals remain numeric without invented units',()=>{assert.equal(typeof ui.metricText,'function');assert.equal(ui.metricText({availability:'available',value:0}),'0');assert.equal(ui.metricText({availability:'available',value:2.5}),'2,5');});
test('UX04 status never falls through object prototypes',()=>{assert.equal(typeof ui.statusView,'function');for(const key of ['__proto__','constructor','toString',null])assert.deepEqual(ui.statusView(key),{label:'Situação indisponível',tone:'neutral'});assert.equal(ui.statusView('resolved').label,'Resolvido');});
test('UX04 priority is an allowlisted label, not arbitrary server text',()=>{assert.equal(typeof ui.priorityText,'function');assert.equal(ui.priorityText('high'),'Alta');assert.equal(ui.priorityText('toString'),'Prioridade indisponível');});

test('UX04 signed zero has the same visible meaning as zero',()=>{assert.equal(ui.countText(-0),'0');assert.equal(ui.metricText({availability:'available',value:-0}),'0');});
