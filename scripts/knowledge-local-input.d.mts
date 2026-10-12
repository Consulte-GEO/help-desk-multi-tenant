/** Stable private local file, bounded to at most 4 MiB. No reading at import. */
export function readPrivateKnowledgeJson(path:string,maxBytes?:number):Promise<unknown>;
export function samePrivateKnowledgePath(a:string,b:string):boolean;
