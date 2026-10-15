import {runtime} from './runtime';
export function getCurrentUser(){try{return {id:runtime().session.id,email:'',displayName:'Equipe de suporte',isAdmin:true};}catch{return null;}}
export async function restoreSession(){return getCurrentUser();}
export async function signIn(){return {ok:false,error:'Use o acesso do HelpDesk.'};}
export async function signOut(){runtime().dispose();}
export async function onAuthStateChange(_cb:unknown){return ()=>{};}
