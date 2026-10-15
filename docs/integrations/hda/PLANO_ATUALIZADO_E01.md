# Plano de desenvolvimento atualizado — V2 / E01

**Épico:** HD-DA-CADASTROS. **Data:** 14/10/2026. Este documento acrescenta execução ao plano V2; não elimina requisitos nem substitui o backlog original. Nenhum pacote com aceite de origem/banco/browser foi marcado concluído por existir código local.

## Estado por pacote

| ID | Estado E01 | Entregue / trabalho restante |
|---|---|---|
| HDA-00 | Parcial; qualificação real pendente | Estado do Help Desk reinspecionado, inventários e roteiro. Falta código/API/IdP e instalação real do agente |
| HDA-01 | Domínio local implementado; aceite integrado pendente | Contratos, parser, schema, catálogo, canonicalização/vetores e análise. Faltam regressão integral e prova .NET; aprovação/execução não são serviços desta fatia |
| HDA-02 | Não iniciado | Persistência privada, jobs, inbox, constraints, CAS/leases/fencing e testes PG17 |
| HDA-03 | Não iniciado | Acoplamento atômico à abertura/revisão real do chamado |
| HDA-04 | Não iniciado como runner | Parser candidato disponível; processo CLI supervisionado, limites e autenticação ainda pendentes |
| HDA-05 | Parcial | `preview-contract` local entregue; `preview-real`, leitura/ACL e HTTP não implementados |
| HDA-06 | Não iniciado | Tela de rascunho/diff, estados assíncronos e testes de navegador |
| HDA-07 | Não iniciado | Serviço de aprovação humana de execução e intenção atômica, diferente da aprovação do atendimento |
| HDA-08 | Não iniciado | Executor/ledger/lookup da origem, efeito único e prova .NET |
| HDA-09 | Não iniciado | Callback autenticado, inbox durável e conciliação de escrita indeterminada |
| HDA-10 | Não iniciado para eventos HDA | Consumir o outbox/worker já existentes, sem reconstruir canal Resend |
| HDA-11 | Não iniciado | Integração, regressão completa, promoção controlada e piloto autorizado |
| HDA-12 | Não iniciado | Cadastro novo de usuário, etapas IdP/GEO/vínculos/convite |
| HDA-13 | Não iniciado | Expansão por action-key, sem herdar aprovação genérica |

**F1 não está concluída.** Ter máquina pura e contratos não oferece análise automática durável nem interface utilizável. Nenhum percentual geral de conclusão foi calculado.

## Próximo incremento: HDA-02 no checkout completo

### Entrada obrigatória

Ler AGENTS/PROJECT e relatórios mais recentes, verificar HEAD, migrations e contratos atuais. Em E01 a fonte já registra schema0.24/17 migrations; não fixar esse número como eterno e não aplicar receitas antigas0.19/0.23. Reexecutar regressão da base antes de adicionar schema. Resolver ambiente PG17 descartável com identidades restritas sem tocar no Supabase hospedado.

### Trabalho executável

1. Mapear o mecanismo de UnitOfWork/locks, autoria, scope, admission receipts, inbox/outbox e manifests já existentes. Especificar em ADR o reuso antes de criar infraestrutura paralela.
2. Criar testes negativos reais de isolamento workspace/conta/alvo, mesmo ID em dois tenants, replay divergente, claim simultâneo, lease vencido, confirmação perdida e rollback após gravação parcial.
3. Persistir operação, snapshots imutáveis e revisões de rascunho em schemas privados, usando chaves compostas/constraints de ownership. O app não ganha DML amplo e o runner não ganha poder de aprovação.
4. Implementar funções/transações mínimas de criação, claim, conclusão de análise, nova revisão e cancelamento. A decisão pura E01 não emite lease nem prova identidade. Ler revisão/fence/ACL efetivos dentro da transação.
5. Criar inbox durável por remetente/eventId/hash. Replay deve recuperar recibo original; conflito não chama novamente o domínio nem gera job. Cobrir eventos antigos, não apenas lastEvent.
6. Distinguir job de análise e execução mesmo antes de existir executor; proibir claim de escrita no runner de análise. Não criar transição approved/committed sem HDA-07/08.
7. Gerar migration pela ferramenta oficial após conferir seu help/versão e o procedimento do projeto. Não editar migrations históricas; atualizar manifest/readiness/contratos no mesmo incremento, com evidência da fonte consolidada.
8. Executar instalação limpa, upgrade histórico, RLS/FORCE, direitos/defaults, rollback, concorrência real e regressão. Entregar patch/ZIP cumulativo, evidências e plano revisado.

### Critério de saída

A operação e a análise ficam recuperáveis após falha/reinício no banco descartável, com prova de isolamento e idempotência; nenhuma escrita na origem ou ativação automática. HDA-03 liga isso à abertura somente após a prova transacional.

## Qualificação em paralelo

HDA-00 deve fornecer origem e host reais. HDA-04 poderá ser preparado com fixtures de subprocesso, mas não operar até concluir qualificação de ferramentas/credenciais/versão. HDA-05.preview-real pode avançar quando a API de leitura sem efeitos estiver comprovada. Nenhum desses trabalhos deve atrasar análise documental de segurança nem fabricar endpoints.

## Dependências de outras frentes

- Core, catálogo e e-mails: existem avanços após V2; reaproveitar, não reinstalar/reverter. A aprovação genérica continua sem poder de escrita externa.
- Wiki: conteúdo interno é recuperado apenas por fonte e versão autorizadas; proxy `/wiki/` não equivale a autenticação do runner.
- Setup/OCR/planilhas: somente artefatos tipados com versão/hash/scan/ACL; fora da entrada piloto E01. Não importar HTML/script como comando.
- UX: montar somente quando existirem serviços reais correspondentes; conservar sessão, temas, políticas CSP e limpeza de resposta atrasada.
- Release: a aprovação para desenvolver não autoriza ativar credenciais, migrations hospedadas, envio real ou cadastro de cliente.

## Correções de rastreabilidade da V2

A matriz original preservou alguns marcos antigos: runner aparece como HDA-05, prévia como HDA-04, IdP como HDA-11 e piloto como HDA-12. Na matriz de execução E01 esses marcos são resolvidos contra a descrição dos pacotes V2: **04 runner;05 origem;11 piloto;12 IdP**. Os casos continuam com os mesmos IDs. X04 é condição de teste de drift, não fotografia atual de schema0.19.

## Reinspeção final de concorrência

Antes do empacotamento foi observado o novo HEAD `875df195745c950590d851f91eb609e7b98a1119`, merge PR38 (Email Kit, primeira onda). O compare contra `511523bea50c053a3bf1ac027be7a4ff01414930` retornou quatro commits e mudanças em22 arquivos de notificações/documentação/evidências/testes. Nenhum path coincide com as adições HDA E01 nem com os três arquivos do contexto local. Essa conferência é de metadados e paths, não regressão/avaliação completa da nova base. Preservar a onda de e-mails e reexecutar os gates no HEAD consolidado no Codex. Evidência: `25-final-upstream-recheck.json`.
