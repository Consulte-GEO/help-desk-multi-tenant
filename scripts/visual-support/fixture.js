/** TEST ONLY. Synthetic callbacks. Never copied by build to dist. */
import * as Support from '../../web/optional-support.js';
window.SUPPORT=Support;
window.CALLS=[];window.MODE='ok';window.NOW=Date.parse('2026-10-13T12:00:00.000Z');window.DEFERRED=null;
const R=document.getElementById('root');
window.KNOWLEDGE={items:[
 {title:'Como descrever sua solicitação',snippet:'Informe o que aconteceu, o resultado esperado e o contexto necessário para a equipe entender o pedido.'},
 {title:'Informações que ajudam na análise',snippet:'Organize as evidências pertinentes. Não inclua senhas ou códigos de acesso no conteúdo enviado.'},
 {title:'Acompanhe a conversa',snippet:'Use o histórico do chamado para conferir as informações e respostas da equipe.'},
]};
window.MACRO={body:'Olá!\n\nRecebemos sua solicitação. Para continuar a análise, descreva o que ocorreu e o resultado que você esperava.\n\nEsta é uma prévia fictícia de resposta para teste da interface.',sent:false};
window.GRANT={id:'private-package-id',expiresAt:'2026-10-13T13:00:00.000000Z',objectCount:3,token:'PRIVATE_FIXTURE_TOKEN',url:'https://private.invalid/PRIVATE_FIXTURE_URL'};
window.LINK={state:'awaiting_human_validation',raw:'PRIVATE_EXTRA'};
function result(value){
 if(MODE==='delay')return new Promise((resolve,reject)=>{DEFERRED=()=>resolve(value);window.REJECT=()=>reject(Error('PRIVATE_REMOTE_EXCEPTION'));});
 if(MODE==='error')throw Error('PRIVATE_REMOTE_EXCEPTION');
 return Promise.resolve(value);
}
window.OPEN=()=>{CALLS.push({op:'open'});return result();};
window.REQUEST=id=>{CALLS.push({op:'package',id});return result();};
window.VOTE=(input,key)=>{CALLS.push({op:'vote',input:structuredClone(input),key});const receipt={rating:MODE==='wrong-score'?1:input.rating,attribution:MODE==='wrong-attribution'?'unqualified':'invitation_possession'};input.comment='MUTATED_BY_TEST_CALLBACK';return result(receipt);};
window.setup=kind=>{
 window.P?.dispose();CALLS=[];MODE='ok';NOW=Date.parse('2026-10-13T12:00:00.000Z');DEFERRED=null;
 if(kind==='knowledge')window.P=Support.renderKnowledge(R,KNOWLEDGE,OPEN);
 if(kind==='macro')window.P=Support.renderMacroPreview(R,MACRO);
 if(kind==='package')window.P=Support.renderPackage(R,GRANT,REQUEST,{now:()=>NOW});
 if(kind==='external')window.P=Support.renderExternalWork(R,LINK);
 if(kind==='csat')window.P=Support.mountCsat(R,VOTE,()=>crypto.randomUUID());
};
window.READY=true;
