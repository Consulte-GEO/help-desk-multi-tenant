import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {compileCustomerReturnRepair,verifyCustomerReturnRepair} from '../scripts/consultegeo-customer-return-upgrade.ts';
const component=()=>readFile(new URL('../supabase/candidates/hdn_notification_customer_return_source.sql',import.meta.url),'utf8');
test('customer return repair is the exact nineteenth append with all eighteen predecessors preserved',async()=>{const result=await verifyCustomerReturnRepair(process.cwd());assert.equal(result.schemaVersion,'0.25.0');assert.equal(result.file,'20261015104831_consultegeo_customer_return_source.sql');});
test('customer return repair refuses an altered component before generating SQL',async()=>{const body=await component();assert.throws(()=>compileCustomerReturnRepair(body+'\n'));assert.throws(()=>compileCustomerReturnRepair(''));});
