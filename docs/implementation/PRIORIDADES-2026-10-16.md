# Implementação das prioridades — 16/10/2026

Autorização: executar itens prioritários do levantamento, reutilizando módulos existentes e preservando MFA/Novo GEO adiados e scanner cancelado. Base inicial `f13754e`, branch `codex/prioridades-levantamento-20261016`.

## Recortes executáveis nesta entrega

- [ ] **HD-019, busca por protocolo:** ampliar a consulta existente de tickets para encontrar o protocolo CG completo, sem pesquisar notas/mensagens, sem alterar escopos e antes da paginação. Assunto literal e UUID completo continuam disponíveis. O PostgreSQL usa somente a projeção autorizada `cg_local_ticket_summary` já existente na composição Consulte GEO; a composição genérica não chama função CG. UI e OpenAPI descrevem a mesma busca. Testes: memória/HTTP, cursor/filtros, outra conta/pessoa/workspace/revogação, SQL parametrizado e PostgreSQL restrito.
- [ ] **HD-002, validação formal:** adicionar validador OpenAPI fixado em dependência de desenvolvimento e conservar os sentinelas estruturais existentes. Impedir resolução de referências externas/rede. Gate executável separa schema formal de conformidade de respostas reais, que continua por rota. Testes negativos: contrato inválido, referência externa e não resolvida; contrato do projeto válido. Não anunciar homologação automática de todas as rotas por validar o documento.
- [ ] **HD-006, regressões combinadas:** complementar somente os cenários ausentes de confirmação antiga após troca de identidade e timeout real do transporte atravessando estado. Nenhuma liberação do modo avançado/MFA, nenhum teste Auth produtivo ou mudança de conta real.
- [ ] **HD-001, estado:** registrar resultados, fonte e limitações desta entrega; manter backlog antigo imutável e indicar recortes ainda abertos. Sem declarar totais/SLA/backoffice/implantação concluídos por entregar busca.

## Sequência e verificação

1. Escrever e executar testes negativos do recorte antes da alteração.
2. Implementar com os adaptadores/serviços existentes; nenhuma migration, grant ou segredo novo para os três recortes acima.
3. Executar testes focais, suíte de aplicação, typecheck, contratos, segredos, lock, build, banco e UI em bancada apta. Preservar falhas preexistentes identificadas, sem mascarar limitações do ambiente.
4. Revisar diff, atualizar este checkpoint e registrar evidência sanitizada. CI/merge/publicação e aceite humano são estados distintos; esta implementação não os presume.

## Frentes seguintes que não podem ser inventadas

HD-011 precisa manter equivalência entre DSL/publicador, PostgreSQL e UI, com nova versão de formulário, sem alterar snapshots antigos. Foi solicitada a referência homologada dos modelos técnicos para HD-013–015; não há autorização para inventar norma/limite de engenharia. HD-009/010 dependem de política/autoridade; admin sensível depende da retomada MFA. SLA atual precisa projeção própria e não mudará política como efeito da busca. HD-024 continua exigindo revisão explícita do contrato de arquivos, sem scanner. Novo GEO, HDA executor e legado permanecem condicionados às decisões vigentes.

## Progresso e evidências

Busca por protocolo implementada; testes de memória/HTTP e filtros/cursor/ACL passaram, com teste PostgreSQL restrito acrescentado à suíte existente. Sem migration ou grant. A interface identifica assunto/protocolo/UUID e descreve busca exata pelo protocolo completo.

Gate formal implementado com `@apidevtools/swagger-parser@12.1.0` e `ajv@8.20.0` como dependências diretas de desenvolvimento fixadas. Valida estrutura OpenAPI3.1.1, Schema Objects2020-12 e referências JSON Pointer internas, sem arquivo/rede remotos. Não é validador de respostas hospedadas. Revisão independente encontrou dois casos inicialmente aceitos (tipo de schema inválido/dynamicRef quebrado) e um erro no reconhecimento de nomes de componentes; todos foram reproduzidos em testes vermelhos e corrigidos. Nomes de componentes são chaves opacas, não palavras-chave.

Transport timeout atravessando a sessão passou; teste de navegador para confirmação obsoleta após novo principal acrescentado. Acesso avançado continua oculto; aceite entre dispositivos não executado.

Verificações locais observadas: busca/adaptadores33/33; OpenAPI7/7; logout9/9; gate de contratos44 operações; lock coerente; auditoria npm sem vulnerabilidades na instalação; typecheck e build aprovados. A instalação do módulo no build exigiu acesso npm fora do sandbox após falha DNS; lock preservado. Nenhuma publicação ocorreu.

A baseline Windows executou5.829 testes, com5.688 aprovados/141 falhas. A execução seguinte (antes dos últimos quatro testes do validador) executou5.836, com5.695 aprovados/141 falhas. Há falhas por Node22 indisponível em testes que exigem esse major, sockets/links e subprocessos limitados no sandbox; esses resultados **não são suíte aprovada**. As falhas não foram removidas e a validação integral será feita no CI Linux. Navegador local não iniciou por incompatibilidade do módulo greenlet cp312 com Python3.14 disponível; não é falha de produto ou prova de aceite. PostgreSQL local nativo exige Linux/macOS/WSL/Docker, indisponíveis nesta sessão Windows.

CI/PR e resultados finais serão registrados depois da execução no SHA correspondente. HD-019 ainda tem totais/cockpit e demais recortes abertos; HD-002 ainda tem conformidade de respostas/capacidades a qualificar; HD-006 ainda tem aceite Auth real. Este checkpoint não fecha integralmente esses três IDs.
