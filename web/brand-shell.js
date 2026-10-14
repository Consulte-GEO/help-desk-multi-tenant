import { getBrandProfile, themePreference, THEME_STORAGE_KEY } from './brand-profile.js';

const mounted = new WeakMap();
const shapes = Object.freeze({
  ticket: [['path',{d:'M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4Z'}],['path',{d:'M14 7v2m0 3v2m0 3v1'}]],
  message: [['path',{d:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z'}]],
  history: [['path',{d:'M3 11a9 9 0 1 1 2.6 7M3 4v7h7m2-4v5l3 2'}]],
  check: [['circle',{cx:'12',cy:'12',r:'9'}],['path',{d:'m8 12 3 3 5-6'}]],
  clock: [['circle',{cx:'12',cy:'12',r:'9'}],['path',{d:'M12 7v5l3 2'}]],
  info: [['circle',{cx:'12',cy:'12',r:'9'}],['path',{d:'M12 11v6m0-10v.1'}]],
  refresh: [['path',{d:'M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5m-4 9a8 8 0 0 0 14 2l3-3m0 5v-5h-5'}]],
  shield: [['path',{d:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z'}],['path',{d:'m8 12 3 3 5-6'}]],
  close: [['path',{d:'m6 6 12 12M6 18 18 6'}]],
  plus: [['path',{d:'M12 5v14M5 12h14'}]],
  menu: [['path',{d:'M4 6h16M4 12h16M4 18h16'}]],
});

function element(doc, tag, className, text) {
  const node=doc.createElement(tag);
  if(className) node.className=className;
  if(text!==undefined) node.textContent=text;
  return node;
}
function icon(doc, name, extra='') {
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:`hd-icon ${extra}`.trim()})) svg.setAttribute(key,value);
  for(const [tag,attrs] of shapes[name] || shapes.ticket) {
    const child=doc.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [key,value] of Object.entries(attrs)) child.setAttribute(key,value);
    svg.append(child);
  }
  return svg;
}
function logo(doc, brand, variant='auto') {
  const group=element(doc,'span','hd-logo-group');
  if(!brand.logoColor) { group.append(element(doc,'span','hd-logo-fallback','HD')); return group; }
  const add=(path,className)=>{
    const img=element(doc,'img',`hd-logo ${className}`.trim());
    img.src=path; img.alt=brand.name; img.width=777; img.height=457; img.decoding='async';
    // A failed logo does not leave an unlabeled access screen.
    img.addEventListener('error',()=>{img.alt=brand.name;}, {once:true});
    group.append(img);
  };
  if(variant==='white') add(brand.logoWhite,'');
  else { add(brand.logoColor,'hd-brand-light'); add(brand.logoWhite,'hd-brand-dark'); }
  return group;
}
function themeControl(doc, id) {
  const previous=doc.getElementById(id);
  if(previous) return previous.closest('label');
  const label=element(doc,'label','hd-theme-control');
  label.append(element(doc,'span','', 'Tema'));
  const select=element(doc,'select'); select.id=id; select.setAttribute('aria-label','Tema da interface');
  for(const [value,title] of [['auto','Automático'],['light','Claro'],['dark','Escuro']]) {
    const option=element(doc,'option','',title); option.value=value; select.append(option);
  }
  label.append(select); return label;
}
function skipLink(doc, id, target, text, signal) {
  let link=doc.getElementById(id);
  if(!link) { link=element(doc,'a','hd-skip',text); link.id=id; link.href=`#${target.id}`; }
  // Avoid changing a fragment which may be reserved for private access navigation.
  link.addEventListener('click',event=>{event.preventDefault();target.focus({preventScroll:false});},{signal});
  return link;
}
function decorateFields(doc) {
  for(const control of doc.querySelectorAll('input,select,textarea')) {
    const label=control.labels?.[0];
    if(!label || label.querySelector('.sr-only')) continue;
    const text=[];
    for(const child of label.childNodes) {
      if(child===control) break;
      if(child.nodeType===3) text.push(child.textContent);
      else if(child.nodeType===1 && !child.classList.contains('hd-required')) text.push(child.textContent);
    }
    const name=text.join(' ').replace(/\s+/g,' ').trim();
    if(control.tagName==='SELECT' && name && !control.hasAttribute('aria-label') && !control.hasAttribute('aria-labelledby')) control.setAttribute('aria-label',name);
    if(control.required && !label.querySelector('.hd-required')) {
      const mark=element(doc,'span','hd-required','*'); mark.setAttribute('aria-hidden','true'); mark.title='Campo obrigatório';
      // A label may be external (for=...) rather than wrapping its control.
      if(control.parentNode===label) label.insertBefore(mark,control);
      else label.append(mark);
    }
  }
}

/** Mounts presentation only; never changes existing business-control availability. */
export function mountBrandShell(doc=document) {
  if(mounted.has(doc)) return mounted.get(doc);
  const win=doc.defaultView;
  if(!win || !doc.body) return {dispose(){}};
  const abort=new win.AbortController(); const {signal}=abort;
  const brand=getBrandProfile(doc.documentElement.getAttribute('data-brand'));
  doc.documentElement.setAttribute('data-brand',brand.id);
  doc.title=brand.title;
  const controls=[];
  function applyTheme(value,persist=false) {
    const choice=themePreference(value);
    doc.documentElement.setAttribute('data-theme',choice);
    for(const control of controls) control.value=choice;
    if(persist) { try { win.localStorage.setItem(THEME_STORAGE_KEY,choice); } catch { /* Preference only; no blocking UI. */ } }
  }
  function bindTheme(label) {
    const control=label.querySelector('select'); controls.push(control);
    control.addEventListener('change',()=>applyTheme(control.value,true),{signal});
  }
  const login=doc.getElementById('login-screen');
  const card=login?.querySelector('.login-card');
  if(login && card) {
    const brandMark=card.querySelector('.brand-mark');
    if(brandMark) brandMark.replaceChildren(logo(doc,brand));
    let tools=card.querySelector('.hd-login-tools');
    if(!tools) { tools=element(doc,'div','hd-login-tools'); if(brandMark) tools.append(brandMark); card.prepend(tools); }
    const theme=themeControl(doc,'hd-theme-login'); tools.append(theme); bindTheme(theme);
    const eyebrow=card.querySelector('.eyebrow'); if(eyebrow) eyebrow.textContent=brand.eyebrow;
    if(!doc.getElementById('hd-login-story')) {
      const story=element(doc,'aside','hd-login-story'); story.id='hd-login-story'; story.setAttribute('aria-label','Apresentação da central');
      story.append(logo(doc,brand,'white'));
      const intro=element(doc,'div'); intro.append(element(doc,'p','eyebrow',brand.product),element(doc,'h2','',brand.intro),element(doc,'p','',brand.description));
      const features=element(doc,'ul','hd-login-features');
      for(const [name,title] of [['ticket','Solicitações com contexto'],['message','Conversas organizadas'],['history','Histórico do atendimento']]) {
        const row=element(doc,'li'); row.append(icon(doc,name),element(doc,'span','',title)); features.append(row);
      }
      intro.append(features); story.append(intro,element(doc,'p','hd-story-note','Disponibilidade conforme contrato, permissões e liberação da sua operação.'));
      login.insertBefore(story,card);
    }
    login.classList.add('hd-login-enhanced');
    const email=doc.getElementById('email');
    if(email) login.prepend(skipLink(doc,'hd-skip-login',email,'Ir para o formulário de acesso',signal));
  }
  const app=doc.getElementById('app'); const sidebar=app?.querySelector('.sidebar');
  let closeNavigation=()=>{}; const observers=[];
  if(app) {
    const main=app.querySelector('main');
    if(main) { if(!main.id) main.id='hd-main-content'; main.tabIndex=-1; app.prepend(skipLink(doc,'hd-skip-main',main,'Ir para o conteúdo',signal)); }
    const identity=app.querySelector('.identity');
    if(identity) { const theme=themeControl(doc,'hd-theme-app'); identity.prepend(theme); bindTheme(theme); }
  }
  if(sidebar) {
    const brandLink=sidebar.querySelector('.brand');
    if(brandLink) {
      const caption=element(doc,'span','',brand.product); caption.append(element(doc,'small','',brand.name));
      brandLink.replaceChildren(logo(doc,brand,'white'),caption); brandLink.setAttribute('aria-label',`${brand.name} · ${brand.product}`);
    }
    let panel=doc.getElementById('hd-nav-panel'); let toggle=doc.getElementById('hd-nav-toggle');
    if(!panel) {
      panel=element(doc,'div','hd-sidebar-body'); panel.id='hd-nav-panel';
      const heading=element(doc,'div','hd-sidebar-heading');
      const original=Array.from(sidebar.children);
      if(brandLink) heading.append(brandLink);
      toggle=element(doc,'button','icon-button'); toggle.id='hd-nav-toggle'; toggle.type='button'; toggle.setAttribute('aria-label','Abrir menu de navegação'); toggle.setAttribute('aria-controls',panel.id);
      toggle.append(icon(doc,'menu')); heading.append(toggle);
      for(const node of original) if(node!==brandLink) panel.append(node);
      sidebar.append(heading,panel);
    }
    const mobile=win.matchMedia('(max-width: 900px)'); let expanded=false;
    const updateNavigation=()=>{
      const closed=mobile.matches&&!expanded;
      // Only this newly introduced disclosure container is hidden or made inert.
      panel.hidden=closed; panel.inert=closed;
      toggle.setAttribute('aria-expanded',String(!closed));
      toggle.setAttribute('aria-label',closed?'Abrir menu de navegação':'Fechar menu de navegação');
    };
    closeNavigation=(returnFocus=false)=>{
      expanded=false; updateNavigation();
      if(returnFocus && mobile.matches && !app.hidden) toggle.focus();
    };
    toggle.addEventListener('click',()=>{expanded=!expanded;updateNavigation();},{signal});
    sidebar.addEventListener('keydown',event=>{
      if(event.key==='Escape' && mobile.matches && expanded) { event.preventDefault(); closeNavigation(true); }
    },{signal});
    mobile.addEventListener('change',()=>{expanded=false;updateNavigation();},{signal});
    const navigation=sidebar.querySelector('nav');
    if(navigation) {
      if(!navigation.hasAttribute('aria-label')) navigation.setAttribute('aria-label','Navegação principal');
      const syncCurrent=()=>{
        for(const button of navigation.querySelectorAll('button[data-view]')) {
          if(button.classList.contains('active')) button.setAttribute('aria-current','page');
          else button.removeAttribute('aria-current');
        }
      };
      navigation.addEventListener('click',event=>{
        const button=event.target.closest?.('button[data-view]');
        if(!button || button.disabled) return;
        win.queueMicrotask(()=>{
          syncCurrent();
          if(mobile.matches) {
            closeNavigation();
            const view=doc.getElementById(`${button.getAttribute('data-view')}-view`);
            const heading=view?.querySelector('h1,h2');
            if(view && !view.hidden && heading) { heading.tabIndex=-1; heading.focus({preventScroll:true}); heading.scrollIntoView({block:'start'}); }
          }
        });
      },{signal});
      const navObserver=new win.MutationObserver(syncCurrent);
      navObserver.observe(navigation,{attributes:true,attributeFilter:['class'],subtree:true}); observers.push(navObserver); syncCurrent();
    }
    const appObserver=new win.MutationObserver(()=>{if(app.hidden) closeNavigation();});
    appObserver.observe(app,{attributes:true,attributeFilter:['hidden']}); observers.push(appObserver); updateNavigation();
  }
  for(const [selector,name] of [['[data-view="tickets"]>span[aria-hidden]','ticket'],['[data-view="guide"]>span[aria-hidden]','info'],['.empty-icon','message'],['.contract-strip>span[aria-hidden]','shield'],['#refresh','refresh'],['#close-dialog','close']]) {
    const target=doc.querySelector(selector); if(target) target.replaceChildren(icon(doc,name));
  }
  const newTicket=doc.getElementById('new-ticket');
  if(newTicket && !newTicket.querySelector('.hd-icon')) {
    for(const node of newTicket.childNodes) if(node.nodeType===3) node.textContent=node.textContent.replace(/^[＋+]\s*/,'');
    newTicket.prepend(icon(doc,'plus'));
  }
  for(const [i,article] of Array.from(doc.querySelectorAll('.stats article')).entries()) {
    if(!article.querySelector('.hd-stat-icon')) article.append(icon(doc,['ticket','message','clock','check'][i]||'ticket','hd-stat-icon'));
  }
  decorateFields(doc);
  applyTheme(doc.documentElement.getAttribute('data-theme'));
  win.addEventListener('storage',event=>{if(event.key===THEME_STORAGE_KEY) applyTheme(event.newValue);},{signal});
  const controller={dispose(){abort.abort();for(const observer of observers) observer.disconnect();mounted.delete(doc);}};
  mounted.set(doc,controller); return controller;
}
if(typeof document!=='undefined') {
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>mountBrandShell(document),{once:true});
  else mountBrandShell(document);
}
