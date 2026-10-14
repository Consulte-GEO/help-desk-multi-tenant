import test from 'node:test';import assert from 'node:assert/strict';
import {issueControlPath,fieldGuidance} from '../web/form-feedback.js';
test('maps bounded parser row paths to renderer paths',()=>{assert.equal(issueControlPath('people[2].name'),'people.2.name');assert.equal(issueControlPath('simple'),'simple');assert.equal(issueControlPath(null),'');});
test('text guidance exposes minimum and maximum',()=>{assert.match(fieldGuidance({type:'text',config:{minLength:3,maxLength:80}}),/3.*80/);});
test('decimal guidance follows actual parser punctuation, not a locale promise',()=>{assert.match(fieldGuidance({type:'decimal',config:{min:'0',max:'40',scale:2}}),/ponto.*2 casas/);});
test('file guidance does not claim scanner clearance or authorization',()=>{assert.match(fieldGuidance({type:'file',config:{maxItems:2}}),/não confirma análise nem autorização/);});
test('false is an explicit answer, not a required affirmative consent',()=>{assert.match(fieldGuidance({type:'boolean'}),/Não também é uma resposta válida/);});
test('unknown guidance is empty and cannot invent schema text',()=>{assert.equal(fieldGuidance({type:'unsupported'}),'');});
