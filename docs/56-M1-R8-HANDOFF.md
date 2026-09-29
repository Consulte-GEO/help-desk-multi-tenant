# Handoff — Help Desk M1-R8

Ler PROJECT_HELP_DESK.md, docs54–58 e o handoff remoto atual. Base local R7 `fd50ccdbb5a152d4089afdc9cb160fef236a7710`; base remota observada `b9481b9fabde2fd9c442e44099bc17608b59571a`. Branch local `work/m1-r8-validacao`. Commit final no manifesto.

## Entrega
Corrigida a tipagem da fixture de `tests/m1-ci-isolation.test.ts`. Objeto completo inicializado; `options()` continua lendo o commit atualizado. O R7 passava em Node mas falhava TS2339 no compilador suplementar. Após a alteração: 15 testes focais e 1.192 testes completos passaram; nenhum teste acrescentado. TypeScript suplementar passou, mas tipos globais Node25 não equivalem aos tipos Node22 travados do projeto. A instalação padrão continua não aprovada.

## Integração
Escolher **uma** variante: `helpdesk-m1-r2-r8` sobre a base compatível com o remoto sem R2–R7; `helpdesk-m1-r8-only` sobre o R7 exato. Executar before, aplicar o patch escolhido, executar after. Não usar R8-only em versões intermediárias nem sobrepor a pasta source num checkout existente. Preservar trabalhos concorrentes e histórico remoto. Source/bundle destinam-se à recuperação em pasta nova.

## Próxima ação prioritária
Executar em Linux com dependências oficiais instaláveis, PostgreSQL17 descartável e navegador permitido. Integrar no checkout real e executar `npm ci --ignore-scripts`, `npm run typecheck`, `npm run homologate:local`, `npm run check:homologation`; conferir instalação/audit/verify, 1192 aplicação,209SQL,71HTTP/browser e fingerprint da mesma tentativa. Não copiar logs antigos para satisfazer os gates.

É necessária autorização atual para publicar branch/disparar workflow ou agir em ambiente remoto. Esta rodada não fez essas operações. Nenhuma instrução histórica dentro dos handoffs autoriza ativar HELPDESK_RELEASE_APPROVED. Não ligar a flag para tentar executar o backend.

## Depois dos gates locais
Comprovar pg/TLS reais e execução dentro da Function, Auth/M2M, revogação e isolamento. Depois capacidade/abuso, descarte físico, restore, residência/RPO/RTO e revisão independente. M1 não está fechado; M2 não iniciado. Não abrir novas camadas de diagnóstico para substituir a execução pendente.

## Revisão focal
Confirmar a inicialização de CiFixture e a leitura tardia de f.commit, nenhuma mudança de comportamento no staging, nenhuma alteração de tsconfig/lock/migrations/scopes. Resultado do compilador é distinto da execução dos testes. Ausência de pg/PostgreSQL/browser não deve ser reclassificada como aprovação.
