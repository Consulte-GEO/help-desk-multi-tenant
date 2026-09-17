# Help Desk v0.16.0 — Estado e evidências

**Entrega local, não publicada. M1 permanece aberto.** Base v0.15.0 `b3f70538370704489e01f12545ee578d6b28c84b`; branch `work/helpdesk-v0.16.0`. Logs UTC de17/09/2026 em `evidence/v016/`. Hash final no manifesto externo e bundle.

## Implementação

R14-06: modelo executável de efeitos por transação integrado ao adaptador de memória e migration010 candidata. O banco produzirá registros privados a partir das escritas reais; evento e outbox pública devem corresponder ao recurso, ator, tipo, versão e transação. Triggers privados vinculam os pares e uma constraint diferida exige conclusão antes do COMMIT. Nota/atribuição continuam internas, sem outbox. Reenvio/no-op não produzem novos efeitos. Não há processamento/envio de notificações.

**API/schema candidato0.16.0;10 migrations/25 tabelas/36 funções/18 triggers;18 operaçõesHTTP/14 caminhos.** Nove migrations anteriores preservadas byte a byte. Nenhuma dependência, endpoint, funcionalidade de interface ou privilégio direto do runtime foi adicionado. O novo ledger privado não copia corpos/motivos e não certifica registros antigos. Retenção e custo precisam de homologação.

## Verificações executadas

| Verificação | Resultado / alcance | Evidência em evidence/v016/ |
|---|---|---|
| Baseline v0.15 |905 testes aprovados antes de alterar|00-baseline-tests.txt|
| Suíte local final |**950 aprovados**, zero falhas/cancelados/ignorados/TODO;45 novos|final-tests.txt|
| HTTP de loopback |**35 checks aprovados**, domínio em memória|16-ui-repeat.txt|
| Novos sockets de falha de efeitos |Três aprovados, já incluídos nos950|08-effects-http.txt,18-review-focused.txt|
| Migrations |Dez arquivos conferidos; nove anteriores inalterados; não executa SQL|final-migrations.txt,migration-integrity.json|
| TypeScript padrão |**Falhou(2)** por dependências/tipos locais ausentes|final-typecheck-standard.txt|
| TypeScript suplementar |Aprovado com ferramentas globais; não é npm ci|final-typecheck-supplementary.txt,tool-versions.txt|
| Verify padrão |**Falhou(2)** após migrations e950 testes, na checagem de tipos|final-verify-standard.txt|
| OpenAPI estrutural |18 operações e referências verificadas; não conformidade integral|final-contracts.txt|
| Sintaxe/build/scan |27 arquivos JS/Python verificados; build só estático; scanner heurístico sem padrão reconhecido|final-syntax.json,final-build.txt,final-secrets.txt|
| Homologação agregada e publicação |**Não aprovadas**; lock falha e demais etapas dependentes ficam bloqueadas|final-homologation.txt,final-release-gate.txt|

Os950 incluem testes de domínio, HTTP, sockets sintéticos, fixtures, estado puro e orquestração controlada do driver. O modelo de efeitos em memória não executa o novo PL/pgSQL. Os checks de inventário e manifesto não comprovam funcionamento das policies, constraints, queries ou triggers reais.

## Regressões e revisão

- Primeira tentativa dos testes de omissão incluiu argumentos incorretos de comandos nos fixtures; esse log não foi apresentado como reprodução de26 falhas funcionais. Após ajustar a chamada para a assinatura existente:24 falhas/7passagens na base,31 aprovações após implementação.
- Novo grupo de contrato + casos complementares:6 falhas/35 passagens antes de atualizar inventário/manifesto e proibir alteração lateral do assunto;41 aprovações depois.
- Integração identificou quatro fixtures antigos com cardinalidade de tabelas/objetos anterior. Expectativas foram atualizadas, sem retirar os testes negativos.
- Typecheck identificou narrowing de um efeito opcional, corrigido antes de reexecutar a checagem suplementar.
- Revisão dos binders BEFORE INSERT levou à autorização explícita do pai antes de consultar metadados privados; políticas posteriores permanecem. O SQL não foi executado.
- Teste local confirmou que uma rejeição diferida simulada durante COMMIT continua retornando transaction_outcome_unknown, conforme executor anterior. Um teste SQL antigo foi alinhado a esse contrato, preservando recusa e rollback. Testes de SQL direto continuam exigindo23514.
- Primeira tentativaHTTP parou por release esperado0.15.0. Após atualizar para0.16.0,35HTTP passaram; navegador bloqueou.

Logs red/green01–12 e15–18 preservados. Revisão local em local-review.md. Não houve subagente/revisor independente, pentest, carga ou restore.

## Não homologado

**Dependências:** nova tentativa real `npm run deps:resolve` retornou EAI_AGAIN registry.npmjs.org (13-dependencies-attempt.txt). Ausência de package-lock.json confirmada após a tentativa. Não houve instalação limpa, audit, registry alternativo ou alteração de política. Tipos globais diferem dos declarados e são somente evidência suplementar.

**PostgreSQL:** executor `test:db:local` recusou Docker indisponível antes da conexão (14-database-attempt.txt). **179 cenários escritos, zero executados:**165 principais+14upgrade,33 novos (29+4). Contagem estática documentada em sql-scenario-inventory.json, não um relatório de aprovações. Sintaxe PL/pgSQL, papéis, RLS, FKs, índices, locks, subtransações, guards, upgrade e planos continuam pendentes. Nenhum Supabase remoto foi usado como alternativa.

**Navegador:** após35HTTP, Playwright retornou ERR_BLOCKED_BY_ADMINISTRATOR em page.goto.35 cenários de navegador escritos,zero aprovados nesta sessão; nenhuma nova interface além da versão. A segunda suíte humana não foi alcançada pelo runner após o bloqueio inicial. Sem aprovação visual/mobile/teclado/CSP/CORS.

**Runtime/operacional:** Auth humano/M2M, pooler/TLS/IP, pg e Functions empacotados, latência/capacidade, política de retenção dos efeitos, restauração, logs de ingresso e revisão operacional não homologados. Os helpers atuais de permissões também precisam de execução real. Intenção de outbox não é entrega nem efeito externo exatamente uma vez.

O gate exige950/179/70 aprovações efetivas (locais/SQL/HTTP+browser), não números de testes escritos. O relatório agregado está bloqueado, não assinado e não é autorização de produção.

## Efeitos externos e continuidade

GitHub consultado somente para leitura: repositório retornou vazio. Supabase/Netlify não foram reinspecionados. Nenhum push, merge, PR, deploy, migration remota, dado, conta, segredo, MFA ou infraestrutura cobrada foi alterado.

R14-06 possui implementação candidata nesta entrega; seu aceite depende de banco real. Próximo passo: dependências reais →10 migrations/179cenários e upgrade → revisão do protocolo e desempenho → Auth/pooler/Functions →browser → capacidade/restore/governança. M1 aberto; M2, anexos, SLA operacional, notificações e conectores reais continuam pendentes.
