# M1-R6 — preservar resultado da transação durante falha de release

Base local R5 b0a544d53f5978aa75170a0827315d4d623e7f5c. Remoto lido: b9481b9fabde2fd9c442e44099bc17608b59571a.

## Escopo e requisito
Executar o handoff R5. Instalação e PostgreSQL permanecem bloqueados no ambiente atual: registry sem resolução DNS; Docker/binários PG ausentes. A revisão do item já registrado em docs42 identificou `client.release(broken)` em `finally` sem contenção. A hipótese a reproduzir é substituição indevida da resposta/erro já decidido por erro bruto de cleanup.

Corrigir apenas essa fronteira. COMMIT confirmado preserva seu retorno; COMMIT enviado sem confirmação preserva transaction_outcome_unknown; falha anterior conserva sua classificação. Não repetir trabalho, COMMIT, rollback, conexão ou release. Marcar a conexão lógica como inválida se release lançar. Não declarar descarte físico confirmado. Emitir evento fechado/best-effort sem erro de origem nem dados da operação. Não alterar schema, API, grants, dependências, timeout ou liberação de produção.

## Execução
1. [x] Recuperar/verificar bundle e SHA do R5, conferir remoto, ler mestre/handoff/backlog; baseline 1163.
2. [x] Reproduzir erro de release em testes Node antes da correção.
3. [x] Implementar contenção do cleanup e diagnóstico fechado; testar resultado confirmado, incerto, recusa anterior, reutilização e falha da telemetria.
4. [x] Escrever cenários do driver/PG descartável; manter claramente não executados se a infraestrutura continuar ausente.
5. [x] Executar suíte completa, comandos de verificação e gate possíveis; guardar também os bloqueios.
6. [x] Revisar diff, gerar patch R6 e cumulativo R2–R6, validar aplicação, fonte/bundle, handoff e backlog.

## Critérios e limites
Nenhum erro de release pode substituir o resultado preexistente; nenhum segredo/sentinel cru entra na telemetria; conexão marcada inválida não executa SQL num eventual novo empréstimo do mesmo objeto. A marcação é do processo, não prova fechamento de socket/pool. Certificação de autenticidade dos artefatos, descarte físico e cenário hospedado continuam separados.

Revisão nesta sessão pelo próprio executor (não há subagente revisor). Sem efeitos remotos de escrita.

## Fechamento local
Reprodução14/14 RED e14/14 GREEN; regressão1177 aprovada. Patches cumulativo55 arquivos e R6-only12 arquivos conferidos before/after. Gate não aprovado; SQL209 e navegador continuam sem execução aprovada. Não houve nova instalação, publicação ou autorização de produção. Relatórios adicionais de reexecução/recuperação acompanham o pacote externamente ao commit para evitar autorreferência.
