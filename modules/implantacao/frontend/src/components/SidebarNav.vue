<template>
  <aside class="sidebar" aria-label="Etapas do cadastro">
    <div class="brand">
      <div class="brand-mark">
        <img
          :src="logoWhite"
          :srcset="`${logoWhite} 1x, ${logoWhite2x} 2x, ${logoWhite4x} 4x`"
          alt="Consulte GEO"
        />
      </div>
      <div>
        <div class="brand-title">Consulte GEO</div>
        <div class="brand-subtitle">Concreto</div>
      </div>
    </div>

    <div class="nav-title">Cadastro da obra</div>

    <div class="step-nav">
      <button
        v-for="step in steps"
        :key="step.id"
        type="button"
        class="step-link"
        :class="{
          active: currentStep === step.id,
          done: currentStep > step.id,
        }"
        :aria-current="currentStep === step.id ? 'step' : undefined"
        @click="$emit('navigate', step.id)"
      >
        <span class="step-index" aria-hidden="true">
          <svg
            v-if="currentStep > step.id"
            viewBox="0 0 12 12"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 6.5 L5 9 L10 3" />
          </svg>
          <template v-else>{{ step.id }}</template>
        </span>
        <span class="step-label">
          <strong>{{ step.title }}</strong>
          <span>{{ step.subtitle }}</span>
        </span>
      </button>
    </div>

    <div class="side-card">
      <strong>Rascunho seguro</strong>
      <p>
        As alterações ficam salvas neste navegador. O envio para validação
        só acontece na última etapa.
      </p>
    </div>
  </aside>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import logoWhite from '../assets/logo-mark-white.png';
import logoWhite2x from '../assets/logo-mark-white@2x.png';
import logoWhite4x from '../assets/logo-mark-white@4x.png';
import type { WizardStep } from '../models/setup.models';

export default defineComponent({
  name: 'SidebarNav',
  props: {
    currentStep: { type: Number, required: true },
    steps: { type: Array as PropType<readonly WizardStep[] | WizardStep[]>, required: true },
  },
  emits: ['navigate'],
  data() {
    return { logoWhite, logoWhite2x, logoWhite4x };
  },
});
</script>
