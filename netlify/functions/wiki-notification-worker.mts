import type {Config,Context} from '@netlify/functions';
import {readNotificationRuntimeEnvironment} from '../../src/infrastructure/notification-runtime.ts';
import {createLazyWikiNotificationRuntime,createWikiNotificationScheduledHandler} from '../../src/infrastructure/wiki-notification-runtime.ts';
declare const Netlify:{env:{get(name:string):string|undefined}};
const handler=createWikiNotificationScheduledHandler({configuration:()=>readNotificationRuntimeEnvironment(name=>Netlify.env.get(name),'worker'),runtime:createLazyWikiNotificationRuntime(),observe:entry=>console.warn(JSON.stringify(entry))});
export default function wikiNotificationWorker(request:Request,context:Context){return handler(request,context);}
// Native schedule is the exclusive binding; no URL path or request-derived authority.
// published=false can be supplied by the scheduler and is not an admission check.
export const config:Config={schedule:'* * * * *'};
