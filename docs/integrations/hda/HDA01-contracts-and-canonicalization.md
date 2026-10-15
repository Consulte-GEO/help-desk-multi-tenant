# HDA-01 — Contratos de análise e canonicalização / E01

Estado: implementado e testado localmente como domínio isolado. Sem persistência, HTTP, CLI real, autorização, UI ou escrita no Novo GEO. A API/schema do Help Desk não muda nesta entrega.

## Arquivos novos e fronteiras

| Arquivo | Responsabilidade |
|---|---|
| `src/domain/registration-canonical.ts` | Clone JSON restrito, decoder, canonicalização, SHA-256 e validações básicas |
| `src/domain/registration-action-catalog.ts` | Única action-key candidata, payload e efeitos fechados |
| `src/domain/registration-contracts.ts` | Snapshot, alvo, análise, rascunho; tipos futuros de aprovação/observação |
| `src/domain/registration-analysis.ts` | Construção/validação do job e parsing da saída estruturada |
| `src/domain/registration-analysis-schema.ts` | JSON Schema candidato vinculado ao job |
| `src/domain/registration-automation.ts` | Decisão pura de estados de análise e revisões |
| `src/connectors/dev-agent/contract.ts` | Extração segura de `structured_output` já decodificado; sem processo CLI |
| `src/connectors/novo-geo/registration-read.ts` | Contrato/parser de prévia candidata; sem implementação HTTP |

O domínio não importa implementações de conectores. O erro comum reaproveita `HelpdeskError`; o canonicalizador existente do core não foi modificado. Nomes/types E01 são contratos locais que a qualificação da origem ainda deverá confrontar.

## Sequência de uso pelo futuro serviço

1. O servidor qualifica escopo, action-key e versão de formulário; cria `RegistrationInputSnapshot` por `createRegistrationInputSnapshot(raw)`.
2. A futura transação HDA-02/03 persiste esse snapshot e a operação. `createRegistrationState(snapshot)` só produz o estado puro inicial.
3. `createAgentAnalysisJob(snapshot, raw)` vincula job/operação/revisão, hashes, fence, versão de agente e referências de conhecimento permitidas.
4. `buildAgentAnalysisOutputSchema(job)` gera o schema candidato. HDA-04 entrega dados minimizados ao processo isolado, não o banco ou tokens.
5. `parseAgentAnalysis(raw, expectedJob, definition)` ou `parseClaudeStructuredOutput(decodedEnvelope, job, definition)` retorna análise normalizada, sempre sem execução autorizada.
6. `decideRegistrationTransition(state, event)` produz o próximo estado e, quando há proposta válida, um rascunho. HDA-02 deverá persistir isso com locks/CAS e inbox na mesma transação.
7. A futura prévia real alimentará `parseOriginPreviewCandidate(raw, expectation)`; o resultado ainda precisa de qualificação de origem/ACL. HDA-07 e HDA-08 continuam separados.

**Não chamar esses helpers diretamente a partir de body HTTP sem o serviço de autorização.** Hash e UUID não constituem direito de acesso. Types `ExecutionApproval` e `OriginObservation` são apenas descrições de dados, não capacidades ou serviços implementados.

## Perfil `hda-cjson-v1`

Este é um perfil JSON restrito, **não uma implementação geral do RFC 8785**. Não promete compatibilidade Node/.NET sem execução na origem.

| Regra | Valor |
|---|---|
| Encoding de hash | UTF-8, SHA-256 hexadecimal minúsculo |
| Chaves | ASCII imprimível, 1–100 caracteres, ordem lexical; `__proto__`, `prototype`, `constructor` proibidas |
| Valores | null, boolean, string válida, inteiro seguro, array denso, objeto JSON simples |
| Números | Inteiros seguros; -0, fração, expoente no decoder, NaN/Infinity recusados |
| Strings | Sem NUL ou surrogate isolado; não normalizar Unicode; preservar zeros iniciais em IDs |
| Limite agregado | 65.536 bytes canônicos; abortar durante a travessia quando excedido |
| String | 16.384 bytes UTF-8 |
| Estrutura | profundidade 16; 4.096 nós; 128 propriedades/objeto; 256 itens/array |
| Objetos em memória | Sem getters/accessors, símbolos, propriedades ocultas, protótipos desconhecidos, arrays esparsos/ampliados ou ciclos |
| Decoder | UTF-8 estrito, sem BOM, sem duplicidade de chave inclusive escapada; entrada limitada |
| Tempo da prévia | UTC ISO com milissegundos exatos; validade final exclusiva |

Payload canônico é calculado por `canonicalRegistrationJson`; hashes por `registrationHash`. O builder/decoder devolve cópias imutáveis, sem alterar a entrada. Strings compostas/decompostas continuam diferentes. O perfil piloto não permite dados decimais de futuros traços; essa expansão exige decisão/versionamento próprios.

## Identidade, hashes e revisão

Snapshot contém identidade da operação/chamado, revisão de entrada, formulário, action-key/schema, alvo, respostas e referências de anexos. Seu `requestHash` é recalculado e conferido. Anexo por ID/hash é apenas referência: o helper não verifica existência, scan ou autorização de Storage.

Rascunho contém alvo/payload/efeitos e respectivos hashes, revisão de entrada/rascunho, origem da análise, política e `contentHash`. Nesta etapa `previewRef` deve ser null, `status` deve ser draft e `executionAllowed` é false. Um rascunho com prévia operacional ou aprovação precisa evoluir explicitamente; não reutilizar o parser E01 ignorando campos.

Comentários comuns do chamado não são eventos desta máquina. Mudança de entrada invalida a proposta, aumenta `inputRevision` exatamente uma vez e conserva a monotonicidade de `draftRevision`. Correção de obra/beneficiário ainda exige reautorização no futuro serviço. Troca de workspace/conta/conexão/instância/tenant/contrato não é uma revisão da mesma operação.

## Máquina de análise

Estados: queued_analysis, analyzing, draft_ready, needs_information, manual_review, analysis_failed e cancelled. Eventos aceitos: analysis_started, analysis_completed, analysis_failed, retry_analysis, input_revised e cancel_analysis. Todos exigem eventId, operationId e expectedRevision.

Job novo precisa de fence superior. Resposta de job/fence/revisão antiga não altera a proposta atual. Cancelamento não permite ressurreição. A repetição imediata do último evento equivalente é neutra; mesmo eventId com outro hash é conflito. **Esse recibo local NÃO substitui inbox ou idempotência persistente**; eventos antigos e múltiplos workers dependem de HDA-02.

Não existem transições de aprovação, execução, committed ou fechamento do ticket. Toda decisão retorna `ticketMutation:none` e `originMutation:none`. Um actor/verified/approval em dados não autoriza a máquina a efetivar cadastro.

## Prévia candidata

A expectativa do servidor inclui rascunho, versão de contrato, instante e política explícita maxAgeMs/maxTtlMs. Não há TTL operacional implícito; os valores positivos possuem teto defensivo de um dia. O parser confere operação, revisão, hashes, revisão de acesso, duas dependências exatas (usuário e obra), status e issues conhecidos, expiração e `effectsExecuted:false`.

`valid` não admite issues ou dependências insatisfeitas. `invalid/conflict` exigem issues. HTTP202/committed não são prévias. O resultado mantém `liveAdapterAllowed:false`. `createUnavailableRegistrationSourceReadPort` retorna erro 503, nunca dados fictícios. Não há adapter habilitado nem comprovação de que a origem real seja sem efeitos.

## Vetores e aceites entre linguagens

Fixture: `tests/fixtures/registration/canonical-vectors.v1.json`: 14 vetores válidos e 12 inválidos. Valores canônicos esperados são fixos; Node compara bytes/hashes, e `scripts/verify-hda-canonical-vectors.py` usa implementação independente em Python stdlib. O verificador Python foi também testado com um valor esperado adulterado e recusou a fixture.

**X01 continua aberto:** execução do mesmo corpus em .NET, contrato de versão e igualdade de bytes antes de criar executor. Python não é substituto dessa prova. Não marcar todos os 81 casos V2 como passados com base nos 122 testes Node locais.
