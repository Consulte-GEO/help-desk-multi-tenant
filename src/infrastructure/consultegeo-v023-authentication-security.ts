import type {SqlPool} from './sql.ts';import {HelpdeskError} from '../domain/errors.ts';
import {DATABASE_SECURITY_QUERY,READINESS_FLAGS} from './database-security.ts';import {DATABASE_SECURITY_CONTRACT as V023} from './consultegeo-v023-security-contract.ts';
/** Exact frozen predecessor; caller must already have closed every business and
 * Consulte GEO gate. No live catalogue adoption and no business compatibility. */
export async function assertV023AuthenticationSecurity(pool:SqlPool){const result=await pool.query(DATABASE_SECURITY_QUERY,[JSON.stringify(V023),[...V023.schemas]]),row=result.rows[0];if(result.rows.length!==1||!row||row.table_count!==V023.tables.length||row.unsafe_tables!==0||row.public_schema_access!==false||row.client_schema_access!==false||row.public_helper_execute!==false||READINESS_FLAGS.some(key=>row[key]!==true))throw new HelpdeskError(503,'unsafe_database_policies','Estrutura de autenticação incompatível com o contrato anterior qualificado.');}
