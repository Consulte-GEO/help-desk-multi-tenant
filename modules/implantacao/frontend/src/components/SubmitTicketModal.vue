<template>
  <!--
    v5.22.12: padrão modal-portal definitivo.
    <Teleport to="body"> garante render como filho direto do body.
    .modal-portal usa flex centralizado + position:fixed inset:0,
    sem depender de "containing block" (não usa top/left/transform).
    z-index 9999 fica acima de TUDO. Funciona em qualquer hierarquia.
  -->
  <Teleport to="body">
    <div
      v-if="ticket"
      class="modal-portal open"
      data-testid="submit-ticket-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-ticket-title"
    >
      <div class="modal-portal__backdrop" @click="onClose"></div>
      <div class="modal-portal__content" ref="modalRoot" tabindex="-1">
        <header class="modal-header">
          <div class="kicker" style="color: var(--success-fg)">
            Proposta enviada
          </div>
          <h2 id="submit-ticket-title" class="card-title" style="margin-top: 4px">
            {{ ticket.email_error ? 'Recebido — verifique o e-mail' : 'Recebido com sucesso' }}
          </h2>
        </header>

        <div class="modal-body">
          <div class="ticket-number-block">
            <div class="kicker">Número do chamado</div>
            <div class="ticket-number">{{ ticket.ticket_number }}</div>
          </div>

          <p style="margin: 0 0 12px">
            A equipe Consulte GEO foi notificada e iniciará a validação em breve.
          </p>

          <div v-if="emailSentToVisible.length" class="hint">
            <strong>Notificação enviada a:</strong>
            <ul style="margin: 4px 0 0; padding-left: 20px">
              <li v-for="e in emailSentToVisible" :key="e">{{ e }}</li>
            </ul>
          </div>

          <div v-if="emailCcVisible.length" class="hint" style="margin-top: 8px">
            <strong>Cópia para você:</strong>
            <ul style="margin: 4px 0 0; padding-left: 20px">
              <li v-for="e in emailCcVisible" :key="e">{{ e }}</li>
            </ul>
          </div>

          <div v-if="ticket.email_error" class="alert warning" style="margin-top: 12px">
            <strong>O e-mail de confirmação não foi enviado.</strong>
            <span>O chamado foi gravado com sucesso. Detalhe técnico: {{ ticket.email_error }}</span>
          </div>
        </div>

        <footer class="modal-footer">
          <button
            type="button"
            class="btn"
            @click="onCopy"
            :title="copied ? 'Copiado!' : 'Copiar número'"
          >
            {{ copied ? '✓ Copiado' : 'Copiar número' }}
          </button>
          <button
            type="button"
            class="btn brand"
            @click="onClose"
            ref="closeBtn"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { TicketSubmissionResponse } from '../models/setup.models';
// v5.22.27 — acessibilidade dos modais centralizada
import { setupModalA11y, type ModalA11yController } from '../composables/useModalA11y';

export default defineComponent({
  name: 'SubmitTicketModal',
  props: {
    ticket: {
      type: Object as PropType<TicketSubmissionResponse | null>,
      default: null,
    },
  },
  emits: ['close'],
  data() {
    return {
      copied: false,
      copyResetTimer: null as ReturnType<typeof setTimeout> | null,
      // v5.22.27
      a11y: null as ModalA11yController | null,
    };
  },
  computed: {
    emailSentToVisible(): string[] {
      return this.ticket?.email_sent_to ?? [];
    },
    emailCcVisible(): string[] {
      return this.ticket?.email_cc ?? [];
    },
    isOpen(): boolean {
      return !!this.ticket;
    },
  },
  watch: {
    /**
     * v5.22.12 → v5.22.27: ao abrir/fechar, ativa/desativa a11y
     * (focus inicial, focus trap, ESC fecha, restaura foco anterior).
     * Antes era apenas focus manual no botão Fechar via nextTick.
     */
    isOpen(newVal: boolean) {
      if (newVal) {
        this.a11y?.activate();
      } else {
        this.a11y?.deactivate();
      }
    },
  },
  mounted() {
    this.a11y = setupModalA11y({
      containerSelector: '[data-testid="submit-ticket-modal"]',
      onEscape: () => this.onClose(),
    });
    if (this.isOpen) this.a11y.activate();
  },
  methods: {
    onClose() {
      this.$emit('close');
    },
    async onCopy() {
      if (!this.ticket) return;
      const text = this.ticket.ticket_number;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        this.copied = true;
        if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
        this.copyResetTimer = setTimeout(() => { this.copied = false; }, 2400);
      } catch {
        /* sem alerta; usuário ainda vê o número na tela */
      }
    },
  },
  beforeUnmount() {
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    this.a11y?.deactivate();
    this.a11y = null;
  },
});
</script>
