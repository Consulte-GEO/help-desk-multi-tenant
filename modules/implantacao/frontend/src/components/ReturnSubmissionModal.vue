<template>
  <!--
    v5.22.12: padrão modal-portal definitivo.
    <Teleport to="body"> garante render como filho direto do body —
    não importa onde o componente esteja no template parent, vai
    pra fora de qualquer hierarquia que possa interferir.
  -->
  <Teleport to="body">
    <div
      v-if="open"
      class="modal-portal open"
      data-testid="return-submission-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="return-modal-title"
    >
      <div class="modal-portal__backdrop" @click="onCancel"></div>
      <div class="modal-portal__content">
        <header class="modal-header">
          <div class="kicker" style="color: var(--danger-fg)">
            Devolver para o responsável
          </div>
          <h2 id="return-modal-title" class="card-title" style="margin-top: 4px">
            Comentário obrigatório
          </h2>
        </header>

        <div class="modal-body">
          <p style="margin: 0 0 12px">
            Escreva o que precisa ser corrigido. O responsável receberá um
            email automático com o texto abaixo e poderá editar o cadastro
            pelo link enviado.
          </p>

          <div class="field">
            <label for="returnReviewer">Seu nome (revisor)</label>
            <input
              id="returnReviewer"
              class="input"
              type="text"
              :value="reviewer"
              placeholder="Exemplo: Thiago Costa"
              @input="$emit('update-reviewer', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="field">
            <label for="returnReason">Motivo da devolução</label>
            <textarea
              id="returnReason"
              class="textarea"
              rows="5"
              minlength="20"
              maxlength="2000"
              v-model="reasonDraft"
              placeholder="Exemplo: O FCK informado nos pavimentos 1° ao 5° (30 MPa) não bate com o que aparece no projeto (FCK 35). Confirme com o projetista e ajuste antes de reenviar."
              :disabled="loading"
            ></textarea>
            <div class="hint">
              {{ reasonDraft.length }}/2000 caracteres ·
              <span :class="tooShort ? 'text-danger' : ''">
                mínimo 20 caracteres
              </span>
            </div>
          </div>

          <div v-if="error" class="alert danger">
            <span>{{ error }}</span>
          </div>
        </div>

        <footer class="modal-footer">
          <button
            type="button"
            class="btn"
            :disabled="loading"
            @click="onCancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn danger"
            :disabled="loading || tooShort"
            @click="onConfirm"
          >
            {{ loading ? 'Devolvendo...' : 'Devolver e enviar email' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
// v5.22.27 — acessibilidade dos modais centralizada
import { setupModalA11y, type ModalA11yController } from '../composables/useModalA11y';

export default defineComponent({
  name: 'ReturnSubmissionModal',
  props: {
    open: { type: Boolean, default: false },
    reviewer: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
  },
  emits: ['cancel', 'confirm', 'update-reviewer'],
  data() {
    return {
      reasonDraft: '',
      // v5.22.27
      a11y: null as ModalA11yController | null,
    };
  },
  computed: {
    tooShort(): boolean {
      return this.reasonDraft.trim().length < 20;
    },
  },
  watch: {
    /**
     * v5.22.23 → v5.22.27 — Reset do rascunho quando abre + ativa
     * focus trap + ESC. A v5.22.23 removeu o `nextTick + ta?.focus()`
     * porque o ref do textarea ficava undefined no instante errado
     * (Teleport + DOM async), gerando erro silencioso que escondia o
     * modal. O `setupModalA11y` agora foca via querySelector dentro
     * do container, que é mais resiliente: não depende de ref nem do
     * timing exato do mount.
     *
     * Se o bug "Devolver para responsável não funciona" estava
     * relacionado a esse focus manual, esta versão deve mitigá-lo.
     */
    open(v: boolean) {
      if (v) {
        this.reasonDraft = '';
        this.a11y?.activate();
      } else {
        this.a11y?.deactivate();
      }
    },
  },
  mounted() {
    this.a11y = setupModalA11y({
      containerSelector: '[data-testid="return-submission-modal"]',
      onEscape: () => this.onCancel(),
    });
    if (this.open) this.a11y.activate();
  },
  beforeUnmount() {
    this.a11y?.deactivate();
    this.a11y = null;
  },
  methods: {
    onCancel() {
      if (!this.loading) this.$emit('cancel');
    },
    onConfirm() {
      const body = this.reasonDraft.trim();
      if (body.length < 20) return;
      this.$emit('confirm', { body });
    },
  },
});
</script>

<style scoped>
.text-danger { color: var(--danger-fg); }
</style>
