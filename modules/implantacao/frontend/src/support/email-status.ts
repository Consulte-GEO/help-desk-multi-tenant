const labels:Record<string,string>={queued:'Na fila de envio',accepted:'Aceito pelo serviço de e-mail',delivered:'Entrega confirmada',failed:'Falha no envio',suppressed:'Sem destinatário autorizado',unknown:'Envio sem confirmação',unavailable:'E-mail indisponível',not_requested:'Nenhum envio solicitado'};
export const emailStatusLabel=(state:string)=>labels[state]??'Estado indisponível';
