import type {Config,Context} from '@netlify/functions';
import {createLazyNotificationRuntime,createNotificationScheduledHandler,readNotificationRuntimeEnvironment} from '../../src/infrastructure/notification-runtime.ts';
declare const Netlify:{env:{get(name:string):string|undefined}};
const handler=createNotificationScheduledHandler({configuration:()=>readNotificationRuntimeEnvironment(name=>Netlify.env.get(name),'worker'),runtime:createLazyNotificationRuntime('worker')});
export default function notificationWorker(request:Request,context:Context){return handler(request,context);}
// Every minute, UTC. Netlify invokes schedules only for the published deploy;
// this Function has no URL path or request-controlled recipient selectors.
export const config:Config={schedule:'* * * * *'};
