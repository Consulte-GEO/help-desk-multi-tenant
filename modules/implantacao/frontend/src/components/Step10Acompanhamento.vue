<template>
  <div>
    <div class="kicker">Etapa 9 de 9 · Equipe Consulte GEO</div>
    <h2 style="margin: 4px 0 4px">Acompanhamento</h2>
    <p class="card-description">
      Histórico de mensagens trocadas com o responsável e auditoria do
      chamado. Mensagens marcadas como "interno" não aparecem para o
      cliente.
    </p>

    <!-- Histórico de mensagens -->
    <div class="card" style="margin-top: 16px">
      <div class="card-header">
        <div>
          <h3 class="card-title">Mensagens</h3>
          <p class="card-description">
            {{ comments.length }} mensagem(ns) registrada(s).
          </p>
        </div>
      </div>
      <div class="card-body grid">
        <div v-if="comments.length === 0" class="empty" style="padding: 16px">
          Nenhuma mensagem ainda. Use o formulário abaixo para escrever
          a primeira nota.
        </div>

        <div
          v-for="c in comments"
          :key="c.id"
          class="comment"
          :class="{ 'comment--internal': c.internal_only }"
        >
          <div class="comment-meta">
            <strong>{{ c.author || '(sem nome)' }}</strong>
            <span
              v-if="c.author_role === 'cliente'"
              class="badge info"
              style="margin-left: 8px; font-size: 10px"
            >Cliente</span>
            <span
              v-if="c.internal_only"
              class="badge warning"
              style="margin-left: 8px; font-size: 10px"
              title="Não visível para o cliente"
            >Interno</span>
            · {{ formatDateBR(c.created_at) }}
          </div>
          <div class="comment-body">{{ c.body }}</div>
        </div>

        <div class="divider"></div>

        <div class="field">
          <label for="newCommentAuthor">Seu nome (revisor)</label>
          <input
            id="newCommentAuthor"
            class="input"
            type="text"
            :value="reviewer"
            placeholder="Exemplo: Thiago Costa"
            @input="$emit('update-reviewer', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field">
          <label for="newCommentBody">Novo comentário</label>
          <textarea
            id="newCommentBody"
            class="textarea"
            rows="3"
            maxlength="2000"
            v-model="bodyDraft"
            placeholder="Anote uma observação, dúvida, ou status interno."
            :disabled="loading"
          ></textarea>
          <div class="hint">{{ bodyDraft.length }}/2000 caracteres</div>
        </div>
        <div class="field">
          <label class="checkbox" style="display: flex; gap: 8px; align-items: center; cursor: pointer">
            <input type="checkbox" v-model="internalDraft" :disabled="loading" />
            <span>Comentário interno (não aparece para o cliente)</span>
          </label>
        </div>
        <div v-if="feedback" class="alert" :class="feedbackClass">
          <span>{{ feedback }}</span>
        </div>
        <div class="toolbar">
          <button
            type="button"
            class="btn brand"
            :disabled="loading || !bodyDraft.trim()"
            @click="onAdd"
          >
            {{ loading ? 'Adicionando...' : 'Adicionar comentário' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Auditoria -->
    <div class="card" style="margin-top: 16px">
      <div class="card-header">
        <div>
          <h3 class="card-title">Auditoria do chamado</h3>
          <p class="card-description">
            Eventos automáticos: criação, envio de emails, mudanças de
            status, devolução, aprovação. Registros imutáveis.
          </p>
        </div>
      </div>
      <div class="card-body">
        <div v-if="auditEvents.length === 0" class="empty" style="padding: 16px">
          Sem eventos de auditoria ainda.
        </div>
        <div class="table-wrap">
          <table v-if="auditEvents.length > 0">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ator</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(a, i) in auditEvents" :key="i">
                <td class="mono">{{ formatDateBR(a.created_at) }}</td>
                <td>{{ a.actor }}</td>
                <td>{{ a.action }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ReviewComment } from '../models/setup.models';

interface AuditRow {
  created_at: string;
  actor: string;
  action: string;
}

export default defineComponent({
  name: 'Step10Acompanhamento',
  props: {
    comments: { type: Array as PropType<ReviewComment[]>, required: true },
    reviewer: { type: String, default: '' },
    auditEvents: { type: Array as PropType<AuditRow[]>, default: () => [] },
    loading: { type: Boolean, default: false },
    feedback: { type: String, default: '' },
    feedbackClass: { type: String, default: 'info' },
  },
  emits: ['update-reviewer', 'add-comment'],
  data() {
    return {
      bodyDraft: '',
      internalDraft: false,
    };
  },
  methods: {
    onAdd() {
      const body = this.bodyDraft.trim();
      if (!body) return;
      this.$emit('add-comment', { body, internalOnly: this.internalDraft });
      // Limpa só o body — internalDraft fica como estava (sticky preferência)
      this.bodyDraft = '';
    },
    formatDateBR(iso: string): string {
      try { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
      catch { return iso; }
    },
  },
});
</script>

<style scoped>
.mono { font-family: var(--font-mono); font-size: 12px; }
</style>
