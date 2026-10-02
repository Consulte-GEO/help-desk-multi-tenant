# Help Desk M1-R10 — Handoff e backlog

## Entrada de continuidade
Ler PROJECT_HELP_DESK.md, os documentos upstream63/64 (R9 integrado), docs65–68 (R10) e o manifesto do pacote. Base upstream atual verificada: `78bbb00112331531168ae24600604cb7f3148770`. Fonte executável inicial: fingerprint `972674dad13427f3d71d6103e60772dd9e0979da5cf27c91adadf2393ba22581`.

A recuperação local não é um clone integral do GitHub. **Aplicar somente o patch R10-only sobre o checkout real compatível.** Não publicar o bundle antigo, não reaplicar R2–R9, não substituir diretórios inteiros e não usar force-push. Se houver mudanças concorrentes, revisar o delta, não sobrescrever.

## Entrega
`test:hosted:read`: plano por padrão e execução explícita de28 GETs existentes. Quatro atores: solicitante A, solicitante B, agente A e sessão curta de integração A. Três chamados: humano A, humano B e integração A. Acesso condicionado à autoria é preservado. Configuração e fixture pequenas/estritas, sem segredos. Relatório separa blocked/failed/passed e mantém flags operacionais false.

Regressão local final1241 testes (39 novos). SQL209 permanece sem nova execução nesta rodada; a base R9 possui209 aprovados no CI anterior. Não confundir o relatório injected do cliente com Auth hospedado. Sem alterações do domínio/API/schema/dependências/migrations.

## Ordem de retomada e critérios de saída
| Prioridade | Trabalho | Critério de saída | Estado nesta entrega |
|---|---|---|---|
| P0-R10-01 |Integrar R10 no checkout real e repetir toolchain/CI |npm ci, audit, typecheck,1241+ aplicação,209PG e71HTTP/browser efetivamente aprovados no mesmo fingerprint |Pendente no destino; aplicação local aprovada |
| P0-R10-02 |Definir o destino de homologação e seu acesso |Permalink, commit conferido no Netlify, backend Supabase correto, autorização atual, dados sintéticos, runtime sob governança própria |Pendente; não habilitar produção para testar |
| P0-R10-03 |Provisionar/validar fixture de aceitação |Quatro identidades, grants corretos, três chamados, duas mensagens, nota sintética e contextos staging; credenciais de curta duração fora do repositório |Especificada, não provisionada por esta rodada |
| P0-R10-04 |Executar cliente de leitura hospedada |28cenários passed via transporte https e evidências sanitizadas do destino; inspeção manual do resultado |Cliente implementado/testado localmente; hospedado não executado |
| P0-AUTH |Homologar ciclo humano e M2M |Login/refresh/logout/expiração/revogação e emissão/rotação/revogação M2M reais, inclusive autorizações concorrentes |Não coberto pelo cliente de leitura |
| P0-WRITE |Homologar mutações hospedadas |Abertura idempotente, repetição/resultado incerto, mensagens/notas, conflitos, atomicidade e isolamento com backend real |Pendente; não automatizado nesta entrega |
| P0-OPS |Encerrar M1 operacional |Pooler/TLS dentro da Function, capacidade/abuso, restauração, revisão independente, residência/RPO/RTO e aceite |Pendente |
| M2 |Administração genérica |M1 encerrado antes do desenvolvimento operacional de M2 |Não iniciado |

## Arquivos para revisão
- `scripts/hosted-acceptance-core.ts`: validação, cenários, limites de resposta, cancelamento e relatório sem corpos.
- `scripts/hosted-acceptance.ts`: CLI sem carregamento de .env, sem tokens em argumentos e plano padrão sem rede.
- `tests/fixtures/hosted-acceptance-fixture.ts`: fixture estritamente local com handler/domain reais, auth/memória sintéticos.
- `tests/m1-hosted-acceptance.test.ts`: casos negativos, política de autoria, transporte e socket local.
- `scripts/homologation-core.mjs`: somente piso da aplicação atualizado para1241; preservar coerência/fingerprint/SQL/browser.

## Limites que não podem desaparecer
Permalink e configuração de homologação não são atestação do backend. O commit do relatório é declarado, não confirmado pela API. Quatro sessões pré-existentes não comprovam login ou emissão/revogação. O controle do segundo workspace não tem controle positivo e não substitui a prova integral de dois workspaces. Ausência do marcador verifica aquela nota/serialização, não todas as políticas de confidencialidade possíveis. GET pode atualizar rate limits técnicos.

O teste completo não tem fallback para outro host, mock ou usuário privilegiado. Falha de segurança para a execução; os checks restantes ficam bloqueados. Não aumentar timeouts, remover controles positivos ou trocar requester por admin/account_manager para fazer passar.

## Autorizações
Esta rodada não autorizou nem efetuou publicação, infraestrutura ou dados remotos. Qualquer autorização do handoff R9 é histórica. Não preencher `HELPDESK_RELEASE_APPROVED` nem declarar `platform_approved:true` por causa deste pacote. Toda operação externa deve ter escopo atual explícito.
