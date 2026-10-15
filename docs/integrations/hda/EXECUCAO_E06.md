# Execução e evidências — E06

**14/10/2026 · HD-DA-CADASTROS · 2.0+E06**

## Base e escopo efetivamente revisados

Partiu-se do ZIP E05 fornecido na conversa. A leitura conectada da principal `codex/m1-reproducibilidade` confirmou `ea7a4454f30c45f35dece6e4a702591c55c79cd5` (PR43), mesma base observada anteriormente. Não há checkout completo neste ambiente; nenhuma comparação integral de árvore ou implantação foi atestada.

Revisão focada em cancelamento e retorno tardio do analisador, limites entre processador e persistência, contrato de consulta, separação de públicos e descarte de dados na interface. A suíte cumulativa do overlay foi reexecutada; isto não representa auditoria linha a linha de todo o Help Desk.

## Alterações

**Processador:** cancelamento passa a interromper a espera do chamador mesmo quando o analisador ignora AbortSignal. A instância permanece ocupada até o analisador efetivamente resolver/rejeitar. Seu retorno tardio não grava rascunho. Se o analisador nunca terminar, a instância fica em quarentena; o supervisor real deverá encerrar e reiniciar o processo segundo sua política. A interrupção da espera não prova encerramento de processo, conexão ou cobrança externa.

**Projeção:** `projectRegistrationDraftReview` valida a correspondência exata entre estado e contexto recebido, devolve dados minimizados para a equipe e apenas andamento para cliente. É função pura, não autorização nem endpoint. Textos são limitados com marca explícita de abreviação. Zero, falso, nulo e IDs com zeros à esquerda são preservados semanticamente. A consulta não inventa histórico, avisos do modelo ou listas de campos ausentes que não estejam disponíveis.

**Interface:** painel opcional, com leitura somente após clique, uma consulta por vez, timeout de 15 segundos, descarte de respostas tardias, janela de exibição de até 60 segundos e limpeza por expiração/encerramento da sessão. Mostra pedido, sugestão, destino, efeitos e pendências. Ações de editar/aprovar/executar são sempre falsas; o painel não é montado no app publicado nesta entrega.

**Vocabulário de estados:** estados desconhecidos como `__proto__` e `toString` não podem selecionar propriedades herdadas do mapa de rótulos. Mensagens descrevem apenas o conhecimento da análise, sem afirmar que não houve cadastro por outro caminho humano.

## Verificações realizadas

| Prova | Resultado | Alcance |
|---|---|---|
| E05 em Linux não-root | 407/407 | Regressão do subconjunto recuperado |
| Cancelamento antes da correção | 2/2 falharam | Espera presa reproduzida nos casos de resolução e rejeição tardia |
| Projeção antes da implementação | 23 falhas/24 casos | Função ausente; caso isolado de recusa não é contado como prova funcional |
| Estado de consulta antes da implementação | 15 falhas | Contrato de interface inexistente |
| Entrada do painel antes da implementação | 1 falha | Módulo não implementado |
| Propriedades herdadas antes da correção | 2 falhas/27 casos | Rótulos desconhecidos não tratados com segurança |
| Suíte cumulativa final | **452/452** | 407 anteriores + 45 novos; zero fail/cancel/skip/todo |
| TypeScript | Aprovado, focado | TS 5.8.3 com @types/node 25.1.0 disponível; não o conjunto fixado do projeto |
| Vetores Python | 14 válidos + 12 inválidos | Implementação independente stdlib; não verifica .NET |
| Chromium | **49/49** | DOM offline real, provedor de dados e sessão sintéticos |

Dos 45 testes Node novos: 2 de cancelamento, 27 de projeção/parser/rótulos, 15 de estado da consulta e 1 do módulo de apresentação. As 49 verificações visuais não se confundem com testes Node nem com os 81 aceites de negócio do V2.

Capturas em 1440 e 390 pixels, temas claro e escuro, e visão do cliente. Verificações incluem ausência de leitura automática, dados privados ausentes no cliente, texto de HTML não interpretado, foco/teclado, botão mínimo de 44 px, limpeza do DOM e referências destacadas após logout, retorno atrasado ignorado, erro saneado, expiração sem polling e ausência de overflow horizontal. Houve inspeção visual das capturas desktop claro e celular escuro.

## Tentativas não aprovadas e limites

A primeira execução como root apresentou 20 recusas, associadas aos guardas do conector CLI; a suíte foi executada novamente como usuário sem privilégios e os 407 testes passaram, sem enfraquecer essas proteções. A primeira checagem de tipos não encontrou os tipos de Node no caminho padrão; a execução focada com o caminho instalado passou. Nenhuma destas tentativas é apresentada como regressão final aprovada.

Clonagem falhou por resolução DNS; download do pré-requisito PostgreSQL também não foi concluído. O executor nativo recusou por ausência de checkout completo, package/lock canônicos, pg 8.16.3 e binários PostgreSQL 17. Ele não executou SQL e não usou serviço hospedado como alternativa.

A tentativa de navegação HTTP em loopback pelo Chromium recebeu `ERR_BLOCKED_BY_ADMINISTRATOR`. Não foram alteradas políticas do ambiente. A prova final usa uma página em branco com DOM e módulos locais confiáveis: não é prova de navegação, rotas, CSP, service worker, SSO, HTTP ou publicação. O servidor experimental não integra o overlay entregue.

Não foram executados: regressão integral e build do repositório completo, audit com lock canônico, testes de cadeia de migrations, PostgreSQL real, .NET, API/IdP de origem, Claude real, envio de e-mail ou acesso de cliente real. Revisão feita pelo próprio implementador, sem reviewer independente. Nenhuma escrita remota.

## Documentos e estado

O relatório de alterações lista um arquivo de produto existente modificado e os novos arquivos da E06. O SQL candidato E03 e as migrations existentes permaneceram intactos. HDA-02 continua parcialmente implementada; HDA-06 ganha consulta visual parcial, sem edição, histórico completo, aprovação e montagem autenticada.
