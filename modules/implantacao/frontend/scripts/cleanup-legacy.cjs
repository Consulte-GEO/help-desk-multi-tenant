#!/usr/bin/env node
/**
 * cleanup-legacy.cjs · v5.20
 *
 * Pre-build guard: remove arquivos legados que possam ter sobrevivido em
 * `src/components`, `src/services` e `src/models`. Roda como primeira
 * etapa do `npm run build`, então protege CI/Netlify mesmo se o
 * desenvolvedor esquecer de fazer um `git rm` manual.
 *
 * Idempotente. Não falha se nada precisar ser removido.
 * Sem dependências externas — apenas APIs nativas do Node ≥ 14.
 *
 * v5.20:
 *   - Adicionado SubmitTicketModal.vue + ReviewView.vue (em views/)
 *   - Adicionado ticketService.ts
 *
 * v5.22.6:
 *   - Step6Preview.vue → renomeado Step7Preview.vue (preview agora é a 7ª etapa)
 *   - Step7Envio.vue + Step8Acompanhamento.vue REMOVIDOS (eram dead code,
 *     ReviewView nunca usou). Substituídos por Step8ValidacaoImplantacao.vue
 *     e Step9Acompanhamento.vue, reescritos do zero para o novo fluxo.
 *   - Adicionado Step6UsuariosObra.vue (nova Etapa 6)
 *   - Adicionado ReturnSubmissionModal.vue (modal de devolução pela equipe)
 *   - Mocks JSON (sample_*.json) REMOVIDOS — eram órfãos.
 *
 * v5.22.7:
 *   - Step7Preview.vue → renomeado Step8Preview.vue (preview agora é a 8ª etapa)
 *   - Step8ValidacaoImplantacao.vue → renomeado Step9ValidacaoImplantacao.vue
 *   - Step9Acompanhamento.vue → renomeado Step10Acompanhamento.vue
 *   - Adicionado Step7Fornecedores.vue (nova Etapa 7: Usinas + Laboratórios,
 *     até 3 emails de programação por fornecedor)
 *   - parseVolume agora REJEITA valores com >2 casas decimais (mask no Step5)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
  {
    dir: path.join(ROOT, 'src/components'),
    label: 'componente',
    allowed: new Set([
      'AppShell.vue',
      'ImportProcessPanel.vue',
      'EditDrawer.vue',
      'SidebarNav.vue',
      'Step1DadosBasicos.vue',
      'Step2TipoEstrutura.vue',
      'Step3GruposEditor.vue',
      'Step4Concretos.vue',
      'Step5PecasEditor.vue',
      'Step6UsuariosObra.vue',
      'Step7Fornecedores.vue',
      'Step8Preview.vue',
      'Step9ValidacaoImplantacao.vue',
      'Step10Acompanhamento.vue',
      'WizardFooter.vue',
      'PadraoMoldagemEditor.vue',
      'SubmitTicketModal.vue',
      'ReturnSubmissionModal.vue',
      // v5.22.19
      'ResumeDraftBanner.vue',
      // v5.22.20
      'PendenciasPanel.vue',
      // v5.22.26
      'ShareDraftLinkModal.vue',
      // help/onboarding (usado por SetupPage)
      'StepHelpPanel.vue',
    ]),
  },
  {
    dir: path.join(ROOT, 'src/services'),
    label: 'serviço',
    allowed: new Set([
      'excelExportService.ts',
      'jsonGeneratorService.ts',
      'normalizationService.ts',
      'setupAuditService.ts',
      'setupDraftService.ts',
      'setupExportService.ts',
      'supabaseClient.ts',
      'validationService.ts',
      // v5.20
      'ticketService.ts',
      // v5.22.25
      'stepMappingService.ts',
      // v5.22.26
      'setupShareService.ts',
      // v5.22.28
      'authService.ts',
      'adminQueriesService.ts',
      // v5.22.29
      'adminExportService.ts',
      // v5.22.39 — exportador do contrato criar_obra (GEO Controle Tecnológico)
      'geoControleExportService.ts',
      // help/onboarding (usado por StepHelpPanel/AdminStepHelpView)
      'stepHelpService.ts',
      'youtubeService.ts',
      // v5.22.47 — importação de planilha de implantação preenchida (Etapa 1)
      'implantacaoImportService.ts',
      'importProcessSession.ts',
    ]),
  },
  {
    dir: path.join(ROOT, 'src/models'),
    label: 'modelo',
    allowed: new Set([
      'setup.models.ts',
      'technicalMapping.models.ts',
      'validation.models.ts',
    ]),
  },
  {
    dir: path.join(ROOT, 'src/views'),
    label: 'view',
    allowed: new Set([
      'SetupPage.vue',
      // v5.20
      'ReviewView.vue',
      // v5.22
      'ClientStatusView.vue',
      // v5.22.2
      'HealthCheckView.vue',
      // v5.22.24
      'MyDraftsView.vue',
      // v5.22.28
      'AdminLoginView.vue',
      'AdminDashboardView.vue',
      // help/onboarding (rota admin)
      'AdminStepHelpView.vue',
      // v5.22.41 — Leitor de Laudos (rota in-app opcional, Opção B)
      'LaudosView.vue',
      // v5.22.42 — Importação de Planilhas (rota in-app opcional, Opção B)
      'ImportaView.vue',
      'ImportProcessView.vue',
    ]),
  },
];

let removed = 0;

console.log('▶ cleanup-legacy (pre-build guard)');

for (const target of TARGETS) {
  if (!fs.existsSync(target.dir)) {
    console.log(`  · ${path.relative(ROOT, target.dir)}: diretório ausente, pulando`);
    continue;
  }
  const entries = fs.readdirSync(target.dir);
  let removedHere = 0;
  for (const name of entries) {
    const full = path.join(target.dir, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (target.allowed.has(name)) continue;
    try {
      fs.unlinkSync(full);
      console.log(`  ✗ removido ${target.label} legado: ${path.relative(ROOT, full)}`);
      removedHere++;
      removed++;
    } catch (err) {
      console.warn(
        `  ! não consegui remover ${path.relative(ROOT, full)}: ${err.message}`,
      );
    }
  }
  if (removedHere === 0) {
    console.log(`  · ${path.relative(ROOT, target.dir)}: nada a remover`);
  }
}

if (removed > 0) {
  console.log(
    `▶ cleanup-legacy: ${removed} arquivo(s) removido(s). Faça commit das remoções (\`git status\` + \`git add -A\`).`,
  );
} else {
  console.log('▶ cleanup-legacy: tudo limpo.');
}
