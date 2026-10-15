import type {Config,Context} from '@netlify/functions';
import {createLazyNotificationRuntime,createNotificationScheduledHandler,readNotificationRuntimeEnvironment} from '../../src/infrastructure/notification-runtime.ts';
import {createCombinedNotificationScheduledHandler,createImplementationEmailScheduledHandler,createLazyImplementationEmailRuntime} from '../../src/infrastructure/implementation-email-runtime.ts';
declare const Netlify:{env:{get(name:string):string|undefined}};
const configuration=()=>readNotificationRuntimeEnvironment(name=>Netlify.env.get(name),'worker');
const core=createNotificationScheduledHandler({configuration,runtime:createLazyNotificationRuntime('worker'),observe:entry=>console.warn(JSON.stringify(entry))});
const implementation=createImplementationEmailScheduledHandler({configuration,runtime:createLazyImplementationEmailRuntime(),observe:entry=>console.warn(JSON.stringify(entry))});
const handler=createCombinedNotificationScheduledHandler(core,implementation);
export default function notificationWorker(request:Request,context:Context){return handler(request,context);}
// Every minute, UTC. Netlify invokes schedules only for the published deploy;
// this Function has no URL path or request-controlled recipient selectors.
export const config:Config={schedule:'* * * * *'};
