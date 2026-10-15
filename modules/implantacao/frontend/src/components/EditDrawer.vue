<template>
  <!--
    v5.22.12: envolto em <Teleport to="body"> para garantir
    que o drawer renderize fora de qualquer hierarquia que possa
    interferir com position:fixed (containing blocks de transform,
    filter, backdrop-filter etc).
  -->
  <Teleport to="body">
    <div data-testid="edit-drawer-portal">
      <div class="overlay" :class="{ open }" @click="$emit('close')"></div>
      <aside class="drawer" :class="{ open }" aria-label="Edição rápida">
      <header>
        <div>
          <div class="kicker">Edição rápida</div>
          <h2 class="card-title">{{ peca ? peca.local || 'Item sem nome' : 'Item' }}</h2>
        </div>
        <button type="button" class="btn sm ghost" @click="$emit('close')">
          Fechar
        </button>
      </header>
      <div class="drawer-body">
        <template v-if="peca">
          <div class="grid">
            <div class="field">
              <label for="drawer_local">Peça ou pavimento</label>
              <input
                id="drawer_local"
                class="input"
                v-model="form.local"
                placeholder="Exemplo: 1º Pavimento"
              />
            </div>
            <div class="field">
              <label for="drawer_etapa">Etapa</label>
              <select id="drawer_etapa" class="select" v-model="form.etapa">
                <option v-for="e in etapas" :key="e" :value="e">{{ e }}</option>
              </select>
            </div>
            <div class="field">
              <label for="drawer_fck">FCK (MPa)</label>
              <input
                id="drawer_fck"
                class="input"
                type="number"
                min="10"
                max="100"
                step="1"
                v-model="form.fck"
                placeholder="Exemplo: 30"
              />
            </div>
            <div class="field">
              <label for="drawer_volume">Volume por unidade</label>
              <input
                id="drawer_volume"
                class="input"
                :value="form.volume"
                placeholder="Exemplo: 187,79"
                inputmode="decimal"
                title="Máximo 2 casas decimais (m³)"
                @input="onVolumeInput"
              />
            </div>
            <div class="field">
              <label for="drawer_obs">Observação</label>
              <input
                id="drawer_obs"
                class="input"
                v-model="form.observacoes"
                placeholder="Opcional"
              />
            </div>
            <button type="button" class="btn primary" @click="save">
              Salvar item
            </button>
          </div>
        </template>
      </div>
      </aside>
    </div>
  </Teleport>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { Peca } from '../models/setup.models';
import { ETAPAS_OPCOES } from '../models/setup.models';
import { maskVolumeInput } from '../services/normalizationService';

export default defineComponent({
  name: 'EditDrawer',
  props: {
    open: { type: Boolean, default: false },
    peca: { type: Object as PropType<Peca | null>, default: null },
    grupoId: { type: String, default: '' },
  },
  emits: ['close', 'save'],
  data() {
    return {
      etapas: ETAPAS_OPCOES,
      form: {
        local: '',
        etapa: 'Estrutura' as string,
        fck: '' as string | number,
        volume: '' as string,
        observacoes: '' as string,
      },
    };
  },
  watch: {
    peca: {
      handler(p: Peca | null) {
        if (p) {
          this.form.local = p.local;
          this.form.etapa = String(p.etapa);
          this.form.fck = p.fck;
          this.form.volume = p.volume;
          this.form.observacoes = p.observacoes;
        }
      },
      immediate: true,
    },
  },
  methods: {
    onVolumeInput(e: Event) {
      const el = e.target as HTMLInputElement;
      const masked = maskVolumeInput(el.value);
      if (masked !== el.value) {
        el.value = masked;
      }
      this.form.volume = masked;
    },
    save() {
      if (!this.peca) return;
      this.$emit('save', {
        grupoId: this.grupoId,
        pecaId: this.peca.id,
        patch: { ...this.form },
      });
    },
  },
});
</script>
