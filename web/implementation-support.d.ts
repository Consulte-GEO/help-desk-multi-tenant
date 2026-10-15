export interface ImplementationSupportPrincipal {kind?:string;workspace_role?:string|null;grants?:readonly {role?:string}[]}
export function isImplementationSupportStaff(principal:ImplementationSupportPrincipal|null|undefined):boolean;
export type ImplementationSupportApplication={destroy():void};
export interface ImplementationSupportMountOptions {
 principal:ImplementationSupportPrincipal|null;
 getPrincipal?:()=>ImplementationSupportPrincipal|null;
 session:{id:string;workspaceId:string};
 request:(path:string,init?:RequestInit)=>Promise<Response>;
 isCurrent?:()=>boolean;
 loadApplication?:()=>Promise<{mountImplementationSupportApplication(options:{root:HTMLElement;request:ImplementationSupportMountOptions['request'];session:{id:string;workspaceId:string};signal:AbortSignal}):Promise<ImplementationSupportApplication>|ImplementationSupportApplication}>;
}
export function mountImplementationSupport(root:HTMLElement,options:ImplementationSupportMountOptions):{readonly ready:Promise<boolean>;retry():Promise<boolean>;destroy():void};
