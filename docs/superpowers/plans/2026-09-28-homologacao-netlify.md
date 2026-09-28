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
- [x] Teste vermelho para saída de testes contável pelo gate; fixar reporter TAP e confirmar verde.
- [x] Teste vermelho para configuração de checkout no fingerprint; incluir .gitattributes e confirmar verde.
- [x] Habilitar CI na branch codex, instalar Playwright em venv do runner, executar homologate:local e guardar artefatos mesmo em falha.
- [x] Publicar mudanças na branch autorizada, acompanhar execução real e investigar falhas pela causa antes de corrigir.
- [x] Recuperar evidências, verificar integridade e executar gate; documentar falhas ou aprovações reais.
- [ ] Somente com gate aprovado: publicar evidências e acompanhar Netlify; verificar frontend e resposta da API sem habilitar liberação fictícia.
- [ ] Atualizar estado/handoff e informar commit, deploy e bloqueios restantes.

## Revisão
Saída sem contagens deve reprovar; alteração de configuração deve invalidar evidência; EOL deve preservar SQL/logs; PostgreSQL deve ser novo/restrito; navegador sintético não deve ser chamado de Auth real. Revisão nesta sessão sem delegação.

## Execuções reais
- 36475731482 (636601a): instalação Python falhou antes dos testes; versão inexistente corrigida para Playwright 1.63.0. Artefatos antigos não contam como execução.
- 36475904032 (0e43d3f): lock/install/audit aprovados; aplicação 1045/1045; PostgreSQL 0/201 por falha do hook (42P18 no format de senha); HTTP 35 aprovados, navegador interrompido em Route already handled.
- d99ce44: casts text em parâmetros variádicos das fixtures e manutenção das rotas interceptadas até a liberação efetiva. Nenhuma assertion removida; migrations intactas. Regressão real em 36476687740.

- 36477266647 (459f27c):199/201SQL,71/71interface. Dois asserts antigos de autorização corrigidos conforme contratos existentes, sem afrouxar proteção.
- 36477734874(c7aa0af):1045/1045aplicação,201/201SQL,71/71interface; gate e logs verificados contra git archive limpo.
- Revisão final independente release_review: sem achados críticos/importantes/menores. Nenhuma migration alterada; nenhuma aprovação de plataforma inferida. A revisão independente substitui a previsão inicial de revisão sem delegação.
