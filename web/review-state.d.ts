export type ReviewContext=Readonly<{ticketId:string;workspaceId:string;principalId:string;version:number;formRevision:number;invitationId:string|null}>;
export type ReviewTransportResult={kind:'confirmed';value:unknown}|{kind:'rejected'}|{kind:'unknown'};
export interface ReviewApi{prepare(context:ReviewContext,signal?:AbortSignal):Promise<unknown>;preview(command:Record<string,unknown>,signal?:AbortSignal):Promise<unknown>;commit(operation:'approval'|'revision',command:Record<string,unknown>,key:string,signal?:AbortSignal):Promise<ReviewTransportResult>}
export type ReviewSnapshot=Readonly<{phase:string;publicDiff:readonly Record<string,unknown>[];receipt:Readonly<{ticketId:string;version:number;formRevision:number;notification:'pending'}>|null;version:number|null;formRevision:number|null}>;
export type ReviewOptions={context:ReviewContext;api:ReviewApi;clock?:()=>string;key?:()=>string;onChange?:(snapshot:ReviewSnapshot)=>void};
export interface ReviewState{snapshot():ReviewSnapshot;prepare():Promise<void>;previewRevision(input:{draftId:string;expectedDraftRevision:number;comment:string}):Promise<void>;confirmApproval(decision:'approve'|'reject',reason:string):Promise<void>;confirmRevision():Promise<void>;reconcile():Promise<void>;clear():void}
export function createReviewState(options:ReviewOptions):ReviewState;
export function createReviewApi(options:{origin:string;fetch:typeof fetch}):ReviewApi;
