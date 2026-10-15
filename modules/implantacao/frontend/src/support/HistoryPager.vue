<template><div v-if="pager?.more||message" class="implementation-history-pager"><button v-if="pager?.more" class="btn sm" type="button" :disabled="busy" @click="older">{{busy?'Consultando…':'Carregar '+noun+' anteriores'}}</button><p v-if="message" role="status">{{message}}</p></div></template>
<script setup lang="ts">
import {computed,ref,toRaw,onBeforeUnmount} from 'vue';import {pageOf} from './paging';
const props=withDefaults(defineProps<{rows:any[];noun?:string}>(),{noun:'registros'}),revision=ref(0),busy=ref(false),message=ref('');let closed=false;
const pager=computed(()=>{revision.value;return pageOf(toRaw(props.rows));});
async function older(){const current=pager.value;if(!current?.more||!current.cursor||busy.value)return;busy.value=true;message.value='';try{const page=await current.next(current.cursor);if(closed)return;const ids=new Set(props.rows.map(r=>r.id)),added=page.rows.filter(r=>!ids.has(r.id));if(current.direction==='prepend')props.rows.unshift(...added);else props.rows.push(...added);current.more=page.more;current.cursor=page.cursor;revision.value++;}catch(e){if(!closed)message.value=(e as Error).message;}finally{if(!closed)busy.value=false;}}
onBeforeUnmount(()=>{closed=true;});
</script>
