export function loginErrorText(code:unknown):string;
export function accessPhase(value:unknown):Readonly<{kind:'signed_out'|'signing_in'|'active'|'paused'|'refreshing'|'signing_out'|'other';loginBusy:boolean;sessionTone:'warning'|'info'|'neutral'}>;
