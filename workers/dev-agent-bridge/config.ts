import {isAbsolute,normalize} from 'node:path';
import {registrationRecord,registrationDigest,registrationRef,registrationFailure} from '../../src/domain/registration-canonical.ts';
export type ClaudeRunnerConfig=Readonly<{executablePath:string;executableSha256:string;cliVersion:string;agentVersionRef:string;modelId:string;maxBudgetUsd:string;timeoutMs:number}>;
/** Server-only configuration, not an HTTP DTO. Pin by binary SHA AND exact version.
 * The bare-mode behavior used here is documented for >=2.1.286. Other major/minor
 * families require explicit requalification; never silently retry without flags. */
export function parseClaudeRunnerConfig(raw:unknown):ClaudeRunnerConfig {
 const fail=():never=>{throw registrationFailure('registration_runner_configuration_invalid',503);};
 try{
  const r=registrationRecord(raw,['executablePath','executableSha256','cliVersion','agentVersionRef','modelId','maxBudgetUsd','timeoutMs']);
  if(typeof r.executablePath!=='string'||!isAbsolute(r.executablePath)||normalize(r.executablePath)!==r.executablePath||/[\p{Cc}]/u.test(r.executablePath))return fail();
  if(typeof r.cliVersion!=='string'||!/^2\.1\.(0|[1-9][0-9]{0,5})$/.test(r.cliVersion)||Number(r.cliVersion.split('.')[2])<286)return fail();
  if(typeof r.modelId!=='string'||!/^claude-[a-z0-9][a-z0-9-]{1,100}$/.test(r.modelId)||r.modelId.includes('latest'))return fail();
  if(typeof r.maxBudgetUsd!=='string'||! /^(0\.[0-9]{2}|1\.00)$/.test(r.maxBudgetUsd)||Number(r.maxBudgetUsd)<0.01)return fail();
  if(!Number.isSafeInteger(r.timeoutMs)||Number(r.timeoutMs)<1000||Number(r.timeoutMs)>240000)return fail();
  return Object.freeze({executablePath:r.executablePath,executableSha256:registrationDigest(r.executableSha256),cliVersion:r.cliVersion,agentVersionRef:registrationRef(r.agentVersionRef),modelId:r.modelId,maxBudgetUsd:r.maxBudgetUsd,timeoutMs:r.timeoutMs as number});
 }catch{return fail();}
}
