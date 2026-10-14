const categories=new Set(['request','response_type','response_redirect','response_content_type','response_body','response_json','workflow_receipt','workflow_etag','workflow_replayed_header','checklist_receipt','checklist_etag']);
/** Closed presentation diagnostics only: never include values, identities,
 * headers, payloads or credentials. A sink cannot alter refusal or confirmation. */
export function observeResponseDiagnostic(observer,category){
 if(!categories.has(category)||typeof observer!=='function')return;
 try{void Promise.resolve(observer(category)).catch(()=>{});}catch{/* diagnostic only */}
}
