<template>
  <footer class="wizard-footer">
    <!-- v5.22.4: Voltar com classe nav-back (cor cinza-azulada discreta) -->
    <button
      type="button"
      class="btn nav-back"
      :disabled="currentStep === 1"
      @click="$emit('back')"
    >
      Voltar
    </button>
    <div class="toolbar">
      <!-- v5.22.4: Salvar rascunho com cor success (verde-acinzentado) -->
      <button
        type="button"
        class="btn success"
        :disabled="loading"
        @click="$emit('save')"
      >
        {{ loading ? 'Salvando...' : 'Salvar rascunho' }}
      </button>
      <!--
        v5.22.27 — Correção de renumeração. Antes da v5.22.11 o wizard
        tinha 8 etapas e este limite era `< 7` (oculta na 7=Fornecedores
        que tinha submit dedicado, oculta na 8=Revisão). Quando a v5.22.11
        reduziu para 7, o limite ficou `< 6` e travou Avançar nas etapas
        5 e 6 — usuário precisava usar a sidebar. Agora `< 7`: Avançar
        aparece em 1-6, oculta só na 7 (Revisão) que tem botão dedicado
        "Enviar para validação" no topo.
      -->
      <button
        v-if="currentStep < 7"
        type="button"
        class="btn primary"
        :disabled="loading"
        @click="$emit('next')"
      >
        Avançar
      </button>
      <!-- Etapa 7 (Revisão e envio) não mostra "Avançar" — o envio é
           via botão dedicado no topo da página. -->
    </div>
  </footer>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'WizardFooter',
  props: {
    currentStep: { type: Number, required: true },
    loading: { type: Boolean, default: false },
  },
  emits: ['back', 'save', 'next'],
});
</script>
