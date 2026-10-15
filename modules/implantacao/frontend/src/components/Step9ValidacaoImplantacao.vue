<template>
  <div>
    <div class="kicker">Etapa 8 de 9 · Equipe Consulte GEO</div>
    <h2 style="margin: 4px 0 4px">Validação para Implantação</h2>
    <p class="card-description">
      Confira o JSON técnico que será usado para implantar a obra no
      Consulte GEO. Se houver ajustes necessários, use "Devolver para o
      responsável" para enviar comentários e permitir a edição. Se tudo
      estiver correto, marque como Aprovado.
    </p>

    <div class="card" style="margin-top: 16px">
      <div class="card-header">
        <div>
          <h3 class="card-title">Decisão</h3>
          <p class="card-description">
            Status atual:
            <span class="badge" :class="statusBadgeClass">
              {{ statusLabel }}
            </span>
          </p>
        </div>
        <div class="toolbar">
          <button
            type="button"
            class="btn danger"
            :disabled="loading || isFinal"
            @click="$emit('open-return-modal')"
          >
            Devolver para o responsável
          </button>
          <button
            type="button"
            class="btn success"
            :disabled="loading || isFinal"
            @click="$emit('approve')"
          >
            Aprovar para implantação
          </button>
        </div>
      </div>
      <div class="card-body">
        <div v-if="isFinal" class="alert info">
          <strong>Decisão registrada.</strong>
          <span>
            Este chamado já foi marcado como
            <strong>{{ statusLabel.toLowerCase() }}</strong>.
            Use a Etapa 9 para acompanhar o histórico e a auditoria.
          </span>
        </div>
        <div v-else-if="status === 'devolvido'" class="alert warning">
          <strong>Devolvido ao responsável.</strong>
          <span>
            O cliente foi notificado por email e pode editar o cadastro
            pelo link enviado. Ao receber o reenvio, este chamado voltará
            para "Em validação".
          </span>
        </div>
        <div v-else class="alert info">
          <strong>Em validação pela equipe Consulte GEO.</strong>
          <span>
            Use os botões acima para aprovar ou devolver. A devolução
            dispara um email automático ao responsável com seus comentários.
          </span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 16px">
      <div class="card-header">
        <div>
          <h3 class="card-title">Protocolo e resumo técnico</h3>
        </div>
      </div>
      <div class="card-body grid grid-2">
        <div>
          <div class="kicker">Protocolo</div>
          <p style="margin: 4px 0 12px; font-family: var(--font-mono); font-size: 16px">
            <strong>{{ ticketNumber }}</strong>
          </p>
          <div class="kicker">Recebido em</div>
          <p style="margin: 4px 0 12px">{{ submittedAtBR }}</p>
        </div>
        <div>
          <div class="kicker">Obra</div>
          <p style="margin: 4px 0 12px"><strong>{{ obraNome }}</strong></p>
          <div v-if="obraCodigo" class="kicker">Código</div>
          <p v-if="obraCodigo" style="margin: 4px 0 12px">{{ obraCodigo }}</p>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 16px">
      <div class="card-header">
        <div>
          <h3 class="card-title">JSON técnico</h3>
          <p class="card-description">
            Payload completo que será processado para implantação.
          </p>
        </div>
        <div class="toolbar">
          <button type="button" class="btn" @click="onCopyJson">
            {{ jsonCopied ? '✓ Copiado' : 'Copiar JSON' }}
          </button>
          <button type="button" class="btn ghost" @click="showJson = !showJson">
            {{ showJson ? 'Esconder' : 'Mostrar' }}
          </button>
        </div>
      </div>
      <div v-if="showJson" class="card-body">
        <pre class="json">{{ jsonPretty }}</pre>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Step9ValidacaoImplantacao',
  props: {
    ticketNumber: { type: String, default: '' },
    obraNome: { type: String, default: '' },
    obraCodigo: { type: String, default: '' },
    submittedAt: { type: String, default: '' },
    status: { type: String, default: 'em_validacao' },
    loading: { type: Boolean, default: false },
    /** v5.22.6: technical_json bruto da submissão. */
    technicalJson: { type: Object, default: null },
  },
  emits: ['open-return-modal', 'approve'],
  data() {
    return {
      showJson: false,
      jsonCopied: false,
      copyTimer: null as ReturnType<typeof setTimeout> | null,
    };
  },
  computed: {
    submittedAtBR(): string {
      if (!this.submittedAt) return '';
      try {
        return new Date(this.submittedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      } catch { return this.submittedAt; }
    },
    isFinal(): boolean {
      return ['aprovado', 'implantado', 'cancelado'].includes(this.status);
    },
    statusLabel(): string {
      const m: Record<string, string> = {
        enviado: 'Recebido',
        em_validacao: 'Em validação',
        devolvido: 'Aguardando ajuste do cliente',
        aprovado: 'Aprovado',
        implantado: 'Implantado',
        cancelado: 'Cancelado',
      };
      return m[this.status] ?? this.status;
    },
    statusBadgeClass(): string {
      if (['aprovado', 'implantado'].includes(this.status)) return 'success';
      if (this.status === 'devolvido') return 'warning';
      if (this.status === 'cancelado') return 'danger';
      return 'info';
    },
    jsonPretty(): string {
      try { return JSON.stringify(this.technicalJson, null, 2); }
      catch { return '/* não foi possível formatar o JSON */'; }
    },
  },
  methods: {
    async onCopyJson() {
      try {
        await navigator.clipboard.writeText(this.jsonPretty);
        this.jsonCopied = true;
        if (this.copyTimer) clearTimeout(this.copyTimer);
        this.copyTimer = setTimeout(() => (this.jsonCopied = false), 2400);
      } catch { /* sem alerta */ }
    },
  },
  beforeUnmount() {
    if (this.copyTimer) clearTimeout(this.copyTimer);
  },
});
</script>

<style scoped>
.json {
  max-height: 480px;
  overflow: auto;
  font-size: 12px;
  background: var(--surface-raised);
  border-radius: var(--radius-md);
  padding: 12px;
}
</style>
