# Execução R02 — plano: PLANO_ORIGINAL_2026-10-14.md

Base remota reinspecionada em 14/10/2026: dcf5607652281bb688f366e6a4f05e07eb698d31.
Workspace local isolado, parcial; não se afirma checkout integral nem ancestralidade do commit local.

## Recorte e decisões
- Ruling: clone integral indisponível (DNS); não repetir a leitura integral pelo chat nem apresentar testes focais como build. Revalidar R01, corrigir integração reproduzível e desenvolver IMP-02a desacoplado, sem habilitar endpoint nem tocar produção. Custo: qualificação integral/SQL permanece bloqueante para ativação.
- Ruling: IMP-02a fica em `modules/import-process/`, TypeScript sem dependências de runtime; consumível pelo serviço existente do Setup e portável ao backend .NET. Não é um novo servidor/banco. DDL candidato fora de migrations; nenhum grant produtivo é aplicado.
- Pre-flight: R01 exporta motores browser; IMP-02a recebe snapshots JSON validados, não recebe objetos DOM/estado global, nem trata origem/conta do navegador como autoridade.
- Pre-flight: impressão digital de conteúdo não é autorização. O serviço requer contexto emitido em servidor por resolver injetado, revalida acesso no começo/fim e limita cada comando ao mesmo processo.
- Pre-flight: autorização da origem M08 e contrato do receptor continuam pendentes. Serviço não aprova nem importa, não comunica sucesso operacional.

## Tarefas — estado registrado no início da execução
- T1: revalidar base R01 — 101/101 Node, evidência baseline-r01.log.
- T2: corrigir mapeamento/reforçar invalidação de exportação — em andamento.
- T3: contratos e serialização canônica — pendente.
- T4: casos/revisões/CAS/idempotência/artefatos — pendente.
- T5: adaptador PostgreSQL, DDL candidato e testes — pendente.
- T6: regressão, revisão e pacote cumulativo — pendente.

## Fechamento local
- T2 concluída focalmente: mapeamento preservado, contexto de preparo, bloqueio por assets/versão, 119 testes cumulativos de integridade e pacote.
- T3/T4 concluídas no recorte de biblioteca: 85 testes contratos/processos/transporte, incluindo rejeições e falhas. Não significa API/storage reais.
- T5 parcial: adaptador tipado e DDL candidato; sem PostgreSQL, driver real ou migration aplicada.
- T6: revisão manual sem revisor independente; detectados e corrigidos motivo de cancelamento não persistido, replay sem nova conferência do solicitante, ausência de deadlines, respostas de armazenamento malformadas e limite agregado de leitura. Logs RED/GREEN preservados.
- Regressão DOM offline: 10/10; Similarity: 21/21; typecheck do módulo: exit 0. Build/smoke integral/PG/full-browser não executados.
- Ruling: o aplicador R02 é cumulativo sobre a base sem R01; não interpreta recusa em branch já alterado como autorização de sobrescrita. Custo: merge manual da diferença quando R01 já estiver integrada.
