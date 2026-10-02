> **Estado local atualizado em 01/10/2026:** R18 descrito em `PROJECT_HELP_DESK.md` e docs97–100. A próxima prioridade é integrar e executar a validação padrão/SQL/hospedada; M1 não está encerrado. Os registros abaixo descrevem entregas anteriores e não aprovam o código local atual.

# Continuidade — Help Desk v0.19.0

Base `3ecd5abb185cf04333c00b6f5349b5563a5779d4`; branch `work/helpdesk-v0.19.0`. Leia README, AGENTS, docs04/23 e plano. Não houve reinspeção/escrita remota. Antes de integrar, conferir GitHub/Supabase/Netlify e preservar trabalho concorrente; não presumir repositório vazio.

## Próxima execução
1. Resolver dependências pelo registry autorizado (`npm run deps:resolve`), revisar lock real/árvore/origens/integridades/licenças/alertas. Executar npm ci, verify e audit. Tipos globais e testes locais não substituem esse requisito; não criar lock sintético.
2. `npm run check:migrations`:11 arquivos idênticos àv0.18, schema0.18.0. API/interface0.19.0; não criar migration cosmética para igualar a versão do frontend.
3. Executar `npm run test:db:local` em PostgreSQL17 novo/descartável, com login restrito.201 cenários escritos,185 principais+16upgrade. Docker padrão; native apenas com binários autorizados e usuário não root. Sem banco remoto como fallback nem remoção de banco preexistente para fazer passar.
4. Homologar os cinco novos casosSQL019: início futuro fracionário, fim posterior no mesmo milissegundo, janela de um microssegundo, JSONB do helper em timezone não UTC e infinity recusado. A classe de relógio precisa continuar exclusiva dos testes. Ela não altera now()/statement_timestamp() do PostgreSQL.
5. Conferir resposta real de locked_coverages: array de objetos completos, flagsbooleanas, versão positiva, políticaJSON e datas com fuso explícito; o limite100 já existe no helper. Valores inválidos devem resultar em503, não lista parcial/no_coverage ou segunda escrita. O limite16KiB de JSON compacto da aplicação não substitui a constraintSQL de policy::text.
6. Testar criação com locks reais, expiração durante espera, suspensão, seleção explícita e reenvio após mudança contratual. Recibos válidos permanecem históricos e reautorizados; não reformatar data/política, repetir mutações ou apagar cache para resolver erro. Comparador exato não sincroniza os relógios API/DB.
7. Repetir perfis de notas-only, command tags, efeitos transacionais e upgrades anteriores sem retirar triggers/asserts. Esta versão não altera esses contratos nem o SQL histórico.
8. Homologar Auth/M2M/pooler/TLS/IP/Functions e executar UI35HTTP+36browser. Interface não ganhou novo controle, mas o módulo compartilhado de instantes mudou e precisa de regressão. Não contornar bloqueio de política de navegador/rede.
9. Executar homologate:local/check:homologation, revisar logs/fingerprint e as contagens1040/201/71 efetivamente aprovadas. Resolver destino/capacidade/restore/governança e aprovação explícita antes de HELPDESK_RELEASE_APPROVED. M1 continua aberto; M2 só depois.

## Arquivos de revisão
| Arquivo | Foco |
|---|---|
| shared/instant.js e .d.ts | Parser de fuso/0–6 frações, calendário e BigInt; nenhuma mudança na gramática dos cursores. |
| src/domain/contracts.ts | Limites `[start,end)`, flags reais, ordem de ID determinística e nenhum relógio global. |
| src/application/coverage-result.ts | Validação integral antes de seleção; contexto, período,JSON/limites e erro seguro. |
| src/application/helpdesk.ts | Validar antes de resolver/criar, amostrar relógio depois da espera; replay não consulta cobertura. |
| src/application/replay-result.ts | Extração do parser antigo para módulo compartilhado sem alterar recibos. |
| src/infrastructure/memory.ts | Excluir dados estrangeiros antes de interpretar períodos do catálogo. |
| tests/v019-* e supabase/tests/rls.test.ts |38 testes locais novos e5SQL escritos; não confundir com PG homologado. |
| docs/openapi.json e scripts/generate-openapi.py | Erro503 descrito, corpo/DTO anteriores preservados; versão0.19.0. |

Sem migration, endpoint, grant, dependência, edição de contrato, SLA operacional, anexos, dispatcher, administração ou conector novo. Não houve revisor independente/pentest/carga/restore. O pacote é local e não autoriza publicação.
