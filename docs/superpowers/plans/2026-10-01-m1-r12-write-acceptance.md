# M1-R12 — Plano de implementação
> Execução inline; utilizar executing-plans e test-driven-development. Revisão independente pendente.

**Objetivo:** verificar gravações idempotentes pela API existente.
**Arquitetura:** reutilizar pré-validação R10; cliente isolado, sem alteração do domínio ou banco.
**Stack:** Node22.16/TypeScript5.8.3; fetch e leitor limitado já existentes.
**Especificação:** docs/73-M1-R12-ACEITACAO-DE-GRAVACOES.md.

## Restrições globais
API0.19/schema0.18,11 migrations e lock intactos; sem operação remota; execução de escrita exige confirmações atuais; plano sem rede; relatório não aprova produção.

## Foco de revisão
Resultado incerto jamais provoca nova chave. Mudança externa de configuração não redireciona a execução. Resposta de criação não pode apontar os chamados usados como controles prévios. Histórico/headers inválidos bloqueiam. Reexecução explícita não duplica mensagem/evento no modelo de referência.

## Tarefa 1 — Cliente e regressões
Arquivos: criar scripts/hosted-write-acceptance-core.ts; tests/m1-hosted-write-acceptance.test.ts. Consome runHostedReadAcceptance/readIdentityResponse/canonicalJson. Produz runHostedWriteAcceptance(input,tokens,options) e relatório de plano/resultado.
- [x] Criar testes de plano, confirmações, fluxo18+28, replay, resposta perdida, conflito e privacidade.
- [x] Executar testes e registrar falha por cliente ausente.
- [x] Implementar cliente mínimo conforme especificação.
- [x] Executar regressões, revisar achados e suíte completa.

## Tarefa 2 — CLI, integração e entrega
Arquivos: scripts/hosted-write-acceptance.ts; examples/hosted-write.fixture.json; package.json; docs74–76; PROJECT_HELP_DESK.md. Consome relatório de plano da tarefa1 para validar a confirmação de hash antes de ler env.
- [x] Testar CLI sem rede, validação de flags, tamanho/UTF8, origem/hash e ausência de segredos em erros.
- [x] Implementar CLI e exemplo sem credenciais; registrar toolchain indisponível sem bypass.
- [x] Atualizar piso de aplicação somente à contagem efetiva, manter209 SQL/71HTTP-browser.
- [x] Verificar duas variantes de patch, artefatos e hashes; atualizar evidências/handoff/backlog.

## Limites do fechamento
Implementação e verificações locais executadas; instalação/audit/typecheck padrão/SQL/browser e host não aprovados. Revisão independente pendente. Reaplicações/hashes registrados no manifesto externo do pacote. Nenhuma operação remota executada.
