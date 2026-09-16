import test from 'node:test';import assert from 'node:assert/strict';
import {eventDto} from '../src/http/serialization.ts';import {principal,ticket} from './fixtures.ts';import type {TicketEvent} from '../src/domain/model.ts';
const t=ticket(),operator=principal({grants:[{accountId:t.accountId,role:'agent'}]});
const event:TicketEvent={id:'event-a',workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,actorId:operator.id,type:'ticket.assignment_changed',customerVisible:false,createdAt:t.createdAt,data:{action:'claim',from:null,to:operator.id,reason:'Motivo interno',version:2}};
for(const [name,value] of Object.entries({empty:'',controls:'Reason\nprivate',surrogate:'\ud800',large:'a'.repeat(2001)}))test('assignment projection rejects malformed stored reason '+name,()=>{assert.throws(()=>eventDto(operator,{...event,data:{...event.data,reason:value}}));});
test('assignment projection must not coerce an object action into a permitted string',()=>{assert.throws(()=>eventDto(operator,{...event,data:{...event.data,action:{toString:()=> 'claim'}}}));});
test('assignment projection forbids a mislabeled public event even for an operator',()=>{assert.throws(()=>eventDto(operator,{...event,customerVisible:true}));});
test('assignment projection strips actor relationships and preserves supplementary Unicode',()=>{const result=eventDto(operator,{...event,data:{...event.data,reason:'Análise 🔎',debug:'private'}});assert.deepEqual(result.data,{action:'claim',reason:'Análise 🔎',version:2});});
