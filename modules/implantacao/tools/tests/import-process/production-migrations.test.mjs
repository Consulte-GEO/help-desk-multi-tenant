import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
for(const [source,migration] of [
 ['IMP02_PROCESSOS_PRODUCTION.sql','20261015102342_imp02_processes_hosted_authority.sql'],
 ['IMP02_STORAGE_PRODUCTION.sql','20261015102401_imp02_private_artifact_storage.sql'],
 ['IMP02_STORAGE_INSPECTOR_RESTRICTIONS.sql','20261015155558_imp02_inspector_storage_restrictions.sql'],
])test('official hosted migration equals the qualified SQL: '+migration,async()=>{
 const bytes=await fs.readFile(new URL('../../../docs/implantacao/sql/'+source,import.meta.url));
 const published=await fs.readFile(new URL('../../../supabase/migrations/'+migration,import.meta.url));
 // Git may check out CRLF on Windows; PostgreSQL statements must remain exact.
 assert.equal(published.toString().replaceAll('\r\n','\n'),bytes.toString().replaceAll('\r\n','\n'));
});
