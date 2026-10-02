# Tarefa executável — integrar Help Desk M1-R15

Leia integralmente PROJECT_HELP_DESK.md, README.md, AGENTS.md, docs85–88, handoffR9 e manifesto. Help Desk genérico multiproduto/multicontrato; não incorporar campos GeoLab/Financeiro ao core.

## 1. Identificar base e aplicar uma variante
```bash
git status --short
git branch --show-current
git rev-parse HEAD
```
Conferir `78bbb00112331531168ae24600604cb7f3148770` ou versão posterior realmente existente. O pacote R15 não autoriza publicação ou alterações externas. Não sobrescrever trabalho concorrente. Confira os hashes antes/depois registrados no manifesto. Crie uma branch local de integração conforme as regras do workspace.

No R9 sem R10–R14, use somente:
```bash
git apply --check /CAMINHO/DO/PACOTE/helpdesk-m1-r10-r15.patch
git apply /CAMINHO/DO/PACOTE/helpdesk-m1-r10-r15.patch
```
No R14 EXATO, substitua o nome por `helpdesk-m1-r15-only.patch`. Em checkout intermediário, reconcilie: não force, não use ambos os patches, não reaplique R2–R9. Aplique num checkout real; `changes/` não é o repositório inteiro.

## 2. Validar a instalação e o código
```bash
npm ci --ignore-scripts
npm run check:lock
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```
Usar ambientes e registry autorizados. PostgreSQL17 descartável, login restrito e209cenários; nunca apontar a fixture SQL a Supabase remoto. Exigir1364testes de aplicação e71HTTP/browser aprovados sem skips, todos associados à mesma fonte. Falha de infraestrutura não é aprovação; preservar logs. Migrations imutáveis. Não atualizar lock apenas para fazer passar sem revisão de dependências.

## 3. Conferir o plano M2M, sem rede
```bash
npm run --silent test:hosted:write -- --config examples/hosted-write-m2m.fixture.json
```
Esperado: `planned`, `transport:none`,28controles prévios e39verificações de gravação/leitura, bloco `machine` com chaves separadas, todas as flags operacionais false. IDs/domínios de exemplo são fictícios.
Sem `includeMachineWrites:true`, o comando mantém somente18passos humanos. Não alterar a configuração antiga já aprovada silenciosamente. O novo campo faz parte do hash de consentimento.

## 4. Execução hospedada — somente sob autorização atual
Não executar esta seção por inferência de um “continue”. Exige origem imutável, ambiente/dados/canais/outbox isolados, três humanos e integração A pré-provisionados; quatro sessões limitadas ao destino, cobertura explícita e autorização para recursos sintéticos persistentes.
Copiar o exemplo para arquivo privado de homologação com IDs reais DE TESTE. Manter executionId estável por intenção e revisar hash do plano. Guardar tokens apenas nas variáveis `HELPDESK_TEST_HUMAN_A`, `HELPDESK_TEST_HUMAN_B`, `HELPDESK_TEST_AGENT_A`, `HELPDESK_TEST_M2M_SESSION_A`, obtidas por canal autorizado. Não colar segredos no prompt ou CLI.

```bash
npm run --silent test:hosted:write -- --config /CAMINHO/PRIVADO/fixture.json --execute --allow-ticket-mutations --confirm-origin <ORIGEM_IMUTAVEL_CONFERIDA> --confirm-config-sha256 <HASH_EXATO_DO_PLANO>
```
O percurso preserva18passos humanos e21M2M, verifica conta/produto, autoria separada, notas/prioridade proibidas e replays. Conta/produto não autorizados retornam404/resource_not_found; notas/prioridade403/forbidden. ResultadoHTTPnão prova atomicidade/outbox/concorrênciaSQL. Preservar relatório e correlacionar efeitos com consulta revisada em destino autorizado. Sem exclusão automática.

Após resposta perdida, interromper novos envios. Nova invocação só com configuração/principais/chaves idênticos e retenção verificada; não gerar outro executionId ou apagar cache para resolver incerteza.

## 5. Entrega de fechamento
Atualizar estado/handoff/backlog com base, commit, CI, testes executados e bloqueados, efeitos remotos autorizados, riscos e próxima etapa. Não declarar M1 fechado por flag, frontend200 ou sucesso do cliente. Não iniciar M2 sem critériosM1. Não fazer push/PR/merge/deploy/migrations/dados/MFA/secrets/buckets sem autorização explícita atual.

Para revisão isolada sem checkout disponível, `recovery/source.tar.gz` contém a fonte executável; extrair SOMENTE em pasta nova e conferir o fingerprint. Não copiar esse snapshot por cima do checkout remoto e não usar isso como evidência do ambiente hospedado. Integração real utiliza uma das variantes de patch acima.
