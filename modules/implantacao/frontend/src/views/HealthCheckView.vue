<template>
  <div class="app-shell" :data-theme="theme">
    <main class="main">
      <header class="topbar">
        <div>
          <div class="kicker">Diagnóstico</div>
          <h1 style="margin: 4px 0 0">Health check</h1>
        </div>
        <div class="toolbar">
          <button class="btn ghost" @click="toggleTheme">
            {{ theme === 'dark' ? 'Modo claro' : 'Modo escuro' }}
          </button>
          <button class="btn" @click="runAllChecks" :disabled="running">
            {{ running ? 'Rodando...' : 'Rodar de novo' }}
          </button>
        </div>
      </header>

      <section class="content">
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Resultado geral</h2>
              <p class="card-description">
                {{ overallSummary }}
              </p>
            </div>
            <span class="badge" :class="overallBadgeClass" style="font-size: 14px; padding: 6px 14px">
              {{ overallBadgeLabel }}
            </span>
          </div>
          <div class="card-body">
            <div v-if="nextStep" class="alert" :class="nextStepClass">
              <strong>Próximo passo recomendado:</strong>
              <span>{{ nextStep }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div><h3 class="card-title">Frontend</h3></div>
          </div>
          <div class="card-body">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in frontendChecks" :key="c.key">
                    <td><strong>{{ c.label }}</strong></td>
                    <td>
                      <span class="badge" :class="c.badgeClass">{{ c.statusLabel }}</span>
                    </td>
                    <td class="mono">{{ c.detail }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div><h3 class="card-title">Backend (Supabase)</h3></div>
          </div>
          <div class="card-body">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in backendChecks" :key="c.key">
                    <td><strong>{{ c.label }}</strong></td>
                    <td>
                      <span class="badge" :class="c.badgeClass">{{ c.statusLabel }}</span>
                    </td>
                    <td class="mono">{{ c.detail }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div><h3 class="card-title">Informações adicionais</h3></div>
          </div>
          <div class="card-body">
            <pre class="json">{{ debugInfo }}</pre>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

type Status = 'ok' | 'fail' | 'warn' | 'pending';

interface Check {
  key: string;
  label: string;
  status: Status;
  detail: string;
  badgeClass: string;
  statusLabel: string;
}

function readEnv(key: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, unknown> }).env) {
      const v = ((import.meta as { env: Record<string, unknown> }).env)[key];
      if (typeof v === 'string') return v;
    }
  } catch { /* */ }
  return undefined;
}

function makeCheck(key: string, label: string, status: Status, detail: string): Check {
  const badgeMap: Record<Status, { c: string; l: string }> = {
    ok:      { c: 'success', l: '✓ OK' },
    fail:    { c: 'danger',  l: '✗ FALHA' },
    warn:    { c: 'warning', l: '! AVISO' },
    pending: { c: 'info',    l: '... verificando' },
  };
  return {
    key, label, status, detail,
    badgeClass: badgeMap[status].c,
    statusLabel: badgeMap[status].l,
  };
}

export default defineComponent({
  name: 'HealthCheckView',
  data() {
    return {
      theme: 'light' as 'light' | 'dark',
      running: false,
      frontendChecks: [] as Check[],
      backendChecks: [] as Check[],
      debugInfo: '',
    };
  },
  computed: {
    allChecks(): Check[] {
      return [...this.frontendChecks, ...this.backendChecks];
    },
    overallSummary(): string {
      const ok = this.allChecks.filter(c => c.status === 'ok').length;
      const fail = this.allChecks.filter(c => c.status === 'fail').length;
      const warn = this.allChecks.filter(c => c.status === 'warn').length;
      const total = this.allChecks.length;
      return `${ok}/${total} checks OK · ${fail} falhas · ${warn} avisos`;
    },
    overallBadgeClass(): string {
      if (this.allChecks.some(c => c.status === 'fail')) return 'danger';
      if (this.allChecks.some(c => c.status === 'warn')) return 'warning';
      if (this.allChecks.some(c => c.status === 'pending')) return 'info';
      return 'success';
    },
    overallBadgeLabel(): string {
      if (this.allChecks.some(c => c.status === 'fail')) return 'CORRIGIR';
      if (this.allChecks.some(c => c.status === 'warn')) return 'ATENÇÃO';
      if (this.allChecks.some(c => c.status === 'pending')) return 'AGUARDE';
      return 'TUDO OK';
    },
    nextStep(): string {
      const failed = this.allChecks.filter(c => c.status === 'fail');
      if (failed.length === 0) {
        const warnings = this.allChecks.filter(c => c.status === 'warn');
        if (warnings.length > 0) {
          return warnings[0].detail;
        }
        return '';
      }
      const first = failed[0];
      // Mensagem human-friendly por tipo de falha
      if (first.key === 'env_url' || first.key === 'env_anon') {
        return `Configure a variável "${first.label}" no Netlify e faça um novo deploy (Trigger deploy → Clear cache and deploy site).`;
      }
      if (first.key === 'supabase_reachable') {
        return 'Não consigo conectar no Supabase. Verifique se VITE_SUPABASE_URL está correta no Netlify (formato: https://yglcnirbnbwjqpvalqif.supabase.co).';
      }
      if (first.key === 'edge_function') {
        return 'A Edge Function não está respondendo. Rode no terminal: supabase functions deploy submit-for-validation --project-ref yglcnirbnbwjqpvalqif';
      }
      if (first.key === 'rpc_tickets' || first.key === 'rpc_status') {
        return 'As migrations SQL não foram aplicadas. Vá no SQL Editor do Supabase e execute os arquivos 005, 006, 007 e 008 em ordem.';
      }
      return first.detail;
    },
    nextStepClass(): string {
      if (this.allChecks.some(c => c.status === 'fail')) return 'danger';
      if (this.allChecks.some(c => c.status === 'warn')) return 'warning';
      return 'info';
    },
  },
  async mounted() {
    try {
      const stored = localStorage.getItem('health-theme');
      if (stored === 'dark' || stored === 'light') this.theme = stored;
    } catch { /* */ }
    document.documentElement.dataset.theme = this.theme;
    await this.runAllChecks();
  },
  methods: {
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = this.theme;
      try { localStorage.setItem('health-theme', this.theme); } catch { /* */ }
    },
    async runAllChecks() {
      this.running = true;
      this.frontendChecks = [
        makeCheck('build', 'Frontend carregado', 'pending', 'verificando build...'),
        makeCheck('env_url', 'VITE_SUPABASE_URL', 'pending', 'verificando env var...'),
        makeCheck('env_anon', 'VITE_SUPABASE_ANON_KEY', 'pending', 'verificando env var...'),
        makeCheck('env_appname', 'VITE_APP_NAME', 'pending', 'verificando env var...'),
        makeCheck('env_appenv', 'VITE_APP_ENV', 'pending', 'verificando env var...'),
      ];
      this.backendChecks = [
        makeCheck('supabase_reachable', 'Conectividade Supabase', 'pending', 'aguardando env...'),
        makeCheck('rpc_tickets', 'Tabela setup_tickets', 'pending', 'aguardando env...'),
        makeCheck('rpc_status', 'RPC get_status_by_client_token', 'pending', 'aguardando env...'),
        makeCheck('edge_function', 'Edge Function submit-for-validation', 'pending', 'aguardando env...'),
      ];

      // 1. Frontend
      this.frontendChecks[0] = makeCheck('build', 'Frontend carregado',
        'ok', `versão ${this.readAppVersion()} · timestamp build ${this.readBuildTime()}`);

      const url = readEnv('VITE_SUPABASE_URL');
      const anon = readEnv('VITE_SUPABASE_ANON_KEY');
      const appName = readEnv('VITE_APP_NAME');
      const appEnv = readEnv('VITE_APP_ENV');

      this.frontendChecks[1] = this.validateUrlEnv(url);
      this.frontendChecks[2] = this.validateAnonEnv(anon);
      this.frontendChecks[3] = appName
        ? makeCheck('env_appname', 'VITE_APP_NAME', 'ok', appName)
        : makeCheck('env_appname', 'VITE_APP_NAME', 'warn', 'vazia — usando default "Implantacao Consulte GEO"');
      this.frontendChecks[4] = appEnv
        ? makeCheck('env_appenv', 'VITE_APP_ENV', 'ok', appEnv)
        : makeCheck('env_appenv', 'VITE_APP_ENV', 'warn', 'vazia — usando default "preview"');

      // 2. Backend (só roda se env vars OK)
      if (!url || !anon) {
        this.backendChecks = this.backendChecks.map(c =>
          makeCheck(c.key, c.label, 'pending', 'pulado — configure as env vars do frontend primeiro')
        );
        this.compileDebugInfo(url, anon, appName, appEnv);
        this.running = false;
        return;
      }

      // 2a. Conectividade
      this.backendChecks[0] = await this.checkSupabaseReachable(url, anon);
      if (this.backendChecks[0].status !== 'ok') {
        this.backendChecks = this.backendChecks.map((c, i) =>
          i === 0 ? c : makeCheck(c.key, c.label, 'pending', 'pulado — Supabase inacessível')
        );
        this.compileDebugInfo(url, anon, appName, appEnv);
        this.running = false;
        return;
      }

      // 2b. RPCs
      this.backendChecks[1] = await this.checkRpcExists(url, anon, 'get_submission_by_token', 'Tabela setup_tickets', 'rpc_tickets');
      this.backendChecks[2] = await this.checkRpcExists(url, anon, 'get_status_by_client_token', 'RPC get_status_by_client_token', 'rpc_status');

      // 2c. Edge Function (ping leve)
      this.backendChecks[3] = await this.checkEdgeFunction(url, anon);

      this.compileDebugInfo(url, anon, appName, appEnv);
      this.running = false;
    },
    readAppVersion(): string {
      // injetado pelo Vite via define
      try {
        return (window as { __APP_VERSION__?: string }).__APP_VERSION__ || 'desconhecido';
      } catch { return 'desconhecido'; }
    },
    readBuildTime(): string {
      try {
        return (window as { __BUILD_TIME__?: string }).__BUILD_TIME__ || new Date().toISOString();
      } catch { return new Date().toISOString(); }
    },
    validateUrlEnv(url: string | undefined): Check {
      if (!url) {
        return makeCheck('env_url', 'VITE_SUPABASE_URL', 'fail',
          'NÃO definida. Configure no Netlify e faça novo deploy com clear cache.');
      }
      if (!url.startsWith('https://')) {
        return makeCheck('env_url', 'VITE_SUPABASE_URL', 'fail',
          `Valor inválido: "${url}" — deve começar com https://`);
      }
      if (!url.includes('.supabase.co')) {
        return makeCheck('env_url', 'VITE_SUPABASE_URL', 'fail',
          `Valor parece incorreto: "${url}" — esperado algo como https://yglcnirbnbwjqpvalqif.supabase.co`);
      }
      if (url.endsWith('/')) {
        return makeCheck('env_url', 'VITE_SUPABASE_URL', 'warn',
          `Tem barra no final: "${url}" — funciona mas o ideal é sem a barra final`);
      }
      return makeCheck('env_url', 'VITE_SUPABASE_URL', 'ok', url);
    },
    validateAnonEnv(anon: string | undefined): Check {
      if (!anon) {
        return makeCheck('env_anon', 'VITE_SUPABASE_ANON_KEY', 'fail',
          'NÃO definida. Configure no Netlify e faça novo deploy com clear cache.');
      }
      if (!anon.startsWith('eyJ')) {
        return makeCheck('env_anon', 'VITE_SUPABASE_ANON_KEY', 'fail',
          `Valor não parece um JWT (deveria começar com "eyJ"). Verifique se copiou a anon key correta do Supabase.`);
      }
      if (anon.length < 100) {
        return makeCheck('env_anon', 'VITE_SUPABASE_ANON_KEY', 'fail',
          `Valor muito curto (${anon.length} chars) — anon keys reais têm ~200 caracteres. Provavelmente foi truncada.`);
      }
      // Tenta decodificar o payload (parte do meio do JWT)
      try {
        const parts = anon.split('.');
        if (parts.length !== 3) {
          return makeCheck('env_anon', 'VITE_SUPABASE_ANON_KEY', 'fail',
            `Formato JWT inválido (deveria ter 3 partes separadas por ponto, achou ${parts.length}).`);
        }
        const payload = JSON.parse(atob(parts[1]));
        if (payload.role !== 'anon') {
          return makeCheck('env_anon', 'VITE_SUPABASE_ANON_KEY', 'fail',
            `Esta key tem role="${payload.role}". Deveria ser "anon". NUNCA use service_role no frontend!`);
        }
        const tail = anon.slice(-12);
        return makeCheck('env_anon', 'VITE_SUPABASE_ANON_KEY', 'ok',
          `JWT válido, role=anon, ref=${payload.ref || '?'}, termina em "...${tail}"`);
      } catch (err) {
        return makeCheck('env_anon', 'VITE_SUPABASE_ANON_KEY', 'fail',
          `Não conseguiu decodificar como JWT: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      }
    },
    async checkSupabaseReachable(url: string, anon: string): Promise<Check> {
      try {
        const t0 = performance.now();
        const r = await fetch(`${url}/rest/v1/`, {
          headers: { 'apikey': anon, 'Authorization': `Bearer ${anon}` },
        });
        const elapsed = Math.round(performance.now() - t0);
        if (r.status === 200 || r.status === 404) {
          // 404 do PostgREST root é normal — a API está respondendo
          return makeCheck('supabase_reachable', 'Conectividade Supabase', 'ok',
            `HTTP ${r.status} em ${elapsed}ms`);
        }
        return makeCheck('supabase_reachable', 'Conectividade Supabase', 'fail',
          `Resposta inesperada: HTTP ${r.status}`);
      } catch (err) {
        return makeCheck('supabase_reachable', 'Conectividade Supabase', 'fail',
          `Erro de rede: ${err instanceof Error ? err.message : 'desconhecido'}`);
      }
    },
    async checkRpcExists(url: string, anon: string, rpcName: string, label: string, key: string): Promise<Check> {
      try {
        // Chama RPC com payload inválido — esperamos 400 ou erro "invalid_token"
        // Isso CONFIRMA que a função EXISTE (404 significaria não existe).
        const r = await fetch(`${url}/rest/v1/rpc/${rpcName}`, {
          method: 'POST',
          headers: {
            'apikey': anon,
            'Authorization': `Bearer ${anon}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_token: '00000000-0000-0000-0000-000000000000' }),
        });
        const body = await r.text();
        if (r.status === 404) {
          return makeCheck(key, label, 'fail',
            `RPC "${rpcName}" não existe — migration não foi aplicada`);
        }
        if (r.status === 400 || r.status === 200) {
          // RPC existe e respondeu (com erro de token inválido, mas existe)
          if (body.includes('invalid_token') || body.includes('Could not find')) {
            return makeCheck(key, label, 'ok', `RPC "${rpcName}" responde (esperando token válido)`);
          }
          return makeCheck(key, label, 'ok', `RPC "${rpcName}" existe (HTTP ${r.status})`);
        }
        return makeCheck(key, label, 'warn',
          `RPC respondeu HTTP ${r.status}: ${body.slice(0, 80)}`);
      } catch (err) {
        return makeCheck(key, label, 'fail',
          `Erro chamando RPC: ${err instanceof Error ? err.message : 'desconhecido'}`);
      }
    },
    async checkEdgeFunction(url: string, anon: string): Promise<Check> {
      try {
        // Chama com OPTIONS (CORS preflight) — leve, não cria ticket
        const r = await fetch(`${url}/functions/v1/submit-for-validation`, {
          method: 'OPTIONS',
          headers: { 'apikey': anon },
        });
        if (r.status === 204 || r.status === 200) {
          return makeCheck('edge_function', 'Edge Function submit-for-validation', 'ok',
            `CORS preflight HTTP ${r.status} — função deployada`);
        }
        if (r.status === 404) {
          return makeCheck('edge_function', 'Edge Function submit-for-validation', 'fail',
            `HTTP 404 — função NÃO deployada. Rode: supabase functions deploy submit-for-validation`);
        }
        return makeCheck('edge_function', 'Edge Function submit-for-validation', 'warn',
          `CORS preflight respondeu HTTP ${r.status}`);
      } catch (err) {
        return makeCheck('edge_function', 'Edge Function submit-for-validation', 'fail',
          `Erro: ${err instanceof Error ? err.message : 'desconhecido'}`);
      }
    },
    compileDebugInfo(url: string | undefined, anon: string | undefined, appName: string | undefined, appEnv: string | undefined) {
      this.debugInfo = JSON.stringify({
        timestamp: new Date().toISOString(),
        location: {
          href: window.location.href,
          host: window.location.host,
        },
        userAgent: navigator.userAgent.slice(0, 100),
        env: {
          VITE_SUPABASE_URL: url ? `${url.slice(0, 30)}...` : '(vazia)',
          VITE_SUPABASE_URL_length: url?.length ?? 0,
          VITE_SUPABASE_ANON_KEY: anon ? `${anon.slice(0, 20)}...${anon.slice(-12)}` : '(vazia)',
          VITE_SUPABASE_ANON_KEY_length: anon?.length ?? 0,
          VITE_APP_NAME: appName ?? '(vazia)',
          VITE_APP_ENV: appEnv ?? '(vazia)',
        },
        all_vite_keys_visible: this.listAllViteKeys(),
      }, null, 2);
    },
    listAllViteKeys(): string[] {
      try {
        const env = (import.meta as { env?: Record<string, unknown> }).env;
        if (!env) return [];
        return Object.keys(env).filter(k => k.startsWith('VITE_'));
      } catch { return []; }
    },
  },
});
</script>

<style scoped>
.app-shell { display: block; }
.main { max-width: 1024px; margin: 0 auto; padding: 0 24px; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px 0; border-bottom: 1px solid var(--border); margin-bottom: 24px;
}
.content > .card { margin-bottom: 16px; }
.mono { font-family: var(--font-mono); font-size: 12px; word-break: break-all; }
@media (max-width: 760px) {
  .main { padding: 0 16px; }
  .topbar { flex-direction: column; align-items: stretch; gap: 12px; }
}
</style>
