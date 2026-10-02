# Help Desk M1-R14 — Estado e evidências

**01/10/2026 · Implementado e testado localmente; não publicado, não homologado e não operacional. M1 aberto.**

## Base e recuperação
Remoto consultado pelo conector GitHub: `78bbb00112331531168ae24600604cb7f3148770`, branches `codex/m1-reproducibilidade` e `codex/m1-r9-integracao`. O handoff remoto 64 registra o CI anterior R9 com 1.202 aplicação/209 PostgreSQL/71 HTTP+browser. Esse resultado não é atribuído ao R14.

Base local de desenvolvimento: R13 `1117bba1e097ec75db00dd86bf4948a8a983db3c`, recuperada dos arquivos enviados e quatro arquivos R9 identificados por blob Git. Fingerprint inicial exato: `0b90a9bc12d397e2d7607307a8287bec447f056bafe83419660df6e7dac32c66`. Baseline 1.333/1.333. O blob inicial de `authentication.ts` coincide com o remoto: `d8365f18d18d4b77d9844257e82257203ff9d3a2`.

A história Git local é uma recuperação, não o clone integral upstream. Os documentos históricos do arquivo de recuperação foram lidos como históricos; os novos documentos e o PROJECT identificam o estado local atual. Não substituir o checkout ou a história remota pela recuperação.

## Correção entregue
`src/infrastructure/authentication.ts` agora solicita uma única vez o cancelamento do corpo de uma resposta humana recusada por HTTP, sem ler esse corpo. Preserva os códigos existentes: 401/unauthorized nas recusas e 503/auth_unavailable para 429/5xx. Nenhum SQL é enviado nesses caminhos.

O cancelamento é best-effort: não é aguardado, não tem retry e sua falha síncrona/assíncrona não muda o erro seguro. O caminho de sucesso permanece no leitor limitado de JSON e na autorização privada por principal/workspace. Não houve mudança em sessão M2M, login/refresh/logout, grants, MFA, endpoints ou schema.

A verificação mínima de aplicação no gate acompanha a suíte nova (1.347). Isso não aprova o gate nem substitui as demais etapas.

## Reprodução e testes
| Verificação | Resultado e evidência relativa a `evidence/r14/` |
|---|---|
| Baseline R13 | 1.333 aprovados — `01-baseline.log` |
| RED | 12 falhas e 2 controles aprovados, antes de alterar o runtime — `05-auth-cleanup-red.log` |
| GREEN focal | 14/14 aprovados — `06-auth-cleanup-green.log` |
| Suíte final | 1.347 aprovados, 14 novos, zero falhas/cancelados/skips/TODO — `07-full-tests.log` |
| Native fetch/HTTP | Três cenários incluídos na suíte: 401, 429 e 503 com corpo sem fim; depois da correção o servidor próprio observou o fechamento antes do limite de 1 segundo do teste |
| HTTP da demonstração | 35 aprovações com memória, antes da falha de browser — `02-ui.log` |
| Browser | `ERR_BLOCKED_BY_ADMINISTRATOR`; zero verificações browser aprovadas nesta rodada — `02-ui.log` |
| PostgreSQL | Runner recusou Docker ausente; 209 cenários existentes, zero executados — `03-postgres.log` |
| npm ci offline | ENOTCACHED — `04-install-offline.log` |
| npm ci online | Tentativa limitada de rede interrompida após 15 segundos; não aprovada — `08-install-online.log` |
| npm audit | EAI_AGAIN no registry oficial, não aprovado — `09-audit.log` |
| TypeScript padrão | Falhou por definições locais Node/pg ausentes — `10-typecheck-standard.log` |
| TypeScript suplementar | Passou com TypeScript 5.8.3 e tipos globais Node 25.1.0 — `17-typecheck-supplemental.log`; NÃO substitui toolchain travada |
| Migrations | 11 verificadas, nenhuma SQL executada — `11-migrations.log` |
| Lock | Preservado, coerência aprovada — `12-lock.log` |
| Contratos | 18 operações, verificação estrutural — `13-contracts.log` |
| Scan heurístico | Sem padrões reconhecidos, não auditoria integral — `14-secrets.log` |
| Build | Somente frontend estático aprovado — `15-build.log` |
| Gate | Não aprovado — `16-gate.log` |

A evidência de reaplicação em cópias limpas acompanha `18-package-validation.json` e `19-reapplied-tests.log`. Os três cenários de socket e os seis TLS herdados já estão incluídos nos 1.347; não somar novamente. Nos testes de HTTP nativo apenas transporte/socket são reais: identidade e SQL permanecem sintéticos.

## Limites, revisão e riscos
Não se constatou incidente no Supabase ou Netlify. A reprodução comprova a retenção de três respostas artificiais abertas antes da correção, não exaustão de capacidade ou vazamento em produção. Cancelamento solicitado não assegura liberação física quando o driver/stream falha; os testes verificam que a falha não altera a autorização e não bloqueia a resposta.

Revisão manual pelo mesmo executor; não houve subagente/revisor independente, pentest, carga, restore ou login hospedado. Fontes externas servem de fundamentação, não evidência de execução. O download de fonte PostgreSQL pelo endereço oficial não concluiu; não houve instalação de servidor, registry alternativo, modificação de rede ou contorno de bloqueio do navegador.

Compatibilidade: API/interface 0.19.0; schema 0.18.0; 11 migrations e lock preservados; nenhuma dependência, comando, endpoint ou coluna nova. O Help Desk continua genérico multiproduto/multicontrato. R10–R13 estão preservados no cumulativo.

## Resultado da fonte e operações
Fingerprint final de código/configuração/testes: `722e5bb449cd4844f7b08d224a60bcf57367f39b4f2032ccb5b9730cae59b101`.
Nenhum push, PR, merge, deploy, migration remota, mudança de usuários, senhas, MFA, segredos, dados ou gate de produção foi executado. M2 não iniciado.
