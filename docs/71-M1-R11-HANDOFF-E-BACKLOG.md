# Help Desk M1-R11 — Handoff e backlog

## Base e integração
Ler PROJECT_HELP_DESK.md, docs64 (R9 upstream), docs65–68 (R10) e docs69–72 (R11). Remoto confirmado `78bbb00112331531168ae24600604cb7f3148770`. R10 permanece local no material entregue; não presumir integração remota.

Duas alternativas, nunca as duas: `helpdesk-m1-r10-r11.patch` para o R9 integrado, ou `helpdesk-m1-r11-only.patch` para o R10 exato. Os arquivos de changes/ são para inspeção; não sobrescrever diretórios do checkout. Base/fingerprints/hashes no manifesto. História local de recuperação não substitui upstream; não fazer force-push.

## O que está entregue
Cliente `test:hosted:auth`:12passos básicos humano/M2M com uso explícito de senha e chave de teste em memória. Reutiliza `web/human-auth.js`. Faz somente as mutações de sessão já existentes; nenhum provisionamento. Saída com estados, confirmações de encerramento e criação incerta, sem credenciais/corpos. Plano padrão não faz rede.

1.277testes locais passaram,36novos. Auth e handler reais contra provedor/SQL sintéticos, incluindo socket loopback. SQL209não reexecutado; browser bloqueado. Typecheck suplementar passou, padrão não. M1 aberto.

## Backlog ordenado
| Prioridade | Trabalho | Critério de saída | Estado |
|---|---|---|---|
| P0-INTEGRAR |Integrar a variante correta no checkout real e repetir toolchain/CI |Instalação/audit/typecheck padrão e1.277+ aplicação,209PostgreSQL e71HTTP/browser no mesmo fingerprint |Pendente externo |
| P0-PRODUCAO | Validar diretamente em produção | Site e base HelpDesk existentes; isolamento entre contas e workspaces preservado |
| P0-AUTH-BASICO |Executar R11 com usuário e conexão de teste existentes |12/12passed com transporte https, encerramentos confirmados, nenhuma criação incerta, revisão humana do relatório |Cliente implementado/testado localmente; destino não executado |
| P0-READ |Executar R10 com quatro sessões/fixture aprovada |28/28leituras/negações via https com controles positivos |Cliente implementado; destino não executado |
| P0-AUTH-COMPLETO |Expiração, acessos concorrentes revogados, limites de sessão, ciclo da chave longa |Evidência real e política aprovada sem relaxar MFA/revogação/TLS |Pendente, não coberto integralmente pelo R11 |
| P0-WRITE |Mutação idempotente e resultado incerto no host |Ticket/evento/outbox atômicos; replay e conflitos; isolamento real |Pendente |
| P0-OPS |Pooler/TLS dentro da Function, abuso/carga, restore e revisão |RPO/RTO/residência definidos e aceite operacional |Pendente |
| M2 |Administração genérica |M1 encerrado antes de iniciar operação M2 |Não iniciado |

## Revisão focal
- `scripts/hosted-auth-acceptance-core.ts`: origens, identidade Auth distinta de principal, fase positiva antes de revogação, cinco segundos/64KiB, ausência de retries e cleanup.
- `scripts/hosted-auth-acceptance.ts`: argumentos sem senha/chave, leitura de env somente com todas as confirmações, arquivo de configuração limitado.
- `tests/fixtures/hosted-auth-fixture.ts`: mantém JWT humano válido depois de logout para não fabricar revogação imediata; SQL é sintético, não PostgreSQL.
- `tests/m1-hosted-auth-acceptance.test.ts`: respostas perdidas, credencial privilegiada retornada, metadados não autorizam, indisponibilidade não atesta revogação, socket não atesta host.

## Limites que não podem desaparecer
O único ambiente do Help Desk é produção: site helpdesk-consultegeo e projeto Supabase HelpDesk xaelbntjnvztznnpcvtm. Desenvolvimento, implantação e validação hospedada usam esse destino. Não solicitar ambiente ou credenciais de teste ao usuário. O percurso HTTP e as permissões efetivas precisam ser comprovados; o plano não concede aprovação operacional.

Não fechar M1 ou ligar platform_approved/operational com o resultado deste cliente. Nenhuma autorização histórica é autorização para operações atuais. Não colocar dados reais/senhas/chaves em tickets, chat, zip ou logs.
