# Backlog — Help Desk após M1-R7

| Prioridade | Item | Estado / critério de saída |
|---|---|---|
| P0 | Integrar R2–R7 no checkout real | Pacote local; before/after não substituem CI |
| P0 | Executar workflow sem histórico de evidências | Implementado/testado localmente no R7; execução GitHub ainda pendente |
| P0 | npm ci, verify, audit | Não aprovados neste ambiente; não substituir por cache/tipos globais |
| P0 | PostgreSQL17 fresh/upgrade e driver |209cenários escritos;0executados nesta rodada; comprovar transação/reuso/descarte |
| P0 | Interface |35HTTP memória aprovados;36browser ainda pendentes nesta rodada |
| P0 | Gate do código atual | Exigir relatório e logs da tentativa correta, sem skips, fingerprint correspondente |
| P0 | Function/Auth/M2M reais | Pendente; configuração histórica não comprova percurso hospedado |
| P0 | Capacidade/abuso/restore/governança/revisão | Pendentes para fechar M1 |
| P1 | M2 administrativo | Não iniciado; só depois do aceite M1 |

R7 não adiciona testes SQL nem corrige novamente o núcleo transacional. A limitação de execução permanece de infraestrutura/integração. A próxima rodada deve buscar evidência real em ambiente autorizado, não outra nova camada de diagnóstico nem aumento arbitrário de testes sintéticos.

As duas referências-base de migrations agora ficam em tests/fixtures/migration-baselines, com os mesmos hashes originais; não restaurar sua leitura de evidence/ nem regenerar os arquivos para acomodar divergências.
