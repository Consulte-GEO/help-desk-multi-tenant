# Fluxos do Apoio Implantação — 16/10/2026

Escopo autorizado: testar cadastro, importação, laudos e e-mails na interface do Help Desk, corrigir os defeitos encontrados e publicar. Destinatário autorizado para eventual envio real: thiago@consultegeo.com.br. Scanner cancelado; Novo GEO preparado, aguardando API e contrato.

## Defeitos encontrados

- O painel de revisão não oferecia acesso à jornada completa do cadastro. Foi acrescentado “Revisar cadastro” aos registros de submissão.
- O resumo de revisão recebia uma data já formatada e a formatava novamente, exibindo `Invalid Date`. Agora recebe a data original.
- A interface importada enviava `aprovado`, enquanto a API privada usa `validado`. Decisão, filtro, rótulos e bloqueio após aprovação agora usam o contrato do Help Desk.
- O painel mantido em memória não recarregava ao retornar à aba. Agora atualiza ao ativar e descarta respostas de gerações anteriores.
- Notas internas e marcações de análise comparavam e-mail com o UUID gravado pelo backend. A comparação usa a identidade autenticada correta, permitindo reconhecer itens próprios.
- A revisão devolvida não tinha acesso ao formulário de correção. O novo botão abre a correção privada, que permite edição pelo estado canônico `devolvido`; o servidor continua validando todas as gravações.
- O resumo de acompanhamento esperava contagens ausentes no DTO. Agora calcula estruturas, peças e concretos pelo conteúdo técnico efetivo.
- A reutilização de telas em memória mostrava estados anteriores após reenvios e devoluções sucessivas. As rotas de revisão e correção passam a revisão do documento na chave da tela. A revisão independente identificou também o segundo ciclo de devolução, incluído na regressão.

As adaptações do código importado permanecem no overlay de compilação. Os arquivos originais importados foram preservados. Não há alteração de SQL, credenciais, infraestrutura paga ou permissões de acesso.

## Qualificação da interface

Foi acrescentado um teste reproduzível da aplicação completa, incluindo login e menu lateral reais do Help Desk, assets compilados e handler HTTP real do Apoio. A fixture é exclusiva de teste, vincula somente `127.0.0.1`, usa identidade/armazenamento/fila de e-mail sintéticos e bloqueia requisições externas do navegador. Não faz parte da publicação e nunca é fallback produtivo.

O percurso cobre:

- Cadastro pelas sete etapas, gravação, exportação Excel/JSON, importação do modelo R02 e envio à revisão.
- Compartilhamento por e-mail e consulta da fila, sem apresentar enfileiramento como entrega.
- Pré-análise de XLSX, relatório, transferência para conversão, mapeamento, propostas, validação e processo salvo.
- Auditoria pós-importação e download do relatório.
- Laudo PDF textual, correção do resultado, aceitação, exportação, salvamento, histórico e reabertura com o valor revisado.
- Revisão completa, comentário, aprovação, devolução, correção e dois reenvios sucessivos.
- Autoria e exclusão lógica da nota interna; análise própria, filtro e liberação.
- Ajuda contextual com título, descrição, link de vídeo e imagem privada na etapa do cadastro.

O runner foi incluído na CI de qualificação do Apoio, além dos testes de navegador já existentes. Relatórios, capturas e logs ficam no artefato da execução.

Na execução local final, os 43 cenários da aplicação completa passaram, sem erros de console ou exceções do navegador. Os 13 testes frontend, compilação com vue-tsc, typecheck principal, contratos e verificação de segredos também passaram. Os defeitos de abertura da revisão, data, aprovação, painel desatualizado, autoria, correção e cache após reenvio tiveram reprodução negativa antes do ajuste; a segunda devolução foi acrescentada após o achado da revisão independente e passou com a correção.

## Limites e situação de produção

A sessão produtiva autenticada foi aberta no Chrome como Administrador e o cadastro apareceu no Help Desk. O controle do navegador perdeu conexão durante a navegação; essa falha de ferramenta não foi classificada como defeito da aplicação. O teste local da aplicação completa abriu Planilhas normalmente.

O envio real para o endereço autorizado e a conclusão dos percursos produtivos dependem da reconexão do navegador; não foram substituídos por extração de sessão, escrita direta no banco ou chamada direta ao provedor. A fila sintética não comprova entrega real. O PDF de teste exercita leitura local textual; OCR/IA externos e persistência hospedada não são comprovados por essa fixture.

## CI Linux

Fonte `f420f76db2012650c1ec542cdbe0320d67bf5ee0`, [PR60](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/60).

A [qualificação do Apoio 38889581672](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38889581672) aprovou 49 verificações PostgreSQL 17.11, 43 cenários da aplicação completa, 30 cenários adicionais Chromium e 13 testes frontend, além da auditoria de dependências e corpus originais. O artefato original tem digest SHA-256 `4b32cbb9b792714a51622f7d56debf5fea4963d9ab562efa18d3054176947167`. [Relatórios, logs e capturas](../evidence/apoio-implantacao-fluxos-ui/ci-f420f76/). A execução do PR, 38889628635, também foi aprovada.

A [CI geral 38889581530](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38889581530) aprovou 5.829 testes de aplicação, 697 PostgreSQL e 632 de interface, sem falhas, skips ou cancelamentos. Fingerprint `9fc1de3f1ffc128229ac82fab96b6e27b611b8845bfa4b68780fbec70b489e6f`; artefato `helpdesk-homologation-f420f76db2012650c1ec542cdbe0320d67bf5ee0-38889581530-1`, digest SHA-256 `10801f0a9ca2cc9a00ae596517888dedc9e5b8094cec536b5f4cc1b8b3f39fde`. Relatório e logs originais preservados em `evidence/homologation/runs/73b1ef0f-76d3-4760-851d-5c03714a349b`, validados por fingerprint e hashes antes/depois da cópia. A CI geral do PR, 38889628604, também terminou aprovada; HDA e CodeQL aprovados.

## Publicação verificada

PR60 mesclado em `e89386f675c265d65916ae926d51bb309cf4e168`. A prévia final `6ad20445e6dd683b7ec16055` ficou READY. O [deploy de produção](https://app.netlify.com/projects/helpdesk-consultegeo/deploys/6ad204e049d00ae445aaa208) ficou READY e foi publicado em `2026-10-16T11:06:06.831Z` (08:06:06 em Brasília). A prova canônica foi novamente validada na árvore mesclada.

- 115 arquivos estáticos, incluindo 22 do módulo, conferidos por HTTPS/hash contra o manifesto do deploy. CSP preservada.
- Duas rotas privadas recusaram acesso anônimo com 401/no-store; quatro caminhos de fontes/SQL privados responderam 404.
- O módulo e a aba E-mails abriram com os arquivos efetivamente publicados e API sintética interceptada. Não houve sessão Auth, chamada à API de negócio ou gravação produtiva nesse smoke.
- O cron nativo do `notification-worker` retornou 204 após a publicação, em `2026-10-16T11:07:05.20932701Z`, request `01M5269S3SKJ3YT4FQTVKZJTV7`, sem logs de falha. Não houve invocação manual ou envio de teste.

[Provas sanitizadas da publicação](../evidence/apoio-implantacao-fluxos-ui/production/).

Após o usuário reconectar duas vezes, as abas do Help Desk apareceram no Edge e a seleção da aba funcionou, mas a leitura do DOM continuou expirando, inclusive com prazo ampliado. Isso não comprova defeito no Help Desk. O percurso produtivo autenticado completo e o e-mail real para o endereço autorizado permanecem pendentes; nenhuma tentativa de clique no envio ocorreu nesta rodada. Não repetir migrations ou alterar credenciais para resolver uma falha de controle do navegador.
