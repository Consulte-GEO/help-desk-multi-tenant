# Help Desk M1-R12 — Handoff e backlog

## Fonte
Ler `PROJECT_HELP_DESK.md`, `README.md`, `AGENTS.md`, documento 64 da integração upstream, documentos 69–72 do R11 e documentos 73–76 do R12. Remoto observado 78bbb00112331531168ae24600604cb7f3148770: R9. Fonte R11 recuperada com baseline de 1.277 testes aprovados. Não reaplicar R2–R9 nem substituir a história upstream por commits de recuperação.

## Entrega
R12: `test:hosted:write`. Plano sem rede por padrão. Execução exige origem, hash lógico da configuração e opt-in de mutações de chamados. Reutiliza R10 (28 controles prévios), depois 18 verificações básicas de escrita humana/operador e consultas finais. executionId no JSON gera chaves estáveis. Relatório distingue confirmado/rejeitado/desconhecido/não tentado; nunca gera nova chave depois de incerteza ou expiração. Nenhum cleanup de domínio.

1.320 testes Node passaram, 43 novos. Socket real HTTP loopback com handler/identidades sintéticas/memória. Typecheck suplementar passou; padrão/instalação/audit/gate não aprovados. SQL: 209 cenários não reexecutados; 35 checks HTTP da demo passaram e browser bloqueou. M1 aberto.

## Variantes
- `helpdesk-m1-r10-r12.patch`: R9 integrado, sem R10/R11.
- `helpdesk-m1-r12-only.patch`: R11 exato já integrado.

Nunca aplicar ambos. Checkout só com R10 precisa primeiro reconciliar R11 ou gerar integração revisada, não forçar um desses patches. Hashes de entrada/saída e fingerprints no manifesto. `changes/` é para inspeção, não overwrite de diretório.

## Backlog ordenado
| Prioridade | Entrega | Critério de saída | Estado |
| --- | --- | --- | --- |
| P0-INTEGRAR | Integrar R10–R12 e repetir toolchain/CI | Instalação, auditoria e typecheck padrão; no mínimo 1.320 testes de aplicação, 209 testes PostgreSQL 17 e 71 checks HTTP/browser no mesmo fingerprint | Pendente externo |
| P0-PRODUCAO | Validar diretamente em produção | Site e base HelpDesk existentes; isolamento entre contas e workspaces preservado |
| P0-AUTH/READ | Executar R11 (12) e R10 (28) em HTTPS | Sessões testadas/encerradas, controles positivos e negações | Clientes locais; host não executado |
| P0-WRITE-BASICO | Executar R12 (28 prévios + 18) em HTTPS | Um recurso por intenção na API; replay histórico;409/412;isolamento;recibos/relatório revisados | Cliente implementado/testado localmente |
| P0-WRITE-BANCO | Correlacionar efeitos e concorrência reais | Ticket/mensagem/evento/outbox atômicos em PG, perda de confirmação controlada sem duplicação | Não atestado pelo cliente HTTP |
| P0-AUTH-COMPLETO | Expiração/revogações concorrentes/ciclo da chave longa | Evidência real sem relaxar autorização | Pendente |
| P0-WRITE-RESTANTE | M2M com escrita, notas, transições, atribuições, concorrência no host | Evidência própria; R12 cobre humano+prioridade, não todas as mutações | Pendente |
| P0-OPS | Function/TLS/pooler, capacidade, restore e revisão independente | RPO/RTO/residência e aceite operacional | Pendente |
| M2 | Administração genérica | M1 encerrado antes da operação M2 | Não iniciado |

## Revisão focal
`hosted-write-acceptance-core.ts`: pré-condições, snapshot dos inputs antes de rede, chaves estáveis, confirmação antes de novo comando, códigos seguros, histórico versus GET atual, sem prova fictícia de DB/outbox. `hosted-write-acceptance.ts`: mesmas 4 variáveis do R10, validação origem/hash antes de ler env, JSON até 32 KiB. Testes: perdas depois das 3 gravações e recuperação explícita; resposta incoerente; prazo real; socket; nunca entregar detalhes privados em JSON.

R11 encerra suas sessões; R10/R12 exigem novas sessões pré-provisionadas ainda válidas. Não reutilizar sessões já revogadas. Não reproduzir comandos de perda de conexão contra banco compartilhado. A suite local PG continua restrita a banco descartável próprio.

**Revisão desta rodada não é independente. Nenhuma autorização remota antiga vale para novas operações.**
