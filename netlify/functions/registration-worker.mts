import type {Config,Context} from '@netlify/functions';
import {createLazyRegistrationRuntime,createRegistrationScheduledHandler,readRegistrationRuntimeEnvironment} from '../../src/infrastructure/registration-runtime.ts';
declare const Netlify:{env:{get(name:string):string|undefined}};
const handler=createRegistrationScheduledHandler({configuration:()=>readRegistrationRuntimeEnvironment(name=>Netlify.env.get(name)),runtime:createLazyRegistrationRuntime()});
export default function registrationWorker(request:Request,context:Context){return handler(request,context);}
export const config:Config={schedule:'* * * * *'};
