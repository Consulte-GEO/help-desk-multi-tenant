import type {GeoReturnController,GeoReturnCredentials} from './geo-auth-callback.js';
export interface GeoCallbackPayload {code:string;state:string;iss:string;}
export function captureGeoCallback(location:Pick<Location,'href'>|string,history:Pick<History,'replaceState'>):Readonly<GeoCallbackPayload>|null;
export function createGeoAuthController(options:{request:(path:string,init:RequestInit)=>Promise<Response>;onState?:(state:ReturnType<GeoReturnController['view']>)=>void;onSession?:(credentials:Readonly<GeoReturnCredentials>)=>void;}):Readonly<GeoReturnController>;
