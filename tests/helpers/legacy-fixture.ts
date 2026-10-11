/** Synthetic normalized export. No source payload is executed or imported. */
import {createHash} from 'node:crypto';
import {AT,BEFORE,UNTIL,u,resource,digest} from './release-fixtures.ts';
export function rawHistory(){const bytes=Buffer.from('Synthetic historical payload; never interpreted as code.');const payloadSha256=createHash('sha256').update(bytes).digest('hex');
 const record:any={ref:{sourceSystem:'GEO_LEGACY',connectionId:u(9),tenantId:'tenant-A',type:'ticket',id:'0001',legacyCode:'CG-0001'},sourceRevision:'source-v1',createdAt:BEFORE,updatedAt:AT,retainUntil:UNTIL,actor:{kind:'shared',sourceId:'master'},resources:[resource('A')],payloadSha256,payloadBytes:bytes.length,attachments:[]};
 const mapping:any={schema:1,sourceSystem:'GEO_LEGACY',connectionId:u(9),revision:'mapping-v1',contractHash:digest('b'),asOf:BEFORE,expiresAt:UNTIL,entries:[{tenantId:'tenant-A',type:'work',id:'A',workspaceId:u(1),accountId:u(2),productInstanceId:u(3),bindingId:u(6)}]};
 const batch:any={schema:1,sourceSystem:'GEO_LEGACY',connectionId:u(9),exportId:u(70),exportedAt:AT,expectedCount:1,recordsHash:'a'.repeat(64),records:[record]};
 const retained:any={entries:[],revokedSourceKeys:[]};return {bytes,record,mapping,batch,retained};}
