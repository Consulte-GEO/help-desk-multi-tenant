<template>
  <div>
    <div class="kicker">Etapa 6 de {{ totalSteps }}</div>
    <h2 style="margin: 4px 0 4px">Fornecedores</h2>
    <p class="card-description">
      Cadastre as usinas concreteiras e laboratórios que vão atender esta
      obra. Cada fornecedor pode ter até 3 e-mails para programação
      (operacional + comercial + gerencial, por exemplo).
    </p>

    <div class="card" style="margin-top: 16px">
      <div class="card-header">
        <div>
          <h3 class="card-title">Fornecedores cadastrados</h3>
          <p class="card-description">
            {{ fornecedores.length }} fornecedor(es) ·
            {{ countUsinas }} usina(s) e {{ countLaboratorios }} laboratório(s).
          </p>
        </div>
        <div class="toolbar">
          <!--
            v5.22.22 — Dois botões em vez de um. Usina e laboratório
            recebem peso visual igual (ambos .brand) porque qualquer
            ordem de cadastro é válida e o usuário decide. O .toolbar
            já é flex com gap, então quebra para coluna em viewports
            estreitos via flex-wrap.
          -->
          <button
            type="button"
            class="btn brand"
            @click="$emit('add-fornecedor', 'usina')"
          >
            Adicionar usina
          </button>
          <button
            type="button"
            class="btn brand"
            @click="$emit('add-fornecedor', 'laboratorio')"
          >
            Adicionar laboratório
          </button>
        </div>
      </div>
      <div class="card-body grid">
        <div v-if="fornecedores.length === 0" class="empty">
          Nenhum fornecedor cadastrado ainda. Use os botões acima para
          adicionar uma usina ou um laboratório. Recomendamos cadastrar
          pelo menos uma usina e um laboratório.
        </div>

        <div
          v-for="(f, idx) in fornecedores"
          :key="f.id"
          :id="`fornecedor-${f.id}`"
          class="fornecedor-card"
          :class="`fornecedor-card--${f.tipo}`"
        >
          <div class="fornecedor-card-header">
            <div>
              <div class="kicker">Fornecedor {{ idx + 1 }}</div>
              <div class="fornecedor-tipo-title">
                {{ tipoInfo(f.tipo).tituloCard }} {{ tipoIndex(f, idx) }}
              </div>
            </div>
            <button
              type="button"
              class="btn sm danger"
              @click="$emit('remove-fornecedor', f.id)"
              title="Remover este fornecedor"
            >
              Remover
            </button>
          </div>

          <div class="grid grid-2">
            <div class="field">
              <label :for="`frn-tipo-${f.id}`">Tipo de fornecedor</label>
              <select
                :id="`frn-tipo-${f.id}`"
                class="input"
                :value="f.tipo"
                @change="onField(f.id, 'tipo', $event)"
              >
                <option value="usina">Usina concreteira</option>
                <option value="laboratorio">Laboratório</option>
              </select>
            </div>
            <div class="field">
              <label :for="`frn-nome-${f.id}`">{{ tipoInfo(f.tipo).nomeLabel }}</label>
              <input
                :id="`frn-nome-${f.id}`"
                class="input"
                type="text"
                :value="f.nome"
                :placeholder="f.tipo === 'usina'
                  ? 'Exemplo: SUPERMIX CONCRETO S/A'
                  : 'Exemplo: TESTIN TECNOLOGIA DE MATERIAIS LTDA'"
                @input="onField(f.id, 'nome', $event)"
              />
            </div>
            <div class="field">
              <label :for="`frn-cnpj-${f.id}`">CNPJ</label>
              <input
                :id="`frn-cnpj-${f.id}`"
                class="input"
                type="text"
                :value="f.cnpj"
                placeholder="Exemplo: 34.230.979/0076-23"
                @input="onField(f.id, 'cnpj', $event)"
              />
            </div>
            <div class="field">
              <label :for="`frn-telefone-${f.id}`">Telefone</label>
              <input
                :id="`frn-telefone-${f.id}`"
                class="input"
                type="tel"
                :value="f.telefone"
                placeholder="Exemplo: +55 11 98106-8172"
                @input="onField(f.id, 'telefone', $event)"
              />
            </div>
            <div class="field" style="grid-column: 1 / -1">
              <label :for="`frn-endereco-${f.id}`">Endereço</label>
              <input
                :id="`frn-endereco-${f.id}`"
                class="input"
                type="text"
                :value="f.endereco"
                placeholder="Exemplo: Rua Policon 120, Jardim Santa Cecília - Barueri"
                @input="onField(f.id, 'endereco', $event)"
              />
            </div>
            <div class="field" style="grid-column: 1 / -1">
              <label :for="`frn-responsavel-${f.id}`">Nome do responsável</label>
              <input
                :id="`frn-responsavel-${f.id}`"
                class="input"
                type="text"
                :value="f.responsavel"
                placeholder="Exemplo: Paulo Sergio Cipriano (Vendedor)"
                @input="onField(f.id, 'responsavel', $event)"
              />
            </div>
          </div>

          <!-- Emails para programação (até 3) -->
          <div class="field" style="margin-top: 12px">
            <label>E-mails para programação (até 3)</label>
            <div
              v-for="(email, eidx) in f.emailsProgramacao"
              :key="eidx"
              class="email-row"
            >
              <input
                class="input"
                type="email"
                :value="email"
                :placeholder="emailPlaceholder(eidx)"
                @input="onEmailChange(f.id, eidx, $event)"
              />
              <button
                type="button"
                class="btn sm ghost"
                @click="$emit('remove-fornecedor-email', { id: f.id, index: eidx })"
                :disabled="f.emailsProgramacao.length === 1 && !email"
                title="Remover este e-mail"
              >
                ×
              </button>
            </div>
            <button
              v-if="f.emailsProgramacao.length < maxEmails"
              type="button"
              class="btn sm"
              @click="$emit('add-fornecedor-email', f.id)"
              style="margin-top: 8px"
            >
              + Adicionar outro e-mail ({{ f.emailsProgramacao.length }}/{{ maxEmails }})
            </button>
            <div v-else class="hint" style="margin-top: 4px">
              Limite de {{ maxEmails }} e-mails atingido.
            </div>
          </div>

          <div class="field" style="margin-top: 12px">
            <label :for="`frn-obs-${f.id}`">Observações (opcional)</label>
            <textarea
              :id="`frn-obs-${f.id}`"
              class="textarea"
              rows="2"
              :value="f.observacoes"
              placeholder="Exemplo: Atende apenas concretagens diurnas."
              @input="onField(f.id, 'observacoes', $event)"
            ></textarea>
          </div>
        </div>

        <div
          v-if="fornecedores.length > 0"
          class="toolbar"
          style="justify-content: center"
        >
          <button
            type="button"
            class="btn brand"
            @click="$emit('add-fornecedor', 'usina')"
          >
            Adicionar outra usina
          </button>
          <button
            type="button"
            class="btn brand"
            @click="$emit('add-fornecedor', 'laboratorio')"
          >
            Adicionar outro laboratório
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import {
  TIPOS_FORNECEDOR_INFO,
  MAX_EMAILS_FORNECEDOR,
  type Fornecedor,
  type TipoFornecedor,
} from '../models/setup.models';
import { scrollToNewItem } from '../composables/useScrollIntoNewItem';

export default defineComponent({
  name: 'Step7Fornecedores',
  props: {
    fornecedores: { type: Array as PropType<Fornecedor[]>, required: true },
    /** v5.22.7: 8 para cliente, 10 para equipe. */
    totalSteps: { type: Number, default: 7 },
  },
  emits: [
    'add-fornecedor',
    'remove-fornecedor',
    'update-fornecedor',
    'add-fornecedor-email',
    'update-fornecedor-email',
    'remove-fornecedor-email',
  ],
  data() {
    return {
      maxEmails: MAX_EMAILS_FORNECEDOR,
    };
  },
  watch: {
    /** v5.22.32: auto-scroll para o fornecedor recém-adicionado. */
    'fornecedores.length'(newLen: number, oldLen: number) {
      if (newLen > oldLen && newLen > 0) {
        const novo = this.fornecedores[newLen - 1];
        if (novo) scrollToNewItem(`#fornecedor-${novo.id}`);
      }
    },
  },
  computed: {
    countUsinas(): number {
      return this.fornecedores.filter((f) => f.tipo === 'usina').length;
    },
    countLaboratorios(): number {
      return this.fornecedores.filter((f) => f.tipo === 'laboratorio').length;
    },
  },
  methods: {
    tipoInfo(t: TipoFornecedor) {
      return TIPOS_FORNECEDOR_INFO[t];
    },
    /** Retorna o "1", "2" ... do mesmo tipo até o índice corrente (para mostrar "Usina 1", "Usina 2"). */
    tipoIndex(f: Fornecedor, idx: number): string {
      let n = 0;
      for (let i = 0; i <= idx; i++) {
        if (this.fornecedores[i].tipo === f.tipo) n++;
      }
      return String(n);
    },
    emailPlaceholder(idx: number): string {
      const ex = [
        'programacao@empresa.com.br',
        'comercial@empresa.com.br',
        'gerencia@empresa.com.br',
      ];
      return `Exemplo: ${ex[idx] ?? ex[0]}`;
    },
    onField(id: string, field: keyof Fornecedor, e: Event) {
      const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      this.$emit('update-fornecedor', { id, field, value: target.value });
    },
    onEmailChange(id: string, index: number, e: Event) {
      const target = e.target as HTMLInputElement;
      this.$emit('update-fornecedor-email', { id, index, value: target.value });
    },
  },
});
</script>

<style scoped>
.fornecedor-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px;
  background: var(--surface-raised);
  border-left-width: 4px;
}
.fornecedor-card--usina {
  border-left-color: var(--brand-magenta);
}
.fornecedor-card--laboratorio {
  border-left-color: var(--brand-navy);
}
.fornecedor-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  gap: 12px;
}
.fornecedor-tipo-title {
  font-weight: 700;
  font-size: 15px;
  margin-top: 2px;
}
.email-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}
.email-row .input {
  flex: 1;
}
.empty {
  padding: 24px;
  text-align: center;
  color: var(--fg-muted);
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
}
</style>
