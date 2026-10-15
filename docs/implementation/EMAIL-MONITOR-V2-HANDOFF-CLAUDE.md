# Continuidade da implementação de e-mails V2

## Estado produtivo posterior à entrega

O titular autorizou e o PR52 foi integrado/publicado. O banco HelpDesk já está em0.27 pela migration remota20261015190027; não reaplicar append21 nem bootstrap. Capability do monitor true,91 assets e13 checks HTTPS aprovados, três workers204. A coleta real ainda não foi qualificada e as datas de cobertura permanecem nulas. O painel Resend autenticado é a dependência atual; o pixel/link de e-mails recebidos respondeu, mas nenhum callback de engajamento chegou/persistiu. Ler [checkpoint produtivo](EMAIL-MONITOR-V2-PRODUCTION-2026-10-15.md) e seus recibos. As descrições anteriores de PR sem merge/produção pendente abaixo são históricas. Não reimplantar nem iniciar cobertura por inferência.

## Estado que deve ser preservado

O código está na branch `codex/email-monitoring-v2`, base original `e8878675eddf21ed9d0fa4ae3ae89abc90c497a4`, posteriormente integrada com a base atual. A implementação principal está em `bfef03b`; os commits seguintes corrigem/revisam cobertura, diagnóstico e documentação. Consultar `git log` para o HEAD exato. O titular autorizou expressamente push/PR/CI e a branch foi enviada: [PR52](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/52). Há preview automático de build. Não houve implantação produtiva, callback real ou alteração de dados de produção nesta rodada.

Leitura inicial: `AGENTS.md`, `docs/159-GESTAO-EMAILS-V2-2026-10-15.md`, especificação V2 e `docs/implementation/EMAIL-MONITOR-V2-PROGRESS.md`. O diretório da especificação é um registro íntegro anterior ao código; seus campos “a desenvolver” não são um inventário atualizado da implementação. Não editar seu manifesto para fingir aceite do produto.

O monitor é somente leitura e usa autenticação, contexto de autorização, fila, planner e workers existentes. GEOCON inspirou a apresentação; GEOLAB, princípios de consultas e indicadores. Não houve cópia de sender, React, laboratório, pixel próprio ou campanhas. Não adicionar reenvio, preferências, ciência, editor de template ou novas permissões de cliente.

## Validação executada e limite concreto

Conjunto integrado 7f311bd qualificado no [CI38784669764](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38784669764): 5739 aplicação + 697 PostgreSQL17 + 632 interface = 7068 testes, todos aprovados, sem falhas/skips/cancel/todo. Fonte SHA256 377fa67122d2c79bdbd609f541f57202e1eb2f45c8492c2f5a575a71e483f253. O recibo original e os logs estão em evidence/homologation/runs/41ceee85-9c25-41ab-80ac-d5d9bdf77334; latest.json aponta para esse mesmo conjunto. A documentação posterior não altera a fonte executável. HDA, PG suplementar e CodeQL devem ser conferidos nos checks do PR52. Os resultados anteriores abaixo são históricos; não substituem esta qualificação integrada. Não houve merge do PR52 ou implantação produtiva.

**Qualificação concluída da fonte06c0bdb:** [CI38779615398](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38779615398),5728 aplicação +697 PostgreSQL +632 interface, zero falhas/skips/cancel/todo. Recibo e logs íntegros em `evidence/homologation/`; `npm run check:homologation` confirmou a fonte SHA25644831b432decb57e937e68bc81081ab71f917e9958970aa7f0e38c2b9ebc060b. HDA40 candidato/14 cadeia completa/49 DOM e CodeQL também aprovados. Os resultados locais abaixo são histórico complementar; não substituem esse gate Linux real. A documentação/evidência posterior não altera a fonte executável homologada. Consultar o PR para verificações posteriores.

- Suíte focada ampliada:185/185 aprovados, incluindo regras, HTTP, store/cursor cifrado, rollout, HDA, UI, compiler, staging e assets. São testes do código local, não aceite hospedado.
- SQL auxiliar PGlite:21/21 consultas e18/18 telemetria. Esse ambiente não comprova RLS nem login de autoridade real.
- Navegador Node/Chrome:22 verificações do componente e32 do shell completo com transportes sintéticos; screenshots desktop/360px inspecionados. A suíte Python portátil foi adicionada ao runner oficial; execução Python local não concluiu, portanto não afirmar aprovação dessa suíte.
- A suíte ampla Windows não foi aprovada:5719 testes,5568 pass e151 fail antes das últimas correções. Inclui limitações de symlink/socket/processos e timeouts. Duas regressões reais foram isoladas e corrigidas (assets do demo e manifesto na fixture de staging). Não remover testes, aumentar timeouts indiscriminadamente ou converter falhas em skips.
- Typecheck, build, verificação estrutural OpenAPI e cadeia offline de migrations executados. A verificação OpenAPI é estrutural, não um validador oficial completo.
- Os16 cenários PG17 reais em `supabase/tests/email-monitor-scenarios.ts` passaram no run38778766099 (f7b7356) e novamente no gate completo06c0bdb. Eles usam app/worker restritos e cadeia real; não são apenas diagnóstico PGlite. O marcador SQL de armazenamento HDA foi corrigido no append27 e a compatibilidade foi aprovada no CI final.

A recusa inicial de push foi resolvida por autorização humana explícita para enviar esta branch ao repositório correto, abrir PR e executar CI. Essa autorização não inclui publicação em produção. O CI da fonte acima foi aprovado; consultar os resultados mais recentes do PR. A prévia Netlify e qualquer promoção produtiva são estágios separados; não retirar o gate de release para publicá-las.

## Próximos passos

### Integração concorrente de 15/10/2026

A base recebeu o PR53 do worker de contribuição do Wiki (`14b1974`) depois da qualificação original deste monitor. O commit de integração `7f311bd` preserva esse worker e os dois conjuntos de recibos históricos, sem alterar código funcional do monitor. O conflito era exclusivamente no ponteiro `evidence/homologation/latest.json`; ele manteve a versão da base até a emissão de um novo recibo para a fonte combinada. Nenhum recibo isolado comprova essa combinação. Consultar o CI da integração e o registro posterior no ledger antes de declarar o conjunto homologado.

Os avisos do Wiki têm ledger próprio e não entram neste monitor de chamados. O ensaio independente `run-wiki-email-composition.mjs` recebido do PR53 está deliberadamente fixado às fontes/schema0.26: seu recibo anterior é histórico, não prova de composição do Wiki com schema0.27. Não remover seus pins para produzir aprovação aparente. Qualificação operacional ampliada requer ensaio próprio autorizado, além dos gates desta branch.

1. A autorização explícita de push/PR/CI já foi concedida para `Consulte-GEO/help-desk-multi-tenant`. O remote `github` aponta para esse repositório; `origin` é um bundle local antigo e não é o destino de push.
2. A branch já foi enviada e o PR52 está aberto para `codex/m1-reproducibilidade`; aguardar o CI do commit exato. Os workflows principal e suplementar de PG17 já contemplam a branch; não afrouxar os gates.
3. Conferir os resultados mais recentes do CI no PR52: PostgreSQL17 com sessões reais restritas e toda a cadeia de migrations, interface Python e suíte completa Linux. Não repetir gates já aprovados sem mudança de fonte, falha ou preocupação concreta. Inspecionar logs reais antes de declarar aprovação. O teste usa clusters descartáveis próprios, envio sintético e callbacks assinados, sem Resend real.
4. Tratar falhas de teste com investigação e regressão negativa; não ajustar catálogo ou hashes para esconder drift. Reexecutar somente o necessário após cada correção e depois o gate completo do commit final.
5. A qualificação e os limites estão registrados no checkpoint/ledger e na matriz de rastreabilidade. Depois da revisão do PR, a implantação produtiva, início da coleta no provedor e aceite autenticado continuam etapas distintas, sob autorização e processo do projeto.

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

> Continue a implementação da gestão de entrega de e-mails V2 existente nesta branch. Leia AGENTS.md, checkpoint159 e este handoff antes de agir. O código passou revisão, testes focais e16 cenários de monitoramento PG17 real. Confira a conclusão do gate completo do commit final no PR52; o ledger registra as correções de compatibilidade encontradas durante o CI. Preserve a especificação aprovada, privacidade, contratos históricos e o piloto. O titular já autorizou explicitamente push, PR e CI para este repositório e a branch está no PR52. Continue corrigindo quaisquer falhas reais e apresente PR e evidências. Não considere testes sintéticos como aceite produtivo nem faça deploy ou ative coleta sem cumprir o processo operacional autorizado.
