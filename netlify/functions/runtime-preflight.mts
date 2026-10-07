import {createHostedPreflight} from '../../src/infrastructure/hosted-preflight.ts';
import type {DeploySucceededEvent} from '@netlify/functions';

declare const Netlify:{env:{get(name:string):string|undefined}};

// Event handlers have no public route. Only the provider's production deploy event triggers the probe.
// Event data never supplies credentials or database targets. No cron or release-gate mutation.
export default {
 async deploySucceeded(event:DeploySucceededEvent):Promise<void>{
  const siteId='9781cd85-7dc1-4ef5-868b-947e389a9d4d';
  if(event?.site?.id!==siteId||event?.deploy?.siteId!==siteId||event.deploy.context!=='production')return;
  await createHostedPreflight(name=>Netlify.env.get(name),entry=>console.log(JSON.stringify(entry)))();
 }
};
