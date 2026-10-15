<template><details v-if="help" class="step-help"><summary>{{help.help_title||'Material de apoio desta etapa'}}</summary><p>{{help.help_description}}</p><a v-if="help.youtube_url" :href="help.youtube_url" target="_blank" rel="noopener noreferrer">Assistir vídeo de orientação</a><div class="implementation-images"><img v-for="(url,i) in images" :key="url" :src="url" :alt="'Imagem de orientação '+(i+1)"/></div></details></template>
<script setup lang="ts">
import {ref,watch,onBeforeUnmount} from 'vue';
import {getStepHelp,resolveImageUrls,STEP_KEY_BY_ID,type StepHelp} from '../services/stepHelpService';
const props=defineProps<{stepId:number}>(),help=ref<StepHelp|null>(null),images=ref<string[]>([]);let generation=0;
watch(()=>props.stepId,async id=>{const current=++generation;help.value=null;images.value=[];try{const h=await getStepHelp(STEP_KEY_BY_ID[id]);const urls=h?await resolveImageUrls(h.image_paths):[];if(generation!==current)return;help.value=h;images.value=urls;}catch{}},{immediate:true});onBeforeUnmount(()=>{generation++;});
</script>
