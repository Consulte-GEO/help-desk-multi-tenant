<template>
  <div>
    <datalist id="pecasList">
      <option v-for="p in pecasSugeridas" :key="p" :value="p"></option>
    </datalist>

    <div class="section-title">
      <div>
        <div class="kicker">Etapa 4 de {{ totalSteps }}</div>
        <h2>Quais peças e pavimentos serão concretados?</h2>
        <p>
          Preencha FCK e volume por unidade. Volume em branco gera pendência,
          mas não bloqueia o envio.
        </p>
      </div>
    </div>

    <div class="grid">
      <div v-for="(grupo, index) in grupos" :key="grupo.id" class="card">
        <div class="card-header">
          <div>
            <div class="kicker">Pavimentos e peças</div>
            <h3 class="card-title">
              <span>{{ grupo.nome || 'Grupo sem nome' }}</span>
              <span
                v-if="grupo.edificacoesInput"
                class="card-title-range"
              >{{ grupo.edificacoesInput }}</span>
            </h3>
            <p class="card-description">
              Edição direta. FCK em MPa, inteiro (10 a 100).
            </p>
          </div>
          <div class="toolbar">
            <button
              v-if="index > 0 && getCopySource(index)"
              type="button"
              class="btn sm"
              @click="onCopyStructure(grupo, index)"
              :title="`Copia as peças cadastradas em &quot;${getCopySource(index)?.nome || ''}&quot;`"
            >
              Copiar estrutura
            </button>
            <button
              type="button"
              class="btn sm brand"
              @click="$emit('add-peca', { grupoId: grupo.id })"
            >
              + Adicionar peça
            </button>
          </div>
        </div>
        <div class="card-body">
          <details>
            <summary><strong>Adicionar pavimentos em massa</strong></summary>
            <div class="grid grid-4" style="margin-top: 12px">
              <div class="field">
                <label :for="`bulk_start_${grupo.id}`">De</label>
                <input
                  :id="`bulk_start_${grupo.id}`"
                  class="input"
                  type="number"
                  min="1"
                  step="1"
                  :value="(bulkState[grupo.id] && bulkState[grupo.id].start) || ''"
                  placeholder="Exemplo: 1"
                  @input="setBulkField(grupo.id, 'start', $event)"
                />
              </div>
              <div class="field">
                <label :for="`bulk_end_${grupo.id}`">Até</label>
                <input
                  :id="`bulk_end_${grupo.id}`"
                  class="input"
                  type="number"
                  min="1"
                  step="1"
                  :value="(bulkState[grupo.id] && bulkState[grupo.id].end) || ''"
                  placeholder="Exemplo: 17"
                  @input="setBulkField(grupo.id, 'end', $event)"
                />
              </div>
              <div class="field">
                <label :for="`bulk_fck_${grupo.id}`">FCK (MPa)</label>
                <input
                  :id="`bulk_fck_${grupo.id}`"
                  class="input"
                  type="number"
                  min="10"
                  max="100"
                  step="1"
                  :value="(bulkState[grupo.id] && bulkState[grupo.id].fck) || ''"
                  placeholder="Exemplo: 25"
                  @input="setBulkField(grupo.id, 'fck', $event)"
                />
              </div>
              <div class="field">
                <label :for="`bulk_volume_${grupo.id}`">Volume (m³)</label>
                <input
                  :id="`bulk_volume_${grupo.id}`"
                  class="input"
                  :value="(bulkState[grupo.id] && bulkState[grupo.id].volume) || ''"
                  placeholder="Exemplo: 187,79"
                  inputmode="decimal"
                  title="Máximo 2 casas decimais (m³)"
                  @input="setBulkField(grupo.id, 'volume', $event)"
                />
              </div>
              <button
                type="button"
                class="btn primary"
                style="align-self: end"
                @click="doBulk(grupo.id)"
              >
                Adicionar range
              </button>
            </div>
          </details>

          <div class="divider"></div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="col-drag" aria-label="Reordenar"></th>
                  <th>Peça ou pavimento</th>
                  <th>Etapa</th>
                  <th class="col-fck">FCK (MPa)</th>
                  <th>Volume por unidade</th>
                  <th>Concreto</th>
                  <th>Observação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(peca, pi) in grupo.pecas"
                  :key="peca.id"
                  :id="`peca-${peca.id}`"
                  class="dnd-row"
                  :draggable="dnd.armed === pi && dragGrupoId === grupo.id"
                  :class="{
                    'dnd-dragging': dragGrupoId === grupo.id && dnd.draggingIndex === pi,
                    'dnd-over': dragGrupoId === grupo.id && dnd.overIndex === pi && dnd.draggingIndex !== pi,
                  }"
                  @dragstart="onPecaDragStart(grupo.id, pi, $event)"
                  @dragover.prevent="dnd.onDragOver(pi, $event)"
                  @drop.prevent="onDropPeca(grupo.id, pi)"
                  @dragend="dnd.onDragEnd()"
                >
                  <td class="col-drag">
                    <!-- v5.22.44 (a11y · WCAG 2.1.1): operável por teclado. -->
                    <span
                      class="drag-handle"
                      role="button"
                      tabindex="0"
                      :aria-label="`Reordenar peça ${pi + 1} de ${grupo.pecas.length}. Use as setas para cima e para baixo.`"
                      title="Arraste, ou use as setas ↑/↓, para reordenar"
                      @mousedown="dnd.arm(pi)"
                      @touchstart="dnd.arm(pi)"
                      @keydown.up.prevent="movePecaTeclado(grupo, pi, -1)"
                      @keydown.down.prevent="movePecaTeclado(grupo, pi, 1)"
                    >⠿</span>
                  </td>
                  <td>
                    <input
                      class="input"
                      :aria-label="`Peça ou pavimento da linha ${pi + 1}`"
                      :data-field-id="`${peca.id}-local`"
                      list="pecasList"
                      :value="peca.local"
                      placeholder="Exemplo: 1º Pavimento"
                      @input="updatePeca(grupo.id, peca.id, 'local', $event)"
                    />
                  </td>
                  <td>
                    <select
                      class="select"
                      :aria-label="`Etapa da linha ${pi + 1}`"
                      :value="peca.etapa"
                      @change="updatePeca(grupo.id, peca.id, 'etapa', $event)"
                    >
                      <option v-for="e in etapas" :key="e" :value="e">{{ e }}</option>
                    </select>
                  </td>
                  <td>
                    <input
                      class="input input-fck"
                      :aria-label="`FCK em MPa da linha ${pi + 1}`"
                      :data-field-id="`${peca.id}-fck`"
                      type="number"
                      min="10"
                      max="100"
                      step="1"
                      :value="peca.fck"
                      placeholder="Exemplo: 30"
                      @input="updatePeca(grupo.id, peca.id, 'fck', $event)"
                    />
                  </td>
                  <td>
                    <!-- v5.22.10: variant --volume cria input compacto
                         (9ch ≈ "9999,99") com text-align:right e suffix m³
                         logo ao lado. Antes herdava largura da célula
                         e gerava input desproporcional. -->
                    <div class="input-group input-group--volume">
                      <input
                        class="input"
                        :aria-label="`Volume em metros cúbicos da linha ${pi + 1}`"
                        :data-field-id="`${peca.id}-volume`"
                        :value="peca.volume"
                        placeholder="0,00"
                        inputmode="decimal"
                        title="Máximo 2 casas decimais (m³)"
                        @input="updatePeca(grupo.id, peca.id, 'volume', $event)"
                      />
                      <span class="input-suffix">m³</span>
                    </div>
                  </td>
                  <td>
                    <select
                      class="select"
                      :aria-label="`Concreto da linha ${pi + 1}`"
                      :value="peca.concretoId"
                      @change="updatePeca(grupo.id, peca.id, 'concretoId', $event)"
                    >
                      <option value="">Selecione</option>
                      <option
                        v-for="c in concretos"
                        :key="c.id"
                        :value="c.id"
                      >
                        {{ c.descricao || 'Sem descrição' }}
                      </option>
                    </select>
                  </td>
                  <td>
                    <input
                      class="input"
                      :aria-label="`Observações da linha ${pi + 1}`"
                      :value="peca.observacoes"
                      placeholder="Opcional"
                      @input="updatePeca(grupo.id, peca.id, 'observacoes', $event)"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="btn sm danger"
                      @click="$emit('remove-peca', { grupoId: grupo.id, pecaId: peca.id })"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
                <tr v-if="!grupo.pecas.length">
                  <td colspan="8">Nenhuma peça cadastrada para este grupo.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-if="!grupos.length" class="empty">
        Cadastre ao menos um grupo na etapa anterior.
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { Concreto, Grupo, Peca } from '../models/setup.models';
import { ETAPAS_OPCOES, PECAS_SUGERIDAS } from '../models/setup.models';
import { maskVolumeInput } from '../services/normalizationService';
import { scrollToNewItem } from '../composables/useScrollIntoNewItem';
import { createDragReorder } from '../composables/useDragReorder';

interface BulkRow {
  start: string;
  end: string;
  fck: string;
  volume: string;
}

export default defineComponent({
  name: 'Step5PecasEditor',
  props: {
    grupos: { type: Array as PropType<Grupo[]>, required: true },
    concretos: { type: Array as PropType<Concreto[]>, required: true },
    /** v5.22.11: 7 para cliente, 9 para equipe (em /r/). */
    totalSteps: { type: Number, default: 7 },
  },
  emits: ['add-peca', 'remove-peca', 'update-peca', 'bulk-add', 'copy-pecas', 'reorder-pecas'],
  data() {
    return {
      bulkState: {} as Record<string, BulkRow>,
      etapas: ETAPAS_OPCOES,
      pecasSugeridas: PECAS_SUGERIDAS,
      // v5.22.38: drag-and-drop de peças. Como as peças são por grupo,
      // guardamos o grupoId da peça sendo arrastada para só permitir
      // soltar dentro do MESMO grupo (peças de grupos diferentes não
      // se misturam).
      dnd: createDragReorder(),
      dragGrupoId: '' as string,
    };
  },
  watch: {
    grupos: {
      handler(newGrupos: Grupo[]) {
        newGrupos.forEach((g) => {
          if (!this.bulkState[g.id]) {
            this.bulkState[g.id] = { start: '', end: '', fck: '', volume: '' };
          }
        });
      },
      immediate: true,
    },
    /**
     * v5.22.32: auto-scroll para a peça recém-adicionada. Como cada
     * grupo tem seu array de peças, observamos a soma total para
     * detectar adição em qualquer grupo. Quando aumenta, busca em
     * todos os grupos a última peça (assume que é a recém-criada).
     *
     * Limitação: se duas peças forem adicionadas simultaneamente
     * em grupos diferentes (raro — bulk-add), só uma vai ser
     * scrollada. Aceito.
     */
    totalPecasCount(newCount: number, oldCount: number) {
      if (newCount > oldCount) {
        // Acha a peça mais recente (última do último grupo com peças).
        let target: { id: string } | null = null;
        for (const g of this.grupos) {
          if (g.pecas && g.pecas.length > 0) {
            target = g.pecas[g.pecas.length - 1];
          }
        }
        if (target) scrollToNewItem(`#peca-${target.id}`);
      }
    },
  },
  computed: {
    /**
     * v5.22.32: usado pelo watcher acima para detectar adição em
     * qualquer dos grupos. Soma o número de peças de todos os grupos.
     */
    totalPecasCount(): number {
      return this.grupos.reduce((acc, g) => acc + (g.pecas?.length || 0), 0);
    },
  },
  methods: {
    /**
     * v5.22.38: drag-and-drop de peças DENTRO de um grupo.
     * onPecaDragStart guarda o grupoId; onDropPeca só reordena se o
     * drop for no mesmo grupo (peças não migram entre grupos).
     */
    onPecaDragStart(grupoId: string, index: number, ev: DragEvent) {
      this.dragGrupoId = grupoId;
      this.dnd.onDragStart(index, ev);
    },
    onDropPeca(grupoId: string, dropIndex: number) {
      // Só aceita drop no mesmo grupo de onde saiu
      if (this.dragGrupoId !== grupoId) {
        this.dnd.onDragEnd();
        this.dragGrupoId = '';
        return;
      }
      const move = this.dnd.resolveDrop(dropIndex);
      this.dragGrupoId = '';
      if (move) {
        this.$emit('reorder-pecas', { grupoId, from: move.from, to: move.to });
      }
    },
    /**
     * v5.22.44 (a11y · WCAG 2.1.1): move a peça uma posição para cima
     * (-1) ou para baixo (+1) dentro do próprio grupo, reusando a action
     * `reorder-pecas` do drag-and-drop.
     */
    movePecaTeclado(grupo: { id: string; pecas: unknown[] }, index: number, delta: number) {
      const to = index + delta;
      if (to < 0 || to >= grupo.pecas.length) return;
      this.$emit('reorder-pecas', { grupoId: grupo.id, from: index, to });
    },
    /**
     * Retorna o grupo "anterior com peças" — o melhor candidato para copy.
     * Procura o último grupo com pelo menos 1 peça antes do grupo atual.
     */
    getCopySource(currentIndex: number): Grupo | null {
      for (let i = currentIndex - 1; i >= 0; i--) {
        const g = this.grupos[i];
        if (g.pecas && g.pecas.length > 0) return g;
      }
      return null;
    },
    onCopyStructure(grupoAtual: Grupo, index: number) {
      const source = this.getCopySource(index);
      if (!source) return;
      // Se o grupo atual já tem peças, confirma antes de sobrescrever
      if (grupoAtual.pecas.length > 0) {
        const ok = window.confirm(
          `Substituir as ${grupoAtual.pecas.length} peça(s) atuais por uma cópia das ${source.pecas.length} peça(s) de "${source.nome || 'grupo anterior'}"?`,
        );
        if (!ok) return;
      }
      this.$emit('copy-pecas', { fromGrupoId: source.id, toGrupoId: grupoAtual.id });
    },
    updatePeca(grupoId: string, pecaId: string, field: keyof Peca, event: Event) {
      const el = event.target as HTMLInputElement | HTMLSelectElement;
      let value = el.value;
      // v5.22.7: mask de 2 casas decimais aplicada AO VIVO no campo volume.
      // Atualiza o DOM também (cursor pode pular se mudou) para o usuário
      // ver imediatamente que a 3ª casa não é aceita.
      if (field === 'volume') {
        const masked = maskVolumeInput(value);
        if (masked !== value) {
          (el as HTMLInputElement).value = masked;
          value = masked;
        }
      }
      this.$emit('update-peca', { grupoId, pecaId, field, value });
    },
    setBulkField(grupoId: string, field: keyof BulkRow, event: Event) {
      const el = event.target as HTMLInputElement;
      let value = el.value;
      // v5.22.7: mesma mask para o campo de volume no bulk-add
      if (field === 'volume') {
        const masked = maskVolumeInput(value);
        if (masked !== value) {
          el.value = masked;
          value = masked;
        }
      }
      if (!this.bulkState[grupoId]) {
        this.bulkState[grupoId] = { start: '', end: '', fck: '', volume: '' };
      }
      this.bulkState[grupoId][field] = value;
    },
    doBulk(grupoId: string) {
      const row = this.bulkState[grupoId];
      if (!row) return;
      this.$emit('bulk-add', {
        grupoId,
        start: Number(row.start),
        end: Number(row.end),
        fck: row.fck,
        volume: row.volume,
      });
      this.bulkState[grupoId] = { start: '', end: '', fck: '', volume: '' };
    },
  },
});
</script>
