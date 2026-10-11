export type ReportMetric=Readonly<{availability:'unavailable'|'available';value:number|null}>;
export type ReportView=Readonly<{total:number;open:number;waitingCustomer:number;resolvedOrClosed30d:number;asOf:string;metrics?:Readonly<Record<string,ReportMetric>>}>;
export function renderOperationalReport(root:HTMLElement,report:ReportView|null):void;
