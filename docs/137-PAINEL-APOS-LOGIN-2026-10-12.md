# Painel após o login — 12/10/2026

O usuário autenticou em produção e ficou na mensagem “Você está conectado. O atendimento ainda não está disponível.” A causa foi o retorno antecipado de `login()` quando public-config informava `operational:false`: `/me` já havia validado o acesso, mas o frontend ocultava toda a aplicação.

Base `fb4c7b943bc8e83541c000ba59f32fb2ab448914`, branch `codex/painel-apos-login-20261012`. Corrigido o fluxo simples: após `/me` válido, abre o painel, menus e saída. Em celular, o cabeçalho agora oferece Sair porque o rodapé da barra lateral desktop fica oculto.

A disponibilidade das funções permanece explícita: banner no painel, ações/filtros desativados enquanto o atendimento não estiver habilitado e contagens desconhecidas como `—`. Não são consultados endpoints de atendimento nesse estado. Quando operacional, o fluxo continua carregando dados reais normalmente. Backend, configuração Auth, grants, migrations e gate não foram alterados. O modo avançado preservado mantém sua fixture anterior.

Regressão real do navegador antes da correção: `/me` aceito, `#app` ainda hidden, login mostrando apenas Sair e a mensagem reportada. Depois: painel visível em desktop/mobile, navegação funcional, logout e retorno ao formulário. `/me`403 impede o painel e encerra a credencial do provedor. A ausência de Sair no móvel também foi reproduzida em RED antes da correção.

Suite corrente: 17 checks de DOM/provedor sintético, sem skips. Tipos, contratos, 12 migrations, build e 33 testes focais aprovados. Screenshots pós-login inspecionadas. Revisão independente somente leitura sem bloqueadores; CI integral e publicação serão registrados após verificação.

A correção abre a área autenticada; criação/consulta de chamados e demais operações continuam dependentes da preparação operacional, cadastros e autorização efetiva já documentados. Não foram criados dados de atendimento fictícios em produção.

CI inicial 38246527760/38246522218: aplicação3741 e PostgreSQL294 passaram; navegador demonstrativo39 e fluxo atual17 também passaram. A etapa avançada preservada falhou porque o rótulo do workspace passou a ser genérico e deixou de refletir a seleção dessa fixture. Corrigido apenas o ramo avançado para manter seu rótulo anterior; o modo simples continua sem UUID na apresentação. A execução vermelha não foi importada como homologação aprovada.

Homologação GREEN: CI38247684034/1 e38247680144 aprovados,3741/3741aplicação,294/294PostgreSQL e156/156interface, sem falhas/skips/cancelamentos/TODO. Artefato11746599042,837533bytes, SHA256e30a4efb34b45c7b36bd0a63dce7d3218ce531591cea732c60a768d640e526a1 conferido. Fontec5bad3cfcb1d56edb6d341a02a1c0afa69708e87; fingerprint4963807a9ec28edd90b08852203bf2a01a4a021968b30ab133e8193cb35f43b7 igual ao checkout. Relatório e seis logs da execução1d8822fe-8685-4af7-a7fe-211270c53d88 importados literalmente; check:homologation passou. [Recibo](../evidence/panel-after-login/ci-receipt.json), checks atuais17 e screenshots no mesmo diretório.

PR29 mesclado em `3d96e86e945fa786ed9092fcbb740b33f2fb229f`, em12/10/2026 às12:28:10UTC, após reconsultar base/head e usar match-head. Checks finais38248555205/38248549632 eCodeQL aprovados; preview6accd0d8f9a0a44f70a0befe pronto com verify:release real e scanner de segredos. [Recibo](../evidence/panel-after-login/preview-receipt.json).

Produção inicial6accd25cea36004d2e55836b:39assets iguais ao build por SHA256, headers de segurança e fronteiras HTTP conferidas. Config/capabilitiesoperational=false, me/workspaces401 sem bearer e quatro leituras de atendimento503/release_gate_closed, zero mutações de negócio. [Smoke](../evidence/panel-after-login/production-smoke-initial.json).

Os assets publicados foram exercitados em desktop/mobile com identidade e perfil explicitamente sintéticos: painel abriu após /me, navegação e saída funcionaram, sem chamadas de negócio ou erros de página. Nenhuma credencial real submetida. [Evidência e escopo](../evidence/panel-after-login/published-panel.json), screenshots publicados no mesmo diretório. Isso valida o frontend servido e não constitui nova jornada do provedor real.

Este registro documental posterior tem o mesmo fingerprint executável; será publicado pelo Git/CD. A primeira publicação acima permanece histórica, sem promover o atendimento operacional a concluído.
