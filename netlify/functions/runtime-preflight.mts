import {createHostedPreflight} from '../../src/infrastructure/hosted-preflight.ts';
import type {DeploySucceededEvent} from '@netlify/functions';

declare const Netlify:{env:{get(name:string):string|undefined}};

// Event handlers have no public route. Only the provider's production deploy event triggers the probe.
// Event data never supplies credentials or database targets. No cron or release-gate mutation.
export default {
 async deploySucceeded(event:DeploySucceededEvent):Promise<void>{
  const siteId='9781cd85-7dc1-4ef5-868b-947e389a9d4d';
  const bindings={site_match:event?.site?.id===siteId,deployment_site_match:event?.deploy?.siteId===siteId,
   production_match:event?.deploy?.context==='production'};
  if(!bindings.site_match||!bindings.deployment_site_match||!bindings.production_match){
   console.log(JSON.stringify({event:'helpdesk.runtime-preflight.skipped',success:false,credentials_read:false,
    business_operations_dispatched:0,...bindings}));return;
  }
  await createHostedPreflight(name=>Netlify.env.get(name),entry=>console.log(JSON.stringify(entry)))();
 }
};
