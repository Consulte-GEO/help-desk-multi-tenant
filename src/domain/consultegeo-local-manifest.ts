import {requestHash} from './canonical.ts';
/** HelpDesk local register provenance. No external API qualification is claimed. */
export const CONSULTEGEO_LOCAL_MANIFEST=Object.freeze({source:'helpdesk-local',version:1,authority:'persisted-local-registry',resourceType:'work',complete:true,externalApiQualified:false});
export const CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT=requestHash(CONSULTEGEO_LOCAL_MANIFEST);
