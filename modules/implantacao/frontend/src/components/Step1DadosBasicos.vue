<template>
  <div>
    <div class="section-title">
      <div>
        <div class="kicker">Etapa 1 de {{ totalSteps }}</div>
        <h2>Dados básicos da obra</h2>
        <p>
          Use os nomes que a equipe de obra já utiliza. Os campos técnicos
          ficam para a validação interna.
        </p>
      </div>
    </div>

    <!-- v5.22.47: o radio "Modelo de preenchimento" foi REMOVIDO.
         Existe um único modelo (o completo, com Tipo de Estrutura,
         Número da Estrutura e Projetista) e ele não precisa ser
         mencionado na interface. Snapshots antigos salvos como
         'comum' são normalizados no store ao carregar. -->

    <!-- v5.22.47: Importar planilha de implantação preenchida.
         Aceita o modelo novo (R02, tabular) e o modelo antigo
         (R00/R01, seções em duas colunas). O parse acontece em
         implantacaoImportService + assets/implantacao-import-core.js. -->
    <div class="card" style="margin-bottom: 20px" data-testid="import-planilha-card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Importar planilha de implantação</h3>
          <p class="card-description">
            Já tem a planilha de implantação preenchida? Importe e o
            cadastro inteiro é montado: obra, estruturas, peças,
            concretos, usuários e fornecedores. Depois é só revisar
            etapa por etapa.
          </p>
        </div>
      </div>
      <div class="card-body">
        <div class="toolbar" style="flex-wrap: wrap; gap: 8px">
          <a
            class="btn sm"
            :href="modeloHref"
            download="Modelo-Implantacao-Consulte-GEO-R02.xlsx"
          >
            Baixar modelo padrão (.xlsx)
          </a>
          <label class="btn sm brand" style="margin-bottom: 0; cursor: pointer">
            {{ importState && importState.status === 'importing' ? 'Importando…' : 'Importar planilha preenchida' }}
            <input
              type="file"
              accept=".xlsx,.xls"
              style="display: none"
              :disabled="!!importState && importState.status === 'importing'"
              @change="onImportFileChange"
            />
          </label>
        </div>
        <div class="hint" style="margin-top: 8px">
          Planilhas no modelo antigo também são aceitas — campos que não
          existiam nele (Projetista, concreto por peça) ficam para
          completar aqui.
        </div>

        <div
          v-if="importState && importState.status === 'done'"
          class="alert success"
          style="margin-top: 12px"
          data-testid="import-resumo"
        >
          <strong>Planilha importada{{ importState.arquivo ? `: ${importState.arquivo}` : '' }}</strong>
          <span>
            {{ importState.resumo.estruturas }} estrutura(s),
            {{ importState.resumo.pecas }} peça(s),
            {{ importState.resumo.concretos }} concreto(s),
            {{ importState.resumo.usuarios }} usuário(s),
            {{ importState.resumo.fornecedores }} fornecedor(es).
            Revise as etapas antes de enviar.
          </span>
        </div>
        <div
          v-if="importState && importState.status === 'done' && importState.avisos.length"
          class="alert warn"
          style="margin-top: 8px"
        >
          <strong>Avisos da importação ({{ importState.avisos.length }})</strong>
          <span>
            <template v-for="(aviso, ai) in importState.avisos" :key="ai">
              • {{ aviso }}<br />
            </template>
          </span>
        </div>
        <div
          v-if="importState && importState.status === 'error'"
          class="alert danger"
          style="margin-top: 12px"
        >
          <strong>Não foi possível importar</strong>
          <span>{{ importState.erro }}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <!-- Identificação -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Identificação</h3>
            <p class="card-description">Dados que aparecem no protocolo de envio.</p>
          </div>
        </div>
        <div class="card-body grid">
          <div class="field">
            <label for="obraNome">Nome da obra</label>
            <input
              id="obraNome"
              data-field-id="meta-obraNome"
              class="input"
              type="text"
              :value="metadata.obraNome"
              placeholder="Exemplo: Evo Vila Clementino"
              @input="updateMeta('obraNome', $event)"
            />
          </div>
          <div class="field">
            <label for="clienteNome">Cliente / construtora</label>
            <input
              id="clienteNome"
              class="input"
              type="text"
              :value="metadata.clienteNome"
              placeholder="Exemplo: Bacelar, Tenda, Direcional"
              @input="updateMeta('clienteNome', $event)"
            />
          </div>
          <div class="field">
            <label for="obraEndereco">Endereço</label>
            <input
              id="obraEndereco"
              class="input"
              type="text"
              :value="metadata.obraEndereco"
              placeholder="Exemplo: Rua, número, bairro, cidade - UF"
              @input="updateMeta('obraEndereco', $event)"
            />
          </div>
          <div class="field">
            <label for="obraCEP">CEP</label>
            <input
              id="obraCEP"
              class="input"
              type="text"
              :value="metadata.obraCEP"
              placeholder="Exemplo: 00000-000"
              @input="updateMeta('obraCEP', $event)"
            />
          </div>
          <!-- v5.22.18: campo livre de observações da obra.
               Antes existiam campos rígidos (Versão da regra + Estrutura
               drywall) dentro do bloco "Modelo Completo". Foram retirados.
               O campo Observação livre absorve esses casos. -->
          <div class="field">
            <label for="obraObservacoes">Observação</label>
            <textarea
              id="obraObservacoes"
              class="textarea"
              :value="metadata.obraObservacoes"
              placeholder="Exemplo: Versão do Procedimento, com ou sem DryWall"
              rows="2"
              @input="updateMeta('obraObservacoes', $event)"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Responsável -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Responsável</h3>
            <p class="card-description">Quem acompanha a devolução e o reenvio.</p>
          </div>
        </div>
        <div class="card-body grid">
          <div class="field">
            <label for="createdByNome">Engenheiro ou responsável</label>
            <input
              id="createdByNome"
              class="input"
              type="text"
              :value="metadata.createdBy.nome"
              placeholder="Exemplo: Ana Paula Souza"
              @input="updateCreatedBy('nome', $event)"
            />
          </div>
          <div class="field">
            <label for="createdByEmail">E-mail do responsável</label>
            <input
              id="createdByEmail"
              class="input"
              type="email"
              :value="metadata.createdBy.email"
              placeholder="Exemplo: ana@construtora.com.br"
              @input="updateCreatedBy('email', $event)"
            />
            <div class="hint">
              Receberá uma confirmação automática quando a proposta for
              enviada à equipe Consulte GEO.
            </div>
          </div>
          <!-- v5.22.18: telefone do responsável. -->
          <div class="field">
            <label for="createdByTelefone">Telefone</label>
            <input
              id="createdByTelefone"
              class="input"
              type="tel"
              :value="metadata.createdBy.telefone"
              placeholder="Exemplo: (11) 98765-4321"
              @input="updateCreatedBy('telefone', $event)"
            />
          </div>

          <!-- v5.22.18: bloco "Modelo Completo" agora só com campos que
               sobreviveram. Removidos: Versão da regra e Estrutura (drywall).
               v5.22.47: sem v-if — o modelo único é o completo, então os
               campos aparecem sempre. -->
          <div
            id="modeloProjetoFields"
            class="grid"
          >
            <div class="field">
              <label for="idCRM">Código interno opcional</label>
              <input
                id="idCRM"
                class="input"
                type="text"
                :value="metadata.modeloProjetoFields.idCRM"
                placeholder="Opcional"
                @input="updateMP('idCRM', $event)"
              />
            </div>
            <div class="field">
              <label for="estadoRegional">Estado - regional</label>
              <input
                id="estadoRegional"
                class="input"
                type="text"
                :value="metadata.modeloProjetoFields.estadoRegional"
                placeholder="Exemplo: BAHIA - NE1"
                @input="updateMP('estadoRegional', $event)"
              />
            </div>
            <div class="field">
              <label for="gestorObra">Gestor da obra</label>
              <input
                id="gestorObra"
                class="input"
                type="text"
                :value="metadata.modeloProjetoFields.gestorObra"
                placeholder="Nome do gestor"
                @input="updateMP('gestorObra', $event)"
              />
            </div>
            <div class="field">
              <label for="gestorExecutivoDiretor">Gestor executivo / diretor</label>
              <input
                id="gestorExecutivoDiretor"
                class="input"
                type="text"
                :value="metadata.modeloProjetoFields.gestorExecutivoDiretor"
                placeholder="Nome do diretor"
                @input="updateMP('gestorExecutivoDiretor', $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ObraMetadata } from '../models/setup.models';

/**
 * v5.22.47: estado da importação de planilha (exibido no card).
 * Controlado pelo SetupPage; este componente só emite o arquivo.
 * União discriminada por status → o template narrowa em cada v-if.
 */
export interface ImportPlanilhaResumo {
  estruturas: number;
  pecas: number;
  concretos: number;
  usuarios: number;
  fornecedores: number;
}
export type ImportPlanilhaState =
  | { status: 'importing'; arquivo: string }
  | { status: 'done'; arquivo: string; resumo: ImportPlanilhaResumo; avisos: string[] }
  | { status: 'error'; arquivo: string; erro: string };

export default defineComponent({
  name: 'Step1DadosBasicos',
  props: {
    metadata: { type: Object as PropType<ObraMetadata>, required: true },
    /** v5.22.11: 7 para cliente, 9 para equipe (em /r/). */
    totalSteps: { type: Number, default: 7 },
    /** v5.22.47: estado da importação (null = nada importado ainda). */
    importState: {
      type: Object as PropType<ImportPlanilhaState | null>,
      default: null,
    },
  },
  emits: [
    'update-meta',
    'update-created-by',
    'update-modelo-projeto-field',
    // v5.22.47: arquivo .xlsx selecionado para importação
    'import-planilha',
  ],
  computed: {
    /** URL do modelo padrão servido de public/modelos (respeita BASE_URL). */
    modeloHref(): string {
      const base = import.meta.env.BASE_URL || '/';
      return `${base.replace(/\/$/, '')}/modelos/Modelo-Implantacao-Consulte-GEO-R02.xlsx`;
    },
  },
  methods: {
    updateMeta(field: string, event: Event) {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement;
      this.$emit('update-meta', { field, value: target.value });
    },
    /** v5.22.47: repassa o arquivo escolhido e limpa o input (permite
        reimportar o mesmo arquivo após correção). */
    onImportFileChange(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files && input.files[0];
      if (file) this.$emit('import-planilha', file);
      input.value = '';
    },
    updateCreatedBy(field: string, event: Event) {
      const value = (event.target as HTMLInputElement).value;
      this.$emit('update-created-by', { field, value });
    },
    updateMP(field: string, event: Event) {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      this.$emit('update-modelo-projeto-field', { field, value: target.value });
    },
  },
});
</script>
