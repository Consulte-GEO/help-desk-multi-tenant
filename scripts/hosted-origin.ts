/** Explicit test-client destination selection; not proof of site ownership or backend isolation. */
export const LEGACY_HOSTED_SITE = 'helpdesk-consultegeo';

/** No inferred site, alias, custom domain, userinfo, port, path or URL normalization. */
export function isHostedDeployOrigin(origin:unknown,siteName:unknown):origin is string {
 if(typeof origin!=='string'||typeof siteName!=='string'
  ||!/^[a-z0-9](?:[a-z0-9-]{0,35}[a-z0-9])?$/.test(siteName))return false;
 // 24-char deploy ID + two separators + at most 37 chars in this DNS label.
 const match=/^https:\/\/([a-f0-9]{24})--/.exec(origin);
 if(!match||origin!==`https://${match[1]}--${siteName}.netlify.app`)return false;
 try{return new URL(origin).origin===origin;}catch{return false;}
}
