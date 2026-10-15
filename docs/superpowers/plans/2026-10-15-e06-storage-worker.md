# E06 — promoção do armazenamento e montagem do worker

Base: github/codex/m1-reproducibilidade 4ba72e3. Escopo autorizado pelo usuário: concluir o possível sem Novo GEO e sem Claude; commit/merge/publicação autorizados. Nesta frente somente código e preparação; root coordena operações remotas.

1. Promover HDA02/HDA06 como vigésima migration, com admissão do catálogo exato 0.25 e contrato final 0.26. Preservar hashes das dezenove anteriores.
2. Montar Function scheduled exclusiva, contexto nativo production, pool TLS/papel dedicado; preflight no startup e em cada ciclo. Selecionar somente identidades existentes na fila, sem provisionar bindings, concessões ou jobs.
3. Engine explícito manual_review: nenhuma proposta, resultado clean, chamada de modelo ou escrita na origem. Novas capacidades dependem de flag e catálogo real.
4. Testes negativos RED→GREEN, contratos/tipos/build e ensaio completo PG17 em CI; Windows não possui PostgreSQL/WSL. Nenhum resultado sintético vale como aceite remoto.

## Decisões e limites

- docs156 e HDA02/04/05/06: origem sem contrato; HDA exige target NOVO_GEO qualificado. Não criar dados fictícios nem converter cadastros locais em autoridade da origem.
- O core recusa integração técnica em recursos CG protegidos. Esse controle permanece integral. Instalar armazenamento/worker não garante uma tarefa operacional elegível.
- Histórico editável/CAS, preparação de novos jobs e aprovação/execução não são cobertos por esta promoção. Consulta permanece somente leitura com audiência fixa.
- RED inicial: registration-runtime.test.ts falhou ERR_MODULE_NOT_FOUND antes da implementação.
- RED nativo38762865884: cadeia0.26 e catálogo/ACL passaram; selector indevidamente chamou helper dependente de workspace antes da resolução da identidade. Corrigido para consultar somente o catálogo privado de proteção na descoberta, mantendo autorização contextual integral no claim. O mesmo teste nativo agora exige explicitamente contexto vazio e um job CG protegido anterior que deve ser ignorado.
- Inventário real desse PG17:86 tabelas,229 funções,85 triggers,504 constraints (46 HDA), três papéis. Fixado integralmente no contrato0.26; o novo ensaio compara também todas as constraints.
- Revisão independente: não selecionar autor humano para analisador técnico nem binding retargetado/reticketado. Corrigidos os três filtros antes de LIMIT1 e adicionadas três tarefas antigas inelegíveis antes de uma tarefa própria válida no ensaio real.
- GREEN nativo/DOM: CI38764274040, fonte4231a7a,40 candidato/14 core+worker/49 DOM/26 vetores, zero falhas; clusters removidos. Metadados, hashes e resultados preservados em evidence/e06-storage-worker-20261015/hda. CI integral38764273868 ainda aguardado neste checkpoint; nenhum SQL remoto aplicado por esta frente.
- CI integral38764273868: aplicação/interface concluíram; PostgreSQL recusou na admissão histórica da suíte activation-upgrade.test.ts, que aceitava somente bundles0.24/17 ou0.25/18–19. Estendido explicitamente para0.26/20; a suíte continua usando a migration17 e o contrato0.24 congelados. Não houve falha de SQL/RLS nos ensaios anteriores à admissão. Novo CI completo exigido para a fonte com essa correção de harness.
- GREEN integral da fonte0d56dc8: CI38766649902,5639/680/617,6936 verificações e zero falhas/skips/cancelamentos/todo. HDA final38766649791:40/14/49/26 vetores, clusters removidos. Fingerprint5a0b2eefb1e05502904ec886be4043cf10266d6402dfe8bc40678461549d94b8 conferido por check:homologation após importar logs/relatório canônico. Estado desta frente: preparação e qualificação completas; root coordena publicação compatível, DDL20, credencial e ativação hospedadas, sem ampliar autorização da origem.
- Fetch remoto exigiu execução escalonada por DNS da sandbox. Worktree anterior estava limpo; arquivos não rastreados da árvore principal foram preservados.
