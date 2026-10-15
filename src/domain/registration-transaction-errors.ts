import {HelpdeskError} from './errors.ts';
import {registrationFailure} from './registration-canonical.ts';

const coreCodes:Readonly<Record<string,number>>=Object.freeze({
 database_unavailable:503,transaction_outcome_unknown:503,transaction_identity_changed:403,
 transaction_work_incomplete:503,transaction_statement_failed:503,transaction_validation_failed:503
});
/** Keep an unknown COMMIT distinguishable, but never forward driver/callback text,
 * stack, cause, paths, credentials or arbitrary error metadata to a caller. */
export function safeRegistrationTransactionError(error:unknown):HelpdeskError {
 try {
  if(error instanceof HelpdeskError) {
   const code=Object.getOwnPropertyDescriptor(error,'code')?.value;
   const status=Object.getOwnPropertyDescriptor(error,'status')?.value;
   if(typeof code==='string'&&Object.hasOwn(coreCodes,code))return registrationFailure(code,coreCodes[code]);
   if(typeof code==='string'&&/^registration_[a-z_]{1,80}$/.test(code)&&[400,403,404,409,412,422,503].includes(status))return registrationFailure(code,status);
  }
 }catch { /* A hostile error object must not replace the controlled response. */ }
 return registrationFailure('registration_storage_unavailable',503);
}
