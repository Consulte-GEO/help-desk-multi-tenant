# Backlog consolidado — após M1-R3

| ID | Prioridade e entrega | Estado após esta rodada | Aceite de saída |
|---|---|---|---|
| M1-R2-INT | Integrar R2 revisado e R3 na fonte atual | Pacote/patchs preparados e verificados localmente; não publicado | Branch revisada preserva mudanças concorrentes; preimages/fingerprint coerentes |
| M1-DEP | Dependências reproduzíveis e audit | Lock existe; nesta rodada instalação/audit bloqueados | npm ci, verify, audit reais aprovados com dependências locais |
| M1-PG | Reexecutar PostgreSQL17/upgrade do código novo | 204 escritos,0 executados aqui | 188principais+16upgrade aprovados, sem skips |
| M1-R3-EVT | Erro assíncrono de cliente e supressão de SQL após quebra | Implementado/testado localmente; sem prova pg atual | Manter regressões e confirmar comportamento com pg8.16.3 |
| M1-R3-TLS | Handshake e socket encerrado | 6testes TLS reais locais; incluídos na suíte1114 | Manter CA/hostname; provar pg/TLS real separado |
| M1-UI | UI/identidade no navegador | 35HTTP aprovados;36browser bloqueados | 71verificações completas do código novo |
| M1-GATE | Nova evidência local rastreável | Mínimos1114/204/71; não aprovado | homologate:local e check:homologation aprovados sem reaproveitar bytes antigos |
| M1-RUNTIME | Diagnóstico pelo driver e dentro da Function | Implementação privada revisada; nenhuma execução hospedada nova | pg/TLS/pooler/login restrito/guards e encerramento comprovados, sem liberar produção por atalho |
| M1-AUTH | Pessoas/M2M ponta a ponta | Não homologado neste incremento | Login, contexto, revogação, isolamento e falhas reais em ambiente autorizado |
| M1-OPS | Carga/abuso/restore/revisão e governança | Pendentes | Evidências de capacidade, restauração, RPO/RTO/residência e aceite operacional |
| M2-ADM | Administração genérica | Não iniciada nesta rodada | Começar após M1; sem campos de GeoLab/Financeiro no núcleo |

A ausência de PostgreSQL/registry local não autoriza testes destrutivos no projeto hospedado ou alterações de rede. O diagnóstico de um instante não é monitoramento permanente, login homologado ou autorização de release. Quantidade de testes não mede percentual de conclusão do produto.
