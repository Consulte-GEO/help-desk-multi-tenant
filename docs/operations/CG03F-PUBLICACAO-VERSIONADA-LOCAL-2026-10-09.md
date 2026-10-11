# CG-03f — publicação versionada de cobertura (motor local)

**09/10/2026. Entrega local sobre a CG-03e local.** Não integrada ao GitHub. PR26 reinspecionado: `f60baed8022b28e067a702b3dd51031e86983017`, draft, base `796face60367e2573d112b7ae42d570055474348`. A CG-03e tampouco está no HEAD remoto. Não reaplicar o cumulativo sobre uma branch que já contenha etapas anteriores.

## Objetivo e recorte

Avançar no CG-03 do plano original: impedir publicação de cobertura parcial, concorrente ou atrasada e preservar intenções/recibos. Esta fatia implementa a decisão de consistência e a orquestração transacional através de portas do servidor. **Não implementa o adaptador PostgreSQL do publicador, uma migration, identidade externa, nova rota ou provedor real.**

O requisito e a sequência vêm do plano fornecido pelo usuário. O envelope de publicação e as portas abaixo são decisões técnicas locais propostas, não contrato da API Novo GEO. A especificação complementar não foi recuperada. Nenhum issuer, endpoint, responsável, coorte ou alçada real foi inventado.

## Arquivos

| Arquivo | Entrega |
|---|---|
| `src/domain/resource-publication.ts` | Normalização de alvo/cobertura/estado; plano de substituição por revisão esperada; instantes e hash canônicos. |
| `src/application/resource-grant-publisher.ts` | Consulta da fonte do servidor, prazo/cancelamento, revisão/recibo, integração contratual com uma transação atômica. |
| `src/domain/external-resource.ts` | Exporta o parser da cobertura completa já limitada internamente a 1000 itens; seleção de ticket permanece limitada a 100. |
| `src/infrastructure/resource-access-store.ts` | Corrige preservação indevida de mensagens de erros tipados do transporte SQL; mantém apenas códigos conhecidos com mensagens locais seguras. |
| `tests/resource-publication.test.ts` | 43 casos de consistência/revisões/cobertura/instantes. |
| `tests/resource-grant-publisher.test.ts` | 40 casos de orquestração, concorrência, recibo, timeout e falhas. |
| `tests/resource-access-store.test.ts` | 31 casos anteriores e 2 regressões de erro tipado. |
| Este documento | Contratos, decisões, evidências e promoção pendente. |

## Entrada, responsabilidade e segurança

`createResourceGrantPublisher` recebe no momento da construção uma fonte e um store do SERVIDOR, fingerprint esperado, idade máxima e timeout explícitos. O método `publish(target, expectedRevision, key, signal?)` não recebe um snapshot do browser. A fonte qualificada deve obter identidade/vínculos/cobertura e devolver um envelope completo para aquele alvo.

`ResourceGrantTarget` contém pessoa, workspace, conta, binding, conexão, tenant e operação (`tickets.read`, `tickets.write`, `notes.read`, `notes.write`). Operações não implicam umas nas outras e não ampliam as cinco business scopes. O publicador não substitui a checagem dessas scopes, de capabilities administrativas, de MFA ou de identidade: a fonte e o futuro adapter devem realizá-las antes de escrever.

`ResourceGrantSnapshot` contém target, fingerprint, revisão de binding/acesso, asOf/expiry, estado active/revoked, `complete: true` e a cobertura inteira. **complete é requisito estrutural; NÃO comprova autenticidade, autorização ou aprovação do manifesto.** Uma fonte construída com JSON de request contornaria a fronteira de confiança: isso é proibido. Não usar `ResourceScopeContext.refs` de uma lease como cobertura completa; ali há apenas os recursos selecionados para uma operação.

`null` da fonte é falta de vínculo confiável e provoca recusa sem transação. Cobertura vazia explicitamente confirmada significa nenhum recurso, nunca acesso global. Revogação explícita exige lista vazia. A aplicação não recebeu acesso direto às tabelas privadas, e nenhum publicador está ligado ao runtime.

## Regras implementadas

1. **CAS local:** estado lido sob lock deve ter a mesma revisão esperada; não atualizar a revisão automaticamente para encaixar uma resposta atrasada.
2. **Revisão exata:** decimal em string, limites de bigint PostgreSQL, sem arredondar acima de Number.MAX_SAFE_INTEGER. O store devolve a revisão final real, estritamente maior; o motor não presume +1 porque os triggers de filhos do candidato CG-03d também avançam revisão.
3. **Fonte coerente:** asOf anterior ao estado persistido é recusado. Mesma revisão de binding/acesso não pode descrever cobertura/estado diferentes. Mudança de revisão com mesmo timestamp e conteúdo diferente é ambígua e recusada. Revisões da origem são opacas, não números ordenáveis.
4. **Cobertura inteira:** sem cortar itens em 100 ou aproveitar uma parte válida. Máximo técnico de 1000, duplicatas/contextos misturados/itens incompletos recusados. Reordenação não muda o hash.
5. **Tempo exato:** milissegundos equivalentes a microssegundos normalizam sem perda; diferenças reais de um microssegundo são mantidas. Fonte vencida, futura, demasiadamente antiga, relógio inválido ou retrocedendo não admitem publicação.
6. **Histórico:** uma chave corresponde ao alvo e revisão esperada. Reenvio válido devolve o recibo original sem republicar a cobertura atual da fonte. Esse recibo é histórico, NÃO uma autorização atual. Mudança de revisão esperada com a mesma chave é conflito.
7. **Atomicidade contratual:** cobertura, observação, recibo e auditoria devem ficar na mesma transação. Falha no recibo impede sucesso; COMMIT desconhecido não gera outra tentativa automaticamente. Sucesso já confirmado não é revertido por expiração posterior.
8. **Recusas:** erros de fonte/persistência não incluem mensagens privadas. A fonte é consultada antes da transação; nenhum token, senha ou URL de origem é registrado pelo motor.

A comparação de revisões e o hash do conteúdo não autenticam a origem. Sem o adapter qualificado e a autoridade de publicação revisada, são mecanismos de consistência locais, não permissão de escrever produção.

## Contrato do futuro adapter SQL

`ResourceGrantPublicationStore.runPublication(target,key,admit,work)` deve usar o `runTransaction` existente com a precondição síncrona `admit`. Não criar outro framework de transações. O adapter deverá:

- Verificar o papel privado/publicador e os vínculos correntes; não dar DML sobre grants ao login normal `helpdesk_app`.
- Serializar o alvo e a intenção inclusive quando a linha de cobertura ainda não existir. Lock apenas numa linha ausente não serializa a criação; validar a estratégia de criação/lock no PG17 real.
- Consultar recibo antes de alterar estado. Recibo inválido não é ausente. Mesma intenção retorna o mesmo comprovante; não calcular uma nova intenção após resultado unknown.
- Ler uma revisão/observação/cobertura completas sob o mesmo lock. Novo alvo é exatamente `{revision:'0',snapshot:null}`; qualquer outra combinação incompleta é falha de persistência.
- Implementar `replaceGrant(plan)` como CAS explícito. Alterar os itens por completo, preservar triggers de invalidação, publicar metadados e observação compatíveis com a revisão final real. Retornar `{revision,snapshotHash}` apenas após validar os efeitos esperados, mas antes do COMMIT.
- Implementar `appendReceipt` e trilha imutável na mesma conexão. A resposta `true` reconhece staging, não substitui a confirmação do COMMIT.
- Chamar o callback uma única vez, sem retry automático. Admitir novamente após esperas e antes do COMMIT; rollback não depende da precondição recusada. Preservar os estados confirmado/desconhecido do runner.
- Validar TTL/revisões da lease/store CG-03e, isolamento por produto/binding/pessoa, notes-only e ausência de concessão implícita por perfil.

Não há implementação SQL dessas operações nesta fatia. O modelo transacional de teste é somente uma referência em memória para staging/commit/rollback/serialização; não demonstra RLS, locks PG ou tolerância a crash do processo/banco.

## Correção na CG-03e

O catch da consulta SQL preservava qualquer `HelpdeskError` inteiro. Reproduzidos dois casos em que um erro tipado poderia carregar mensagem privada. Agora apenas códigos locais de admissão conhecidos são preservados, reconstruídos com status e mensagem seguros; demais falhas viram `resource_scope_database_unavailable`. O callback de negócio não é executado nesses cenários.

São testes com transporte SQL sintético. Não demonstram vazamento histórico real, ataque HTTP ou comprometimento de produção. O SQL candidato da CG-03e e seus 15 cenários PostgreSQL não foram alterados nem executados nesta rodada.

## Evidências locais

Baseline 204/204 preservados. Planner: RED 43/43 falhas por interface ausente; GREEN 43/43. Publicador: RED 36/36 por interface ausente; implementação inicial 35/36, corrigida classificação de revisão inválida de resposta. Autorrevisão produziu RED adicional de cinco casos (inclui os dois da CG-03e), corrigidos. Mais um RED isolou estado persistido malformado sendo classificado como erro do caller; corrigido.

Uma execução conjunta apresentou unhandledRejection no teste novo de fonte atrasada: o teste segurava a Promise enquanto dependia de um deadline real de 50ms. A sincronização foi alterada para barreira explícita; o relógio do deadline é controlado com MockTimers do Node nesse cenário. O teste de timeout avança exatamente os mesmos 50ms. Nenhum timeout de produto foi aumentado, nenhuma asserção removida. Isso não é correção da ocorrência histórica `notes-retry`, que permanece pendente.

Conjunto final: **289/289**, zero falhas/skips/cancelamentos/TODO; 204 preservados + 85 novos. Quatro mutações funcionais detectadas: retirar CAS (2 falhas), vínculo entre revisão e conteúdo (3), gravação de recibo (8), leitura de recibo anterior (5). Fontes restauradas e conjunto repetido.

Typecheck focal TS5.8.3/ES2022/libES2023/NodeNext/strict, tipos Node25.1.0 disponíveis no ts-node global. Primeira tentativa usou um typeRoots sem os tipos Node e falhou por ambiente; correção apontou aos tipos já instalados, sem mudar dependências do produto. Não equivale a npm ci/lock/audit do repositório.

**Não executado:** PostgreSQL real da CG-03e/f, migration/upgrade novos, CI integral desta fonte, browser/CodeQL desta fonte, build/audit completos, hosted. Não publicar números históricos de CG-03d como aprovação deste conjunto.

## Fronteiras e continuidade

Não houve tentativa de repetir a gravação SQL bloqueada no GitHub por outra codificação/ferramenta. Nenhum código/ref remoto, migration remota, grant, fator Auth, provider ou release flag foi alterado. CLI e servidor PostgreSQL não estão disponíveis no container; o DNS do registry não respondeu. Não se alterou configuração de rede para contornar isso.

Próximo: revisar fonte E+F em checkout completo; executar primeiro os cenários SQL E já escritos; implementar o adapter privado/CAS/ledger com teste RED/GREEN no PG17 e fault injection de commit; gerar a migration pela CLI, atualizar manifest/readiness/upgrade; qualificar identidades/source; integrar handlers somente com as evidências. Importação canônica, preview e revisão independente permanecem pendentes. CG-01/02/03 completos e operação não estão encerrados.

Referência técnica consultada: PostgreSQL17, Explicit Locking e Transaction Isolation. Essas fontes orientam o contrato do adapter; não são prova de implementação ou teste de lock do novo publicador. Changelog Supabase e a página Node consultada ficaram inacessíveis na ferramenta; nenhuma atualização de biblioteca foi inferida/aplicada.
