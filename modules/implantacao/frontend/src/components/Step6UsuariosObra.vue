<template>
  <div>
    <div class="kicker">Etapa 5 de {{ totalSteps }}</div>
    <h2 style="margin: 4px 0 4px">Usuários da obra</h2>
    <p class="card-description">
      Cadastre as pessoas que terão acesso ao Consulte GEO para esta obra,
      indicando o perfil de cada uma. A quantidade de usuários é ilimitada.
    </p>

    <!-- Cards informativos dos perfis -->
    <div class="card" style="margin-top: 16px">
      <div class="card-header">
        <div>
          <h3 class="card-title">Perfis disponíveis</h3>
          <p class="card-description">
            Use estes perfis ao cadastrar cada usuário. A descrição abaixo
            ajuda a escolher o perfil mais adequado para cada pessoa.
          </p>
        </div>
      </div>
      <div class="card-body grid grid-2 perfis-grid">
        <div
          v-for="(info, key) in perfisInfo"
          :key="key"
          class="perfil-card"
        >
          <div class="perfil-card-title">{{ info.label }}</div>
          <div class="perfil-card-body">{{ info.descricao }}</div>
        </div>
      </div>
    </div>

    <!-- Tabela de usuários -->
    <div class="card" style="margin-top: 16px">
      <div class="card-header">
        <div>
          <h3 class="card-title">Lista de usuários</h3>
          <p class="card-description">
            {{ usuarios.length }} usuário(s) cadastrado(s). Adicione um
            para cada pessoa que vai acessar o sistema desta obra.
          </p>
        </div>
        <div class="toolbar">
          <button
            type="button"
            class="btn brand"
            @click="$emit('add-usuario')"
          >
            Adicionar usuário
          </button>
        </div>
      </div>
      <div class="card-body grid">
        <div v-if="usuarios.length === 0" class="empty">
          Nenhum usuário cadastrado ainda. Use o botão acima para começar.
        </div>

        <div
          v-for="(u, idx) in usuarios"
          :key="u.id"
          :id="`usuario-${u.id}`"
          class="user-card"
        >
          <div class="user-card-header">
            <div class="kicker">Usuário {{ idx + 1 }}</div>
            <button
              type="button"
              class="btn sm danger"
              @click="$emit('remove-usuario', u.id)"
              title="Remover este usuário"
            >
              Remover
            </button>
          </div>
          <div class="grid grid-2">
            <div class="field">
              <label :for="`usr-nome-${u.id}`">Nome do usuário</label>
              <input
                :id="`usr-nome-${u.id}`"
                class="input"
                type="text"
                :value="u.nome"
                placeholder="Exemplo: Alessandro Oliveira Morimoto"
                @input="onField(u.id, 'nome', $event)"
              />
            </div>
            <div class="field">
              <label :for="`usr-email-${u.id}`">E-mail</label>
              <input
                :id="`usr-email-${u.id}`"
                class="input"
                type="email"
                :value="u.email"
                placeholder="Exemplo: alessandro.morimoto@empresa.com.br"
                @input="onField(u.id, 'email', $event)"
              />
            </div>
            <div class="field">
              <label :for="`usr-cargo-${u.id}`">Cargo</label>
              <input
                :id="`usr-cargo-${u.id}`"
                class="input"
                type="text"
                :value="u.cargo"
                placeholder="Exemplo: Engenheiro Residente"
                @input="onField(u.id, 'cargo', $event)"
              />
            </div>
            <div class="field">
              <label :for="`usr-tel-${u.id}`">Telefone</label>
              <input
                :id="`usr-tel-${u.id}`"
                class="input"
                type="tel"
                :value="u.telefone"
                placeholder="Exemplo: +55 11 97216-4706"
                @input="onField(u.id, 'telefone', $event)"
              />
            </div>
            <div class="field" style="grid-column: 1 / -1">
              <label :for="`usr-perfil-${u.id}`">Perfil / Grupo Acesso</label>
              <select
                :id="`usr-perfil-${u.id}`"
                class="input"
                :value="u.perfil"
                @change="onField(u.id, 'perfil', $event)"
              >
                <option value="">Selecione o perfil...</option>
                <option
                  v-for="(info, key) in perfisInfo"
                  :key="key"
                  :value="key"
                >
                  {{ info.label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="usuarios.length > 0" style="text-align: center">
          <button
            type="button"
            class="btn brand"
            @click="$emit('add-usuario')"
          >
            Adicionar outro usuário
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { PERFIS_INFO, type UsuarioObra } from '../models/setup.models';
import { scrollToNewItem } from '../composables/useScrollIntoNewItem';

export default defineComponent({
  name: 'Step6UsuariosObra',
  props: {
    usuarios: { type: Array as PropType<UsuarioObra[]>, required: true },
    /** v5.22.6: total de etapas — 7 para cliente, 9 para equipe. */
    totalSteps: { type: Number, default: 7 },
  },
  emits: ['add-usuario', 'remove-usuario', 'update-usuario'],
  data() {
    return {
      perfisInfo: PERFIS_INFO,
    };
  },
  watch: {
    /** v5.22.32: auto-scroll para o usuário recém-adicionado. */
    'usuarios.length'(newLen: number, oldLen: number) {
      if (newLen > oldLen && newLen > 0) {
        const novo = this.usuarios[newLen - 1];
        if (novo) scrollToNewItem(`#usuario-${novo.id}`);
      }
    },
  },
  methods: {
    onField(id: string, field: keyof UsuarioObra, e: Event) {
      const target = e.target as HTMLInputElement | HTMLSelectElement;
      this.$emit('update-usuario', { id, field, value: target.value });
    },
  },
});
</script>

<style scoped>
.perfis-grid {
  gap: 12px;
}
.perfil-card {
  background: color-mix(in srgb, var(--brand-magenta) 8%, var(--surface-raised));
  border: 1px solid color-mix(in srgb, var(--brand-magenta) 26%, var(--border));
  border-radius: var(--radius-lg);
  padding: 12px 14px;
}
.perfil-card-title {
  font-weight: 700;
  color: var(--brand-magenta);
  margin-bottom: 6px;
  font-size: 14px;
}
.perfil-card-body {
  font-size: 13px;
  color: var(--fg);
  line-height: 1.45;
}
[data-theme="dark"] .perfil-card {
  background: color-mix(in srgb, var(--brand-magenta) 18%, var(--surface-raised));
}
.user-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px;
  background: var(--surface-raised);
}
.user-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.empty {
  padding: 24px;
  text-align: center;
  color: var(--fg-muted);
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
}
@media (max-width: 760px) {
  .perfis-grid {
    grid-template-columns: 1fr;
  }
}
</style>
