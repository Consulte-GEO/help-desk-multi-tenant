<template>
  <!--
    v5.22.24 — Lista de rascunhos do dispositivo (Supabase + LS fallback).

    Mostra TODOS os rascunhos retornados pelo listDrafts (filtrados por
    status `rascunho`, ordenados por updated_at DESC). Permite:
      - "Continuar": navega para `/?draft=:id` (cai no fluxo do mounted
        do SetupPage, que carrega o rascunho e limpa a URL)
      - "Apagar": delete soft (marca como cancelado)

    Reusa AppShell para manter sidebar/tema/topbar consistentes com o
    fluxo principal. Por ser uma rota auxiliar, não tem wizard steps
    (sidebar mostra a wizard mas em modo somente-leitura via prop
    do AppShell — opção desativada para simplicidade).

    Acessível via:
      - URL direta: /meus-rascunhos
      - Banner de retomada → botão "Ver todos" (futuro)
  -->
  <div class="app-shell" :data-theme="theme">
    <main class="main">
      <header class="topbar">
        <div>
          <div class="kicker">Rascunhos deste dispositivo</div>
          <h1 style="margin: 4px 0 0">Meus rascunhos</h1>
        </div>
        <div class="actions">
          <router-link to="/" class="btn sm">
            ← Voltar ao cadastro
          </router-link>
          <button
            type="button"
            class="btn sm"
            @click="onToggleTheme"
            :title="theme === 'light' ? 'Mudar para modo escuro' : 'Mudar para modo claro'"
          >
            {{ theme === 'light' ? 'Modo escuro' : 'Modo claro' }}
          </button>
        </div>
      </header>

      <section class="content">
        <div v-if="loading" class="empty">
          <p>Carregando rascunhos...</p>
        </div>

        <div v-else-if="error" class="alert danger">
          <strong>Não foi possível listar os rascunhos.</strong>
          <span>{{ errorMessage }}</span>
        </div>

        <div v-else-if="drafts.length === 0" class="empty">
          <p>Nenhum rascunho ainda neste dispositivo.</p>
          <p>
            <router-link to="/" class="btn sm brand">
              Começar um cadastro novo
            </router-link>
          </p>
        </div>

        <div v-else class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">{{ drafts.length }} {{ drafts.length === 1 ? 'rascunho' : 'rascunhos' }} encontrado{{ drafts.length === 1 ? '' : 's' }}</h2>
              <p class="card-description">
                Cada linha representa um cadastro em andamento neste navegador.
                Clique em "Continuar" para retomar de onde parou.
              </p>
            </div>
          </div>
          <div class="card-body">
            <table class="table">
              <thead>
                <tr>
                  <th>Obra</th>
                  <th>Código</th>
                  <th>Última edição</th>
                  <th style="width: 200px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in drafts" :key="d.id">
                  <td>
                    <strong>{{ d.obra_nome || '(sem nome)' }}</strong>
                  </td>
                  <td>{{ d.obra_codigo || '—' }}</td>
                  <td>
                    <span :title="d.updated_at">{{ formatDate(d.updated_at) }}</span>
                  </td>
                  <td>
                    <div class="toolbar" style="justify-content: flex-end">
                      <router-link
                        :to="`/?draft=${encodeURIComponent(d.id)}`"
                        class="btn xs primary"
                      >
                        Continuar
                      </router-link>
                      <button
                        type="button"
                        class="btn xs danger"
                        :disabled="deleting === d.id"
                        @click="onDelete(d)"
                      >
                        {{ deleting === d.id ? 'Apagando...' : 'Apagar' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { listDrafts, deleteDraft, clearLastDraftPointer, getLastDraftPointer, type SetupDraftRow } from '../services/setupDraftService';

export default defineComponent({
  name: 'MyDraftsView',
  data() {
    return {
      loading: true,
      error: false,
      errorMessage: '',
      drafts: [] as SetupDraftRow[],
      deleting: null as string | null,
      // Tema sincronizado com localStorage manual — esta view NÃO usa
      // store/Vuex porque é leve e independente do fluxo de setup.
      theme: 'light' as 'light' | 'dark',
    };
  },
  async mounted() {
    // Restaura tema do dataset do <html> (já setado por outras telas
    // que usam Vuex). Se vier vazio, default light.
    const docTheme = (document.documentElement.dataset.theme as 'light' | 'dark') || 'light';
    this.theme = docTheme;
    document.title = 'Meus rascunhos · Implantação Consulte GEO';
    await this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      this.error = false;
      this.errorMessage = '';
      try {
        const all = await listDrafts();
        // Mostra só rascunhos ativos — ignora os marcados como cancelado/enviado
        this.drafts = all.filter((d) => d.status === 'rascunho');
      } catch (err) {
        this.error = true;
        this.errorMessage = err instanceof Error ? err.message : String(err);
      } finally {
        this.loading = false;
      }
    },
    formatDate(iso: string): string {
      if (!iso) return '—';
      try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        // Formato curto pt-BR — "20/05/2026 14:32"
        return d.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return iso;
      }
    },
    async onDelete(d: SetupDraftRow) {
      const obraLabel = d.obra_nome || '(sem nome)';
      if (!window.confirm(`Apagar o rascunho "${obraLabel}"?\n\nIsso não pode ser desfeito.`)) {
        return;
      }
      this.deleting = d.id;
      try {
        await deleteDraft(d.id);
        // Se o rascunho apagado é o "último editado" deste browser,
        // limpa o pointer para o banner não tentar reabri-lo depois.
        const pointer = getLastDraftPointer();
        if (pointer?.id === d.id) {
          clearLastDraftPointer();
        }
        // Remove da lista local em vez de re-listar (mais rápido + UI snappy)
        this.drafts = this.drafts.filter((x) => x.id !== d.id);
      } catch (err) {
        // Mostra erro inline mas mantém a lista — usuário pode tentar outro.
        this.error = true;
        this.errorMessage = err instanceof Error ? err.message : String(err);
      } finally {
        this.deleting = null;
      }
    },
    onToggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = this.theme;
    },
  },
});
</script>
