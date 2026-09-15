export class HelpdeskError extends Error {
  readonly status:number;
  readonly code:string;
  constructor(status:number,code:string,message:string){super(message);this.name='HelpdeskError';this.status=status;this.code=code;}
}
export function deny():never {throw new HelpdeskError(404,'resource_not_found','Recurso não encontrado ou sem acesso.');}
