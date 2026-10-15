import { createRouter, createWebHistory } from 'vue-router';
import SetupPage from '../views/SetupPage.vue';
import ReviewView from '../views/ReviewView.vue';
import ClientStatusView from '../views/ClientStatusView.vue';
import HealthCheckView from '../views/HealthCheckView.vue';
import MyDraftsView from '../views/MyDraftsView.vue';
// v5.22.28 — painel de gestão
import AdminLoginView from '../views/AdminLoginView.vue';
import AdminDashboardView from '../views/AdminDashboardView.vue';
import AdminStepHelpView from '../views/AdminStepHelpView.vue';
import { restoreSession, getCurrentUser } from '../services/authService';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'setup',
      component: SetupPage,
      meta: { title: 'Cadastro Simplificado da Estrutura da Obra' },
    },
    {
      // v5.20: rota interna da equipe Consulte GEO.
      // O token é passado por email — não exposto pela aplicação cliente.
      path: '/r/:token',
      name: 'review',
      component: ReviewView,
      meta: { title: 'Validação de implantação' },
      props: true,
    },
    {
      // v5.22: rota pública de status do cliente.
      // Token diferente do /r/ — vai no email enviado ao responsável.
      // Read-only com troca de mensagens (sem ações de aprovação).
      path: '/s/:token',
      name: 'client-status',
      component: ClientStatusView,
      meta: { title: 'Status do chamado' },
      props: true,
    },
    {
      // v5.22.2: página de diagnóstico (env vars, conectividade, RPCs).
      // Útil para troubleshoot pós-deploy.
      path: '/health',
      name: 'health',
      component: HealthCheckView,
      meta: { title: 'Health check' },
    },
    {
      // v5.22.24: lista de rascunhos do dispositivo
      // (Supabase quando online, LS quando offline).
      path: '/meus-rascunhos',
      name: 'my-drafts',
      component: MyDraftsView,
      meta: { title: 'Meus rascunhos' },
    },
    {
      // v5.22.41 — Leitor de Laudos de Rompimento.
      // Página estática real em public/laudos.html; esta view a embute via iframe.
      // Também acessível direto em /laudos pelo redirect do Netlify (Opção A).
      path: '/laudos',
      name: 'laudos',
      component: () => import('../views/LaudosView.vue'),
      meta: { title: 'Leitor de Laudos de Rompimento' },
    },
    {
      // v5.22.42 — Importação de Planilhas (Copilot V3.1).
      // Página estática real em public/importa.html; esta view a embute via iframe.
      // Também acessível direto em /importa pelo redirect do Netlify (Opção A).
      path: '/importa',
      name: 'importa',
      component: () => import('../views/ImportaView.vue'),
      meta: { title: 'Importação de Planilhas de Obras' },
    },
    {
      path: '/admin/processos/:caseId?',
      name: 'admin-import-process',
      component: () => import('../views/ImportProcessView.vue'),
      props: true,
      meta: { title: 'Revisão de implantação e importações', adminOnly: true },
    },
    /* ============================== v5.22.28 — Painel de gestão */
    {
      path: '/admin/login',
      name: 'admin-login',
      component: AdminLoginView,
      meta: {
        title: 'Login do painel de gestão',
        adminGuestOnly: true, // se já logado, redireciona pra /admin
      },
    },
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: AdminDashboardView,
      meta: {
        title: 'Painel de gestão',
        adminOnly: true, // requer autenticação admin
      },
    },
    /* v5.22.36 — Configuração de ajuda contextual por etapa */
    {
      path: '/admin/ajuda',
      name: 'admin-step-help',
      component: AdminStepHelpView,
      meta: {
        title: 'Ajuda das etapas',
        adminOnly: true,
      },
    },
  ],
});

/**
 * v5.22.28 — Guard de rotas admin. Restaura sessão antes de
 * decidir; sem isso, refresh em /admin sempre joga para login.
 *
 * Comportamento:
 *  - rota com `meta.adminOnly` + sem user → redirect /admin/login?to=<path>
 *  - rota com `meta.adminGuestOnly` + com user → redirect /admin
 *  - outras rotas: passa direto
 */
router.beforeEach(async (to) => {
  const needsRestore = to.meta?.adminOnly || to.meta?.adminGuestOnly;
  if (needsRestore && !getCurrentUser()) {
    // Tenta restaurar sessão do localStorage do Supabase
    await restoreSession();
  }
  const user = getCurrentUser();
  if (to.meta?.adminOnly && !user) {
    return {
      path: '/admin/login',
      query: { to: to.fullPath },
    };
  }
  if (to.meta?.adminGuestOnly && user) {
    return { path: '/admin' };
  }
  return true;
});

router.afterEach((to) => {
  if (typeof document !== 'undefined' && to.meta?.title) {
    document.title = `${to.meta.title} · Implantação Consulte GEO`;
  }
});

export default router;
