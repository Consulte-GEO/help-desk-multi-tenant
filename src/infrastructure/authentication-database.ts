import type {SqlPool} from './sql.ts';
import {assertSafeDatabaseRole,assertSchemaCompatibility,assertDatabaseSecurity} from './postgres.ts';
import {assertDatabaseSecurity as assertLegacyAuthenticationSecurity} from './legacy-authentication-security.ts';
import {assertV023AuthenticationSecurity} from './consultegeo-v023-authentication-security.ts';
import {HelpdeskError} from '../domain/errors.ts';
export type RuntimeDatabaseMode={authenticationOnly:boolean;administration:boolean;workflow:boolean;intake:boolean};
export async function assertRuntimeDatabase(pool:SqlPool,mode:RuntimeDatabaseMode):Promise<void>{
 await assertSafeDatabaseRole(pool);
 // This compatibility path grants no business capability and never adopts live privileges.
 if(mode.authenticationOnly===true&&mode.administration===false&&mode.workflow===false&&mode.intake===false){
  const result=await pool.query('select helpdesk_auth.schema_version() as version');
  if(result.command!=='SELECT'||result.rows.length!==1)throw new HelpdeskError(503,'schema_version_mismatch','Banco incompatível com esta versão da API.');
  if(result.rows[0]?.version==='0.19.0'){await assertLegacyAuthenticationSecurity(pool);return;}
  if(result.rows[0]?.version==='0.23.0'){await assertV023AuthenticationSecurity(pool);return;}
 }
 await assertSchemaCompatibility(pool);await assertDatabaseSecurity(pool);
}
