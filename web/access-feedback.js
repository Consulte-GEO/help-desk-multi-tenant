/** Presentation only. Accept a code, never an Error/message/session/token object. */
const fallback='Não foi possível entrar. Confira seus dados e tente novamente.';
const messages=Object.freeze({
 invalid_login:'Informe um e-mail e uma senha válidos.',
 invalid_credentials:'Não foi possível confirmar o acesso. Confira seu e-mail e sua senha.',
 login_failed:'Não foi possível confirmar o acesso. Confira seu e-mail e sua senha.',
 auth_rate_limited:'Houve muitas tentativas de acesso. Aguarde antes de tentar novamente.',
 membership_required:'Seu acesso a esta operação não foi confirmado. Procure o administrador.',
 forbidden:'Seu acesso a esta operação não foi autorizado. Procure o administrador.',
 simple_mfa_required:'Esta conta exige autenticação adicional e não pode usar o acesso simples. Procure o administrador.',
 simple_workspace_required:'É necessário definir uma única operação para usar o acesso simples. Procure o administrador.',
 auth_unavailable:'O serviço de acesso está indisponível no momento. Tente novamente mais tarde.',
 invalid_auth_config:'O serviço de acesso ainda não está configurado. Procure o administrador.',
 auth_response_invalid:'O serviço não confirmou uma sessão válida. Entre novamente para continuar.',
 session_rejected:'A sessão não foi confirmada. Entre novamente para continuar.',
 mfa_required:'Sua conta exige autenticação adicional. Use o acesso autorizado indicado pelo administrador.',
 unsupported_mfa:'O acesso simples não atende à autenticação exigida por esta conta. Procure o administrador.'
});
export function loginErrorText(code){return typeof code==='string'&&Object.hasOwn(messages,code)?messages[code]:fallback;}
export function accessPhase(value){
 const kind=typeof value==='string'&&['signed_out','signing_in','active','paused','refreshing','signing_out'].includes(value)?value:'other';
 return Object.freeze({kind,loginBusy:kind==='signing_in',sessionTone:kind==='paused'?'warning':kind==='refreshing'?'info':'neutral'});
}
