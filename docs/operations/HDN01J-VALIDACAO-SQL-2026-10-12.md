# HDN-01j — validação SQL em branch isolada

## Escopo desta branch

Base `6e069005beaa12d7cb55c77af92478c21f7526ca`. Esta branch reúne os 11 arquivos da HDN-01i necessários aos 31 cenários PostgreSQL: domínio, parser de marcação, contrato de página, store, guard legado, executor, PostgresStore, SQL candidato e registro/cenário. Os bytes foram conferidos pelos objetos Git; a árvore reconstruída com os hashes locais coincide com a árvore transferida.

Não é ainda a integração dos 75 arquivos do cumulativo: interface, handlers e montagem estruturada restantes continuam no pacote local. O objetivo é executar a persistência no runner já existente, em checkout completo Linux/Node22/PostgreSQL17. Workflows, lock, migrations, gates, evidência canônica e UI da principal permanecem intactos. Teste não executado não é aprovação.

## Regras

Não aplicar o SQL candidato no Supabase hospedado, não promover migration, não fazer merge ou abrir atendimento. A própria instalação candidata exige banco descartável, marcador local e administrador do teste; operações exercitadas usam login restrito. A suíte principal conserva as regressões anteriores e registra os 31 cenários novos após D/E/G.

O primeiro commit conserva o código do pacote I para revelar falhas reais de integração. Corrigir somente causas demonstradas e preservar as execuções vermelhas. Não remover cenários, ampliar grants ou enfraquecer gates para aprovar. O arquivo SQL continua fora do manifest de migrations.

## Evidência

No momento deste checkpoint nenhum novo CI foi concluído. Resultados e correções posteriores serão registrados no PR e no pacote cumulativo, vinculados à fonte exata. A aprovação dessa fatia SQL não equivale a montagem de runtime, navegador do checklist, qualificação do Novo GEO ou aceite operacional.

---

# HDN-01j — validação real da persistência do checklist

Data de referência: 12/10/2026, America/Sao_Paulo. As execuções entre 00h e 01h UTC de 13/10 correspondem à noite de 12/10 no Brasil.

## Resultado central

Os **31 cenários PostgreSQL HDN foram executados e aprovados** no runner original do repositório, sobre checkout completo, Node22 e PostgreSQL17 descartável. O CI final aprovou **3.741 testes de aplicação, 326 PostgreSQL e 156 verificações HTTP/interface**, sem falhas, cancelamentos, skips ou TODO. Esse resultado fecha a pendência de execução dessa fatia SQL; **não encerra a integração operacional HDN-01**.

Não acrescentei outro módulo de produto. Levei ao GitHub a dependência exata da persistência, executei os testes até então apenas escritos e corrigi quatro defeitos de preparação/consulta das fixtures demonstrados pelo banco real. O SQL candidato e todos os controles de produto ficaram idênticos à entrada I.

## Base, branch e escopo exato

- Repositório: `Consulte-GEO/help-desk-multi-tenant`.
- Principal/base: `codex/m1-reproducibilidade`, `6e069005beaa12d7cb55c77af92478c21f7526ca`.
- Branch isolada: `review/hdn01-checklist-validation-20261012`.
- PR30, aberto em rascunho, **sem merge**.
- Head validado: `a5b23a9143ecc367444a28e9b71d561fd325611c`.
- Árvore do head: `f719253f13b2357cc35b44669d71b56a02da5566`.

Foram incorporados à branch **11 arquivos de produto/teste da HDN-01i**, mais um checkpoint documental. Não é a incorporação dos 75 arquivos do cumulativo anterior. A interface nova, handlers e partes restantes do workflow continuam no pacote local. O ZIP J contém **76 arquivos cumulativos: 74 preservados, um teste corrigido e um documento novo**, sobre a base principal acima.

A transferência inicial foi verificada por Git blob SHA de cada arquivo: reconstruir a árvore a partir dos hashes locais produziu a mesma árvore remota. As duas revisões da fixture retornaram hashes iguais aos arquivos locais. Não foram sobrescritos UI simples, painel pós-login, configurações de Auth, escopos de Thiago, workflows, lock ou evidências canônicas.

## Sequência de execução e correções

| Execução oficial, tentativa 1 | Fonte head | Aplicação | PostgreSQL | Interface | Interpretação |
|---|---|---:|---:|---:|---|
|38325705901|75a5a37|3741/3741|294/295|156/156|Falha no setup HDN; **zero** dos 31 cenários executados.|
|38326384615|e13e12a|3741/3741|322/326|156/156|31 cenários HDN executados, 28 aprovados; 3 falhas de fixture e seu grupo.|
|38327100179|a5b23a9|3741/3741|326/326|156/156|31/31 HDN aprovados, incluindo grupo e regressões anteriores.|

As execuções vermelhas foram preservadas integralmente. Não houve repetição sem mudança para tentar ocultar falhas. Não houve redução de asserts, alteração de triggers/grants ou exclusão de cenários.

### 1. Atribuição sem ator e combinada com status

A fixture usava um UPDATE administrativo que alterava `assigned_to` e `status` juntos, sem contexto de aplicação. O trigger histórico de atribuição recusou corretamente com `42501 / Assignment not authorized`, antes dos subtestes HDN. A correção usa `HelpdeskService.changeAssignment(..., 'claim', ...)` e depois `transition(..., 'open', ...)`, ambos no login restrito. Foram acrescentadas asserções do responsável e status resultantes. O trigger e a regra que impedem misturar as operações permanecem intactos.

### 2. Precedência na expressão de microssegundo

A consulta de teste aplicava `AT TIME ZONE` ao intervalo em vez do resultado da subtração e gerava `42883`. Parênteses agora fixam `(created_at - interval '1 microsecond') AT TIME ZONE 'UTC'`. O cenário efetivamente verifica a recusa de uma nota posterior à marcação por um microssegundo, sem reduzir a precisão exigida.

### 3. Preparação do chamado já resolvido

O teste de mensagem sem nova conclusão alterava status por administração sem o ator exigido e recebia `42501 / Transition not authorized`. A fixture agora resolve pelo serviço existente **antes** de vincular o checklist, modelando um chamado legado previamente resolvido. O subteste confirma o estado inicial e prova que uma mensagem posterior mantém `resolved` e avança somente a versão. Não se remove o vínculo nem se ignora a proteção para resolver um chamado vinculado.

### 4. Avanço artificial de revisão

O UPDATE administrativo isolado de versão foi corretamente recusado por `23514 / Ticket write requires authenticated transaction context`. A fixture agora utiliza uma mensagem pública autenticada para avançar a revisão. A asserção de que a revisão nova não herda o checklist concluído foi preservada, assim como o snapshot anterior.

Esses quatro achados são defeitos de preparação dos testes, **não quatro vulnerabilidades demonstradas no produto**. As recusas do banco evidenciaram que os testes de memória não representavam todos os pré-requisitos do ambiente real.

## O que os 31 cenários demonstram

A matriz `03_CENARIOS_POSTGRESQL.md` lista cada caso e seu resultado literal. Dentro dessas fixtures sintéticas, o banco e os adapters reais demonstraram:

- Login restrito, negação de acesso direto às tabelas, FORCE RLS e ausência de EXECUTE para PUBLIC.
- Recusa de requester, de obra C e de conjunto A+C; revogação do papel e do scope de notas.
- Marcação, snapshot, auditoria e recibo gravados atomicamente; replay sem novo efeito.
- Conflito de revisão e duas marcações concorrentes com somente uma confirmação.
- Nota da mesma conta/chamado/autor, validação temporal exata, ausência e referência estrangeira recusadas.
- Bloqueio compartilhado nas notas durante a leitura usada pela resolução, até o término da transação.
- Leitura de metadados sem corpo de nota, paginação confrontada com consulta SQL de referência e sem duplicação.
- Caminho original recusando resolução/fechamento de chamado vinculado mesmo com checklist completo; compatibilidade de chamados sem vínculo e mensagens no mesmo estado.
- Rollback real de marcação, auditoria e recibo após erro SQL capturado, recusa local capturada e envelope de resultado corrompido **depois** de uma gravação SQL bem-sucedida.

O administrador foi usado para criar dados sintéticos e provocar estados corrompidos deliberados. As operações de produto foram exercitadas com `helpdesk_app` restrito. Isso não é homologação de pessoas reais ou autorização para replicar fixtures na produção.

## Evidência final conferida

- Run **38327100179**, tentativa **1**, job **115068201905**, `completed/success`.
- Artefato **11782135083**, 839855 bytes.
- ZIP SHA-256: `7b427215afb5daa9e9599d051c36d7493b5aaa1550013c1cacebbd5506cd60fc`.
- Fonte de teste do evento PR: `220d112899c87751ca37b0e21a664ac58b27dec7`.
- Fingerprint executável: `bae90184afad51c3c9328a9e5a372db38287d4c89aeb28870539ab4cfb7b83b3`.
- A árvore da fonte sintética de teste e a do head são a mesma `f719253f13b2357cc35b44669d71b56a02da5566`. Isso **não é merge da principal**.
- Verificados o digest do ZIP, integridade, fonte/run/tentativa, hashes dos seis logs, contagens TAP, cópia idêntica de `report.json`/`latest.json` e os 31 resultados HDN individuais.
- `check:homologation` passou no checkout do CI. Lock, instalação, auditoria de dependências, tipos, contratos, scanner heurístico de segredos, build estático e upgrade histórico passaram no workflow existente.
- CodeQL do head: check115068382046, `success`, sem novos alertas no código alterado. Não substitui revisão independente ou segurança operacional.

O fingerprint integral foi produzido e validado pelo CI; não foi recalculado no recorte local. O `source.json` declara `tests_executed:false` porque descreve a etapa de staging; a evidência de execução é o relatório posterior e seus logs. Essa distinção foi preservada, sem editar arquivos oficiais.

## Limites que permanecem

1. O CI refere-se ao **checkout completo com a fatia de 11 arquivos**, não ao cumulativo completo HDN. Os 586 testes focais antigos não foram reexecutados nesta rodada nem somados aos 3741 testes do CI.
2. As 156 verificações de interface são as seis suítes já montadas na principal, com identidades/servidores sintéticos. **Não são a homologação da nova tela de checklist**, ainda fora desta branch.
3. O candidato foi instalado somente no banco descartável. A prova da instalação sobre a base existente e o upgrade histórico não equivalem ao upgrade de uma futura migration HDN promovida.
4. Publicação qualificada de templates e bindings, armazenamento estruturado completo, proteção de todas as escritas terminais, montagem do workflow/rotas/painel e escopos/capabilities ainda faltam. Não há ação automática no GEO.
5. Nenhuma pessoa, Auth/MFA, grant, flag ou migration foi alterada no Supabase hospedado. Não houve merge nem deploy de produção por esta sessão.
6. O preview automático do head foi reportado como falho (`6acd7a4b9a5df599dceb0e4a`). O log completo não foi inspecionado; não atribuí causa exclusiva. Não modifiquei o gate de publicação nem importei evidência parcial como aprovação do cumulativo completo.
7. Autorrevisão da integração e das correções realizada em passagem separada; revisão independente permanece pendente.

## Próximo incremento

**Consolidar o restante do cumulativo sobre o PR30 atual**, sem duplicar os 11 arquivos já presentes, executar a suíte completa dessa composição e sua tela de checklist. Depois, concluir publicação/vínculo de templates e armazenamento do workflow e preparar migration aditiva com readiness/schema/upgrade próprios. Manter o atendimento fechado até montagem e aceite do escopo. Não reabrir a execução dos31cenários como 'nunca executada'; futuras alterações exigem regressão nova, mas esta prova fica preservada.

## Referências verificáveis

- PR: https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/30
- CI final: https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38327100179
- RED inicial: https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38325705901
- RED de fixtures: https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38326384615
- Regra de atribuição preservada: `supabase/migrations/20260916000800_ticket_assignment.sql`.
- Contrato da tarefa: handoff HDN-01i e plano V2; requisito RF-CEN-07, com confirmação reforçada RF-CEN-11. Não foram alteradas as decisões comerciais ou técnicas dessas fontes.
