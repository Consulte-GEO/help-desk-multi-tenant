# Continuidade — v0.3.0 / M1 ainda aberto

Base v0.2.0 `922d5d16a5e30cbee05386c262d11849a8596987`. Branch local `work/helpdesk-m1-v0.3.0`; commit final no manifesto externo. Sem escrita remota. Reinspecionar GitHub/Supabase/Netlify antes de integrar: não há nova inspeção remota nesta entrega.

Leia `04-ESTADO-E-EVIDENCIAS.md`, `07-M1B-HOMOLOGACAO.md` e CHANGELOG. Há 274 testes locais aprovados e nove verificações HTTP de memória. Não afirmar PostgreSQL real, browser ou M1 homologados.

## Ordem de execução

1. Resolver dependências em ambiente autorizado (`npm run deps:resolve`); revisar lock/integridade/versões e alertas, executar instalação limpa e auditoria. A tentativa desta sessão falhou por DNS; nenhum lock foi fabricado.
2. Executar `npm run homologate:local`. O executor roda o grafo descrito no documento 07, gera logs e distingue failed/blocked/passed. A demonstração precisa de loopback 4317 livre e browser autorizado; não contornar bloqueios da política do ambiente.
3. Corrigir qualquer falha dos **35 cenários SQL** em PostgreSQL 17 novo, com as quatro migrations anteriores e papel de aplicação real. Não usar o Supabase remoto como alternativa ao banco descartável. Exercitar também guards de versão/privilégio com driver real.
4. Revisar as duas regressões novas do navegador: rascunho digitado durante envio e troca de ticket com envio pendente. O script tem 11 verificações, mas bloqueou na navegação antes de concluí-las. Typecheck global e estado puro não comprovam integração DOM.
5. Revisar as evidências, executar `npm run check:homologation`. Esse sucesso seria apenas local. Ainda é necessário empacotar Netlify Functions, validar Auth humano/M2M, revogação, pooler/TLS, RLS/grants, schemas expostos e limites no ambiente de homologação autorizado.
6. Homologar carga/abuso, retenção técnica, acessibilidade, restauração e decisões operacionais aplicáveis. Somente então avaliar fechamento do M1 e fluxo de publicação. Não alterar `HELPDESK_RELEASE_APPROVED` para ocultar uma falha.

## Arquivos prioritários para revisão

| Tema | Arquivos |
|---|---|
| Vigência após espera | `src/application/helpdesk.ts`, `tests/m1b-request.test.ts` |
| Identidade humana/M2M | `authentication.ts`, `principal-validation.ts`, `tests/m1b-auth.test.ts` |
| Entrada e paginação | `src/http/validation.ts`, `handler.ts`, `src/application/pagination.ts` |
| Envios e rascunhos | `web/mutation-state.js`, `web/app.js`, `tests/m1b-mutation-state.test.ts`, `tests/browser-smoke.py` |
| Evidência e gate | `scripts/homologation-core.mjs`, `homologate-local.mjs`, `check-homologation.mjs`, testes `m1b-homologation` |
| Processos próprios | `scripts/local-process.mjs`, `test-ui-local.mjs`, `tests/m1b-process.test.ts` |
| Assets reais | `scripts/build.mjs`, `demo.ts`, `smoke-local-http.mjs` |

O schema continua 0.2.0 e a API é 0.3.0; as migrations não mudaram. Não criar uma migration de versão sem motivo de dados/estrutura. M2 (bootstrap, usuários/vínculos, catálogo, contratos/coberturas e credenciais administrativas auditáveis) ainda não foi iniciado.

## Comandos locais já disponíveis

```bash
npm test
npm run demo
# Outra sessão local: node scripts/smoke-local-http.mjs
# Alternativa: runner de UI inicia/encerra suas próprias demonstrações:
npm run test:ui:local
```

A evidência automatizada não é assinada e requer revisão. Não copiar fixtures sintéticas ou editar relatórios para obter publicação. Nenhum pentest ou revisor independente atuou nesta sessão; foi realizada revisão local com regressões.
