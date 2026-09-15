import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadTicket, canWriteInternalNote } from '../src/domain/policy.ts';
import { resolveCoverage } from '../src/domain/contracts.ts';
import { canTransition, customerStatus } from '../src/domain/workflow.ts';
import { canonicalJson, requestHash } from '../src/domain/canonical.ts';
import { addBusinessMinutes } from '../src/domain/calendar.ts';
import { principal, coverage, ticket } from './fixtures.ts';

test('requester reads own ticket', () => assert.equal(canReadTicket(principal(), ticket()), true));
test('same workspace does not grant sibling-account access', () => assert.equal(canReadTicket(principal(), ticket({accountId:'account-b'})), false));
test('account grant never grants another workspace', () => assert.equal(canReadTicket(principal(), ticket({workspaceId:'workspace-b'})), false));
test('requester cannot read another requester ticket', () => assert.equal(canReadTicket(principal(), ticket({createdBy:'other'})), false));
test('account manager reads other requester tickets', () => assert.equal(canReadTicket(principal({grants:[{accountId:'account-a',role:'account_manager'}]}), ticket({createdBy:'other'})), true));
test('agent needs an account grant, not only workspace membership', () => assert.equal(canReadTicket(principal({workspaceRole:'agent',grants:[]}), ticket()), false));
test('human workspace administrator can read its workspace', () => assert.equal(canReadTicket(principal({workspaceRole:'admin',grants:[]}), ticket()), true));
test('forged integration administrator never becomes human operator', () => assert.equal(canWriteInternalNote(principal({kind:'integration',workspaceRole:'admin'}), ticket()), false));
test('customer cannot write internal notes', () => assert.equal(canWriteInternalNote(principal(), ticket()), false));
test('account-scoped agent can write internal notes', () => assert.equal(canWriteInternalNote(principal({grants:[{accountId:'account-a',role:'agent'}]}), ticket()), true));
test('integration cannot read another product instance', () => assert.equal(canReadTicket(principal({kind:'integration',productInstanceIds:['other']}), ticket()), false));
test('missing read scope blocks ticket', () => assert.equal(canReadTicket(principal({scopes:[]}), ticket()), false));

test('single eligible coverage resolves', () => assert.equal(resolveCoverage([coverage()], '2026-09-15T12:00:00Z').status,'resolved'));
test('multiple coverages are ambiguous', () => assert.equal(resolveCoverage([coverage(),coverage({id:'coverage-b'})], '2026-09-15T12:00:00Z').status,'ambiguous'));
test('expired coverage cannot be chosen', () => assert.equal(resolveCoverage([coverage({validUntil:'2026-09-15T12:00:00Z'})], '2026-09-15T12:00:00Z').status,'no_coverage'));
test('suspended contract cannot be chosen', () => assert.equal(resolveCoverage([coverage({contractStatus:'suspended'})], '2026-09-15T12:00:00Z').status,'no_coverage'));
test('future contract is ineligible', () => assert.equal(resolveCoverage([coverage({validFrom:'2027-01-01T00:00:00Z'})], '2026-09-15T12:00:00Z').status,'no_coverage'));
test('draft contract cannot grant coverage', () => assert.equal(resolveCoverage([coverage({published:false})], '2026-09-15T12:00:00Z').status,'no_coverage'));

test('new ticket can enter triage',()=>assert.equal(canTransition('new','triage','agent'),true));
test('customer cannot resolve own ticket',()=>assert.equal(canTransition('open','resolved','customer'),false));
test('customer can explicitly reopen resolved ticket',()=>assert.equal(canTransition('resolved','open','customer'),true));
test('closed is terminal in first release',()=>assert.equal(canTransition('closed','open','agent'),false));
test('internal waiting projects as in progress',()=>assert.equal(customerStatus('waiting_internal'),'in_progress'));

test('canonical hash ignores object property order',()=>assert.equal(requestHash({a:1,b:2}),requestHash({b:2,a:1})));
test('canonical hash preserves array order',()=>assert.notEqual(requestHash({a:[1,2]}),requestHash({a:[2,1]})));
test('ambiguous non-JSON values are rejected',()=>assert.throws(()=>canonicalJson({a:undefined})));
const calendar={timezone:'America/Bahia',week:{1:[[540,1020]],2:[[540,1020]],3:[[540,1020]],4:[[540,1020]],5:[[540,1020]]},holidays:[]} as const;
test('business calendar skips weekend',()=>assert.equal(addBusinessMinutes('2026-09-18T19:30:00Z',60,calendar),'2026-09-21T12:30:00.000Z'));
test('business calendar skips configured holiday',()=>assert.equal(addBusinessMinutes('2026-09-18T19:30:00Z',60,{...calendar,holidays:['2026-09-21']}),'2026-09-22T12:30:00.000Z'));
test('business calendar preserves seconds',()=>assert.equal(addBusinessMinutes('2026-09-15T12:00:30Z',1,calendar),'2026-09-15T12:01:30.000Z'));
test('zero target returns exact start',()=>assert.equal(addBusinessMinutes('2026-09-19T12:00:15Z',0,calendar),'2026-09-19T12:00:15.000Z'));
test('empty calendar fails instead of infinite loop',()=>assert.throws(()=>addBusinessMinutes('2026-09-15T12:00:00Z',60,{...calendar,week:{}})));
