# Homologação para Netlify — plano de execução

**Objetivo:** executar as validações pendentes e publicar somente depois de os gates reais passarem.
**Base:** 07cbeefac28e048c8fb585fb12ccf9cd07758450, codex/m1-reproducibilidade.
**Arquitetura:** runner Linux efêmero do GitHub Actions; Docker PostgreSQL17 próprio do runner existente, Chromium/Playwright, sem dados reais ou credenciais de produção. O relatório e seus logs são artefatos de CI, recuperados e conferidos antes de commit. Netlify mantém verify:release.
**Especificação:** PROJECT_HELP_DESK.md, docs/02-PLANO-DE-DESENVOLVIMENTO.md e pedido atual.

## Restrições
- Migrations históricas imutáveis; correção SQL somente em migration nova.
- Sem skips, contagens fictícias, redução de asserts ou bypass de gate.
- Push e deploy no destino autorizado; não alterar usuários, secrets, MFA ou banco remoto.
- Auth/infraestrutura do destino permanecem separados da homologação descartável.

## Passos
- [x] Conferir branch/remoto/commit, baseline e migrations.
- [ ] Teste vermelho para saída de testes contável pelo gate; fixar reporter TAP e confirmar verde.
- [ ] Teste vermelho para configuração de checkout no fingerprint; incluir .gitattributes e confirmar verde.
- [ ] Habilitar CI na branch codex, instalar Playwright em venv do runner, executar homologate:local e guardar artefatos mesmo em falha.
- [ ] Publicar mudanças na branch autorizada, acompanhar execução real e investigar falhas pela causa antes de corrigir.
- [ ] Recuperar evidências, verificar integridade e executar gate; documentar falhas ou aprovações reais.
- [ ] Somente com gate aprovado: publicar evidências e acompanhar Netlify; verificar frontend e resposta da API sem habilitar liberação fictícia.
- [ ] Atualizar estado/handoff e informar commit, deploy e bloqueios restantes.

## Revisão
Saída sem contagens deve reprovar; alteração de configuração deve invalidar evidência; EOL deve preservar SQL/logs; PostgreSQL deve ser novo/restrito; navegador sintético não deve ser chamado de Auth real. Revisão nesta sessão sem delegação.
