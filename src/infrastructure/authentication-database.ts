import type {SqlPool} from './sql.ts';
import {assertSafeDatabaseRole,assertDatabaseSecurity} from './postgres.ts';
import {assertDatabaseSecurity as assertLegacyAuthenticationSecurity} from './legacy-authentication-security.ts';
import {assertV023AuthenticationSecurity} from './consultegeo-v023-authentication-security.ts';
import {HelpdeskError} from '../domain/errors.ts';
export type RuntimeDatabaseMode={authenticationOnly:boolean;administration:boolean;workflow:boolean;intake:boolean};
export async function assertRuntimeDatabase(pool:SqlPool,mode:RuntimeDatabaseMode):Promise<'0.19.0'|'0.23.0'|'0.24.0'|'0.25.0'|'0.26.0'|'0.27.0'>{
 await assertSafeDatabaseRole(pool);
 const result=await pool.query('select helpdesk_auth.schema_version() as version');
 if(result.command!=='SELECT'||result.rows.length!==1)throw new HelpdeskError(503,'schema_version_mismatch','Banco incompatível com esta versão da API.');
 const version=result.rows[0]?.version;
 // This compatibility path grants no business capability and never adopts live privileges.
 if(mode.authenticationOnly===true&&mode.administration===false&&mode.workflow===false&&mode.intake===false){
  if(version==='0.19.0'){await assertLegacyAuthenticationSecurity(pool);return version;}
  if(version==='0.23.0'){await assertV023AuthenticationSecurity(pool);return version;}
 }
 if(version!=='0.24.0'&&version!=='0.25.0'&&version!=='0.26.0'&&version!=='0.27.0')throw new HelpdeskError(503,'schema_version_mismatch','Banco incompatível com esta versão da API.');
 await assertDatabaseSecurity(pool,version);return version;
}
