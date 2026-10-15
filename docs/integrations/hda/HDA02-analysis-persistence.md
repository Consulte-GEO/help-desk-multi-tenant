> **E03:** este documento preserva o checkpoint E02. ACKs/recibos, escopos do core, integridade da fila e runner foram revisados; veja [EXECUCAO_E03.md](EXECUCAO_E03.md). O SQL continua candidato não executado.

# HDA-02 — persistência da análise / E02

**Data:** 14/10/2026. **Situação:** implementação local parcial, SQL candidato não executado. Não é API pública, migração hospedada ou worker Claude operacional.

## Fronteiras

A E02 acrescenta `registration-persistence.ts` no domínio e na aplicação, `registration-job-store.ts` e o adaptador `registration-store.ts`. Consome os contratos E01 sem modificá-los. A única ação candidata continua sendo `geo.user.grant_work.v1`. Não há aprovação, execução no GEO, envio de convite, alteração de perfil ou resolução automática de chamado.

O serviço recebe um `RegistrationJobTransaction` de uma transação que já pertence ao chamador. O adaptador não abre pool, não inicia/encerra transação e não libera a conexão. Sua guarda é obrigatória e deverá ser composta com `assertBorrowedTransactionIdentity` e `rejectTransactionValidation` do core real. O guard jamais é um booleano recebido do HTTP. Qualquer falha de validação envenena a transação: capturar a exceção não pode permitir COMMIT dos efeitos anteriores.

## Comandos internos

| Comando | Ator qualificado | Efeito restrito |
|---|---|---|
| `prepare` | Pessoa | Snapshot inicial + operação + tarefa de análise + recibo |
| `claim` | Analisador técnico | Reserva exclusiva e incremento do fencing; nunca cria no GEO |
| `complete` | Mesmo analisador e reserva vigente | Análise validada + rascunho ou pendência + recibo |
| `fail` | Mesmo analisador e reserva vigente | Falha tipada da análise |
| `retry` | Pessoa | Nova tarefa após falha; fencing anterior não é zerado |
| `revise` | Pessoa | Nova revisão de entrada, mesmo alvo, e nova tarefa |
| `cancel` | Pessoa | Cancelamento da análise e invalidação da reserva |

Todos os comandos têm `commandId` UUID canônico. A identidade durável do recibo é `(workspace, ator, commandId)`; o hash inclui o escopo e o comando completo. Repetição igual retorna os metadados históricos, nunca uma nova reserva de processamento. Mesmo ID com outro conteúdo é conflito. A consulta ao recibo é posterior à reautorização atual, mas anterior à comparação da revisão corrente. Não depende apenas de `lastEvent`.

O `eventId` interno é derivado deterministicamente do workspace, ator e commandId. Não é token de acesso ou autorização. O PostgreSQL candidato recompõe o mesmo identificador e o hash de intenção.

## Reserva e falhas

A duração solicitada é de 15 a 300 segundos; o padrão documentado é 60. A validade final é limitada pela autorização qualificada. O relógio vem do banco, no perfil UTC com milissegundos da E01. Há três tentativas por tarefa; após três reservas abandonadas a tarefa é marcada como falha. Um humano pode pedir outra tarefa. São valores iniciais de engenharia, não SLOs medidos.

Cada nova reserva incrementa `analysisFence`, inclusive na retomada. O resultado exige o mesmo ator, jobId, leaseId, fence e uma reserva ainda válida. Revisar, cancelar ou retomar impede que o processo antigo ressuscite o estado anterior. A fila candidata usa lock da operação e `SKIP LOCKED`; o comportamento concorrente real depende da suíte nativa ainda pendente.

`claim` sem trabalho retorna `idle`, sem novo recibo; não houve efeito para reconciliar. Uma repetição de claim já aplicado retorna `replay` e `lease:null`, propositalmente. O chamador deve aguardar o COMMIT do `runTransaction` antes de usar uma reserva recebida. Perda de confirmação não permite começar outra análise a partir de um replay; aguardar a expiração e obter nova reserva. A E02 não implementa heartbeat/renovação de lease, daemon, escalonador ou leitura HTTP do job para a CLI: esses pontos são HDA-04.

## SQL candidato e objetos

Arquivo: `supabase/candidates/hda02_analysis_persistence.sql`. Sete tabelas privadas: `hda02_bindings`, `hda02_grants`, `hda02_operations`, `hda02_snapshots`, `hda02_jobs`, `hda02_drafts`, `hda02_inbox`. As duas primeiras são cadastros de qualificação com ativação padrão falsa, sem publicador nesta etapa. Não são permissão inferida de UUID, domínio de e-mail ou metadados do JWT.

Os nomes ficam no schema privado `helpdesk_integration`; os helpers ficam em `helpdesk_auth`. Apenas cinco helpers de entrada têm concessão prevista para os papéis restritos. Não há leitura/DML direto das tabelas para app, browser ou subprocesso Claude. O dono administrativo é distinto do papel de requisição; nenhum acesso do worker de e-mails é reaproveitado.

A proposta SQL inclui chaves compostas, validação independente das projeções E01, hashes canônicos, locks de concessões e chamado, snapshot/rascunho/inbox imutáveis, confirmação de uma linha por escrita, verificação diferida de operação/job/recibo e revalidação da expiração antes do COMMIT. Default ACL inesperada recusa a instalação. Isso descreve **código candidato**, não garantias já demonstradas pelo PostgreSQL.

A instalação é recusada fora de banco `helpdesk_test`, PostgreSQL17 e owner `hda_test_owner`, além de opt-in local. Não há `CREATE OR REPLACE` de funções do core, ajuste de schema_version, alteração de migration histórica, nova dependência ou montagem no runtime.

## Limites deliberados

Revisão que mude obra, beneficiário ou outro componente do target é recusada pela E02; HDA-00/03 deverá qualificar e versionar essa mudança. A E01 admite algumas correções puras de alvo, mas isso não autoriza persistir um alvo novo. Retentativas preservam versão do agente, conhecimento e política; atualizar configuração exige fluxo administrativo futuro.

A intenção de escrita atômica inteira tem limite de 64 KiB. Um snapshot isolado pode caber e o envelope composto exceder esse limite: nesse caso há recusa sem truncamento. Dimensionamento/chunking será uma alteração versionada, não aumento silencioso.

Não se criaram tabelas vazias de aprovação/execução nesta etapa. Essa parte do HDA-02 original fica dependente de HDA-07/08, quando haverá contratos reais de escrita e origem. O vínculo definitivo ao evento de abertura/intenção do chamado e sua unicidade continuam HDA-03; criar uma operação por comando não prova que a abertura já agenda o agente.

## Privacidade, retenção e observabilidade

O recibo contém IDs, revisão, hash, estado e horário; não duplica nome, e-mail ou texto do pedido. Snapshot, análise e rascunho são conteúdo privado necessário ao processo. Nenhum stdout bruto da CLI, segredo ou token humano é persistido por este incremento. Logs de erro expõem somente códigos seguros.

Não existe limpeza automática de histórico ou recibos. Expirar uma reserva libera processamento, não apaga informação e não amplia permissões. Retenção, tombstones, cotas de fila, índices de volume, expiração da proposta antes de aprovar e métricas operacionais precisam de política publicada na promoção. Não prometer retenção infinita, durabilidade operacional ou custo dimensionado a partir dos testes em memória.

## Verificação disponível

122 testes E01 preservados + 105 novos = 227 testes Node. Dos novos, 18 são contratos, 32 serviço com modelo transacional, 20 adaptador/transporte, 8 composição/recibo, 16 inspeções estáticas do SQL e 11 admissão do runner local. Os 16 estáticos não executam SQL; os 11 do runner não iniciam PostgreSQL.

A suíte `hda02-native-suite.mjs` está escrita e deve rodar no cluster descartável do runner. Usa papéis LOGIN distintos, PostgreSQL de verdade e `runTransaction` real do repositório completo, mas um **core sintético mínimo**. Mesmo aprová-la não substitui upgrade/replay das 17 migrations, catálogos, RLS e autenticação do core completo.

Fontes técnicas: PostgreSQL17 SELECT/locking (`https://www.postgresql.org/docs/17/sql-select.html`) e Row Security (`https://www.postgresql.org/docs/17/ddl-rowsecurity.html`). São referências, não evidência de execução deste candidato.
