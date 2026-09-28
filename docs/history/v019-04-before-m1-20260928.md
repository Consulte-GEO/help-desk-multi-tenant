# Help Desk v0.19.0 — Estado e evidências

**Entrega local, não publicada. M1 permanece aberto.** Base: `3ecd5abb185cf04333c00b6f5349b5563a5779d4`. Branch `work/helpdesk-v0.19.0`. Verificações em17/09/2026; logs UTC. O commit final acompanha o manifesto externo e o bundle.

## Implementação e compatibilidade
Correção da comparação de vigência contratual com microssegundos, validação integral das coberturas retornadas pelo adaptador antes de resolver/criar e erro503 seguro para configuração incompatível. Preserva replay após vencimento, snapshots, relógio amostrado após esperar as coberturas e todos os controles de nota-only/efeitos/confirmacão da v0.18. O catálogo de memória filtra o escopo antes de interpretar períodos; dados estrangeiros inválidos não derrubam a descoberta autorizada.

API/interface0.19.0; schema esperado0.18.0;11 migrations intactas,25 tabelas candidatas,18 operações/14 caminhos. Sem novo endpoint, grant, dependency, tela ou migration. Documentação técnica em23-VIGENCIA-E-INTEGRIDADE-CONTRATUAL.md.

## Verificações executadas
Todos os caminhos de evidência abaixo são relativos a `evidence/v019/`.

| Verificação | Resultado e alcance | Evidência |
|---|---|---|
| Base antes da alteração |1.002 testes locais aprovados |00-baseline-tests.txt |
| Suíte Node final |**1.040 aprovados; zero falhas, cancelados, ignorados ou TODO**,38 novos |28-final-tests.txt |
| HTTP novo de contratos |**Três aprovados, incluídos nos1.040**; sockets reais, identidade sintética e memória |11-contract-http-reviewed.txt |
| HTTP da demonstração |**35 checks aprovados**; o runner falhou depois no browser |17-ui-attempt.txt |
| Integridade de migrations |Onze arquivos conferidos, todos iguais à base; nenhuma execuçãoSQL |29-final-migrations.txt; migration-integrity.json |
| TypeScript do manifesto/verify |**Falhou(2)** após passar migrations e1.040 testes; dependências/tipos locais ausentes |20-verify-standard.txt |
| TypeScript suplementar |Saída0 com compilador/tipos globais existentes; não equivale a npm ci |31-final-typecheck-supplemental.txt |
| OpenAPI |18 operações/14 caminhos; verificação estrutural, não conformidade integral |30-final-contracts.txt |
| Sintaxe |26 arquivos JS/MJS/Python verificados |26-syntax.json |
| Build |Somente frontend estático aprovado; sem bundle de Functions |33-final-build.txt |
| Scan heurístico |Nenhum padrão reconhecido; não pentest/auditoria integral |32-final-secret-scan.txt |
| Diff |Sem erro de whitespace |34-diff-check.txt |
| Homologação agregada/check/publicação |**Não aprovadas**; lock falhou e dependentes ficaram bloqueadas |22–24; evidence/homologation/latest.json |

Testes locais incluem domínio real, estado puro, helpers e respostas controladas do driver. Sockets reais não transformam memória em PostgreSQL nem autenticação sintética em Supabase. Os cinco casosSQL novos não foram incluídos nas aprovações locais.

## Regressões e revisão
- Na base,31 testes contratuais tiveram28 falhas e3 aprovações; depois31 passaram (03/04).
- A primeira suíte completa detectou o fixture antigo de contrato futuro com fim igual ao início. Corrigido o fim para2028, mantendo o resultado de não elegibilidade e acrescentando teste explícito de recusa do intervalo vazio. Não houve relaxamento da regra.
- Uma regressão mostrou que a interpretação estrita de datas no catálogo de memória ocorria antes de excluir outro workspace. O filtro foi movido antes da resolução, mantendo o caso estrangeiro fora do resultado (07/08).
- O primeiro arquivoHTTP falhou na carga por propriedade de parâmetro TypeScript não suportada em strip-only. Foi corrigida a declaração do fixture; essa falha de carga não foi contabilizada como regressão do produto (10/11).
- O compilador suplementar detectou inferência circular de uma variável do teste; a anotação explícita foi aplicada e a checagem repetida com saída0 (12/13).
- Revisados diff, limites do parser, flags/dadosJSON, autenticação antes da consulta, rollback, compatibilidade do recibo e ausência de mudança no SQL histórico. **Revisão local, sem revisor independente ou subagente.**

## Bloqueado ou não executado
**Dependências:** `npm run deps:resolve` retornou `EAI_AGAIN registry.npmjs.org` (01). Sem package-lock real, npm ci, auditoria ou árvore de dependências instalada/revisada. Nenhum registry alternativo ou alteração de política de rede. A checagem global é apenas suplementar.

**PostgreSQL:** runner recusou Docker ausente antes da conexão (02/25). Há**201 cenários escritos:185 principais e16 upgrade**, cinco novos; zero executados contra servidor real nesta rodada. `pg_config` do ambiente não constitui servidor instalado. Uma tentativa de obter fonte no endereço oficial não concluiu o download; nenhum PostgreSQL foi instalado/iniciado. Não foi usado Supabase remoto, limpeza de banco existente ou bypass de política como alternativa.

**Browser:** os35HTTP passaram; Playwright parou em `page.goto` com `ERR_BLOCKED_BY_ADMINISTRATOR`.36 checks browser permanecem escritos, zero aprovados. A suíte humana subsequente não foi alcançada depois da falha. Nenhum screenshot, acessibilidade, mobile ouDOM aprovado nesta rodada.

**Destino/operação:** Auth real, pooler/TLS/IP, Functions com pg instalado, RLS/grants/locks/triggers reais, latência/capacidade, backup/restore e governança continuam pendentes. Precisão lógica não garante relógios sincronizados. O guard SQL de criação e as políticas devem ser validados conjuntamente; a correção do comparador não prova autorização real do banco.

O gate exige1040/201/71 aprovações efetivas, respectivamente locais/SQL/HTTP+browser, sem skips. Ele não foi aprovado. Mesmo um sucesso local não liberaria produção ou substituiria os critérios do destino.

## Efeito remoto e continuidade
**Nenhuma inspeção ou escrita remota nesta rodada:** sem push/PR/merge/deploy/migration, alteração de dados, usuário, segredo, MFA ou infraestrutura cobrada. O estado remoto histórico não é apresentado como atual.

Prioridade: dependências reais → PostgreSQL17 e upgrade → perfis e transações/runtime/Auth/Functions → navegador → capacidade/restore/revisão operacional. M1 aberto; M2, anexos, SLA operacional, dispatcher e conectores reais não entregues.

O pacote inclui o histórico Git e os logs; o commit final é informado no manifesto externo. A evidência da recuperação do bundle, realizada após o commit, acompanha o pacote separadamente para evitar autorreferência do hash.
