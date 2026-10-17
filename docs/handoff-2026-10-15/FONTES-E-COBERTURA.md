# Fontes, cobertura e limites da auditoria

## 1. Escopo efetivamente realizado

Análise em 15/10/2026 dos quatro repositórios locais do ecossistema, cópias históricas do Help Desk, planos/requisitos/checkpoints, código de composição, contratos, migrations/manifests, testes relevantes, wiki e seus conteúdos de negócio. O Financeiro foi examinado como produto independente e referência de fronteiras; não recebeu auditoria integral de sua ponta remota.

Foram recuperados 13 chats principais com `cwd` do projeto Help Desk, excluindo a conversa atual e os subagentes automáticos: 113 mensagens humanas e 64 respostas finais entre 02 e 15/10. Os títulos e IDs constam de CONVERSAS-E-DECISOES.md. Registros brutos e credenciais históricas não são redistribuídos no pacote.

A matriz original de 107 RF foi reconciliada individualmente, preservando IDs, textos e prioridades originais. O inventário da wiki contém 174 artigos e 6 modelos; houve leitura aprofundada das áreas de cadastro, implantação, suporte e riscos, além de inventário de caminhos/marcadores. A revisão factual integral contra o código do Novo GEO não ocorreu, pois essa fonte está indisponível e o usuário adiou a etapa.

Foram consultados no GitHub remoto: metadados do repositório Help Desk, PRs recentes, PR49 e seus 29 arquivos alterados, refs de branch dos quatro produtos, documento 157 e status do CI 38725040437. O PR49 altera migration/helper/scripts/testes/evidências; não muda a composição de runtime analisada no checkout 306dd5c. Assim, a constatação de módulos ainda não compostos permanece compatível com esse delta remoto.

## 2. Classes de evidência

| Classe | O que comprova | O que não comprova |
|---|---|---|
| Leitura atual de código | Implementação, contrato, composição e limites encontrados no SHA indicado | Que o recurso esteja configurado/ativo em produção |
| Consulta atual ao GitHub | SHA remoto, merge e resultado de CI consultado | Conteúdo do banco, configuração Netlify ou caixa de e-mail |
| Checkpoint/recibo versionado | Evidência declarada da entrega e sua fonte | Que nada tenha mudado depois ou que a auditoria tenha repetido a operação |
| Mensagem humana do chat | Pedido, decisão, confirmação e adiamento | Autorização universal para qualquer mudança futura |
| Texto da wiki | Vocabulário, procedimento e necessidade de negócio documentada | Contrato atual de API, comportamento factual comprovado ou alçada técnica |
| Benchmark oficial | Padrões usados por outros help desks | Obrigação de comprar/copiar produto ou requisito já aprovado pelo usuário |
| Ausência de evidência localizada | Tarefa a verificar ou completar | Prova absoluta de que não exista implementação em outro lugar |

## 3. Baselines e evidências remotas

| Fonte | Identificador observado |
|---|---|
| Help Desk local | 306dd5ccd3d8d50e7c186dd6c6aa4372145d23da |
| Help Desk GitHub | d036fccededcba31a0cd1a9be30963c1d34ddc69, branch codex/m1-reproducibilidade |
| PR49 | Mesclado em 15/10/2026 às 11:32:51 UTC, 08:32:51 em São Paulo |
| CI 38725040437 | completed/success, fonte cb61a5852ea0cbe443195dd96cd3296497d912bf |
| Contagens da CI no checkpoint 157 | 5.625 aplicação, 680 PostgreSQL 17, 617 interface, total 6.922; contagens lidas do relatório, não reexecutadas |
| Wiki local | 8b63f098fdd1670dd2d5782b84779f156f455208 |
| Wiki main remota | 2f71a0240e81e04e5576d83ef531fa9ce499b79e |
| Setup local/remoto | 3fe0dbecee448a3caa762e21e4927b04fb43b1e5 |
| Financeiro local | 7c234f1f28ffab80492d19a3866771884c0af816, branch de plano de 06/10 |
| Financeiro main remota | fe81b443277a82b1025f78d5d5d13c4b16799e13 |

O snapshot [FONTES/157-ONDA2-RETORNO-DO-CLIENTE-2026-10-15.md](FONTES/157-ONDA2-RETORNO-DO-CLIENTE-2026-10-15.md) foi recuperado da [fonte remota fixa](https://github.com/Consulte-GEO/help-desk-multi-tenant/blob/d036fccededcba31a0cd1a9be30963c1d34ddc69/docs/157-ONDA2-RETORNO-DO-CLIENTE-2026-10-15.md). É uma cópia documental para cobrir o delta do checkout; não é novo recibo de operação.

## 4. Verificações executadas nesta auditoria

No checkout Help Desk 306dd5c, com Node 24.20.0/npm 11.19.0, foram executados com sucesso:

- `npm run typecheck`.
- `npm run check:contracts` — 41 operações locais.
- `npm run check:migrations` — 18 migrations no checkout local, antes de incorporar o PR49.
- `npm run check:consultegeo-upgrade`.
- `npm run check:lock`.
- `npm run check:homologation` — evidência local existente válida para sua fonte.

Não foi executada novamente a suíte completa de aplicação, PostgreSQL ou navegador; os números de CI das entregas são referências identificadas. Não foram feitas migrações, mutações de dados, envio de e-mail, login em nome de terceiros, ativação de flags, merge ou deploy nesta auditoria. O produto foi mantido intacto; a entrega é documental.

O pacote possui verificação própria de 107 IDs, textos/prioridades, backlog estruturado, dependências, links locais, arquivos e manifesto. Isso valida a integridade do documento, não o funcionamento de uma integração ainda fechada.

## 5. Limitações e acessos que não produziram prova

- A listagem de projetos/chats via ferramentas do app não concluiu; foi usada a cópia local de sessões. Não declaramos cobertura de conversas externas ou somente cloud.
- Tentativas de leitura pública por ferramenta web de `/v1/capabilities` e `/v1/public-config` não foram acessíveis. Isso **não é prova de indisponibilidade do site**. Estado operacional vem dos checkpoints/aceites e decisões cruzados com o código.
- Não houve reinspeção completa de Netlify, Supabase, Resend ou dados de clientes. Configuração real, drift e disponibilidade devem ser conferidos no início de uma futura entrega operacional.
- As verificações locais pertencem ao 306dd5c; o delta remoto PR49 foi lido e sua CI confirmada, sem reset, pull ou testes locais do novo SHA.
- A mídia/UX da Wiki estava em trabalho concorrente: o estado local é mais novo que a main consultada. Não declaramos esse delta publicado.
- O Financeiro tem remoto posterior ao checkout de 06/10. Contagens históricas de 113 capacidades não são auditoria atual da produção financeira.
- Não foram abertos todos os anexos/imagens originais de cada chat nem feitas revisões manuais de cada linha de SQL/teste. Foram priorizados código executável, contratos, fontes de negócio, estado e pendências relevantes ao handoff.
- Esta análise não é pentest, certificação de segurança, laudo técnico de engenharia ou parecer jurídico. Não estabelece normas técnicas nem prazos legais novos.

## 6. Mapa curto de fontes primárias do projeto

| Evidência | Referência no repositório ou pacote |
|---|---|
| Invariantes e instruções | `helpdesk/AGENTS.md`, `docs/01-ARQUITETURA.md`, `docs/06-M1-SEGURANCA-E-LIMITES.md` |
| Estado mais recente local/remoto | `docs/149` a `docs/157`, com seus nomes completos no repositório; ler 157 → 156 → 155 para os últimos deltas |
| Cadastro real | `src/application/consultegeo-registration-operation.ts`, `docs/150-CONSULTEGEO-CADASTROS-2026-10-14.md` |
| Runtime/capabilities | `src/infrastructure/runtime.ts`, `consultegeo-runtime.ts`, `src/http/handler.ts` |
| Piloto de e-mails | `docs/155-EMAIL-KIT-ONDA2-2026-10-15.md`, snapshot 157, `Entregas/Implantacao_Onda1_2026-10-14` e `Implantacao_Onda2_2026-10-14` no computador de origem |
| HDA | `docs/integrations/hda/`, `workers/dev-agent-bridge/`, `supabase/candidates/` |
| Requisitos originais | `docs/requirements/consultegeo/matriz-107-requisitos.json` e apêndice reconciliado do pacote |
| Wiki factual | `wiki-consultegeo/corpus/`, `docs/editorial/aprovacoes.json`, inventário factual em Entregas |
| Setup | `setup-implantacao-obras/IMPLEMENTATION-REPORT-IMP02-HOSTED-2026-10-15.md`, `docs/implantacao/PLANO_ORIGINAL_2026-10-14.md`, `modules/import-process/` |
| Financeiro | Roadmap de 06/10 do checkout, apenas como contexto histórico; reinspecionar o remoto para qualquer trabalho nele |

As auditorias anexas têm localizadores `arquivo:linha` para achados específicos. Linhas são relativas ao SHA local indicado e podem mudar no futuro. O diretório de transferência conserva caminhos relativos no pacote; os caminhos de código partem do workspace que contém os repositórios irmãos.

## 7. Boas práticas externas consultadas

Fontes oficiais de Atlassian Jira Service Management, Zendesk e Freshservice foram pesquisadas em 15/10/2026 e estão citadas junto das recomendações em AUDITORIA-ECOSSISTEMA-E-BOAS-PRATICAS.md. Cobrem filas, primeira resposta/resolução, SLA, notas internas, anexos, macros e base de conhecimento. Aplicações ao Consulte GEO são propostas da auditoria; não foram apresentadas como requisitos históricos.

## 8. Manutenção da fotografia

Reinspecionar HEADs e checkpoints antes de usar este pacote em desenvolvimento posterior. Se outro chat concluir o aceite de e-mails ou integrar mídia da Wiki, atualizar somente as pendências afetadas, preservando fonte/data. Não tomar o hash do ZIP como prova de que o software remoto continua no mesmo estado.
