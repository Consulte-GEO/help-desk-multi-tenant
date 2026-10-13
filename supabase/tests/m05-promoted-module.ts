import assert from 'node:assert/strict';import type {SqlPool} from '../../src/infrastructure/sql.ts';
/** No candidate install/fallback. Semantic suites exercise the manifest migration. */
export async function assertPromotedM05Module(admin:SqlPool,signature:string){const r=await admin.query('select helpdesk_auth.schema_version() as version,to_regprocedure($1) is not null as installed',[signature]);assert.equal(r.rows[0]?.version,'0.20.0');assert.equal(r.rows[0]?.installed,true);}
