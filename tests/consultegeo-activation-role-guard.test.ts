import test from 'node:test';import assert from 'node:assert/strict';
async function recipe(){return import('../scripts/consultegeo-activation-upgrade.ts');}
for(const phase of ['base','final'] as const)test('activation '+phase+' guard emits every ordinary application check before catalogue approval',async()=>{
 const m=await recipe();assert.equal(typeof m.compileActivationCatalogueGuard,'function','Activation must require the ordinary application identity in both catalogue guards');
 const sql=m.compileActivationCatalogueGuard(phase),profile=sql.slice(0,sql.indexOf('SELECT * INTO checked FROM'));
 assert.match(profile,/r\.rolname='helpdesk_app'/);for(const flag of ['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication'])assert.ok(profile.includes('r.'+flag),'Missing application flag '+flag);
 assert.match(profile,/pg_catalog\.pg_auth_members m WHERE m\.member=r\.oid/);
 assert.match(profile,/c\.relowner=r\.oid AND n\.nspname LIKE 'helpdesk_%'/);
 assert.match(profile,/n\.nspowner=r\.oid AND n\.nspname LIKE 'helpdesk_%'/);
 assert.match(profile,/p\.proowner=r\.oid AND n\.nspname LIKE 'helpdesk_%'/);
 const role=sql.indexOf("RAISE EXCEPTION 'Restricted application identity required'"),catalogue=sql.indexOf('SELECT * INTO checked FROM');
 assert.ok(role>0&&catalogue>role,'The role check must precede catalogue approval');assert.ok(sql.includes("ERRCODE='"+(phase==='base'?'HDU04':'HDU06')+"'"));
});
