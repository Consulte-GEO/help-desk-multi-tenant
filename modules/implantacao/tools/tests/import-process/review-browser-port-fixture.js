// Deliberately not Vuex. This exercises Vue rendering plus the production binding/controller.
const state=Vue.reactive({setup:{preserved:true},validation:{preserved:true},export:{preserved:true}}),getters={},registered=new Map();
const calls=[];
const store={state,getters,hasModule:n=>registered.has(n),registerModule(n,m){registered.set(n,m);state[n]=m.state();for(const[k,g]of Object.entries(m.getters))Object.defineProperty(getters,n+'/'+k,{configurable:true,get:()=>g(state[n])});},unregisterModule(n){registered.delete(n);delete state[n];for(const k of Object.keys(getters))if(k.startsWith(n+'/'))delete getters[k];},commit(type,payload){const[n,k]=type.split('/');registered.get(n).mutations[k](state[n],payload);},dispatch(type,payload){const[n,k]=type.split('/');return Promise.resolve(registered.get(n).actions[k]({},payload));}};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),caseId=id(3);
const field=(raw,value,semanticRole='measured')=>({rawValue:raw,rawUnit:'MPa',value,unit:'MPa',presence:'present',provenance:'operator_corrected',semanticRole,locations:[]});
let stored={process:{caseId,workspaceId:id(1),accountId:id(2),workRef:null,status:'draft',version:1},currentRevision:{snapshot:{schemaVersion:'1',records:[{id:'CP-001',kind:'result',fields:{resistencia:field('32,4',32.4)},links:{}},{id:'CP-002',kind:'result',fields:{resistencia:field('<img src=x onerror="window.xss=true">',30)},links:{}}],artifactIds:[],findings:[],decisions:[]}},artifacts:[]};
let serial=100,binding,mode='normal',active=Vue.ref(false);
const clone=x=>JSON.parse(JSON.stringify(x));
const client={async getCase(){calls.push('GET');return clone(stored);},async saveRevision(c,command){calls.push('POST');if(mode==='conflict')throw new ProcessHttpError('VERSION_CONFLICT',412,'not_committed');if(mode==='unknown')throw new Error('SIMULATED_LOST_ACK');stored.process.version++;stored.currentRevision.snapshot=clone(command.snapshot);return {caseId:c,operationId:command.operationId,version:stored.process.version,revision:stored.process.version,hash:'b'.repeat(64),status:'draft',replayed:false};}};
const app=Vue.createApp({components:{Panel},setup(){return{active}},template:'<Panel ref="panel" :active="active" />'});
app.config.globalProperties.$store=store;const host=app.mount('#app');
window.fixture={
 store,calls,host,getState:()=>clone(state.importProcess),setMode:m=>{mode=m;},
 async activate(){binding=registerImportProcessSession({enabled:true,store,client,newId:()=>id(++serial)});await store.dispatch('importProcess/open',{caseId});active.value=true;await Vue.nextTick();},
 async deactivate(){active.value=false;binding.endSession();await Vue.nextTick();},
 async externalRevision(){stored.process.version++;stored.currentRevision.snapshot.findings.push({text:'Revisão de outra sessão'});},
 async makeCancelled(){stored.process.status='cancelled';await store.dispatch('importProcess/open',{caseId,discardChanges:true});},
};
