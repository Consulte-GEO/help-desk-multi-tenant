/** Local presentation of the authorized public-message page set, never a reader.
 * No notes, network, persistence, logging, DOM text replacement or HTML parsing. */
export function createMessageSearchState(){
 let owner='',items=[],query='',ids=[],currentId=null,error=null,hasMore=false;
 const view=()=>({enabled:!!owner,query,ids:ids.slice(),currentId,position:currentId===null?0:ids.indexOf(currentId)+1,loaded:items.length,hasMore,error});
 function recalculate(){
  ids=query&&!error?items.filter(m=>m.body.toLowerCase().includes(query.toLowerCase())).map(m=>m.id):[];
  if(!ids.includes(currentId))currentId=ids[0]??null;
  return view();
 }
 return {
  update(identity,messages=[],more=false){
   if(identity!==owner||!identity){query='';currentId=null;error=null;}
   owner=identity;items=owner?messages.map(m=>({id:m.id,body:m.body})):[];hasMore=!!owner&&more===true;
   return recalculate();
  },
  search(value){
   query=owner?value.trim():'';currentId=null;error=null;
   if(query&&(value.length>120||Array.from(query).length<2||/[\p{Cc}\p{Cs}]/u.test(value)))error='Use de 2 a 120 caracteres, sem quebras de linha.';
   return recalculate();
  },
  move(direction){if(ids.length){const offset=direction<0?-1:1;currentId=ids[(ids.indexOf(currentId)+offset+ids.length)%ids.length];}return view();},view
 };
}

export function mountMessageSearch({root,input,status,previous,next,clear,container}){
 const state=createMessageSearchState();
 function paint(view,focus=false){
  root.hidden=!view.enabled;
  input.disabled=!view.enabled;input.setAttribute('aria-invalid',String(!!view.error));
  previous.disabled=next.disabled=view.ids.length===0;clear.disabled=!input.value;
  const coverage=view.loaded+' mensagem(ns) pública(s) carregada(s).'+(view.hasMore?' Carregue mensagens anteriores para ampliar a busca.':'');
  status.textContent=view.error??(view.query?(view.ids.length?view.position+' de '+view.ids.length+' mensagens encontradas. ':'Nenhuma mensagem encontrada. ')+coverage:coverage+' A busca considera somente o texto dessas mensagens.');
  const matched=new Set(view.ids);let selected=null;
  for(const article of container.children){
   const id=article.dataset.messageId,active=!!id&&id===view.currentId;
   article.classList.toggle('message-search-match',!!id&&matched.has(id));article.classList.toggle('message-search-current',active);
   if(active){article.setAttribute('aria-current','true');selected=article;}else article.removeAttribute('aria-current');
  }
  if(focus&&selected){selected.focus({preventScroll:true});selected.scrollIntoView({block:'nearest',behavior:'instant'});}
 }
 const search=()=>paint(state.search(input.value));
 const reset=()=>{input.value='';paint(state.search(''));input.focus();};
 const move=direction=>paint(state.move(direction),true);
 input.addEventListener('input',event=>{if(!event.isComposing)search();});
 input.addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(event.key==='Enter'){event.preventDefault();move(event.shiftKey?-1:1);}
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();reset();}
 });
 previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));clear.addEventListener('click',reset);
 return {
  update(identity,messages,hasMore){const view=state.update(identity,messages,hasMore);input.value=view.query;paint(view);},
  reset(){input.value='';paint(state.update(''));}
 };
}
