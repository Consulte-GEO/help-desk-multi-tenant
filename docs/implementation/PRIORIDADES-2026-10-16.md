> **Estado corrente — 16/10/2026:** PR67 mesclado e publicado em `f7ff73a`/deploy `6ad2892dd4bec684a4e7c792`,120 entradas conferidas, sem migração. A síntese canônica, limites e entrega seguinte em qualificação estão em [ESTADO-ATUAL.md](../ESTADO-ATUAL.md). Os checkpoints abaixo são históricos.

> **16/10/2026 — PR66 em produção; PR67 qualificado para revisão:** merge4899c7d/deploy6ad2751586c3cdf1e22acd80 READY,120 entradas HTTPS/hash e quatro recusas nativas401 conformes, sem migração. PR67 completa cabeçalhos dos recibos core e qualifica sua serialização offline; sincroniza fixture de recuperação de notas sem alterar runtime. Fontef4a166f, CI5900/700/655 (7255), zero falha/skip/cancelamento/todo; revisão sem achados pendentes e relatórios originais preservados. PR67 ainda sem merge/publicação. MFA/Novo GEO adiados, scanner cancelado e modelos técnicos ausentes preservados. [Estado e limites](CABECALHOS-RESPOSTAS-2026-10-16.md). Os registros abaixo são históricos.

# Implementação das prioridades — 16/10/2026

**Continuidade mais recente:** PR65 publicado/verificado; PR66 revisado e qualificado (7249 verificações) para correção de erros de envio e foco do Apoio, ainda sem merge/publicação; [estado, provas e próximos recortes](CONTRATOS-ENVIOS-2026-10-16.md). HD-002/019 continuam parciais; registros de preparação abaixo são históricos.

**Continuidade corrente:** PR65 publicado/verificado; [recibo e limites](ORIENTACAO-ATENDIMENTO-2026-10-16.md). HD-002 continua com conformidade de envios existentes e correção de quatro erros incompletos; [escopo e testes](CONTRATOS-ENVIOS-2026-10-16.md), ainda sem qualificação integral/publicação da nova fonte. HD-002/019 permanecem parciais.

**Continuidade corrente:** PR64 publicado e verificado, sem migration; [prova](CONFORMIDADE-RESPOSTAS-2026-10-16.md). HD-019 continua com resumo no detalhe, fonte66385f8 revisada e qualificada no PR65 (7234 verificações Linux), ainda sem merge/publicação; [escopo, testes e pendências](ORIENTACAO-ATENDIMENTO-2026-10-16.md). Nenhum fechamento integral de HD-002/019.

**Continuidade posterior:** PR61/busca e validador formal, PR62/totais e PR63/consultas rápidas publicados. PR64/conformidade de respostas HD002 implementado, revisado e qualificado (7221 verificações), ainda sem merge/publicação. [Estado e evidências atuais](CONFORMIDADE-RESPOSTAS-2026-10-16.md). Os estados anteriores abaixo são históricos; HD002/019 continuam parciais.

**Atualização posterior:** PR61 mesclado/publicado em16/10, `2c201d0`/deploy `6ad23360e61e3b1608a0fd71`,116 arquivos do manifesto aprovados por hash/HTTPS. Sem migration/escrita de negócio. Os registros de ausência de publicação abaixo descrevem a qualificação anterior. Continuidade e provas em [Totais da fila](TOTAIS-FILA-2026-10-16.md).

Autorização: executar itens prioritários do levantamento, reutilizando módulos existentes e preservando MFA/Novo GEO adiados e scanner cancelado. Base inicial `f13754e`, branch `codex/prioridades-levantamento-20261016`.

## Recortes executáveis nesta entrega

- [x] **HD-019, busca por protocolo:** ampliar a consulta existente de tickets para encontrar o protocolo CG completo, sem pesquisar notas/mensagens, sem alterar escopos e antes da paginação. Assunto literal e UUID completo continuam disponíveis. O PostgreSQL usa somente a projeção autorizada `cg_local_ticket_summary` já existente na composição Consulte GEO; a composição genérica não chama função CG. UI e OpenAPI descrevem a mesma busca. Testes: memória/HTTP, cursor/filtros, outra conta/pessoa/workspace/revogação, SQL parametrizado e PostgreSQL restrito.
- [x] **HD-002, validação formal:** adicionar validador OpenAPI fixado em dependência de desenvolvimento e conservar os sentinelas estruturais existentes. Impedir resolução de referências externas/rede. Gate executável separa schema formal de conformidade de respostas reais, que continua por rota. Testes negativos: contrato inválido, referência externa e não resolvida; contrato do projeto válido. Não anunciar homologação automática de todas as rotas por validar o documento.
- [x] **HD-006, regressões combinadas:** complementar somente os cenários ausentes de confirmação antiga após troca de identidade e timeout real do transporte atravessando estado. Nenhuma liberação do modo avançado/MFA, nenhum teste Auth produtivo ou mudança de conta real.
- [x] **HD-001, estado:** registrar resultados, fonte e limitações desta entrega; manter backlog antigo imutável e indicar recortes ainda abertos. Sem declarar totais/SLA/backoffice/implantação concluídos por entregar busca.

## Sequência e verificação

1. Escrever e executar testes negativos do recorte antes da alteração.
2. Implementar com os adaptadores/serviços existentes; nenhuma migration, grant ou segredo novo para os três recortes acima.
3. Executar testes focais, suíte de aplicação, typecheck, contratos, segredos, lock, build, banco e UI em bancada apta. Preservar falhas preexistentes identificadas, sem mascarar limitações do ambiente.
4. Revisar diff, atualizar este checkpoint e registrar evidência sanitizada. CI/merge/publicação e aceite humano são estados distintos; esta implementação não os presume.

## Frentes seguintes que não podem ser inventadas

HD-011 precisa manter equivalência entre DSL/publicador, PostgreSQL e UI, com nova versão de formulário, sem alterar snapshots antigos. O usuário confirmou nesta rodada que **não existem modelos técnicos homologados** para HD-013–015; preservar coleta atual e registrar definição técnica como pendência de negócio. Não inventar norma/limite de engenharia. HD-009/010 dependem de política/autoridade; admin sensível depende da retomada MFA. SLA atual precisa projeção própria e não mudará política como efeito da busca. HD-024 continua exigindo revisão explícita do contrato de arquivos, sem scanner. Novo GEO, HDA executor e legado permanecem condicionados às decisões vigentes.

## Progresso e evidências

Busca por protocolo implementada; testes de memória/HTTP e filtros/cursor/ACL passaram, com teste PostgreSQL restrito acrescentado à suíte existente. Sem migration ou grant. A interface identifica assunto/protocolo/UUID e descreve busca exata pelo protocolo completo.

Gate formal implementado com `@apidevtools/swagger-parser@12.1.0` e `ajv@8.20.0` como dependências diretas de desenvolvimento fixadas. Valida estrutura OpenAPI3.1.1, Schema Objects2020-12 e referências JSON Pointer internas, sem arquivo/rede remotos. Não é validador de respostas hospedadas. Revisão independente encontrou dois casos inicialmente aceitos (tipo de schema inválido/dynamicRef quebrado) e um erro no reconhecimento de nomes de componentes; todos foram reproduzidos em testes vermelhos e corrigidos. Nomes de componentes são chaves opacas, não palavras-chave.

Transport timeout atravessando a sessão passou; teste de navegador para confirmação obsoleta após novo principal acrescentado. Acesso avançado continua oculto; aceite entre dispositivos não executado.

Verificações locais observadas: busca/adaptadores33/33; OpenAPI8/8; logout9/9; gate de contratos44 operações; lock coerente; auditoria npm sem vulnerabilidades na instalação; typecheck e build aprovados. A instalação do módulo no build exigiu acesso npm fora do sandbox após falha DNS; lock preservado. Nenhuma publicação ocorreu.

A baseline Windows executou5.829 testes, com5.688 aprovados/141 falhas. A execução seguinte (antes dos últimos quatro testes do validador) executou5.836, com5.695 aprovados/141 falhas. Há falhas por Node22 indisponível em testes que exigem esse major, sockets/links e subprocessos limitados no sandbox; esses resultados **não são suíte aprovada**. As falhas não foram removidas e a validação integral será feita no CI Linux. Navegador local não iniciou por incompatibilidade do módulo greenlet cp312 com Python3.14 disponível; não é falha de produto ou prova de aceite. PostgreSQL local nativo exige Linux/macOS/WSL/Docker, indisponíveis nesta sessão Windows.

O [PR61](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/61) contém a primeira entrega. A [CI da fonte bc0fd6e, run38910351088](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38910351088) aprovou **5.841 testes de aplicação, 698 PostgreSQL e 633 de interface: 7.172 no total, sem falha/skip/cancelamento**. O [merge de teste do PR, run38910357829](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38910357829) também foi aprovado. Apoio Implantação, HDA e CodeQL passaram nos respectivos workflows.

O teste PostgreSQL de busca usou a composição restrita real e verificou protocolo exato, filtros e principal sem acesso. O teste de navegador novo de confirmação obsoleta também passou na suíte Linux. Isso não é aceite Auth entre dispositivos ou jornada humana hospedada.

Artefato original: `helpdesk-homologation-bc0fd6e48effedbc8880219fe50a81713700945d-38910351088-1`, digest `sha256:b839eb8a0a4128a279999f4ada1cafb274c214dfe27f23f27c8b9371dad8467d`. Fingerprint `4957cb9c09bc95c260de8809b2ce28ddd1bf7d754d06994e68225b2d342e2a04`. Relatório e seis logs originais preservados em `evidence/homologation/runs/c6087869-4761-4dbd-820d-043f1da5ed60`; hashes e relatório reconferidos contra a árvore local antes/depois da cópia. Recibo em `evidence/prioridades-20261016/ci-qualified.json`.

Revisão independente encerrada sem achados materiais pendentes após os fixes do validador; 8/8 casos reexecutados pelo revisor. As alterações seguintes de estado/evidência são documentais, preservam exatamente o fingerprint aprovado e não constituem nova homologação de código distinto. A prévia automática inicial falhou no build (sem publicação); o envio das evidências permite ao processo normal revalidar o release, sem remover gates. Nenhum merge ou deploy de produção foi realizado.

Definições de negócio ausentes estão em [Cadastros — definição pendente](CADASTROS-DEFINICAO-PENDENTE-2026-10-16.md). HD-019 ainda tem totais/cockpit e demais recortes abertos; HD-002 ainda tem conformidade de respostas/capacidades a qualificar; HD-006 ainda tem aceite Auth real. Este checkpoint não fecha integralmente esses três IDs.
