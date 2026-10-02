# Tarefa executável — integrar e validar Help Desk M1-R16

Leia PROJECT_HELP_DESK.md, README.md, AGENTS.md, handoff upstream R9 e docs89–92. Preserve Help Desk genérico multiproduto/multicontrato, core, migrations imutáveis e isolamento. O pacote NÃO autoriza operações externas.

## 1. Conferir base e aplicar uma única variante
```bash
git status --short
git branch --show-current
git rev-parse HEAD
```
Reinspecionar remoto e trabalho concorrente. Base remota observada: `78bbb00112331531168ae24600604cb7f3148770`. Trabalhar em branch local isolada; não sobrescrever trabalho existente nem usar force-push.

No R9 sem R10–R15:
```bash
git apply --check /CAMINHO/DO/PACOTE/helpdesk-m1-r10-r16.patch
git apply /CAMINHO/DO/PACOTE/helpdesk-m1-r10-r16.patch
```
No R15 EXATO, substituir o nome por `helpdesk-m1-r16-only.patch`. Não usar ambos. Checkouts intermediários precisam de reconciliação. Conferir arquivos e hashes originais/finais no manifesto. `changes/` não é o repositório inteiro.

## 2. Executar validação padrão
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
Exigir 1.375 testes de aplicação, 209 PostgreSQL17 e 71 HTTP/browser sem skips, mesma fonte e evidências reais. Tipos globais/compilador suplementar não substituem instalação padrão. Não trocar registry ou adulterar lock/log para contornar erro. A suíte SQL é exclusiva de banco novo/descartável local, nunca Supabase hospedado. Não aumentar timeout só para aprovar.

## 3. Revisar os planos sem rede
```bash
npm run --silent test:hosted:write -- --config examples/hosted-write.fixture.json
npm run --silent test:hosted:write -- --config examples/hosted-write-m2m.fixture.json
```
Esperado: `planned`, `transport:none`, sem leitura de tokens. Legado: 18 etapas. M2M: 43 etapas e 28 controles prévios. Os quatro últimos IDs são `machine-post-denials-notes`, `machine-post-denials-human-ticket`, `machine-post-denials-human-messages`, `machine-post-denials-human-timeline`; nenhum tem chave de mutação. Flags operacionais permanecem false.

## 4. Aceitação hospedada, somente sob autorização atual
Não executar esta seção por inferência de um “continue”. Requer ambiente/fixtures/outbox/canais isolados, identidade humana e integração limitadas, cobertura explícita, origem imutável e confirmação literal do hash do plano. Usar quatro sessões nas variáveis de ambiente documentadas no R10; nunca colar tokens/senhas em prompt, CLI, logs ou artefatos.

```bash
npm run --silent test:hosted:write -- --config /CAMINHO/PRIVADO/fixture.json --execute --allow-ticket-mutations --confirm-origin <ORIGEM_IMUTAVEL> --confirm-config-sha256 <HASH_DO_PLANO>
```
Não existe nova opção no R16. `includeMachineWrites:true` continua sendo o opt-in anterior. Mesma configuração mantém hash e chaves; as quatro leituras extras não criam novas intenções mutáveis. Divergência nas leituras finais reprova/interrompe; não concluir automaticamente que a recusa causou a mudança. Não limpar registros, renovar executionId ou tentar corrigir dados. Identificar a causa e correlacionar efeitos com SQL autorizado.

## 5. Revisão e entrega
Verificar especialmente nota persistida sob 403, mensagem humana persistida sob 404, alteração sem incremento de versão, paginação/indisponibilidade das notas e não exposição dos corpos no relatório. Os testes locais injetam esses defeitos APENAS em memória sintética; não são incidentes no produto.

Atualizar estado/handoff/backlog com base, commit, CI, aplicação/PostgreSQL/browser efetivamente executados, bloqueios e riscos. Não liberar HELPDESK_RELEASE_APPROVED ou iniciar M2 com base em sucesso HTTP. Push/PR/merge/deploy, migrations/dados/usuários/MFA/secrets/buckets exigem autorização explícita atual.

`recovery/source.tar.gz` destina-se somente à extração em pasta nova para revisão/recuperação; conferir fingerprint. Não substitui checkout upstream nem contém história Git completa ou evidência de homologação.
