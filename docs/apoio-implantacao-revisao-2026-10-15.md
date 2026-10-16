# Revisão do Apoio Implantação — 15/10/2026

Revisão sobre o estado publicado por PR57/PR58 e checkpoint `54991ca`. Escopo: corrigir os fluxos existentes de suporte/administradores, preservando o atendimento e as integrações já ativadas.

## Correções confirmadas

- O leitor de JSON podia aguardar indefinidamente um corpo incompleto. Agora reutiliza o leitor controlado do Help Desk: cancelamento, prazo de cinco segundos, UTF-8 e limites existentes; nenhuma transação ou chamada de IA começa enquanto a leitura não termina.
- Ao cancelar a troca de conta, o seletor nativo mostrava a conta recusada. O valor visual é restaurado antes da confirmação, acompanhando o escopo efetivo; a troca confirmada continua remontando o módulo e descartando dados anteriores.
- Alternar processos enquanto o histórico anterior carregava podia deixar o novo histórico vazio. Cada escolha invalida a geração anterior e permite carregar imediatamente o processo escolhido.
- Uma falha ao listar registros na aba E-mails impedia nova tentativa. “Atualizar situação” recarrega registros e situação, preserva a seleção válida e descarta respostas de ciclos anteriores.

## Verificação local

Os quatro defeitos foram reproduzidos antes das correções. Após os ajustes:

- 57 testes focais de backend, corpo de requisição, sessão e e-mails aprovados; os dois novos testes verificam cancelamento e prazo real, sem trabalho no armazenamento/provedor.
- 30 verificações Chromium aprovadas, incluindo troca de histórico com resposta atrasada, recuperação da lista de e-mails e troca de conta cancelada/confirmada; nenhum erro de console.
- 13 testes do frontend aprovados; typecheck, build completo, contratos, verificação de segredos e sentinelas das 21 migrations aprovados.
- Revisão independente do diff e do addon SQL concluída, sem defeitos confirmados pendentes.

## Homologação Linux

[PR59](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/59), fonte `de89187615a8bbbd027cc1759c918e10db44146d`, fingerprint `c086994e0f834848f3b072bac069e68024eede457e5d4e9463ec265c2d2769ff`.

- [CI geral 38828703183](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38828703183): 5.829 testes de aplicação, 697 PostgreSQL e 632 de interface, todos aprovados, sem falhas/skips/cancelamentos. Artefato original `helpdesk-homologation-de89187615a8bbbd027cc1759c918e10db44146d-38828703183-1`, digest SHA-256 `deb13b9b51fc85cf6d0dcc811f46a192e4ac782c5461ca98dab86a43f724cef3`. Relatório e logs incorporados sem reescrita; fingerprint e hashes verificados antes e após a cópia.
- [Qualificação do Apoio 38828720171](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38828720171): 49 PostgreSQL 17.11, 30 cenários Chromium e 13 frontend aprovados; auditoria de dependências e corpus originais aprovados. Digest do artefato `7d3bb13e510f9e5ef2e9b663d435c5c1584518d93fe130434df1114d84739e9f`. [Provas específicas](../evidence/apoio-implantacao-revisao/ci-de89187/).
- [HDA 38828720166](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38828720166) aprovado, assim como as análises CodeQL.

A execução completa do PR [38828720079](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38828720079) também terminou aprovada. A prova canônica preservada acima é a execução da branch para a mesma fonte.

## Publicação verificada

Merge `0042710c0374c706c88f51fd51f05edb7b88a2c8`; [deploy de produção](https://app.netlify.com/projects/helpdesk-consultegeo/deploys/6ad170633eb3f6b5850ee880) READY, publicado em `2026-10-16T00:32:37.604Z` (15/10 às 21:32 em Brasília). A árvore mesclada passou novamente na verificação de evidência. A prévia final `6ad170477597e1320fe62ca1` também ficou READY.

- 115 arquivos estáticos conferidos por HTTPS e hash contra o manifesto do deploy, incluindo os 22 do módulo; CSP original preservada.
- Duas rotas protegidas recusaram acesso anônimo com 401/no-store; quatro caminhos privados responderam 404.
- Chromium abriu o módulo e a aba E-mails usando os arquivos públicos efetivamente publicados, com API sintética interceptada; encerramento limpou o módulo. Nenhuma chamada da API produtiva ou gravação de negócio nesse teste.
- Ciclo nativo agendado do `notification-worker` retornou 204 após a publicação, em `2026-10-16T00:33:04.729887008Z`, request `01M5120W6SESD5FXC6Z5SBM353`, sem logs de falha; não houve invocação manual ou e-mail de teste.

[Provas da publicação](../evidence/apoio-implantacao-revisao/production/). Os cenários do navegador não equivalem a uma sessão humana autenticada em produção. Nenhum e-mail fictício ou registro de negócio foi criado em produção. Nenhuma alteração de SQL, credenciais ou infraestrutura paga nesta revisão. Scanner permanece cancelado; Novo GEO permanece preparado, aguardando contrato/API.
