import {registrationFailure} from '../../domain/registration-canonical.ts';
import type {RegistrationActionDefinition} from '../../domain/registration-action-catalog.ts';
import type {AgentAnalysisJob,AgentAnalysis} from '../../domain/registration-contracts.ts';
import {parseAgentAnalysis} from '../../domain/registration-analysis.ts';
export {createAgentAnalysisJob,parseAgentAnalysisJob,parseAgentAnalysis} from '../../domain/registration-analysis.ts';
export type {AgentAnalysisJob,AgentAnalysis} from '../../domain/registration-contracts.ts';

/** Adapter for an ALREADY decoded CLI envelope. HDA-04 must independently bound
 * stdout bytes and reject duplicate JSON members before calling this helper.
 * Provider metadata (including decimal costs) is neither canonicalized nor retained.
 */
export function parseClaudeStructuredOutput(raw:unknown,job:AgentAnalysisJob,definition:RegistrationActionDefinition):AgentAnalysis {
  try {
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))throw registrationFailure();
    const pick=(key:string):unknown=>{const p=Object.getOwnPropertyDescriptor(raw,key);if(!p?.enumerable||!Object.hasOwn(p,'value'))throw registrationFailure();return p.value;};
    if(pick('type')!=='result'||pick('subtype')!=='success'||pick('is_error')!==false)throw registrationFailure();
    return parseAgentAnalysis(pick('structured_output'),job,definition);
  }catch {throw registrationFailure('registration_cli_output_invalid',422);}
}
