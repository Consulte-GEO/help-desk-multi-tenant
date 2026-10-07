import {hasAal2Claims,type MfaFactor} from '../../shared/mfa.js';
import {HelpdeskError} from '../domain/errors.ts';
/** Caller must have validated this exact bearer and current factors through Auth /user. */
export function requireHumanMfa(token:string,verifiedUserId:string,factors:readonly MfaFactor[],at:Date):void{
 if(factors.length&& !hasAal2Claims(token,verifiedUserId,at.getTime()))throw new HelpdeskError(403,'mfa_required','Confirme a autenticação multifator antes de acessar o workspace.');
}
