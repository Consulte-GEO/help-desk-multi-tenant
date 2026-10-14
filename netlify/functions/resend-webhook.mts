import type {Config,Context} from '@netlify/functions';
import {createLazyNotificationRuntime,createResendWebhookHandler,readNotificationRuntimeEnvironment} from '../../src/infrastructure/notification-runtime.ts';
import {privateJson} from '../../src/http/controlled-json.ts';
declare const Netlify:{env:{get(name:string):string|undefined}};
const handler=createResendWebhookHandler({configuration:()=>readNotificationRuntimeEnvironment(name=>Netlify.env.get(name),'webhook'),runtime:createLazyNotificationRuntime('webhook')});
export default function resendWebhook(request:Request,context:Context){if(context.deploy.context!=='production'||context.deploy.published!==true)return Promise.resolve(privateJson({code:'notification_unavailable'},503));return handler(request);}
// Keep this literal: Netlify extracts routing metadata without executing imports.
export const config:Config={path:'/integrations/resend/events',method:'POST'};
