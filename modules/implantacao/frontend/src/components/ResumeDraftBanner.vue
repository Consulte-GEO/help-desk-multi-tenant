<template>
  <!--
    v5.22.19 — Banner "Continuar de onde parou"

    Reusa `.alert.info` como base de cor (par fg/bg já validado pelo
    smoke-contrast.ts) e sobrescreve só o layout para virar uma linha
    com texto à esquerda e botões à direita.

    Aparece UMA VEZ por sessão de página, quando o mounted() do SetupPage
    detecta um LastDraftPointer no localStorage. Depois que o usuário
    clica em Continuar ou Começar novo, some — não reaparece nesta sessão.
  -->
  <div class="alert info resume-draft-banner" role="status" aria-live="polite">
    <div class="resume-draft-banner__text">
      <strong>Você tem um rascunho salvo neste navegador</strong>
      <span>
        Obra: <em>{{ displayObraNome }}</em>
        <template v-if="relativeTime">· salvo {{ relativeTime }}</template>
      </span>
    </div>
    <div class="resume-draft-banner__actions">
      <button
        type="button"
        class="btn sm nav-back"
        :disabled="loading"
        @click="$emit('dismiss')"
      >
        Começar novo
      </button>
      <button
        type="button"
        class="btn sm primary"
        :disabled="loading"
        @click="$emit('resume')"
      >
        {{ loading ? 'Carregando...' : 'Continuar onde parei' }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ResumeDraftBanner',
  props: {
    obraNome: { type: String, default: '' },
    updatedAt: { type: String, default: '' },
    loading: { type: Boolean, default: false },
  },
  emits: ['resume', 'dismiss'],
  computed: {
    displayObraNome(): string {
      const n = (this.obraNome || '').trim();
      return n || '(sem nome)';
    },
    /**
     * Tempo relativo simples em pt-BR ("há 2 minutos", "há 3 horas",
     * "ontem", "há 5 dias"). Falha silenciosa se updatedAt for inválido.
     * Não usa Intl.RelativeTimeFormat por ainda termos suporte legado
     * no smoke-pipeline e pra ter controle total sobre as strings.
     */
    relativeTime(): string {
      if (!this.updatedAt) return '';
      const t = Date.parse(this.updatedAt);
      if (Number.isNaN(t)) return '';
      const diffMs = Date.now() - t;
      if (diffMs < 0) return 'agora';
      const sec = Math.floor(diffMs / 1000);
      if (sec < 60) return 'agora há pouco';
      const min = Math.floor(sec / 60);
      if (min < 60) return `há ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `há ${hr} ${hr === 1 ? 'hora' : 'horas'}`;
      const days = Math.floor(hr / 24);
      if (days === 1) return 'ontem';
      if (days < 30) return `há ${days} dias`;
      const months = Math.floor(days / 30);
      if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
      const years = Math.floor(months / 12);
      return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
    },
  },
});
</script>
