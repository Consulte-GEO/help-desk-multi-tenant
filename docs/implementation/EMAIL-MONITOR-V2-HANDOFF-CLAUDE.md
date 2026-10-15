# Continuidade da implementação de e-mails V2

## Estado que deve ser preservado

O código está na branch local `codex/email-monitoring-v2`, base `e8878675eddf21ed9d0fa4ae3ae89abc90c497a4`. A implementação principal está em `bfef03b`; os commits seguintes corrigem/revisam cobertura, diagnóstico e documentação. Consultar `git log` para o HEAD exato. O titular autorizou expressamente push/PR/CI e a branch foi enviada: [PR52](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/52). Não houve deploy, callback real ou mudança de produção nesta rodada.

Leitura inicial: `AGENTS.md`, `docs/159-GESTAO-EMAILS-V2-2026-10-15.md`, especificação V2 e `docs/implementation/EMAIL-MONITOR-V2-PROGRESS.md`. O diretório da especificação é um registro íntegro anterior ao código; seus campos “a desenvolver” não são um inventário atualizado da implementação. Não editar seu manifesto para fingir aceite do produto.

O monitor é somente leitura e usa autenticação, contexto de autorização, fila, planner e workers existentes. GEOCON inspirou a apresentação; GEOLAB, princípios de consultas e indicadores. Não houve cópia de sender, React, laboratório, pixel próprio ou campanhas. Não adicionar reenvio, preferências, ciência, editor de template ou novas permissões de cliente.

## Validação executada e limite concreto

- Suíte focada ampliada:185/185 aprovados, incluindo regras, HTTP, store/cursor cifrado, rollout, HDA, UI, compiler, staging e assets. São testes do código local, não aceite hospedado.
- SQL auxiliar PGlite:21/21 consultas e18/18 telemetria. Esse ambiente não comprova RLS nem login de autoridade real.
- Navegador Node/Chrome:22 verificações do componente e32 do shell completo com transportes sintéticos; screenshots desktop/360px inspecionados. A suíte Python portátil foi adicionada ao runner oficial; execução Python local não concluiu, portanto não afirmar aprovação dessa suíte.
- A suíte ampla Windows não foi aprovada:5719 testes,5568 pass e151 fail antes das últimas correções. Inclui limitações de symlink/socket/processos e timeouts. Duas regressões reais foram isoladas e corrigidas (assets do demo e manifesto na fixture de staging). Não remover testes, aumentar timeouts indiscriminadamente ou converter falhas em skips.
- Typecheck, build, verificação estrutural OpenAPI e cadeia offline de migrations executados. A verificação OpenAPI é estrutural, não um validador oficial completo.
-16 cenários PG17 reais foram preparados em `supabase/tests/email-monitor-scenarios.ts`, registrados na suíte de ativação. Ainda não foram executados nesta rodada.

A recusa inicial de push foi resolvida por autorização humana explícita para enviar esta branch ao repositório correto, abrir PR e executar CI. Essa autorização não inclui publicação em produção. O CI está em qualificação; consultar os resultados mais recentes do PR.

## Próximos passos

1. A autorização explícita de push/PR/CI já foi concedida para `Consulte-GEO/help-desk-multi-tenant`. O remote `github` aponta para esse repositório; `origin` é um bundle local antigo e não é o destino de push.
2. A branch já foi enviada e o PR52 está aberto para `codex/m1-reproducibilidade`; aguardar o CI do commit exato. Os workflows principal e suplementar de PG17 já contemplam a branch; não afrouxar os gates.
3. Executar/corrigir PostgreSQL17 com sessões reais restritas e toda a cadeia de migrations, mais interface Python e suíte completa Linux. Inspecionar logs reais antes de declarar aprovação. O teste usa clusters descartáveis próprios, envio sintético e callbacks assinados, sem Resend real.
4. Tratar falhas de teste com investigação e regressão negativa; não ajustar catálogo ou hashes para esconder drift. Reexecutar somente o necessário após cada correção e depois o gate completo do commit final.
5. Registrar CI/PR/commit e limites no checkpoint/ledger. A implantação produtiva, início da coleta no provedor e aceite autenticado continuam etapas distintas, sob autorização e processo do projeto.

## Pontos sensíveis da implementação

- Schema0.27 é append21 sobre HDA0.26. Prefixo20 deve permanecer byte a byte idêntico. Contrato final:88 tabelas,233 funções,516 constraints, três roles. Contratos e query históricos0.25 estão congelados.
- Mudanças no SQL candidato exigem compiler, pins, manifesto e migration consistentes, além de contrato revisado. `verifyEmailMonitorUpgrade` é verificador offline determinístico; não aplica nada nem repara arquivos.
- Equipe recebe máscara no SQL e DTO fechado; administração recebe endereço capturado no envio autorizado. Não buscar Auth atual para reconstruir endereços antigos nem permitir busca livre por destinatário à equipe.
- Clique/abertura são independentes da entrega. Callback estranho/sem vínculo não se associa por assunto, endereço ou tags. No replay, a identidade e os bytes/hash devem permanecer compatíveis.
- Configuração de início e lacunas é privada. Datas de início ficam nulas até prova real da coleta. Lacuna `[started_at,ended_at)` exclui a intenção afetada da elegibilidade sem apagar fatos observados; novas intenções após o fim podem voltar a ser elegíveis.
- Idade de pendência é calculada no servidor desde enfileiramento até `asOf`; não representa aceite nem tempo do estado atual. Estados aceitos/terminais retornam nulo.
- Cursor é cifrado e vinculado a identidade, filtros, contexto e fatos autorizados; mudanças podem produzir409. Reiniciar a consulta, nunca compartilhar cursor entre usuários ou workspaces.
- Os workers mantêm13 e7 RPCs, respectivamente. O receptor novo só envia `eventType` quando qualifica schema0.27, mantendo compatibilidade durante rollout. Não criar fila/worker/pixel adicionais.
- Preservar piloto, CG-10001/CG-10002, adiamento de MFA e novos clientes; não repetir bootstrap, vínculo Claude, seeds ou migration19.

## Prompt para iniciar no Claude

> Continue a implementação da gestão de entrega de e-mails V2 existente nesta branch. Leia AGENTS.md, checkpoint159 e este handoff antes de agir. O código passou revisão e testes focais, mas falta executar PG17 real e CI Linux do commit final. Preserve a especificação aprovada, privacidade, contratos históricos e o piloto. O titular já autorizou explicitamente push, PR e CI para este repositório e a branch está no PR52. Continue corrigindo quaisquer falhas reais e apresente PR e evidências. Não considere testes sintéticos como aceite produtivo nem faça deploy ou ative coleta sem cumprir o processo operacional autorizado.
