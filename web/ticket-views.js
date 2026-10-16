import {createTicketListState} from './ticket-list-state.js';
const views=[
 {id:'all',label:'Todos',filters:{}},
 {id:'waiting',label:'Aguardando resposta',filters:{status:'waiting_for_you'}},
 {id:'resolved',label:'Resolvidos',filters:{status:'resolved'}},
 {id:'mine',label:'Meus atendimentos',filters:{assignment:'mine'},team:true},
 {id:'unassigned',label:'Sem responsável',filters:{assignment:'unassigned'},team:true}
];
const validated=filters=>{const state=createTicketListState();state.reset(filters);return state.filters();};
/** Advisory presentation only. All reads retain server account/work authorization. */
export function availableTicketViews(person){
 if(!person||!['human','integration'].includes(person.kind)||!Array.isArray(person.scopes)||!person.scopes.includes('tickets:read'))return [];
 const team=person.kind==='human'&&(person.workspace_role==='admin'||Array.isArray(person.grants)&&person.grants.some(g=>g?.role==='agent'));
 return views.filter(v=>!v.team||team).map(({id,label})=>({id,label}));
}
export function applyTicketView(raw,id,person){
 if(!availableTicketViews(person).some(v=>v.id===id))throw Error('Consulta rápida indisponível para esta sessão.');
 const current=validated(raw),preset=views.find(v=>v.id===id);
 return {...(current.q?{q:current.q}:{}),...(current.priority?{priority:current.priority}:{}),...preset.filters};
}
export function activeTicketView(raw,person){
 const current=validated(raw);
 return availableTicketViews(person).find(({id})=>{const preset=views.find(v=>v.id===id);return current.status===preset.filters.status&&current.assignment===preset.filters.assignment;})?.id??null;
}
export function mountTicketViews(doc,onSelect){
 const group=doc.getElementById('ticket-views'),help=doc.getElementById('ticket-views-help'),status=doc.getElementById('ticket-view-status');
 if(!group||!help||!status)throw Error('Consultas rápidas indisponíveis.');
 let allowed=new Set(),busy=false,available=false;
 return Object.freeze({update(person,filters,loading,ready){
  const options=availableTicketViews(person),ids=options.map(v=>v.id),active=activeTicketView(filters,person);
  busy=loading===true;available=ready===true;allowed=new Set(ids);
  // Preserve button nodes and keyboard focus during reads and total updates.
  if(Array.from(group.children).map(n=>n.dataset.ticketView).join(',')!==ids.join(',')){
   group.replaceChildren(...options.map(v=>{const button=doc.createElement('button');button.type='button';button.className='secondary';button.dataset.ticketView=v.id;button.textContent=v.label;
    button.addEventListener('click',()=>{if(!busy&&available&&allowed.has(v.id)&&group.contains(button))onSelect(v.id);});return button;}));
  }
  group.hidden=help.hidden=status.hidden=!options.length||!available;
  for(const button of group.children){button.disabled=!available;button.setAttribute('aria-pressed',String(button.dataset.ticketView===active));button.setAttribute('aria-disabled',String(busy||!available));}
  const text=options.length?(active?'Consulta rápida: '+options.find(v=>v.id===active).label+'.':'Consulta personalizada: situação e responsabilidade combinadas manualmente.'):'';
  if(status.textContent!==text)status.textContent=text;
 }});
}
