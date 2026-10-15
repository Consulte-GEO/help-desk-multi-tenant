<template>
  <main class="content import-process-page">
    <nav aria-label="Navegação do suporte"><router-link to="/admin">Voltar ao painel de gestão</router-link></nav>
    <p v-if="loading" role="status">Consultando seus processos autorizados…</p>
    <p v-if="message" class="alert warning" role="status">{{ message }}</p>
    <section v-if="!caseId && !loading" class="card card-body" aria-labelledby="saved-processes-title">
      <h1 id="saved-processes-title">Processos salvos</h1>
      <p v-if="!cases.length">Nenhum processo disponível para esta conta.</p>
      <ul v-else><li v-for="item in cases" :key="item.caseId"><router-link :to="'/admin/processos/'+item.caseId">{{ purpose(item.purpose) }} · {{ item.workRef || 'Nova obra' }} · revisão {{ item.version }}</router-link><span v-if="item.status==='cancelled'"> · Cancelado</span></li></ul>
      <p v-if="more">Exibindo os 100 processos mais recentes.</p>
    </section>
    <ImportProcessPanel v-if="caseId" ref="panel" :active="available && !loading" :initial-case-id="openedCaseId" />
  </main>
</template>
<script>
import ImportProcessPanel from '../components/ImportProcessPanel.vue';
import {startImportProcessHost} from '../services/importProcessSession';
export default {
  name:'ImportProcessView',components:{ImportProcessPanel},props:{caseId:{type:String,default:''}},
  data(){return {host:null,cases:[],more:false,loading:true,message:'',stopped:false,openedCaseId:this.caseId,generation:0};},
  computed:{available(){return !!this.$store.state.importProcess;}},
  async created(){
    const generation=++this.generation;
    try{
      const host=await startImportProcessHost(this.$store);
      if(this.stopped){host.dispose();return;}this.host=host;
      const listing=await host.list();if(this.stopped||generation!==this.generation)return;
      this.cases=listing.cases;this.more=listing.more;
      if(host.scopeCount===0)this.message='Seu acesso aos processos ainda precisa ser configurado pela equipe.';
      if(this.caseId)await host.open(this.caseId);
    }catch{if(!this.stopped&&generation===this.generation)this.message='Não foi possível consultar os processos. Confira sua sessão ou tente novamente mais tarde.';}
    finally{if(!this.stopped&&generation===this.generation)this.loading=false;}
  },
  beforeUnmount(){this.stopped=true;this.host?.dispose();},
  methods:{purpose(value){return {new_work:'Implantação',history:'Histórico',reports:'Laudos',reconciliation:'Conciliação'}[value]||'Processo';}},
  async beforeRouteLeave(){try{return (await this.$refs.panel?.requestExit()) !== false;}catch{return false;}},
  async beforeRouteUpdate(to,from){
    if(to.params.caseId === from.params.caseId)return true;
    if(this.loading&&!this.host)return false;
    try{
      if((await this.$refs.panel?.requestExit()) === false)return false;
      if(this.host && to.params.caseId){const generation=++this.generation;this.loading=true;this.openedCaseId=to.params.caseId;try{await this.host.open(to.params.caseId);return generation===this.generation;}finally{if(generation===this.generation)this.loading=false;}}
      return true;
    }catch{return false;}
  },
};
</script>
<style scoped>
.import-process-page { max-width: 100%; min-width: 0; }
nav { margin-bottom: var(--space-4, 1rem); }
</style>
