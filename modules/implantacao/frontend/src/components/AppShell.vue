<template>
  <div class="app-shell" :data-theme="theme">
    <SidebarNav
      :current-step="currentStep"
      :steps="steps"
      @navigate="onNavigate"
    />

    <main class="main">
      <header class="topbar">
        <div class="page-title">
          <div class="kicker">Implantação de estrutura</div>
          <h1>{{ pageTitle }}</h1>
        </div>

        <div class="top-actions">
          <!-- v5.22.8: agrupamento visual — ações primárias da etapa
               ficam em "primary cluster"; utilitárias (tema, limpar)
               em "utility cluster", separadas por divisor vertical. -->
          <div class="actions-cluster actions-cluster--primary">
            <span class="save-state">{{ saveState }}</span>
            <!-- Slot usado pelas etapas que têm CTAs próprios (ex: Etapa 8
                 = "Exportar Excel" + "Enviar para validação"). -->
            <slot name="top-actions-extra" />
          </div>

          <span class="actions-divider" aria-hidden="true"></span>

          <div class="actions-cluster actions-cluster--utility">
            <!-- v5.22.13: botão de carregar exemplo só nas Etapas 1 e 2
                 (Dados básicos e Blocos e torres). Quem chega na Etapa 3
                 (Concretos) já passou da decisão de começar do zero vs
                 exemplo.
                 v5.22.47: existe UM modelo de preenchimento (o completo,
                 com projetista) — então existe UM botão de exemplo, sem
                 citar nome de modelo na interface. O emit continua
                 'load-example-projetista' porque o exemplo carregado é o
                 completo. -->
            <template v-if="currentStep <= 2">
              <button
                type="button"
                class="btn sm brand"
                @click="$emit('load-example-projetista')"
              >
                Carregar exemplo completo
              </button>
            </template>

            <button
              type="button"
              class="btn sm"
              @click="$emit('toggle-theme')"
            >
              {{ theme === 'dark' ? 'Modo claro' : 'Modo escuro' }}
            </button>
            <button
              type="button"
              class="btn sm danger"
              @click="onResetClick"
            >
              Limpar
            </button>
          </div>
        </div>
      </header>

      <section class="content">
        <slot />
      </section>

      <WizardFooter
        :current-step="currentStep"
        :loading="loading"
        @back="$emit('back')"
        @save="$emit('save')"
        @next="$emit('next')"
      />
    </main>

    <slot name="overlays" />
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import SidebarNav from './SidebarNav.vue';
import WizardFooter from './WizardFooter.vue';
import type { WizardStep } from '../models/setup.models';

export default defineComponent({
  name: 'AppShell',
  components: { SidebarNav, WizardFooter },
  props: {
    currentStep: { type: Number, required: true },
    pageTitle: { type: String, required: true },
    steps: { type: Array as PropType<readonly WizardStep[] | WizardStep[]>, required: true },
    theme: { type: String as PropType<'light' | 'dark'>, default: 'light' },
    saveState: { type: String, default: 'Rascunho salvo' },
    loading: { type: Boolean, default: false },
  },
  emits: [
    'navigate',
    // v5.22.47: o emit do exemplo simplificado foi removido junto com o
    // segundo botão (modelo único). Views que escutavam o evento antigo
    // tiveram o listener removido.
    'load-example-projetista',
    'toggle-theme',
    'reset',
    'back',
    'save',
    'next',
  ],
  methods: {
    onNavigate(stepId: number) {
      this.$emit('navigate', stepId);
    },
    onResetClick() {
      this.$emit('reset');
    },
  },
});
</script>
