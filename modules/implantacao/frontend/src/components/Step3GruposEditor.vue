<template>
  <div>
    <!-- v5.22.18: Radio "Modelo de Preenchimento" REMOVIDO desta etapa
         (estava no topo) e migrado para a Etapa 1 (Dados básicos). A
         Etapa 3 agora foca só nas estruturas. -->

    <!-- Modo modelo_projeto: tabela -->
    <template v-if="isModeloProjeto">
      <div class="section-title">
        <div>
          <div class="kicker">Etapa 2 de {{ totalSteps }}</div>
          <h2>Estruturas</h2>
          <p>
            Preencha as estruturas usando tipo, numeração e projetista em
            texto livre. O campo <strong>Projetista é opcional</strong> —
            pode ficar em branco e não impede salvar nem enviar.
          </p>
        </div>
        <button type="button" class="btn brand" @click="$emit('add-grupo')">
          Adicionar linha
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="col-drag" aria-label="Reordenar"></th>
              <th>Tipo de Estrutura</th>
              <th>Número da Estrutura</th>
              <!-- v5.22.47: "(opcional)" visível no cabeçalho — pedido
                   direto do produto: deixar claro que Projetista não é
                   obrigatório nesta etapa. -->
              <th>Projetista <span class="th-optional">(opcional)</span></th>
              <th>Nomenclatura no Sistema</th>
              <th>Prévia expandida</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(grupo, gi) in grupos"
              :key="grupo.id"
              :id="`grupo-${grupo.id}`"
              :draggable="dnd.armed === gi"
              class="dnd-row"
              :class="{ 'dnd-dragging': dnd.draggingIndex === gi, 'dnd-over': dnd.overIndex === gi && dnd.draggingIndex !== gi }"
              @dragstart="dnd.onDragStart(gi, $event)"
              @dragover.prevent="dnd.onDragOver(gi, $event)"
              @drop.prevent="onDropGrupo(gi)"
              @dragend="dnd.onDragEnd()"
            >
              <td class="col-drag">
                <!-- v5.22.44 (a11y · WCAG 2.1.1): handle operável por teclado.
                     Setas ↑/↓ reordenam reusando a mesma ação do drag-and-drop. -->
                <span
                  class="drag-handle"
                  role="button"
                  tabindex="0"
                  :aria-label="`Reordenar estrutura ${gi + 1} de ${grupos.length}. Use as setas para cima e para baixo.`"
                  title="Arraste, ou use as setas ↑/↓, para reordenar"
                  @mousedown="dnd.arm(gi)"
                  @touchstart="dnd.arm(gi)"
                  @keydown.up.prevent="moveGrupoTeclado(gi, -1)"
                  @keydown.down.prevent="moveGrupoTeclado(gi, 1)"
                >⠿</span>
              </td>
              <td>
                <select
                  class="select"
                  :aria-label="`Tipo de Estrutura da linha ${gi + 1}`"
                  :value="grupo.tipoEdificacao"
                  @change="onTipoChange(grupo, $event)"
                >
                  <option v-for="opt in tiposProjeto" :key="opt" :value="opt">
                    {{ opt }}
                  </option>
                </select>
              </td>
              <td>
                <input
                  class="input"
                  :aria-label="`Número da Estrutura da linha ${gi + 1}`"
                  :data-field-id="`${grupo.id}-numeroEstrutura`"
                  :value="grupo.edificacoesInput"
                  placeholder="Exemplo: 1 A 24, 1 e 2, ANEXOS, -"
                  @input="updateGrupo(grupo.id, 'edificacoesInput', $event)"
                />
              </td>
              <td>
                <input
                  class="input"
                  :aria-label="`Projetista da linha ${gi + 1} (opcional)`"
                  :value="grupo.projetista"
                  placeholder="Opcional — digite livremente"
                  @input="updateGrupo(grupo.id, 'projetista', $event)"
                />
              </td>
              <td>
                <input
                  class="input"
                  :aria-label="`Nomenclatura no Sistema da linha ${gi + 1}`"
                  :value="grupo.nome"
                  placeholder="Descrição opcional do grupo"
                  @input="updateGrupo(grupo.id, 'nome', $event)"
                />
              </td>
              <td>
                <div class="chips">
                  <span
                    v-for="(name, idx) in expandedNames(grupo).slice(0, 8)"
                    :key="idx"
                    class="chip"
                  >
                    {{ name }}
                  </span>
                  <span v-if="expandedNames(grupo).length > 8" class="chip">
                    +{{ expandedNames(grupo).length - 8 }}
                  </span>
                </div>
              </td>
              <td>
                <button
                  type="button"
                  class="btn sm danger"
                  @click="$emit('remove-grupo', grupo.id)"
                >
                  Remover
                </button>
              </td>
            </tr>
            <tr v-if="!grupos.length">
              <td colspan="7">Nenhuma linha cadastrada.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="divider"></div>
      <div class="alert info">
        <strong>Regra Aplicada</strong>
        <span>
          Intervalos como 1 A 24 são expandidos automaticamente. ANEXOS cria
          um agrupador especial para estruturas não residenciais.
        </span>
      </div>
    </template>

    <!-- Modo comum: cards -->
    <template v-else>
      <div class="section-title">
        <div>
          <div class="kicker">Etapa 2 de {{ totalSteps }}</div>
          <h2>Quais blocos ou torres existem nesta obra?</h2>
          <p>Cadastre grupos idênticos para preencher uma vez e replicar internamente.</p>
        </div>
        <button type="button" class="btn brand" @click="$emit('add-grupo')">
          Adicionar grupo
        </button>
      </div>

      <div class="grid">
        <div
          v-for="(grupo, gi) in grupos"
          :key="grupo.id"
          :id="`grupo-${grupo.id}`"
          class="card dnd-row"
          :class="{ 'dnd-dragging': dnd.draggingIndex === gi, 'dnd-over': dnd.overIndex === gi && dnd.draggingIndex !== gi }"
          :draggable="dnd.armed === gi"
          @dragstart="dnd.onDragStart(gi, $event)"
          @dragover.prevent="dnd.onDragOver(gi, $event)"
          @drop.prevent="onDropGrupo(gi)"
          @dragend="dnd.onDragEnd()"
        >
          <div class="card-header">
            <div>
              <div class="kicker">
                <span
                  class="drag-handle"
                  title="Arraste para reordenar"
                  @mousedown="dnd.arm(gi)"
                  @touchstart="dnd.arm(gi)"
                >⠿</span>
                Grupo de estrutura
              </div>
              <h3 class="card-title">{{ grupo.nome || 'Novo grupo' }}</h3>
              <p class="card-description">
                Liste os blocos ou torres que compartilham os mesmos
                pavimentos e FCKs.
              </p>
            </div>
            <div class="toolbar">
              <button
                type="button"
                class="btn sm"
                @click="$emit('duplicate-grupo', grupo.id)"
              >
                Duplicar
              </button>
              <button
                type="button"
                class="btn sm danger"
                @click="$emit('remove-grupo', grupo.id)"
              >
                Remover
              </button>
            </div>
          </div>
          <div class="card-body grid">
            <div class="field">
              <label :for="`grupo_nome_${grupo.id}`">Nome do grupo</label>
              <input
                :id="`grupo_nome_${grupo.id}`"
                class="input"
                :value="grupo.nome"
                placeholder="Exemplo: Torres 1 a 3 ou Blocos 6 a 9"
                @input="updateGrupo(grupo.id, 'nome', $event)"
              />
            </div>
            <div class="field">
              <label :for="`grupo_tipo_${grupo.id}`">Tipo visível na obra</label>
              <select
                :id="`grupo_tipo_${grupo.id}`"
                class="select"
                :value="grupo.tipoEdificacao"
                @change="onTipoChange(grupo, $event)"
              >
                <option v-for="opt in tiposComum" :key="opt" :value="opt">
                  {{ opt }}
                </option>
              </select>
            </div>
            <div class="field">
              <label :for="`grupo_range_${grupo.id}`">Quais blocos/torres fazem parte?</label>
              <div class="hint">
                Use range quando os nomes seguem uma sequência. Para nomes
                livres, separe por vírgula.
              </div>
              <input
                :id="`grupo_range_${grupo.id}`"
                :data-field-id="`${grupo.id}-numeroEstrutura`"
                class="input"
                :value="grupo.edificacoesInput"
                placeholder="Exemplo: 1 a 4 ou Torre A, Torre B"
                @input="updateGrupo(grupo.id, 'edificacoesInput', $event)"
              />
            </div>
            <div class="chips">
              <template v-if="expandedNames(grupo).length">
                <span
                  v-for="(name, idx) in expandedNames(grupo)"
                  :key="idx"
                  class="chip"
                >
                  {{ name }}
                </span>
              </template>
              <span v-else class="hint">Nenhuma estrutura gerada ainda.</span>
            </div>
          </div>
        </div>

        <div v-if="!grupos.length" class="empty">
          <strong>Nenhum grupo cadastrado.</strong>
          <br />
          Clique em Adicionar grupo para começar.
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import {
  TIPO_EDIFICACAO_PADRAO,
  TIPO_ESTRUTURA_MODELO_PROJETO,
  type Grupo,
} from '../models/setup.models';
import { expandRange, formatGroupName } from '../services/normalizationService';
import { scrollToNewItem } from '../composables/useScrollIntoNewItem';
import { createDragReorder } from '../composables/useDragReorder';

export default defineComponent({
  name: 'Step3GruposEditor',
  props: {
    grupos: { type: Array as PropType<Grupo[]>, required: true },
    isModeloProjeto: { type: Boolean, default: false },
    /** v5.22.18: prop mantida porque o Step3 ainda LÊ esse valor para
        decidir layout (Simplificado vs Completo). A troca em si agora
        acontece SÓ na Etapa 1 (Dados básicos). */
    modeloPreenchimento: { type: String, default: 'comum' },
    /** v5.22.11: 7 para cliente, 9 para equipe (em /r/). */
    totalSteps: { type: Number, default: 7 },
  },
  /* v5.22.18: emit 'change-modelo' removido. O radio foi para Etapa 1.
     Listeners @change-modelo em views ficam inofensivos (Vue ignora).
     v5.22.38: 'reorder-grupos' para drag-and-drop. */
  emits: ['add-grupo', 'remove-grupo', 'duplicate-grupo', 'update-grupo', 'reorder-grupos'],
  data() {
    return {
      tiposComum: TIPO_EDIFICACAO_PADRAO,
      tiposProjeto: TIPO_ESTRUTURA_MODELO_PROJETO,
      // v5.22.38: estado de drag-and-drop de grupos
      dnd: createDragReorder(),
    };
  },
  watch: {
    /**
     * v5.22.32: auto-scroll para o grupo recém-adicionado quando
     * o array cresce. Vide composables/useScrollIntoNewItem.
     */
    'grupos.length'(newLen: number, oldLen: number) {
      if (newLen > oldLen && newLen > 0) {
        const novo = this.grupos[newLen - 1];
        if (novo) scrollToNewItem(`#grupo-${novo.id}`);
      }
    },
  },
  methods: {
    /** v5.22.38: ao soltar a linha arrastada sobre o índice destino. */
    onDropGrupo(dropIndex: number) {
      const move = this.dnd.resolveDrop(dropIndex);
      if (move) this.$emit('reorder-grupos', move);
    },
    /**
     * v5.22.44 (a11y · WCAG 2.1.1 "Teclado"): move a linha uma posição
     * para cima (-1) ou para baixo (+1). Reusa a mesma action do
     * drag-and-drop (`reorder-grupos`), que já faz clamp e é idempotente
     * quando from === to — então não é preciso validar limites aqui.
     */
    moveGrupoTeclado(index: number, delta: number) {
      const to = index + delta;
      if (to < 0 || to >= this.grupos.length) return;
      this.$emit('reorder-grupos', { from: index, to });
    },
    updateGrupo(id: string, field: keyof Grupo, event: Event) {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      this.$emit('update-grupo', { id, field, value: target.value });
    },
    /**
     * Handler para o select de "Tipo de Estrutura" (ambos os modos).
     * Atualiza o tipo e — se a Nomenclatura no Sistema (`grupo.nome`)
     * estiver vazia ou igual ao tipo anterior — também atualiza a
     * nomenclatura para o novo tipo. Heurística: o usuário deixou a
     * nomenclatura como default; basta sincronizar.
     */
    onTipoChange(grupo: Grupo, event: Event) {
      const newTipo = (event.target as HTMLSelectElement).value;
      const oldTipo = String(grupo.tipoEdificacao || '').trim();
      this.$emit('update-grupo', {
        id: grupo.id,
        field: 'tipoEdificacao',
        value: newTipo,
      });
      const nome = String(grupo.nome || '').trim();
      if (!nome || nome === oldTipo) {
        this.$emit('update-grupo', {
          id: grupo.id,
          field: 'nome',
          value: newTipo,
        });
      }
    },
    expandedNames(grupo: Grupo): string[] {
      const expanded = expandRange(grupo.edificacoesInput);
      if (!expanded.length) return grupo.nome ? [grupo.nome] : [];
      return expanded.map((n) => formatGroupName(grupo.nome, n, grupo.tipoEdificacao));
    },
  },
});
</script>

<style scoped>
/* v5.22.47: marcador "(opcional)" no cabeçalho da coluna Projetista.
   Peso normal e cor secundária para não competir com o título da coluna.
   Cor herdada de var(--text-muted) do Design System (contraste AA já
   validado no smoke:contrast para textos secundários). */
.th-optional {
  font-weight: 400;
  font-size: 0.85em;
  color: var(--text-muted, #64748b);
  text-transform: none;
  letter-spacing: 0;
}
</style>
