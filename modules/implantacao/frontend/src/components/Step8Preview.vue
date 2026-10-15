<template>
  <div>
    <div class="section-title">
      <div>
        <div class="kicker">Etapa 7 de {{ totalSteps }}</div>
        <h2>Revisão visual da estrutura</h2>
        <p>Confira a árvore e as pilhas de pavimentos. Clique em um item para editar.</p>
      </div>
    </div>

    <div class="grid grid-3" style="margin-bottom: 16px">
      <button
        type="button"
        class="validation-summary-button"
        :class="v.bloqueantes.length ? 'danger' : 'success'"
        :disabled="!v.bloqueantes.length"
        @click="onScrollTo('bloqueantes')"
        :title="v.bloqueantes.length ? 'Ver lista de erros bloqueantes' : 'Sem erros'"
      >
        <strong>{{ v.bloqueantes.length }}</strong>
        <span>erros que bloqueiam o envio</span>
        <small v-if="v.bloqueantes.length">Clique para ver →</small>
      </button>
      <button
        type="button"
        class="validation-summary-button"
        :class="v.alertas.length ? 'warning' : 'success'"
        :disabled="!v.alertas.length"
        @click="onScrollTo('alertas')"
        :title="v.alertas.length ? 'Ver lista de alertas' : 'Sem alertas'"
      >
        <strong>{{ v.alertas.length }}</strong>
        <span>alertas que permitem envio</span>
        <small v-if="v.alertas.length">Clique para ver →</small>
      </button>
      <button
        type="button"
        class="validation-summary-button"
        :class="v.sugestoes.length ? 'info' : 'success'"
        :disabled="!v.sugestoes.length"
        @click="onScrollTo('sugestoes')"
        :title="v.sugestoes.length ? 'Ver sugestões' : 'Sem sugestões'"
      >
        <strong>{{ v.sugestoes.length }}</strong>
        <span>sugestões de melhoria</span>
        <small v-if="v.sugestoes.length">Clique para ver →</small>
      </button>
    </div>

    <div class="preview-layout">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Árvore da obra</h3>
            <p class="card-description">Prévia hierárquica para validação.</p>
          </div>
        </div>
        <div class="card-body">
          <div v-if="!nodes.length" class="empty">Nada para visualizar.</div>
          <ul v-else class="tree">
            <li v-for="node in nodes" :key="node.id">
              <div class="node">
                <strong>{{ node.label }}</strong>
                <span class="badge neutral">{{ node.children.length }} itens</span>
              </div>
              <ul class="tree">
                <li v-for="child in node.children" :key="child.id">
                  <div class="node">
                    <button type="button" @click="$emit('edit-item', child.id)">
                      {{ child.label }}
                    </button>
                    <span class="badge" :class="badgeStatus(child.status)">
                      {{ labelStatus(child.status) }}
                    </span>
                    <span class="badge neutral">FCK {{ child.fck || '-' }}</span>
                    <span class="badge neutral">{{ brNumber(child.volume) }} m³</span>
                  </div>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Pilhas por bloco/torre</h3>
            <p class="card-description">Cores laterais indicam o FCK informado.</p>
          </div>
        </div>
        <div class="card-body">
          <div v-if="!nodes.length" class="empty">Nada para visualizar.</div>
          <div v-else class="stack-board">
            <div v-for="node in nodes" :key="node.id" class="tower-stack">
              <div class="tower-title">{{ node.label }}</div>
              <div
                v-for="child in stackOrder(node.children)"
                :key="child.id"
                class="floor-card"
                :class="`fck-${child.fck || ''}`"
                @click="$emit('edit-item', child.id)"
              >
                <strong>{{ child.label }}</strong>
                <br />
                <span>FCK {{ child.fck || '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="grid grid-3">
      <div ref="cardBloqueantes" class="card" :class="{ 'card-flash': flashTarget === 'bloqueantes' }">
        <div class="card-header">
          <div>
            <h3 class="card-title">Erros bloqueantes</h3>
          </div>
        </div>
        <div class="card-body validation-grid">
          <template v-if="v.bloqueantes.length">
            <div v-for="(i, idx) in v.bloqueantes" :key="idx" class="alert danger">
              <strong>{{ i.localizacao || i.campo || 'Item' }}</strong>
              <span>{{ i.message }}</span>
            </div>
          </template>
          <div v-else class="alert success">
            <strong>Nenhum item</strong>
            <span>Não há registros nesta categoria.</span>
          </div>
        </div>
      </div>

      <div ref="cardAlertas" class="card" :class="{ 'card-flash': flashTarget === 'alertas' }">
        <div class="card-header">
          <div>
            <h3 class="card-title">Alertas</h3>
          </div>
        </div>
        <div class="card-body validation-grid">
          <template v-if="v.alertas.length">
            <div v-for="(i, idx) in v.alertas" :key="idx" class="alert warning">
              <strong>{{ i.localizacao || i.campo || 'Item' }}</strong>
              <span>{{ i.message }}</span>
            </div>
          </template>
          <div v-else class="alert success">
            <strong>Nenhum item</strong>
            <span>Não há registros nesta categoria.</span>
          </div>
        </div>
      </div>

      <div ref="cardSugestoes" class="card" :class="{ 'card-flash': flashTarget === 'sugestoes' }">
        <div class="card-header">
          <div>
            <h3 class="card-title">Sugestões</h3>
          </div>
        </div>
        <div class="card-body validation-grid">
          <template v-if="v.sugestoes.length">
            <div v-for="(i, idx) in v.sugestoes" :key="idx" class="alert info">
              <strong>{{ i.localizacao || i.campo || 'Item' }}</strong>
              <span>{{ i.message }}</span>
            </div>
          </template>
          <div v-else class="alert success">
            <strong>Nenhum item</strong>
            <span>Não há registros nesta categoria.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- v5.20: Seção de envio para validação -->
    <div class="divider"></div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Envio para validação</h3>
          <p class="card-description">
            Use os botões no topo da página para exportar o Excel ou enviar
            o cadastro para validação da equipe Consulte GEO. Você receberá
            um número de chamado e uma cópia da confirmação no e-mail do
            responsável.
          </p>
        </div>
      </div>
      <div class="card-body grid">
        <div class="field">
          <label for="clientMessage">Observação para a equipe (opcional)</label>
          <textarea
            id="clientMessage"
            class="textarea"
            rows="3"
            maxlength="1000"
            placeholder="Exemplo: a obra começa em julho, prioridade no padrão de moldagem das fundações."
            :value="clientMessage"
            @input="onClientMessageInput"
          ></textarea>
          <div class="hint">
            {{ clientMessage.length }}/1000 caracteres
          </div>
        </div>

        <div
          v-if="bloqueantesCount > 0"
          class="alert danger"
        >
          <strong>Envio bloqueado</strong>
          <span>
            Corrija {{ bloqueantesCount }} erro(s) acima antes de enviar.
          </span>
        </div>

        <div
          v-if="exampleUnchanged"
          class="alert warning"
        >
          <strong>Edição obrigatória</strong>
          <span>
            Você carregou um exemplo mas ainda não personalizou nenhum dado.
            Edite ao menos um campo (nome da obra, código, peças, etc.)
            antes de enviar à equipe Consulte GEO.
          </span>
        </div>

        <div v-if="exportFeedback" class="hint">{{ exportFeedback }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type {
  RenderChildNode,
  RenderGroupNode,
} from '../models/technicalMapping.models';
import type { ValidationBuckets } from '../services/validationService';
import { orderOf } from '../services/normalizationService';

export default defineComponent({
  name: 'Step8Preview',
  props: {
    nodes: { type: Array as PropType<RenderGroupNode[]>, required: true },
    v: { type: Object as PropType<ValidationBuckets>, required: true },
    /** v5.20: textarea controlado pelo SetupPage via Vuex */
    clientMessage: { type: String, default: '' },
    /** v5.20: estado de loading do submit (desabilita botões) */
    submitLoading: { type: Boolean, default: false },
    /** v5.20: mensagem de feedback dos exports */
    exportFeedback: { type: String, default: '' },
    /** v5.22.4: true se usuário carregou exemplo e não modificou nada. */
    exampleUnchanged: { type: Boolean, default: false },
    /** v5.22.6: 7 para cliente, 9 para equipe (em /r/). */
    totalSteps: { type: Number, default: 7 },
  },
  emits: ['edit-item', 'update-client-message', 'export-excel', 'submit'],
  data() {
    return {
      // v5.22.9: destaque temporário ao clicar nos cards de validação
      flashTarget: null as 'bloqueantes' | 'alertas' | 'sugestoes' | null,
      flashTimer: null as ReturnType<typeof setTimeout> | null,
    };
  },
  computed: {
    bloqueantesCount(): number {
      return this.v.bloqueantes.length;
    },
  },
  beforeUnmount() {
    if (this.flashTimer) clearTimeout(this.flashTimer);
  },
  methods: {
    /**
     * v5.22.9: rola até o card de detalhe da categoria + destaca com
     * flash. Categoria: 'bloqueantes' | 'alertas' | 'sugestoes'.
     */
    onScrollTo(target: 'bloqueantes' | 'alertas' | 'sugestoes') {
      const refMap = {
        bloqueantes: 'cardBloqueantes',
        alertas: 'cardAlertas',
        sugestoes: 'cardSugestoes',
      } as const;
      const el = this.$refs[refMap[target]] as HTMLElement | undefined;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash de destaque
      this.flashTarget = target;
      if (this.flashTimer) clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => {
        this.flashTarget = null;
      }, 1800);
    },
    brNumber(value: number | null): string {
      if (value === null || value === undefined) return '';
      return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    },
    labelStatus(s: string): string {
      if (s === 'ok') return 'Completo';
      if (s === 'pendente') return 'Pendente';
      return 'Corrigir';
    },
    badgeStatus(s: string): string {
      if (s === 'ok') return 'success';
      if (s === 'pendente') return 'warning';
      return 'danger';
    },
    stackOrder(children: RenderChildNode[]): RenderChildNode[] {
      return [...children].sort((a, b) => orderOf(b.label) - orderOf(a.label));
    },
    onClientMessageInput(event: Event) {
      const value = (event.target as HTMLTextAreaElement).value;
      this.$emit('update-client-message', value);
    },
  },
});
</script>

<style scoped>
/* v5.22.9: cards de resumo da validação clicáveis */
.validation-summary-button {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  text-align: left;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  color: var(--fg);
  transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
  border-left-width: 4px;
}
.validation-summary-button strong {
  font-size: 28px;
  line-height: 1;
  font-family: var(--font-mono);
}
.validation-summary-button small {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--fg-muted);
  margin-top: 2px;
}
.validation-summary-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.validation-summary-button:focus-visible {
  outline: 2px solid var(--brand-magenta);
  outline-offset: 2px;
}
.validation-summary-button:disabled {
  cursor: default;
  opacity: 0.85;
}
.validation-summary-button.danger  { border-left-color: var(--color-danger,  #c0392b); }
.validation-summary-button.danger  strong { color: var(--color-danger,  #c0392b); }
.validation-summary-button.warning { border-left-color: var(--color-warning, #d97706); }
.validation-summary-button.warning strong { color: var(--color-warning, #d97706); }
.validation-summary-button.info    { border-left-color: var(--color-info,    #1d4ed8); }
.validation-summary-button.info    strong { color: var(--color-info,    #1d4ed8); }
.validation-summary-button.success { border-left-color: var(--color-success, #15803d); }
.validation-summary-button.success strong { color: var(--color-success, #15803d); }

/* Flash temporário no card de destino ao clicar */
.card-flash {
  animation: cardFlash 1.6s ease-out 1;
}
@keyframes cardFlash {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  20%      { box-shadow: 0 0 0 3px rgba(197, 17, 126, 0.45); }
  60%      { box-shadow: 0 0 0 2px rgba(197, 17, 126, 0.20); }
}
</style>
