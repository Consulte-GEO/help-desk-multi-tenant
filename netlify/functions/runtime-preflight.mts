import {createHostedPreflight} from '../../src/infrastructure/hosted-preflight.ts';

declare const Netlify:{env:{get(name:string):string|undefined}};

// Netlify scheduled functions have no public URL. Run now is provider-authenticated.
// No body/header can supply credentials, change a database target or open the release gate.
export default async function handler():Promise<Response>{
 await createHostedPreflight(name=>Netlify.env.get(name),entry=>console.log(JSON.stringify(entry)))();
 return new Response(null,{status:204});
}

// Monthly bounded read-only monitoring; manual Run now permits the initial acceptance probe.
export const config={schedule:'0 0 1 * *'};
