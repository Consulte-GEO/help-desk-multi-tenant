<template>
  <!--
    v5.22.28 — Tela de login do painel de gestão.

    Visual: tema dark fixo (não toggle), card centrado, marca da
    Consulte GEO no topo. Reusa classes do design system existente
    (.card, .btn, .input, .alert.danger). Zero CSS novo.

    Acessibilidade: form semântico, label associado, autocomplete
    correto, foco inicial no email, ENTER submete.
  -->
  <div class="admin-login-page">
    <div class="admin-login-card">
      <div class="kicker" style="color: var(--brand-fg); text-align: center;">
        Painel de gestão
      </div>
      <h1 class="card-title" style="text-align: center; margin: 8px 0 24px">
        Implantação Consulte GEO
      </h1>

      <form @submit.prevent="onSubmit" novalidate>
        <div class="field">
          <label for="adminEmail">E-mail</label>
          <input
            id="adminEmail"
            ref="emailInput"
            class="input"
            type="email"
            v-model="email"
            placeholder="seu@email.com.br"
            autocomplete="username"
            :disabled="loading"
            required
          />
        </div>

        <div class="field">
          <label for="adminPassword">Senha</label>
          <input
            id="adminPassword"
            class="input"
            type="password"
            v-model="password"
            autocomplete="current-password"
            :disabled="loading"
            required
          />
        </div>

        <div v-if="errorMsg" class="alert danger" style="margin: 16px 0">
          {{ errorMsg }}
        </div>

        <button
          type="submit"
          class="btn brand"
          style="width: 100%; margin-top: 16px"
          :disabled="!canSubmit || loading"
        >
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <p style="margin-top: 24px; color: var(--muted-fg); font-size: 13px; text-align: center">
        Acesso restrito à equipe Consulte GEO.<br>
        <a href="/" style="color: var(--brand-fg)">
          ← Voltar para a área do cliente
        </a>
      </p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { signIn } from '../services/authService';

export default defineComponent({
  name: 'AdminLoginView',
  data() {
    return {
      email: '',
      password: '',
      loading: false,
      errorMsg: '',
    };
  },
  computed: {
    canSubmit(): boolean {
      return (
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim()) &&
        this.password.length > 0
      );
    },
  },
  mounted() {
    // Foco inicial — acessibilidade
    this.$nextTick(() => {
      const el = this.$refs.emailInput as HTMLInputElement | undefined;
      el?.focus();
    });
  },
  methods: {
    async onSubmit() {
      if (!this.canSubmit || this.loading) return;
      this.loading = true;
      this.errorMsg = '';
      try {
        const result = await signIn(this.email, this.password);
        if (result.ok) {
          // Redireciona para o dashboard. ?to= preserva destino original
          // se o usuário foi mandado pra login por guard de rota.
          const to =
            (this.$route.query.to as string | undefined) || '/admin';
          this.$router.replace(to);
        } else {
          this.errorMsg = this.translateError(result.error || 'Erro desconhecido');
        }
      } finally {
        this.loading = false;
      }
    },
    /**
     * Traduz mensagens cruas do Supabase para português. Não cobre
     * todas — mostra original como fallback.
     */
    translateError(raw: string): string {
      const map: Record<string, string> = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'Email not confirmed': 'E-mail ainda não confirmado.',
        'usuario_sem_permissao_admin':
          'Este e-mail não tem permissão para acessar o painel de gestão.',
      };
      for (const [key, value] of Object.entries(map)) {
        if (raw.toLowerCase().includes(key.toLowerCase())) return value;
      }
      return raw;
    },
  },
});
</script>

<style scoped>
.admin-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--page-bg);
  padding: 24px;
}
.admin-login-card {
  background: var(--surface);
  border-radius: 16px;
  padding: 40px 32px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
</style>
