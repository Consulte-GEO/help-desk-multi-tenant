import {HelpdeskError} from '../domain/errors.ts';

/** These statements have no RETURNING and must each affect exactly one row.
 * A suppressed INSERT (for example, a BEFORE trigger returning NULL) is not success.
 * This acknowledges the statement only: runTransaction still confirms the COMMIT.
 */
export function assertSingleWrite(value:unknown,expected:'INSERT'|'UPDATE'):void{
 const invalid=()=>new HelpdeskError(503,'invalid_database_write_result',
  'O banco não confirmou a gravação esperada. Atualize antes de tentar novamente.');
 if(value===null||typeof value!=='object'||Array.isArray(value))throw invalid();
 const r=value as Record<string,unknown>;
 if(r.command!==expected||!Array.isArray(r.rows)||r.rows.length!==0
  ||typeof r.rowCount!=='number'||!Number.isInteger(r.rowCount))throw invalid();
 if(expected==='UPDATE'&&r.rowCount===0)
  throw new HelpdeskError(412,'version_conflict','O chamado foi alterado ou deixou de estar acessível.');
 if(r.rowCount!==1)throw invalid();
}
