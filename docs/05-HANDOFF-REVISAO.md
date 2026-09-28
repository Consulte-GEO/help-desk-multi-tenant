# Handoff — v0.19.0, rodada M1 de 28/09/2026

Base `94d827654d0ca19144b857e014acef1494f924b3`; branch `codex/m1-reproducibilidade`. Commit final na entrega/manifesto externo. Código recuperado em helpdesk/; Git da pasta pai continua sem commits. Leia PROJECT_HELP_DESK.md, README, AGENTS e docs04 antes de editar. Handoff anterior em history/v019-05-before-m1-20260928.md.

Lock real, npm ci e audit aprovados também pelo agregador após corrigir subprocessos npm no Windows. SDK Netlify6.0.0, 20 pacotes, zero alertas. Três regressões novas passaram após falhas confirmadas. Typecheck local, contratos, scan heurístico, build estático e35HTTP aprovados. **Suíte integral reprovada: 1.035/1.043; oito falhas Windows discriminadas em docs04. M1 aberto.**

API/interface0.19.0, schema0.18.0, onze migrations com bytes/hashes originais. Não alterar SQL histórico ou recalcular manifesto. Nenhum domínio/endpoint/grant/UI novo.

## Próxima execução

1. Confirmar branch/HEAD e mudanças concorrentes. GitHub consultado: branches vazias. Reinspecionar antes de integrar; não há autorização para publicação ou operação remota.
2. Usar o lock revisado: npm ci --ignore-scripts, check:lock, audit. Cache padrão falhou EPERM; foi usado por processo no PowerShell: `$env:npm_config_cache=Join-Path $env:TEMP 'helpdesk-npm-cache-20260928'`. Nenhuma configuração global alterada. Não regenerar lock sem necessidade.
3. Resolver as oito falhas de ambiente/portabilidade com TDD, sem remover proteção contra symlinks. Preferir repetição em Linux autorizado e apto. Garantir saída TAP no agregador: não aceitar contagens ausentes do reporter spec.
4. Executar PostgreSQL17 novo/descartável e login restrito:185 principais+16upgrades. Docker ausente nesta máquina; native recusa Windows. Não usar Supabase, banco preexistente ou login privilegiado como fallback. Não afirmar SQL aprovado antes da execução.
5. Preservar cenários de microssegundos, notas-only, command tags, efeitos, locks, revogação e replay. Consultar docs23 e handoff histórico para detalhes. Não ampliar grants para fazer testes passar.
6. Empacotar/verificar Functions com pg; build existente só copia frontend. SDK6 é compatível com engine declarado, mas o host não foi homologado. Prosseguir Auth/M2M/pooler/TLS/IP apenas no ambiente explicitamente autorizado.
7. Preparar Playwright em ambiente apto: Python fornecido não contém módulo.35HTTP passaram; zero dos36browser executou. Verificar mobile/acessibilidade/sessão, sem contornar política.
8. Reexecutar homologate:local/check:homologation, revisar fingerprint/logs. Último estado: lock/install/audit passed; application/postgres failed; interface blocked. Não ativar HELPDESK_RELEASE_APPROVED. Completar carga, restore, revisão e governança. M2 somente após M1.

Nenhum efeito remoto de escrita, carga, restore, revisão independente ou pentest. Evidências em evidence/m1-20260928/ e evidence/homologation/.
