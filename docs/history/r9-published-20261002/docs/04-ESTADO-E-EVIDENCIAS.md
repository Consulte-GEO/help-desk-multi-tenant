# Estado e evidências — M1 / 28-09-2026

Base original `94d827654d0ca19144b857e014acef1494f924b3`; base desta rodada `07cbeefac28e048c8fb585fb12ccf9cd07758450`. Branch `codex/m1-reproducibilidade`. Código validado: `c7aa0aff9d33bd05f0248ac904ecbc834204f986`.

CI real: https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/36477734874 — aprovado em 28/09/2026, 20:15:51 UTC. Ubuntu 24.04, Node22, PostgreSQL17 descartável em Docker local, Chromium via Playwright Python1.63.0. Dados sintéticos.

| Verificação | Resultado executado |
|---|---|
| Lock, instalação limpa, audit | Aprovados; zero vulnerabilidades reportadas |
| Aplicação, contratos, typecheck, build | 1045/1045 testes aprovados |
| PostgreSQL real, RLS/grants, isolamento, concorrência | 185/185 aprovados |
| Upgrade e preservação de histórico | 16/16 aprovados |
| HTTP da demonstração | 35/35 aprovados |
| Chromium: interface e sessão sintética | 31+5 aprovados |
| Gate e integridade dos logs | Aprovados no CI e reconferidos contra extração limpa do Git |
| Revisão independente das mudanças desta rodada | Sem achados; não equivale a pentest ou aprovação de plataforma |

Nenhum teste ignorado, cancelado ou todo. Evidências: `evidence/homologation/latest.json` e seus logs com SHA256; screenshots desktop/mobile e relatórios browser em `evidence/`. Fingerprint de código: `94e6b61079895d992209ec14ced701199d0622d24fa704b6495f8b62fc25800a`.

## Causas corrigidas

CI não abrangia codex; reporter precisava TAP para contagem; checkout precisava EOL estável e configuração no fingerprint. Fixtures SQL tinham parâmetros variádicos sem cast e registro de hooks concorrente. Rotas atrasadas no browser eram removidas antes de liberar; seletor usava símbolo aria-hidden. Dois asserts SQL refletiam expectativas antigas: último grant humano revogado nega catálogo (42501), recurso sem leitura fica oculto (404/resource_not_found). Novos asserts comprovam negação SQL/serviço, ausência de linhas e recuperação após restaurar o grant sintético.

Falhas reais preservadas: runs 36475904032 (0/201 SQL), 36476687740 (16/201), 36477266647 (199/201 e interface71/71). A instalação da primeira tentativa36475731482 falhou antes de testar; artefatos antigos daquela tentativa não foram usados como aprovação.

## Compatibilidade e limites

API/interface0.19.0; schema0.18.0; 11 migrations históricas byte a byte preservadas. SDK Netlify6.0.0; pg8.16.3; Node>=22.16 <25. Nenhuma migration nova ou remota, usuário, MFA, segredo, bucket ou dado externo alterado.

Windows local continua com oito falhas de symlink/portabilidade já documentadas no histórico; Linux real passou. O checkout Windows pode conter CRLF antigos: validar evidência com extração limpa (`git archive`) ou checkout novo que respeite .gitattributes. Não recalcular relatórios para acomodar bytes diferentes.

M1 ainda aberto: Auth real, pooler/TLS/runtime configurado, carga/abuso, restore, residência/RPO/RTO e segurança operacional pendentes. Browser usa provedor sintético. `platform_approved:false`; não ativar HELPDESK_RELEASE_APPROVED para contornar pendências. M2 não iniciado.

## Publicação

GitHub publicado na branch autorizada. Netlify helpdesk-consultegeo (site9781cd85-7dc1-4ef5-868b-947e389a9d4d): publicação desta evidência preparada; resultado do deploy será registrado após execução. O erro original foi verify:release rejeitando evidência incompleta, não simples falta de assets.

## Resultado de publicação — 20:23 UTC

Deploy Netlify `6abacc45ec4ca0832ffe6aeb`: **ready**, contexto production, publicado 28/09/2026 às20:21:45UTC. Fonte enviada: extração limpa do commit `9ea9851e6e8d448654fcbb0a04caf950983bde74`, com código validado em c7aa0af. Upload via MCP; commit_ref remoto nulo é esperado nesse mecanismo. Build verify:release preservado.

Site: https://helpdesk-consultegeo.netlify.app
Logs: https://app.netlify.com/projects/helpdesk-consultegeo/deploys/6abacc45ec4ca0832ffe6aeb

Frontend200; Functionapi publicada em Node22; GET/v1/config retorna503/release_gate_closed. **DEPLOYADO, ainda não OPERACIONAL nem HOMOLOGADO para atendimento real.** Não houve ativação do gate de runtime, alteração de secrets/usuários ou migration remota. Evidências compactas e smoke em evidence/m1-ci-20260928/netlify-*.json. Próxima etapa exige ambiente e operações de backend explicitamente autorizados; não basta ligar a flag.

## Provisionamento autorizado — 28/09/2026, 20:49 UTC

O usuário autorizou explicitamente as11migrations e o vínculo ao workspace. Aplicadas no Supabase HelpDesk (xaelbntjnvztznnpcvtm), PostgreSQL17.6: schema0.18.0,25tabelas com ENABLE/FORCE RLS,11registros de migration. O MCP atribuiu novos timestamps de execução; os nomes preservam o identificador original. Mapeamento completo em evidence/m1-ci-20260928/supabase-provisioning.json. Não executar novamente com timestamps locais nem usar migration repair automaticamente.

Workspace Consulte GEO: e57d6844-f5df-4d82-a4cf-6c85b3be7c9e. Vínculo humano confirmado pela função resolve_human; papel agent, capabilities iniciais contexts:resolve/tickets:read,sem grants de contas. Não concede administração nem escrita. Usuário Auth existente preservado; nenhuma senha/MFA/secret alterada.

Advisors:14informativos de RLS sem policies em tabelas privadas deliberadamente fechadas; não adicionar policies públicas para silenciar. Um aviso Auth de proteção contra senhas vazadas desativada: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection — configuração não alterada nesta autorização.

Migrations históricas locais intactas; não houve mudança funcional de código. Asserções remotas de schema/RLS/vínculo aprovadas, mas não equivalem aos201testes descartáveis nem a login ponta a ponta. Backend Netlify/credenciais e release gate permanecem pendentes. A autorização desta rodada substitui somente a restrição histórica referente a aplicar migrations e cadastrar este vínculo.

## Configuração de backend autorizada — 28/09/2026

O usuário autorizou configurar e validar a conexão do backend no Netlify. O login restrito `helpdesk_app` foi habilitado com senha aleatória nova. Netlify production/functions recebeu HELPDESK_DATABASE_URL (segredo), HELPDESK_DATABASE_CA (CA pública Supabase Root2021), SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e HELPDESK_RATE_LIMIT_HMAC_KEY (segredo). Valores secretos não entram no repositório.

Pooler Supavisor session port5432, TLS com verificação de CA/hostname. A senha do login foi testada em conexão real: current_user=session_user=helpdesk_app, schema0.18.0. createProductionRuntime executou os guards reais de papel/schema/RLS/grants e GET/v1/public-config retornou200 no processo de validação local. Com o mesmo login restrito, resolve_human retornou o usuário provisionado no workspace e57d6844-f5df-4d82-a4cf-6c85b3be7c9e, papel agent, capabilities contexts:resolve/tickets:read, zero contas. O teste local passou `releaseApproved:true` apenas como entrada efêmera de validação; a variável de produção não foi criada.

Deploy Netlify6abaddf0e69e8a97891f533a ready, Functionapi Node22 publicada. GET/v1/public-config no host continua503/release_gate_closed. A conexão não foi testada *dentro* da Function porque o gate impede a inicialização. Login real com senha do usuário não foi executado. M1 segue aberto (host/Auth, carga/abuso, restore e revisão operacional); não marcar HOMOLOGADO ou OPERACIONAL. Evidência compacta em evidence/m1-ci-20260928/netlify-backend-config.json.
