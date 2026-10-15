<template>
  <div class="padrao-moldagem-editor">
    <!-- Botões de shortcut -->
    <div class="shortcut-row">
      <button
        v-for="sc in shortcuts"
        :key="sc.label"
        type="button"
        class="btn sm"
        :class="{ 'shortcut-empty': sc.variant === 'empty', 'shortcut-default': sc.variant !== 'empty' }"
        @click="onShortcut(sc)"
      >
        {{ sc.label }}
      </button>
    </div>

    <div class="table-wrap" v-if="padroes.length">
      <table>
        <thead>
          <tr>
            <th class="col-narrow">#</th>
            <th class="col-idade">Idade</th>
            <th>Unidade</th>
            <th>Tipo de Ensaio</th>
            <th>Valor Esperado</th>
            <th>Crescimento %</th>
            <th class="col-narrow">Qtd CPs</th>
            <th class="col-narrow"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(pm, idx) in sortedPadroes" :key="pm.id" :id="`padrao-${pm.id}`">
            <td class="col-narrow row-index">{{ idx + 1 }}</td>
            <td>
              <input
                class="input input-idade"
                type="number"
                min="0"
                step="1"
                :value="pm.idadeControle"
                @input="onUpdate(pm.id, 'idadeControle', $event)"
              />
            </td>
            <td>
              <select
                class="select"
                :value="pm.unidadeIdade"
                @change="onUpdate(pm.id, 'unidadeIdade', $event)"
              >
                <option value="dias">Dias</option>
                <option value="horas">Horas</option>
              </select>
            </td>
            <td>
              <select
                class="select"
                :value="pm.tipoEnsaio"
                @change="onUpdate(pm.id, 'tipoEnsaio', $event)"
              >
                <option v-for="t in tipoEnsaioOpcoes" :key="t.value" :value="t.value">
                  {{ t.label }}
                </option>
              </select>
            </td>
            <td>
              <input
                class="input input-narrow"
                type="number"
                min="0"
                step="0.1"
                :value="pm.valorEsperado"
                :placeholder="pm.tipoEnsaio === 'compressao' ? '(FCK)' : ''"
                @input="onUpdate(pm.id, 'valorEsperado', $event)"
              />
            </td>
            <td>
              <div class="input-group">
                <input
                  class="input input-narrow"
                  type="number"
                  min="0"
                  max="200"
                  step="1"
                  :value="pm.crescimentoPct"
                  @input="onUpdate(pm.id, 'crescimentoPct', $event)"
                />
                <span class="input-suffix">%</span>
              </div>
            </td>
            <td>
              <input
                class="input input-narrow"
                type="number"
                min="0"
                step="1"
                :value="pm.quantidadeCp"
                @input="onUpdate(pm.id, 'quantidadeCp', $event)"
              />
            </td>
            <td>
              <button
                type="button"
                class="btn sm danger"
                @click="$emit('remove-padrao', { concretoId, padraoId: pm.id })"
                aria-label="Remover linha"
                title="Remover linha"
              >
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="hint" style="margin-top: 8px">
      Nenhuma linha. Use os botões acima para adicionar uma idade de controle.
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import {
  padraoMoldagemAgeInHours,
  PADRAO_MOLDAGEM_SHORTCUTS,
  TIPO_ENSAIO_OPCOES,
  type PadraoMoldagem,
  type PadraoMoldagemShortcut,
} from '../models/setup.models';
import { scrollToNewItem } from '../composables/useScrollIntoNewItem';

export default defineComponent({
  name: 'PadraoMoldagemEditor',
  props: {
    concretoId: { type: String, required: true },
    padroes: { type: Array as PropType<PadraoMoldagem[]>, required: true },
  },
  emits: ['add-padrao', 'remove-padrao', 'update-padrao'],
  data() {
    return {
      shortcuts: PADRAO_MOLDAGEM_SHORTCUTS,
      tipoEnsaioOpcoes: TIPO_ENSAIO_OPCOES,
    };
  },
  watch: {
    /**
     * v5.22.32: auto-scroll para a linha de padrão de moldagem
     * recém-adicionada. Útil quando a tabela já está cheia (5+ linhas)
     * e o + Adicionar empurra a nova linha pra fora do viewport.
     */
    'padroes.length'(newLen: number, oldLen: number) {
      if (newLen > oldLen && newLen > 0) {
        // Como a ordem visual é por sortedPadroes (não pela ordem
        // do array original), pegamos a última do array original
        // — que é a recém-adicionada — e localizamos pelo id.
        const novo = this.padroes[this.padroes.length - 1];
        if (novo) scrollToNewItem(`#padrao-${novo.id}`, { block: 'nearest' });
      }
    },
  },
  computed: {
    /**
     * Exibe as linhas ordenadas por temporalidade (12h vem antes de
     * 7 dias). A ordem do array no store é independente — quando o
     * usuário edita a idade de uma linha existente, a ordem visual
     * atualiza, mas o foco do input é preservado pelo `:key="pm.id"`
     * (o Vue reordena nodes em vez de recriá-los).
     */
    sortedPadroes(): PadraoMoldagem[] {
      return [...this.padroes].sort(
        (a, b) => padraoMoldagemAgeInHours(a) - padraoMoldagemAgeInHours(b),
      );
    },
  },
  methods: {
    onShortcut(sc: PadraoMoldagemShortcut) {
      if (sc.mode === 'empty') {
        this.$emit('add-padrao', { concretoId: this.concretoId, seed: {} });
        return;
      }
      // Monta o seed conforme o "lado" que o atalho fixa.
      // O store fará o cálculo do outro lado a partir do FCK do concreto.
      const seed: Partial<PadraoMoldagem> = {
        idadeControle: sc.idadeControle,
        unidadeIdade: sc.unidadeIdade,
        tipoEnsaio: 'compressao',
        quantidadeCp: 2,
      };
      if (sc.mode === 'value' && typeof sc.valorMpa === 'number') {
        seed.valorEsperado = sc.valorMpa;
      } else if (sc.mode === 'percent' && typeof sc.crescimentoPct === 'number') {
        seed.crescimentoPct = sc.crescimentoPct;
      }
      this.$emit('add-padrao', { concretoId: this.concretoId, seed });
    },
    onUpdate(padraoId: string, field: keyof PadraoMoldagem, event: Event) {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      const raw = target.value;
      // Campos numéricos: converte string vazia em '', resto em Number.
      const numericFields: Array<keyof PadraoMoldagem> = [
        'idadeControle', 'valorEsperado', 'crescimentoPct', 'quantidadeCp',
      ];
      const value: string | number =
        numericFields.includes(field)
          ? raw === '' ? '' : Number(raw)
          : raw;
      this.$emit('update-padrao', {
        concretoId: this.concretoId,
        padraoId,
        field,
        value,
      });
    },
  },
});
</script>
