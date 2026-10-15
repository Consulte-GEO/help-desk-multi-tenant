# Execução E02 — Help Desk / Dev Agent

**Data:** 14/10/2026. **Entrega:** E01 + E02 cumulativas. **Estado:** código local; HDA-02 parcialmente implementada, não homologada em PostgreSQL.

## Fonte e concorrência

Base lida no início: `e66814a7ed4f445c1b4897cb35b790cd71457743` (PR39 callback Resend). Última principal observada: `a06c21a8ec828ad38b04dd4005137f2fca5b6eb5` (PR40 diagnóstico de pré-condição do rascunho e prazo da qualificação de UI). A comparação mostrou mudanças em `src/http/consultegeo-drafts.ts`, `src/infrastructure/consultegeo-runtime.ts`, cliente web de intake, tooling/fixtures/evidências e documentação do Email Kit. Nenhum desses arquivos é substituído por este pacote. A árvore E01 também é preservada byte a byte.

Fontes GitHub: `https://github.com/Consulte-GEO/help-desk-multi-tenant/commit/a06c21a8ec828ad38b04dd4005137f2fca5b6eb5` e a comparação `e66814a7ed4f445c1b4897cb35b790cd71457743...a06c21a8ec828ad38b04dd4005137f2fca5b6eb5`. Inspeção por conector não é clone completo nem inspeção hospedada.

O projeto não deve voltar ao diagnóstico antigo de atendimento fechado/schema0.19. As implementações atuais de atendimento, cadastros e e-mails permanecem intocadas. Não houve consulta ou mutação do Supabase/Netlify nesta execução.

## Entregue nesta etapa

Quatro módulos TypeScript de persistência/serviço/adaptador; SQL candidato com sete tabelas privadas; suíte nativa e runner de cluster próprio; testes, contrato, plano e recibos de desenvolvimento. Comandos de preparar, reservar, completar, falhar, repetir por nova tarefa, revisar e cancelar estão implementados no recorte de análise. Rascunho continua sem aprovação e sem autorização de execução.

## Resultados e alcance

| Verificação | Resultado | Alcance |
|---|---|---|
| Testes Node | 227 aprovados; 0 falhas/skips | Subconjunto E01/E02 disponível, não suíte integral do Help Desk |
| Novos testes E02 | 105 | Incluem 16 inspeções estáticas e 11 testes de admissão do runner |
| TypeScript | Aprovado | Checagem focada com contexto explicitamente separado |
| Vetores canônicos Python | 14 válidos + 12 inválidos | Oráculo separado da implementação Node; não prova .NET/SQL |
| Sintaxe dos scripts nativos | `node --check` aprovado | JavaScript apenas, não sintaxe/execução do PL/pgSQL |
| PostgreSQL nativo | Bloqueado antes de iniciar | Falta servidor17, driver pg, checkout completo e usuário não-root |
| Regressão do core / build completo | Não executados | Clone indisponível por DNS |
| Navegador / CLI Claude / origem .NET | Não executados | Não montados nem conectados |
| Publicação / operação | Não realizadas | Sem alteração remota |

Os logs RED/GREEN, falhas intermediárias de tipos e recusa do runner são preservados. O primeiro teste de composição tinha erro de acesso ao fixture (`snapshot` em vez de `inspect`); corrigido antes de registrar a regressão válida. A regressão válida mostrou 2 positivos e 6 falhas de ACK; após correção, 8/8 passaram.

## Correções da revisão

O adaptador passou a conferir também workspace, conta, ator, binding, finalidade e horário do recibo antes de devolvê-lo; antes, essas conferências dependiam da aplicação. O teste que alterava cada campo demonstrou a falha e depois a correção.

A autorrevisão do SQL identificou diferenças de NULL e comprimento UTF-16 que foram ajustadas no candidato, com negativos incluídos na suíte nativa. Não chamamos essas alterações de corrigidas/homologadas em banco: a suíte nativa ainda não rodou. O runner conserva o diretório quando uma tentativa de inicialização/parada deixa o estado do processo incerto; a execução real desse caminho também depende do ambiente nativo.

**Revisão:** autorrevisão, sem revisor independente/subagente. Revisão independente e execução nativa são gates recomendados antes de integrar/promover a persistência.

## Não entregue / próximos gates

Não há tabela de aprovação/execução, nova migration hospedada, montagem HTTP, integração com a abertura, daemon de polling, heartbeat, sessão real da CLI, credencial de escrita ou API de execução no Novo GEO. Retenção/cotas/telemetria operacional e autorização real da origem continuam pendentes. HDA-02 não foi marcada como concluída.

Próximo passo: integrar o pacote na árvore completa preservando PR40 e posteriores; executar a suíte atual e o runner PG17; corrigir qualquer falha real; qualificar o upgrade/schema/ACL e só então seguir para HDA-03 (abertura + intenção + tarefa na mesma transação), sem ativar a automação real.
