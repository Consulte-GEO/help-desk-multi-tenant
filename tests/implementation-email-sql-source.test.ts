import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const base=new URL('../supabase/addons/implantacao/',import.meta.url);
test('email addon exists outside immutable core, with seven explicitly scoped entry points',()=>{
 const files=readdirSync(base).filter(x=>x.includes('implementation_email')&&x.endsWith('.sql'));
 assert.equal(files.length,1,'one independent email addon is required');
 const sql=readFileSync(new URL(files[0]!,base),'utf8');
 for(const name of ['contract','enqueue','status','claim','begin_send','finish_send','receive_event'])assert.match(sql,new RegExp('CREATE FUNCTION helpdesk_implantacao_email\\.'+name+'\\('));
 assert.doesNotMatch(sql,/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s+ON[^;]*TO\s+helpdesk_(app|notification_worker)/i);
 assert.match(sql,/REVOKE ALL ON ALL FUNCTIONS IN SCHEMA helpdesk_implantacao_email/);
 assert.match(sql,/auth\.users/);assert.match(sql,/email_confirmed_at/);assert.match(sql,/banned_until/);assert.match(sql,/deleted_at/);
});
test('native qualification preserves baseline and executes additional restricted worker suite',()=>{
 const runner=readFileSync(new URL('../scripts/qualify-implementation-support-native.mjs',import.meta.url),'utf8');
 assert.match(runner,/runImplementationSupportNativeSuite/);
 assert.match(runner,/runImplementationEmailNativeSuite/);
 assert.match(runner,/user:'helpdesk_notification_worker'/);
 assert.doesNotMatch(runner,/ssl:\s*\{[^}]*rejectUnauthorized:\s*false/);
});
