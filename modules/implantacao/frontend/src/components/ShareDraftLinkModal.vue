<template>
  <!--
    v5.22.26 — Modal "Enviar link por email".

    Padrão visual idêntico ao ReturnSubmissionModal:
      - Teleport to="body" (renderiza fora de qualquer hierarquia)
      - modal-portal + modal-portal__backdrop + modal-portal__content
      - .field para cada campo
      - .alert.danger para erros / .alert.success para feedback
      - Footer com botões "Cancelar" + "Enviar email"

    Reusa zero CSS novo. Tudo via classes do design-system existentes.
  -->
  <Teleport to="body">
    <div
      v-if="open"
      class="modal-portal open"
      data-testid="share-draft-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div class="modal-portal__backdrop" @click="onCancel"></div>
      <div class="modal-portal__content">
        <header class="modal-header">
          <div class="kicker" style="color: var(--brand-fg)">
            Compartilhar rascunho
          </div>
          <h2 id="share-modal-title" class="card-title" style="margin-top: 4px">
            Enviar link por email
          </h2>
        </header>

        <div class="modal-body">
          <p style="margin: 0 0 12px">
            O destinatário receberá um email com o botão "Abrir
            cadastro" apontando para este rascunho. Ele pode continuar
            de onde você parou, em qualquer máquina.
          </p>

          <div class="field">
            <label for="shareRecipientEmail">
              Email do destinatário <span aria-hidden="true">*</span>
            </label>
            <input
              id="shareRecipientEmail"
              class="input"
              type="email"
              v-model="recipientEmail"
              placeholder="Exemplo: engenheiro@construtora.com.br"
              :disabled="state === 'sending'"
              autocomplete="off"
              required
            />
          </div>

          <div class="field">
            <label for="shareRecipientName">Nome do destinatário (opcional)</label>
            <input
              id="shareRecipientName"
              class="input"
              type="text"
              v-model="recipientName"
              placeholder="Exemplo: João Silva"
              :disabled="state === 'sending'"
              maxlength="200"
              autocomplete="off"
            />
          </div>

          <div class="field">
            <label for="shareSenderName">Seu nome (opcional)</label>
            <input
              id="shareSenderName"
              class="input"
              type="text"
              v-model="senderName"
              placeholder="Exemplo: Thiago Costa"
              :disabled="state === 'sending'"
              maxlength="200"
              autocomplete="off"
            />
            <div class="hint">
              Aparece no email como "{nome} compartilhou um cadastro
              com você".
            </div>
          </div>

          <div class="field">
            <label for="shareMessage">Mensagem (opcional)</label>
            <textarea
              id="shareMessage"
              class="textarea"
              rows="3"
              v-model="message"
              placeholder="Exemplo: Já preenchi os dados básicos e os blocos. Pode completar as peças do Bloco A?"
              :disabled="state === 'sending'"
              maxlength="2000"
            ></textarea>
            <div class="hint">
              {{ message.length }}/2000 caracteres
            </div>
          </div>

          <div v-if="errorMsg" class="alert danger" style="margin-top: 12px">
            <span>{{ errorMsg }}</span>
          </div>

          <div v-if="state === 'success'" class="alert info" style="margin-top: 12px">
            <strong>✓ Email enviado para {{ sentTo }}.</strong>
            <span>O modal fecha automaticamente em 2s.</span>
          </div>
        </div>

        <footer class="modal-footer">
          <button
            type="button"
            class="btn"
            :disabled="state === 'sending'"
            @click="onCancel"
          >
            {{ state === 'success' ? 'Fechar' : 'Cancelar' }}
          </button>
          <button
            type="button"
            class="btn brand"
            :disabled="!canSubmit || state === 'sending' || state === 'success'"
            @click="onSubmit"
          >
            {{ submitButtonLabel }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
// v5.22.27 — acessibilidade dos modais centralizada
import { setupModalA11y, type ModalA11yController } from '../composables/useModalA11y';

type ModalState = 'idle' | 'sending' | 'success' | 'error';

export default defineComponent({
  name: 'ShareDraftLinkModal',
  props: {
    /** Controla visibilidade. Modal só aparece se true. */
    open: { type: Boolean, required: true },
    /**
     * draftId do rascunho a compartilhar. Vem do estado do SetupPage.
     * Passa para o handler de submit via emit. Aceita null para o
     * caso em que o modal está fechado e o draft ainda não nasceu.
     */
    draftId: { type: String as PropType<string | null>, default: null },
    /**
     * Sugestão de senderName — pré-preenche o campo. Em geral vem do
     * `metadata.createdBy.nome`.
     */
    suggestedSenderName: { type: String, default: '' },
  },
  emits: ['close', 'submit'],
  data() {
    return {
      recipientEmail: '',
      recipientName: '',
      senderName: '',
      message: '',
      state: 'idle' as ModalState,
      errorMsg: '',
      sentTo: '',
      autoCloseTimer: null as ReturnType<typeof setTimeout> | null,
      // v5.22.27 — controller de acessibilidade
      a11y: null as ModalA11yController | null,
    };
  },
  computed: {
    canSubmit(): boolean {
      const email = this.recipientEmail.trim();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !!this.draftId;
    },
    submitButtonLabel(): string {
      if (this.state === 'sending') return 'Enviando...';
      if (this.state === 'success') return '✓ Enviado';
      return 'Enviar email';
    },
  },
  watch: {
    /**
     * Quando o modal abre, reseta estado e pré-preenche sender.
     * Quando fecha, garante limpeza do timer.
     * v5.22.27 — também ativa/desativa o focus trap + ESC.
     */
    open: {
      immediate: true,
      handler(newVal: boolean, oldVal: boolean) {
        if (newVal && !oldVal) {
          // abriu
          this.recipientEmail = '';
          this.recipientName = '';
          this.senderName = this.suggestedSenderName || '';
          this.message = '';
          this.state = 'idle';
          this.errorMsg = '';
          this.sentTo = '';
          this.a11y?.activate();
        }
        if (!newVal && oldVal) {
          // fechou (não no immediate inicial)
          this.a11y?.deactivate();
        }
        if (!newVal && this.autoCloseTimer) {
          clearTimeout(this.autoCloseTimer);
          this.autoCloseTimer = null;
        }
      },
    },
  },
  mounted() {
    // v5.22.27 — instancia o controller uma vez. activate/deactivate
    // são chamados no watch do `open`.
    this.a11y = setupModalA11y({
      containerSelector: '[data-testid="share-draft-modal"]',
      onEscape: () => this.onCancel(),
    });
    // Se o modal já está aberto no mount (cenário raro mas possível
    // se v-if for falsy → truthy antes do mount terminar), ativa
    // agora pois o watch com immediate não pega esse caso.
    if (this.open) this.a11y.activate();
  },
  beforeUnmount() {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
    this.a11y?.deactivate();
    this.a11y = null;
  },
  methods: {
    onCancel() {
      if (this.state === 'sending') return;
      this.$emit('close');
    },
    /**
     * Aciona o submit. Não chama a Edge Function diretamente — emite
     * para o SetupPage que orquestra o service. Mantém o modal
     * agnóstico ao caminho de rede.
     *
     * Espera receber um Promise<ShareDraftLinkResponse> de volta via
     * resolveSend / failSend (chamadas pelo parent).
     */
    onSubmit() {
      if (!this.canSubmit) return;
      this.state = 'sending';
      this.errorMsg = '';
      this.$emit('submit', {
        recipientEmail: this.recipientEmail.trim(),
        recipientName: this.recipientName.trim() || undefined,
        senderName: this.senderName.trim() || undefined,
        message: this.message.trim() || undefined,
      });
    },
    /**
     * Chamado pelo parent quando a Edge Function devolve sucesso.
     */
    resolveSend(payload: { sentTo: string }) {
      this.state = 'success';
      this.sentTo = payload.sentTo;
      // Auto-close em 2s (consistente com feedback de copy do botão)
      if (this.autoCloseTimer) clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = setTimeout(() => {
        this.$emit('close');
        this.autoCloseTimer = null;
      }, 2000);
    },
    /**
     * Chamado pelo parent quando a Edge Function devolve erro.
     */
    failSend(errorMessage: string) {
      this.state = 'error';
      this.errorMsg = errorMessage || 'Erro desconhecido ao enviar email.';
    },
  },
});
</script>
