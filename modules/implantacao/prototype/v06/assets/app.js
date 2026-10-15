/* ============================================================================
 * Implantação Consulte GEO — protótipo (lógica de apresentação)
 * Sem framework. Portável para Vue 3 + Vuex (mesma estrutura de estado/ações).
 * ========================================================================== */

/* ── Estado ──────────────────────────────────────────────────────────────── */
const state = {
  obra: {},
  estruturas: [],
  pecas: [],
  step: 0,
  draftId: 'DRAFT-2026-014',
};
const TIPOS = ['Bloco','Torre','Contenção','Área Externa','Anexos','Apoio'];
const CLASSIF = ['Fundação','Estrutura','Contenção','Periferia','Acabamento'];

/* ── Normalizações (fiel ao contrato do projeto) ─────────────────────────── */
function normalizeFCK(raw){
  raw = (raw||'').toString();
  const m = raw.match(/(\d+(?:[.,]\d+)?)/);
  const value = m ? parseFloat(m[1].replace(',','.')) : null;
  return { raw, value, unit:'MPa', valid: value!=null && value>0 };
}
function normalizeVolume(raw){
  raw = (raw==null?'':raw).toString();
  const t = raw.trim();
  if(t===''){ return { raw, value:null, unit:'m³', status:'missing' }; }
  if(t==='-'||/^n\/?a$/i.test(t)){ return { raw, value:null, unit:'m³', status:'not_applicable' }; }
  let s = t.replace(/m³|m3|mc|\s/gi,'');                 // remove unidade e espaços
  if(s.indexOf(',')>-1) s = s.replace(/\./g,'').replace(',','.'); // pt-BR: ponto=milhar, vírgula=decimal
  const val = parseFloat(s);
  return { raw, value: isNaN(val)?null:val, unit:'m³', status: isNaN(val)?'missing':'valid' };
}
function normalizeNumero(raw){
  raw = (raw||'').toString().trim();
  let m = raw.match(/^(\d+)\s*(?:a|A|ao|até)\s*(\d+)$/);
  if(m){ const a=+m[1],b=+m[2],items=[];for(let i=a;i<=b;i++)items.push(String(i));return {raw,type:'range',items,display:`${a} ao ${b}`}; }
  if(/[,e]/.test(raw) && /\d/.test(raw)){
    const items = raw.split(/,|\se\s|\sE\s/).map(s=>s.trim()).filter(Boolean);
    if(items.every(x=>/^\d+$/.test(x))){
      const display = items.length>1 ? items.slice(0,-1).join(', ')+' e '+items[items.length-1] : items[0];
      return {raw,type:'list',items,display};
    }
  }
  if(/^\d+$/.test(raw)) return {raw,type:'single',items:[raw],display:raw};
  return {raw,type:'text',items:[raw||'—'],display:raw||'—'};
}
const fmt = (n)=> n==null?'—':n.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2});

/* ── Dados de exemplo (obra completa com projetista) ─────────────────────── */
function exampleData(){
  return {
    obra:{ nome:'Residencial Alameda das Palmeiras', codigo:'OBRA-2026-014', cliente:'Construtora Alfa',
      regional:'Sudeste', endereco:'Av. do Contorno, 3900', cep:'30110-000', municipio:'Belo Horizonte',
      uf:'MG', responsavel:'Eng. Marina Duarte', email:'marina.duarte@construtoraalfa.com.br', telefone:'(31) 90000-0000',
      obs:'Obra piloto para validação do fluxo de implantação.' },
    estruturas:[
      { tipo:'Torre', numero:'1 a 4', nomenclatura:'Torre {n}', projetista:'Calculiza Engenharia', classificacao:'Estrutura', regra:'Padrão vertical' },
      { tipo:'Bloco', numero:'1, 2 e 3', nomenclatura:'Bloco {n}', projetista:'Calculiza Engenharia', classificacao:'Estrutura', regra:'Padrão vertical' },
      { tipo:'Contenção', numero:'Perimetral', nomenclatura:'Contenção', projetista:'GeoFundações', classificacao:'Contenção', regra:'Muro de arrimo' },
      { tipo:'Área Externa', numero:'Única', nomenclatura:'Área Externa', projetista:'', classificacao:'Periferia', regra:'Piso e calçadas' },
    ],
    pecas:[
      { estrutura:'Torre {n}', peca:'Fundação', classificacao:'Fundação', fck:'FCK 30', volume:'42,5 m³', concreto:'Bombeável 30 MPa', overbreak:'5', flags:{croqui:true,forma:true,dashboard:true,unidade:false,legenda:true} },
      { estrutura:'Torre {n}', peca:'Térreo', classificacao:'Estrutura', fck:'30mpa', volume:'28,4', concreto:'Bombeável 30 MPa', overbreak:'5', flags:{croqui:true,forma:true,dashboard:true,unidade:true,legenda:true} },
      { estrutura:'Torre {n}', peca:'Pavimento tipo 1 a 20', classificacao:'Estrutura', fck:'FCK25', volume:'22,0 m³', concreto:'Convencional 25 MPa', overbreak:'4', flags:{croqui:false,forma:true,dashboard:true,unidade:true,legenda:false} },
      { estrutura:'Torre {n}', peca:'Cobertura', classificacao:'Estrutura', fck:'25 MPa', volume:'18', concreto:'Convencional 25 MPa', overbreak:'4', flags:{croqui:true,forma:true,dashboard:false,unidade:false,legenda:false} },
      { estrutura:'Bloco {n}', peca:'Radier', classificacao:'Fundação', fck:'FCK 30mpa', volume:'55,0 m³', concreto:'Bombeável 30 MPa', overbreak:'6', flags:{croqui:true,forma:true,dashboard:true,unidade:false,legenda:true} },
      { estrutura:'Contenção', peca:'Muro de arrimo', classificacao:'Contenção', fck:'FCK 20', volume:'-', concreto:'', overbreak:'8', flags:{croqui:true,forma:false,dashboard:true,unidade:false,legenda:true} },
      { estrutura:'Área Externa', peca:'Piso externo', classificacao:'Periferia', fck:'20', volume:'', concreto:'Convencional 20 MPa', overbreak:'', flags:{croqui:false,forma:false,dashboard:false,unidade:true,legenda:false} },
    ],
  };
}

/* ── Render tabelas editáveis ────────────────────────────────────────────── */
function opt(list, sel){ return list.map(x=>`<option ${x===sel?'selected':''}>${x}</option>`).join(''); }
function trashBtn(fn,i){ return `<button class="btn ghost icon sm" aria-label="Remover linha" onclick="${fn}(${i})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`; }

function renderEstruturas(){
  const b=document.getElementById('estruturasBody');
  b.innerHTML = state.estruturas.map((e,i)=>`<tr>
    <td><select class="row-select" onchange="upd('estruturas',${i},'tipo',this.value)">${opt(TIPOS,e.tipo)}</select></td>
    <td><input class="row-input" value="${e.numero||''}" onchange="upd('estruturas',${i},'numero',this.value)"></td>
    <td><input class="row-input" value="${e.nomenclatura||''}" onchange="upd('estruturas',${i},'nomenclatura',this.value)"></td>
    <td><input class="row-input" value="${e.projetista||''}" placeholder="(opcional)" onchange="upd('estruturas',${i},'projetista',this.value)"></td>
    <td><select class="row-select" onchange="upd('estruturas',${i},'classificacao',this.value)"><option value="">—</option>${opt(CLASSIF,e.classificacao)}</select></td>
    <td><input class="row-input" value="${e.regra||''}" onchange="upd('estruturas',${i},'regra',this.value)"></td>
    <td>${trashBtn('removeEstrutura',i)}</td></tr>`).join('') ||
    `<tr><td colspan="7"><div style="padding:24px;text-align:center;color:var(--fg-muted);font-size:13px">Nenhuma estrutura. Clique em <b>Adicionar linha</b> ou carregue o exemplo.</div></td></tr>`;
  document.getElementById('estCount').textContent = state.estruturas.length+' estrutura'+(state.estruturas.length===1?'':'s');
}
function estruturaOptions(sel){
  const names = state.estruturas.map(e=>e.nomenclatura).filter(Boolean);
  return `<option value="">—</option>`+names.map(n=>`<option ${n===sel?'selected':''}>${n}</option>`).join('');
}
function flagDots(f){
  const map=[['croqui','C'],['forma','F'],['dashboard','D'],['unidade','+'],['legenda','L']];
  return map.map(([k,l])=>`<span title="${k}" style="width:18px;height:18px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:var(--font-mono);background:${f&&f[k]?'var(--tone-brand-bg)':'var(--stone-100)'};color:${f&&f[k]?'var(--tone-brand-fg)':'var(--fg-subtle)'}">${l}</span>`).join(' ');
}
function renderPecas(){
  const b=document.getElementById('pecasBody');
  b.innerHTML = state.pecas.map((p,i)=>{
    const vol=normalizeVolume(p.volume); const fck=normalizeFCK(p.fck);
    const volTone = vol.status==='valid'?'':(vol.status==='missing'?'style="color:var(--warning-600)"':'style="color:var(--fg-subtle)"');
    return `<tr>
      <td><select class="row-select" onchange="upd('pecas',${i},'estrutura',this.value)">${estruturaOptions(p.estrutura)}</select></td>
      <td><input class="row-input" value="${p.peca||''}" onchange="upd('pecas',${i},'peca',this.value)"></td>
      <td><select class="row-select" onchange="upd('pecas',${i},'classificacao',this.value)"><option value="">—</option>${opt(CLASSIF,p.classificacao)}</select></td>
      <td><input class="row-input mono" value="${p.fck||''}" onchange="upd('pecas',${i},'fck',this.value)" title="${fck.valid?fck.value+' MPa':'inválido'}"></td>
      <td class="num"><input class="row-input mono" style="text-align:right" value="${p.volume||''}" ${volTone} onchange="upd('pecas',${i},'volume',this.value)"></td>
      <td><input class="row-input" value="${p.concreto||''}" placeholder="(opcional)" onchange="upd('pecas',${i},'concreto',this.value)"></td>
      <td class="num"><input class="row-input mono" style="text-align:right" value="${p.overbreak||''}" onchange="upd('pecas',${i},'overbreak',this.value)"></td>
      <td>${flagDots(p.flags)}</td>
      <td>${trashBtn('removePeca',i)}</td></tr>`;
  }).join('') ||
  `<tr><td colspan="9"><div style="padding:24px;text-align:center;color:var(--fg-muted);font-size:13px">Nenhuma peça. Clique em <b>Adicionar linha</b> ou carregue o exemplo.</div></td></tr>`;
  document.getElementById('pecaCount').textContent = state.pecas.length+' peça'+(state.pecas.length===1?'':'s');
}

/* ── Mutations ───────────────────────────────────────────────────────────── */
function upd(coll,i,k,v){ state[coll][i][k]=v; state.isDirty=true; }
function addEstrutura(){ state.estruturas.push({tipo:'Torre',numero:'',nomenclatura:'',projetista:'',classificacao:'',regra:''}); renderEstruturas(); }
function removeEstrutura(i){ state.estruturas.splice(i,1); renderEstruturas(); }
function addPeca(){ state.pecas.push({estrutura:'',peca:'',classificacao:'',fck:'',volume:'',concreto:'',overbreak:'',flags:{}}); renderPecas(); }
function removePeca(i){ state.pecas.splice(i,1); renderPecas(); }

function readObraForm(){
  state.obra = {
    nome:val('f_obra_nome'), codigo:val('f_obra_cod'), cliente:val('f_obra_cliente'), regional:val('f_obra_regional'),
    endereco:val('f_obra_end'), cep:val('f_obra_cep'), municipio:val('f_obra_mun'), uf:val('f_obra_uf'),
    responsavel:val('f_obra_resp'), email:val('f_obra_email'), telefone:val('f_obra_tel'), obs:val('f_obra_obs')
  };
}
const val=(id)=>document.getElementById(id)?document.getElementById(id).value:'';
function setVal(id,v){ const el=document.getElementById(id); if(el) el.value=v||''; }

function loadExample(){
  const d=exampleData();
  state.obra=d.obra; state.estruturas=d.estruturas.map(x=>({...x})); state.pecas=d.pecas.map(x=>({...x, flags:{...x.flags}}));
  setVal('f_obra_nome',d.obra.nome); setVal('f_obra_cod',d.obra.codigo); setVal('f_obra_cliente',d.obra.cliente);
  setVal('f_obra_regional',d.obra.regional); setVal('f_obra_end',d.obra.endereco); setVal('f_obra_cep',d.obra.cep);
  setVal('f_obra_mun',d.obra.municipio); setVal('f_obra_uf',d.obra.uf); setVal('f_obra_resp',d.obra.responsavel);
  setVal('f_obra_email',d.obra.email); setVal('f_obra_tel',d.obra.telefone); setVal('f_obra_obs',d.obra.obs);
  document.getElementById('sbObra').textContent=d.obra.nome; document.getElementById('sbCod').textContent=d.obra.codigo;
  renderEstruturas(); renderPecas();
  toast('Exemplo completo com projetista carregado.');
}

/* ── Stepper / navegação ─────────────────────────────────────────────────── */
function goStep(n){
  if(state.step===0) readObraForm();
  state.step=n;
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('hidden', +s.dataset.screen!==n));
  document.querySelectorAll('.step').forEach(s=>{ const i=+s.dataset.step; s.classList.toggle('active',i===n); s.classList.toggle('done',i<n); });
  document.getElementById('btnBack').style.visibility = n===0?'hidden':'visible';
  document.getElementById('btnNext').classList.toggle('hidden', n===5);
  document.getElementById('btnSubmit').classList.toggle('hidden', n!==5);
  if(n===3) renderPreview();
  if(n===4) runValidation();
  if(n===5){ buildJson(); renderMapping(); updateXlsxName(); }
  document.getElementById('main').scrollTop=0;
}
function nextStep(){ if(state.step<5) goStep(state.step+1); }
function prevStep(){ if(state.step>0) goStep(state.step-1); }

/* ── Prévia (render tree + stats) ────────────────────────────────────────── */
function renderPreview(){
  readObraForm();
  const est=state.estruturas, pec=state.pecas;
  // stats
  let volTotal=0, fcks=[];
  pec.forEach(p=>{ const v=normalizeVolume(p.volume); if(v.status==='valid') volTotal+=v.value; const f=normalizeFCK(p.fck); if(f.valid) fcks.push(f.value); });
  document.getElementById('stEst').textContent=est.length;
  document.getElementById('stPec').textContent=pec.length;
  document.getElementById('stVol').textContent=fmt(volTotal)+' m³';
  document.getElementById('stFck').textContent= fcks.length? `${Math.min(...fcks)}–${Math.max(...fcks)}`:'—';
  // tree
  let html=`<div class="tree-node tree-obra"><div class="tree-node__head">
    <span class="pill brand"><span class="dot"></span>Obra</span>
    <b>${state.obra.nome||'(sem nome)'}</b><span class="mono muted text-xs">${state.obra.codigo||''}</span>
    <span style="margin-left:auto" class="badge">${est.length} estruturas · ${pec.length} peças</span></div>
    <div class="tree-node__body">`;
  est.forEach(e=>{
    const num=normalizeNumero(e.numero);
    const linked=pec.filter(p=>p.estrutura===e.nomenclatura);
    html+=`<div class="tree-node"><div class="tree-node__head">
      <span class="pill neutral"><span class="dot"></span>${e.tipo}</span>
      <b>${e.nomenclatura||'(sem nomenclatura)'}</b>
      <span class="badge info">${num.display}</span>
      ${e.projetista?`<span class="text-xs muted">Projetista: ${e.projetista}</span>`:`<span class="text-xs" style="color:var(--warning-600)">Projetista em branco</span>`}
      <span style="margin-left:auto" class="badge">${linked.length} peças</span></div>
      <div class="tree-node__body">`;
    if(linked.length===0) html+=`<div class="alert warning"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/></svg><div>Estrutura sem peças cadastradas.</div></div>`;
    linked.forEach(p=>{
      const v=normalizeVolume(p.volume), f=normalizeFCK(p.fck);
      const volBadge = v.status==='valid'?`<b>${fmt(v.value)}</b> m³`: v.status==='not_applicable'?'<span class="muted">n/a</span>':'<span style="color:var(--warning-600)">volume ausente</span>';
      html+=`<div class="floor-card"><div class="top"><div class="fname">${p.peca||'(sem descrição)'}</div>
        <div class="row">${f.valid?`<span class="badge success">FCK ${f.value}</span>`:`<span class="badge danger">FCK inválido</span>`}
        <span class="pill neutral"><span class="dot"></span>${p.classificacao||'sem classificação'}</span></div></div>
        <div class="meta"><span>Volume: ${volBadge}</span><span>Concreto: <b style="font-family:inherit">${p.concreto||'—'}</b></span><span>Overbreak: <b>${p.overbreak||'0'}%</b></span></div></div>`;
    });
    html+=`</div></div>`;
  });
  html+=`</div></div>`;
  document.getElementById('previewTree').innerHTML=html;
}

/* ── Validação (regras obrigatórias) ─────────────────────────────────────── */
function runValidation(){
  readObraForm();
  const V=[]; const add=(sev,code,msg,path,fix)=>V.push({sev,code,msg,path,fix});
  const o=state.obra;
  if(!o.nome) add('error','OBRA_SEM_NOME','Obra sem nome.','obra.nome','Informe o nome da obra.');
  if(!o.codigo) add('error','OBRA_SEM_CODIGO','Obra sem código.','obra.codigo','Informe o código da obra.');
  if(state.estruturas.length===0) add('error','OBRA_SEM_ESTRUTURA','Obra sem nenhuma estrutura.','estruturas','Adicione ao menos uma estrutura.');

  const nomeMap={};
  state.estruturas.forEach((e,i)=>{
    if(!TIPOS.includes(e.tipo)) add('error','TIPO_FORA_LISTA',`Tipo de estrutura fora da lista permitida (linha ${i+1}).`,`estruturas[${i}].tipo`,'Use Bloco, Torre, Contenção, Área Externa, Anexos ou Apoio.');
    if(!e.nomenclatura) add('error','ESTRUTURA_SEM_NOME',`Estrutura sem nomenclatura (linha ${i+1}).`,`estruturas[${i}].nomenclatura`,'Informe a Nomenclatura no Sistema.');
    if(!e.classificacao) add('warning','CLASSIFICACAO_VAZIA',`Classificação vazia na estrutura ${e.nomenclatura||i+1}.`,`estruturas[${i}].classificacao`,'Selecione a classificação/etapa.');
    if(!e.projetista) add('info','PROJETISTA_BRANCO',`Projetista em branco (${e.nomenclatura||'linha '+(i+1)}).`,`estruturas[${i}].projetista`,'Projetista é opcional e não bloqueia o envio.');
    const linked=state.pecas.filter(p=>p.estrutura===e.nomenclatura);
    if(linked.length===0) add('warning','ESTRUTURA_SEM_PECAS',`Estrutura ${e.nomenclatura||i+1} sem peças.`,`estruturas[${i}]`,'Cadastre ao menos uma peça.');
  });

  const byName={};
  state.pecas.forEach((p,i)=>{
    if(!p.peca) add('error','PECA_SEM_DESC',`Peça sem descrição (linha ${i+1}).`,`pecas[${i}].peca`,'Descreva a peça/pavimento.');
    if(!p.estrutura) add('error','PECA_SEM_ESTRUTURA',`Peça sem estrutura vinculada (linha ${i+1}).`,`pecas[${i}].estrutura`,'Vincule a peça a uma estrutura.');
    const f=normalizeFCK(p.fck); if(!f.valid) add('error','FCK_INVALIDO',`FCK inválido em "${p.peca||'linha '+(i+1)}".`,`pecas[${i}].fck`,'Informe um FCK numérico, ex.: FCK 30.');
    const v=normalizeVolume(p.volume);
    if(v.status==='missing') add('warning','VOLUME_AUSENTE',`Volume ausente em "${p.peca||'linha '+(i+1)}".`,`pecas[${i}].volume`,'Informe o volume ou use "-" para não aplicável.');
    if(!p.concreto) add('warning','CONCRETO_VAZIO',`Concreto/produto indicado vazio em "${p.peca||'linha '+(i+1)}".`,`pecas[${i}].concreto`,'Indique o concreto/produto.');
    // agrupamento: mesmo nome com FCK/volume diferentes
    const key=(p.peca||'').toLowerCase().trim(); if(key){ (byName[key]=byName[key]||[]).push({...p,i,_f:f.value,_v:v.value}); }
  });
  Object.entries(byName).forEach(([k,arr])=>{
    if(arr.length>1){
      add('info','AGRUPAMENTO',`Agrupamento detectado: "${arr[0].peca}" aparece ${arr.length}×.`,'normalizedStructure','Verifique se devem ser agrupadas.');
      const fckSet=new Set(arr.map(x=>x._f)); const volSet=new Set(arr.map(x=>x._v));
      if(fckSet.size>1) add('warning','NOME_FCK_DIF',`"${arr[0].peca}" com mesmo nome e FCK diferente.`,'pecas','Confirme os valores de FCK.');
      if(volSet.size>1) add('warning','NOME_VOL_DIF',`"${arr[0].peca}" com mesmo nome e volume diferente.`,'pecas','Confirme os valores de volume.');
    }
  });

  // Render
  const counts={error:0,warning:0,info:0}; V.forEach(v=>counts[v.sev]++);
  document.getElementById('vErr').textContent=counts.error;
  document.getElementById('vWarn').textContent=counts.warning;
  document.getElementById('vInfo').textContent=counts.info;
  const icon={error:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    warning:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/>',
    info:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'};
  const order={error:0,warning:1,info:2};
  V.sort((a,b)=>order[a.sev]-order[b.sev]);
  const list=document.getElementById('valList');
  if(V.length===0){ list.innerHTML=`<div class="alert success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11.5 14.5 16 9.5"/></svg><div><div class="t">Tudo certo</div>Nenhum erro ou aviso. Pronto para submeter.</div></div>`; }
  else list.innerHTML=V.map(v=>`<div class="val-row ${v.sev}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon[v.sev]}</svg>
    <div class="vmsg"><div class="vt">${v.msg}</div><div class="vp">${v.code} · ${v.path}${v.fix?' — '+v.fix:''}</div></div>
    <span class="pill ${v.sev==='error'?'danger':v.sev==='warning'?'warning':'info'}"><span class="dot"></span>${v.sev==='error'?'Erro':v.sev==='warning'?'Aviso':'Info'}</span>
  </div>`).join('');
  state._validation={counts,items:V};
  // submit button reflects blocking
  const btn=document.getElementById('btnSubmit');
  if(btn){ btn.disabled = counts.error>0; btn.title = counts.error>0?'Corrija os erros para submeter':''; }
  return V;
}

/* ── JSON técnico (7 seções) ─────────────────────────────────────────────── */
function buildTechnicalJson(){
  readObraForm();
  const now='2026-07-24T14:30:00-03:00';
  const tmp=(p,n)=>`TMP-${p}-${String(n).padStart(3,'0')}`;
  // normalized structure
  const estN = state.estruturas.map((e,i)=>({ temporaryId:tmp('UGR',i+1), tipo:e.tipo, nomenclatura:e.nomenclatura,
    numero:normalizeNumero(e.numero), projetista:e.projetista||null, classificacao:e.classificacao||null, regra:e.regra||null }));
  const pecN = state.pecas.map((p,i)=>({ temporaryId:tmp('UTP',i+1), estrutura:p.estrutura, peca:p.peca,
    classificacao:p.classificacao||null, fck:normalizeFCK(p.fck), volume:normalizeVolume(p.volume),
    concreto:p.concreto||null, overbreak:p.overbreak?Number(p.overbreak):null, flags:p.flags||{} }));
  // distinct sets for mapping
  const projetistas=[...new Set(state.estruturas.map(e=>e.projetista).filter(Boolean))];
  const concretos=[...new Set(state.pecas.map(p=>p.concreto).filter(Boolean))];
  const classifs=[...new Set([...state.estruturas.map(e=>e.classificacao),...state.pecas.map(p=>p.classificacao)].filter(Boolean))];
  const fcks=[...new Set(state.pecas.map(p=>normalizeFCK(p.fck).value).filter(v=>v!=null))];
  const V=state._validation||{counts:{error:0,warning:0,info:0},items:[]};
  return {
    metadata:{ schemaVersion:'1.0.0', generatedAt:now, generatedBy:'prototype-web', source:'implantacao-consulte-geo',
      environment:'preview', tenantHint:'construtora-alfa', draftId:state.draftId, submissionId:null,
      projectName:'Implantação Consulte GEO', projectVersion:'v04' },
    customerInput:{ obra:state.obra, estruturas:state.estruturas, pecas:state.pecas },
    normalizedStructure:{ obra:{ nomeCanonico:state.obra.nome, codigo:state.obra.codigo },
      estruturas:estN, pecas:pecN,
      vinculos: estN.map(e=>({ estrutura:e.temporaryId, pecas: pecN.filter(p=>p.estrutura===e.nomenclatura).map(p=>p.temporaryId) })) },
    technicalMapping:{
      Ges_Obra:[{ temporaryId:tmp('OBRA',1), nome:state.obra.nome, codigo:state.obra.codigo }],
      Ges_UnidadeGrupo: estN.map(e=>({ temporaryId:e.temporaryId, descricao:e.nomenclatura, tipoRef:e.tipo })),
      Ges_UnidadeTipo: pecN.map(p=>({ temporaryId:p.temporaryId, descricao:p.peca })),
      Ges_Unidade: estN.flatMap(e=> e.numero.items.map((it,k)=>({ temporaryId:tmp('UN',`${e.temporaryId.slice(-3)}${k}`), grupoRef:e.temporaryId, rotulo:it }))),
      Ges_Classificacao: classifs.map((c,i)=>({ temporaryId:tmp('CLS',i+1), descricao:c })),
      Pro_Projetista: projetistas.map((p,i)=>({ temporaryId:tmp('PRJ',i+1), nome:p })),
      Utl_Produto: concretos.map((c,i)=>({ temporaryId:tmp('PRD',i+1), descricao:c })),
      Con_Concreto: concretos.map((c,i)=>({ temporaryId:tmp('CON',i+1), descricao:c })),
      CTe_PadraoMoldagem: fcks.map((f,i)=>({ temporaryId:tmp('MLD',i+1), fck:f, unidade:'MPa' })),
      CTe_TipoEnsaioProduto: fcks.map((f,i)=>({ temporaryId:tmp('ENS',i+1), fck:f, ensaio:'Compressão' })),
    },
    validation:{ counts:V.counts, items:V.items.map(v=>({ code:v.code, severity:v.sev, message:v.msg, path:v.path, entityTemporaryId:null, suggestedFix:v.fix })) },
    renderTree:{ obra:state.obra.nome, totais:{ estruturas:estN.length, pecas:pecN.length,
      volume: pecN.reduce((s,p)=>s+(p.volume.status==='valid'?p.volume.value:0),0) } },
    audit:[{ timestamp:now, actor:'thiago@consultegeo.com.br', action:'generate_json', entity:'draft', before:null, after:state.draftId, source:'prototype-web' }]
  };
}
let _json={};
function buildJson(){ _json=buildTechnicalJson(); document.getElementById('jsonView').innerHTML=highlightJson(_json); }
function highlightJson(obj){
  let s=JSON.stringify(obj,null,2);
  s=s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  s=s.replace(/"([^"]+)":/g,'<span class="k">"$1"</span>:');
  s=s.replace(/: "([^"]*)"/g,': <span class="s">"$1"</span>');
  s=s.replace(/: (\-?\d+\.?\d*)/g,': <span class="n">$1</span>');
  s=s.replace(/: (true|false|null)/g,': <span class="b">$1</span>');
  return s;
}

/* ── Mapeamento banco (tabela) ───────────────────────────────────────────── */
function renderMapping(){
  const j=buildTechnicalJson(); const m=j.technicalMapping;
  const rows=[
    ['Ges_Obra','Obra','TMP-OBRA-###',m.Ges_Obra.length],
    ['Ges_UnidadeGrupo','Estrutura','TMP-UGR-###',m.Ges_UnidadeGrupo.length],
    ['Ges_UnidadeTipo','Peça / Pavimento','TMP-UTP-###',m.Ges_UnidadeTipo.length],
    ['Ges_Unidade','Unidade expandida','TMP-UN-###',m.Ges_Unidade.length],
    ['Ges_Classificacao','Classificação / Etapa','TMP-CLS-###',m.Ges_Classificacao.length],
    ['Pro_Projetista','Projetista','TMP-PRJ-###',m.Pro_Projetista.length],
    ['Utl_Produto','Produto','TMP-PRD-###',m.Utl_Produto.length],
    ['Con_Concreto','Concreto','TMP-CON-###',m.Con_Concreto.length],
    ['CTe_PadraoMoldagem','Padrão de moldagem (FCK)','TMP-MLD-###',m.CTe_PadraoMoldagem.length],
    ['CTe_TipoEnsaioProduto','Tipo de ensaio','TMP-ENS-###',m.CTe_TipoEnsaioProduto.length],
  ];
  document.getElementById('mapBody').innerHTML=rows.map(r=>`<tr><td class="mono">${r[0]}</td><td>${r[1]}</td><td class="mono text-xs muted">${r[2]}</td><td class="num"><span class="badge">${r[3]}</span></td></tr>`).join('');
}

/* ── Exportação ──────────────────────────────────────────────────────────── */
function expTab(t,btn){
  ['json','excel','map'].forEach(x=>document.getElementById('exp_'+x).classList.toggle('hidden',x!==t));
  document.querySelectorAll('#expSeg button').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
}
function copyJson(){ navigator.clipboard.writeText(JSON.stringify(_json,null,2)).then(()=>toast('JSON técnico copiado.')); }
function downloadJson(){
  const blob=new Blob([JSON.stringify(_json,null,2)],{type:'application/json'});
  dl(blob, `implantacao-consulte-geo-${(state.obra.codigo||'obra')}.json`); toast('JSON exportado.');
}
function updateXlsxName(){ document.getElementById('xlsxName').textContent=`implantacao-consulte-geo-${(state.obra.codigo||'obra')}-20260724-1430.xlsx`; }
function exportExcel(){
  if(typeof XLSX==='undefined'){ toast('Carregando biblioteca xlsx…'); return; }
  const j=buildTechnicalJson(); const wb=XLSX.utils.book_new();
  const S=(name,aoa)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),name);
  S('Resumo',[['Campo','Valor'],['Obra',state.obra.nome||''],['Código',state.obra.codigo||''],['Cliente',state.obra.cliente||''],['Município/UF',(state.obra.municipio||'')+' / '+(state.obra.uf||'')],['Estruturas',state.estruturas.length],['Peças',state.pecas.length],['Erros',j.validation.counts.error],['Avisos',j.validation.counts.warning]]);
  S('Estruturas',[['Tipo','Número','Nomenclatura','Projetista','Classificação','Regra','TemporaryId'],...j.normalizedStructure.estruturas.map(e=>[e.tipo,e.numero.display,e.nomenclatura,e.projetista||'',e.classificacao||'',e.regra||'',e.temporaryId])]);
  S('Peças',[['Estrutura','Peça','Classificação','FCK (raw)','FCK','Volume (raw)','Volume','Status','Concreto','Overbreak %','TemporaryId'],...j.normalizedStructure.pecas.map(p=>[p.estrutura,p.peca,p.classificacao||'',p.fck.raw,p.fck.value,p.volume.raw,p.volume.value,p.volume.status,p.concreto||'',p.overbreak,p.temporaryId])]);
  S('Tipos Técnicos',[['Tabela','Descrição','TemporaryId'],...j.technicalMapping.Ges_UnidadeTipo.map(x=>['Ges_UnidadeTipo',x.descricao,x.temporaryId])]);
  S('Unidades Técnicas',[['Grupo','Rótulo','TemporaryId'],...j.technicalMapping.Ges_Unidade.map(x=>[x.grupoRef,x.rotulo,x.temporaryId])]);
  const mapRows=[]; Object.entries(j.technicalMapping).forEach(([t,arr])=>arr.forEach(x=>mapRows.push([t,x.temporaryId,x.descricao||x.nome||x.rotulo||x.fck||''])));
  S('Mapeamento Banco',[['Tabela','TemporaryId','Descrição'],...mapRows]);
  S('Validações',[['Severidade','Código','Mensagem','Path','Correção'],...j.validation.items.map(v=>[v.severity,v.code,v.message,v.path,v.suggestedFix])]);
  S('JSON Técnico',[['JSON'],[JSON.stringify(j)]]);
  XLSX.writeFile(wb,`implantacao-consulte-geo-${(state.obra.codigo||'obra')}-20260724-1430.xlsx`);
  toast('Planilha Excel exportada.');
}
function dl(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }

/* ── Ações gerais ────────────────────────────────────────────────────────── */
function saveDraft(){ readObraForm(); state.lastSavedAt='14:30'; toast('Rascunho salvo · '+state.draftId); }
function submitForValidation(){
  const V=runValidation();
  const errs=(state._validation&&state._validation.counts.error)||0;
  if(errs>0){ goStep(4); toast('Existem '+errs+' erro(s) que bloqueiam o envio.'); return; }
  toast('Submetido para validação da equipe Consulte GEO.');
}

/* ── Tema / densidade / toast ────────────────────────────────────────────── */
function toggleTheme(){
  const dark=document.documentElement.classList.toggle('dark');
  document.getElementById('themeIcon').innerHTML = dark
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
    : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
}
const densities=['comfortable','compact','spacious']; let di=0;
function cycleDensity(){ di=(di+1)%3; document.documentElement.dataset.density=densities[di]; toast('Densidade: '+densities[di]); }
let toastT;
function toast(msg){ const t=document.getElementById('toast'); document.getElementById('toastMsg').textContent=msg; t.style.display='block'; clearTimeout(toastT); toastT=setTimeout(()=>t.style.display='none',2600); }

/* ── Init ────────────────────────────────────────────────────────────────── */
document.documentElement.dataset.density='comfortable';
renderEstruturas(); renderPecas(); goStep(0);
