/** Synthetic records only. No key, person or approval here exists in production. */
export const u=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const AT='2026-10-10T18:00:00.000000Z';
export const BEFORE='2026-10-10T17:00:00.000000Z';
export const UNTIL='2026-10-10T19:00:00.000000Z';
export const digest=(c='a')=>c.repeat(64);
export const identity=()=>({sourceSha:'a'.repeat(40),sourceFingerprint:digest(),apiVersion:'0.27.0',schemaVersion:'0.19.0',configDigest:digest('b'),providerDigest:digest('c'),netlifySiteId:'9781cd85-7dc1-4ef5-868b-947e389a9d4d',supabaseProjectId:'xaelbntjnvztznnpcvtm',deployId:'6ac807ef1d6686000887ce64',recoveryEpoch:u(500)});
export const resource=(id='A',tenantId='tenant-A')=>({connectionId:u(9),tenantId,type:'work',id});
export const cohort=()=>({id:u(10),workspaceId:u(1),accountId:u(2),productInstanceId:u(3),categoryId:'SYNTHETIC',channelId:'portal',personIds:[u(4)],refs:[resource('A'),resource('B')],features:['core']});
export const manifest=()=>({schema:1,releaseId:u(5),identity:identity(),validFrom:BEFORE,expiresAt:UNTIL,policySetDigest:digest('d'),cohorts:[cohort()]});
export const requestScope=()=>({workspaceId:u(1),principalId:u(4),accountId:u(2),productInstanceId:u(3),categoryId:'SYNTHETIC',channelId:'portal',refs:[resource()],feature:'core'});
export const REQUIREMENTS:Record<string,{environment:string;checks:string[]}>= {
 ci:{environment:'ci_linux',checks:['lock','tests','contracts','migrations','secretScan','typecheck','build','audit']},
 postgres:{environment:'owned_pg17',checks:['resourceIsolation','upgrade','oldUsers','rls','concurrency']},
 browser:{environment:'owned_browser',checks:['desktop','mobile','csp','keyboard','audienceClear']},
 security:{environment:'hosted_existing',checks:['auth','privileges','ssrf','notesIsolation','exportIsolation','findingsTriaged']},
 capacity:{environment:'hosted_existing',checks:['targetsAccepted','noisyNeighbor','pooler','limits','costsMeasured']},
 restore:{environment:'authorized_isolated_restore',checks:['database','objects','configuration','keyReferences','counts','hashes','noReplayedDeliveries','noResurrectedData','rpoRtoAccepted']},
 review:{environment:'independent_review',checks:['notAuthor','findingsResolved']},
 operations:{environment:'owner_acceptance',checks:['owners','policies','runbooks','containment','providers','training']},
 external_identity:{environment:'hosted_existing',checks:['oidc','twoPeople','scopeRevocation']},
 attachments:{environment:'hosted_existing',checks:['privateStorage','realScanner','downloadRevocation','cleanup','costs']},
 approvals:{environment:'hosted_existing',checks:['currentPerson','currentRevision','duplicateDecision']},
 email:{environment:'hosted_existing',checks:['provider','dns','unknownOutcome','deliveryLedger','noPrivateNotes']},
 exports:{environment:'hosted_existing',checks:['completeUniverse','downloadRevocation','privateStorage']},
 packages:{environment:'hosted_existing',checks:['qualifiedProducer','realScanner','objectRestore']},
 knowledge:{environment:'hosted_existing',checks:['editorialSource','audience']},
 csat:{environment:'hosted_existing',checks:['invitation','useOnce','limits']},
 gtc:{environment:'hosted_existing',checks:['qualifiedContract','signature','releaseEvidence','noAutomaticClose']},
};
export function evidenceFor(hash:string,kinds=Object.keys(REQUIREMENTS).slice(0,8)) {return kinds.map((kind,index)=>({id:`synthetic-${kind}`,kind,manifestHash:hash,artifactHash:digest('e'),environment:REQUIREMENTS[kind]!.environment,status:'passed',checkedAt:AT,validUntil:UNTIL,checks:Object.fromEntries(REQUIREMENTS[kind]!.checks.map(k=>[k,true])),tests:['ci','postgres','browser'].includes(kind)?{total:index+1,passed:index+1,failed:0,skipped:0,cancelled:0,todo:0}:null}));}
