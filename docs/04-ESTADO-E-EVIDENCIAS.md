# Help Desk v0.5.0 — Catálogo autorizado e abertura guiada

**Entrega local. M1 continua aberto; produção não aprovada.** Base v0.4.0: `a51f721f329fa2a4e3029820c00793da1196b82e`. Branch: `work/helpdesk-m1-v0.5.0`. Execução em 16/09/2026; logs usam UTC. O commit final consta no manifesto externo e no bundle Git.

## Resultado verificável

| Verificação | Resultado e alcance | Evidência |
|---|---|---|
| Base recuperada | 325 testes aprovados antes de alterar | `evidence/m1d/00-baseline-tests.txt` |
| Suíte local final | **407 aprovados; zero falhas, cancelados, ignorados ou TODO**. 82 novos | `evidence/m1d/final-tests.txt` |
| HTTP de loopback | **13 verificações aprovadas** com dados fictícios em memória | `evidence/m1d/final-http-smoke.json` |
| TypeScript do ambiente | Saída 0 com compilador e tipos globais | `evidence/m1d/final-typecheck-environment.txt` |
| Contrato estrutural | **16 operações / 13 caminhos**; referências verificadas | `evidence/m1d/final-contracts.txt` |
| Sintaxe JS/MJS e AST Python | Verificadas | `evidence/m1d/final-syntax.json` |
| Build estático | Saída 0; não empacota Functions | `evidence/m1d/final-build.txt` |
| Scanner heurístico | Nenhum padrão reconhecido; não substitui auditoria | `evidence/m1d/final-secrets.txt` |
| Cinco migrations anteriores | Preservadas byte a byte | `evidence/m1d/final-migration-integrity.json` |
| Verificação padrão `npm run verify` | **Falhou, saída 2**, por dependências/tipos locais ausentes | `evidence/m1d/final-verify-manifest.txt` |
| Homologação agregada/publicação | **Não aprovadas**. Lock falha, etapas dependentes bloqueadas | `evidence/homologation/latest.json`, logs `final-homologation*` e `final-release-gate.txt` |

O typecheck aprovado usou TypeScript 5.8.3 e tipos Node 25.1.0 globais; o manifesto declara tipos Node 22.15.30, ainda não instalados. Não equivale a `npm ci` nem aprovação de dependências. Versões, comandos e códigos de saída: `evidence/m1d/final-verification.json`.

## Desenvolvimento entregue

Novo GET `/v1/support-contexts`, com scope existente `contexts:resolve`. Descobre opções por conta, instância do produto e serviço, com nomes de apresentação e ambiente. A aplicação filtra autorização; o helper privado candidato aplica também vínculos/scopes/produto e vigência. Páginas têm limite padrão 50, máximo 100, cursor composto vinculado ao ator/workspace/filtro. Retorno sem políticas, notas internas, credenciais, IDs de contratos ou contagem global de clientes.

Uma tupla com duas coberturas continua sendo uma opção, não duas opções idênticas. A resolução contratual permanece separada e pode retornar `ambiguous`. Criação revalida cobertura e autorização, inclusive após suspensão posterior à descoberta. Catálogo é consultivo, não reserva, snapshot ou autorização permanente.

O formulário usa nomes obtidos pela mesma API na demonstração e no adaptador de produção. Não solicita UUIDs manuais e não usa `demo-config` para decidir opções de criação. Há carregamento, vazio, erro/tentativa novamente, carregamento de páginas e seleção explícita. Só uma opção na lista completa é selecionada automaticamente. A seleção de cobertura ambígua possui opção inicial vazia, sem escolher silenciosamente o primeiro contrato.

O estado puro de interface invalida resultados antigos por operação/geração, após fechar formulário ou trocar perfil. Descarta opções duplicadas, cursor repetido e respostas malformadas; preserva a seleção explícita ao carregar outras páginas. Nomes são projetados como texto e metadados extras não são armazenados no estado. A ligação com DOM está codificada, mas ainda não homologada em navegador.

API/interface e schema candidato: **0.5.0**. A migration 006 adiciona helper privado, índice de descoberta e atualiza a versão de schema. Seis migrations e as mesmas 23 tabelas candidatas. Nenhuma migration executada remotamente ou localmente com servidor real nesta rodada.

## Evidências de regressão

| Grupo | Antes | Depois |
|---|---|---|
| Aplicação/catálogo | 32 testes falhavam por ausência do recurso | 32 passaram; posteriormente ampliados para 38 |
| HTTP/adaptador/SQL estrutural | 17 falhas em 20 testes | 20 passaram; não é execução SQL |
| Estado puro da abertura | 24 falhas por ausência do módulo | 24 passaram |
| Revisão de metadados | Dois casos de controle Unicode falhavam | Corrigidos; 38 testes de aplicação passaram |

Logs red/green: `02`–`12` em `evidence/m1d/`. Houve revisão local do diff, fronteiras, nomes, ordenação, cursores e formulário. **Não houve revisor independente, pentest ou avaliação de carga.**

## Bloqueios reais

**Dependências:** `npm run deps:resolve` falhou com `EAI_AGAIN registry.npmjs.org`. Sem lockfile, instalação limpa ou audit concluído. A alternativa de pacotes de sistema também não resolveu DNS; o exit 0 de apt com warnings não comprova atualização. Nenhuma política de rede foi contornada.

**PostgreSQL:** Docker/servidor local indisponíveis. `npm run test:db:local` recusou antes da conexão. Há **60 cenários SQL escritos (14 novos), zero executados**. Incluem descoberta por conta/workspace, revogação de vínculo/scope, suspensão, deduplicação, cursor composto/Unicode, grants e ausência de mutação de tickets/eventos/outbox. Asserções em arquivos não são prova de RLS, grants, índices, sintaxe PL/pgSQL, planos ou desempenho reais. O Supabase remoto não foi usado como alternativa.

**Navegador:** `test:ui:local` concluiu 13 checks HTTP e depois Playwright retornou `ERR_BLOCKED_BY_ADMINISTRATOR` em `page.goto`, antes das asserções de navegador. Há **14 checks browser escritos (três novos), zero aprovados nesta rodada**. Não há aprovação visual, mobile, acessibilidade ou integração DOM; testes de estado puro não a substituem.

**Destino:** Supabase Auth, pooler/TLS, Netlify Functions, autorização do runtime real, carga, restauração e decisões operacionais ainda pendentes. A descoberta faz joins e checagens privadas; latência/índices precisam de medição. Uma requisição GET pode consumir contadores técnicos de rate limiting, embora o catálogo não crie/edite chamados, eventos ou contratos.

## Matriz de avanço

| Item | Avanço | Ainda necessário |
|---|---|---|
| HD-101 dependências/CI | Gates atualizados às novas contagens | Registry, lock revisado, npm ci, auditoria e CI real |
| HD-102 persistência | Helper/índice privados e 14 cenários adicionais | Executar 60 casos, instalação limpa e upgrade 0.4→0.5 em PostgreSQL 17 |
| HD-103 runtime | API de descoberta conectada ao adaptador existente | Auth, TLS/pooler, bundle/execução Functions e exposição de schemas |
| HD-104 limites | Página até 100, metadados limitados e guard de resposta | Plano de consulta, abuso/carga e calibração |
| HD-105 interface | Abertura guiada e estado testado; HTTP aprovado | Navegador real, mobile, teclado, acessibilidade e falhas de rede |

## Ambientes e limites de escopo

**Sem push, PR, merge, deploy, migrations remotas, alteração de dados, segredo, usuário ou MFA.** Não houve nova inspeção remota. O pacote foi elaborado a partir do bundle anterior; observações antigas de GitHub/Supabase/Netlify não são uma confirmação atual.

Esta entrega é evolução do fluxo de abertura do HD-105. **Não é o backoffice M2:** não cria usuários, contas, produtos, serviços, contratos ou credenciais administrativas. Configuração real permanece dependente do provisionamento aprovado. Intakes, participantes/filas, SLA operacional, anexos, notificações/worker/webhooks e suporte incorporado não foram implementados aqui.
