# Backlog — Help Desk após M1-R6

| Prioridade | Item | Estado / saída exigida |
|---|---|---|
| P0 | Integrar R2–R6 no checkout real | Pacote local; inspeções de arquivos/patch não substituem CI ou homologação |
| P0 | Instalação npm ci / verify / audit | Não aprovados neste ambiente; usar o lock real e registry autorizado |
| P0 | PostgreSQL17 fresh/upgrade | 209 cenários escritos; precisam de execução integral sem skips na fonte atual |
| P0 | Driver/TLS e descarte físico | Testar interrupção, reuso A/B, confirmação incerta e release; marcação lógica não libera recursos físicos |
| P0 | Interface |35HTTP memória aprovados;36browser pendentes nesta rodada |
| P0 | Gate da fonte atual | Não aprovado; obter logs completos e fingerprint correspondente |
| P0 | Function/Auth/M2M reais | Pendente; diagnóstico local não equivale a execução hospedada; exige autorização atual |
| P0 | Capacidade/abuso/restore/governança/revisão | Pendentes para aceite operacional M1 |
| P1 | M2 administração | Não iniciado; posterior ao M1 |

Pendência de R5 sobre exceção síncrona de release: correção implementada e coberta por14 testes locais. NÃO reclassificar o item de descarte real como homologado. Não há motivo para alterar o schema/API apenas para criar novo número de versão. Não iniciar outra camada de diagnóstico como substituto da execução dos gates existentes.
