# M1-R19 — Plano de fechamento do M1

## Objetivo e limite
Integrar o código já desenvolvido e produzir evidência real antes de ampliar o produto. R19 não altera funções, consultas, migrations, permissões, gates ou o contrato dos clientes hospedados. Não iniciar M2, criar outro comparador, runner ou flag de liberação apenas para responder a uma nova solicitação de continuidade.

## Sequência executável
| Prioridade | Entrega | Critério de saída |
|---|---|---|
| P0-1 Integração | Aplicar uma variante no checkout real e conciliar HEAD | Hashes before/after e fingerprint compatíveis; histórico preservado |
| P0-2 Ambiente | Node compatível, npm, registry autorizado, Docker local e Chromium | `npm ci --ignore-scripts`, `npm run typecheck`, `npm audit` aprovados com o lock do projeto |
| P0-3 Persistência | Executar a suíte existente em PostgreSQL 17 descartável | 215/215, incluindo os seis percursos de aceitação e os 16 testes de upgrade |
| P0-4 Interface | Executar a interface existente | 35 HTTP + 36 browser, sem falsos positivos por mocks ou skips |
| P0-5 Evidência | Executar `homologate:local` e conferir seus logs | Fonte única, contagens esperadas, hash e gate íntegros; revisão independente |
| P0-6 Destino | Preparar homologação realmente isolada e autorizada | Projeto/banco, Auth, site, outbox e identidades de teste definidos; produção não alterada |
| P0-7 Hospedado | Executar leitura, ciclo de sessão e gravações existentes | R10:28; R11:12; R15/R16:28 controles + 43 etapas, com evidência própria de contexto |
| P0-8 Operação | Conferir Function/TLS, concorrência, capacidade, backup/restore e governança | Evidências do destino e aceite explícito; só então encerrar M1 |

## Dados mínimos da homologação
O ambiente de testes precisa de um workspace autorizado e de uma referência de workspace alheio para testes negativos; contas A e B; produtos/instâncias e serviços; contrato publicado e cobertura vigente; solicitantes A/B, agente A e principal de integração A. Usuários Auth e principais internos possuem IDs distintos. Capacidades e grants são independentes e devem ser provisionados pelos caminhos administrativos existentes, sem tornar o login HTTP administrador.

O R10 precisa de três chamados prévios: humano A, humano B e integração A, além de mensagens públicas e nota interna controlada. A nota só deve ser lida pelo agente autorizado. O R11 cria/renova/encerra sessões de teste; o R12/R15 efetua cinco gravações válidas e testes negativos. Esses passos não podem ser executados contra produção apenas porque o deploy tem URL imutável.

Os JSONs em `examples/hosted-*.fixture.json` continuam fictícios. Nenhum identificador ou token deve ser inferido de metadados. Credenciais ficam no ambiente do executor, nunca no ZIP, Git, logs, screenshot ou conversa. Não pedir senha ao usuário no chat. Evitar traces que capturem headers, request bodies ou respostas de autenticação.

## Isolamento e autorização
Os 215 cenários destrutivos nunca apontam para Supabase remoto. O runner Docker possui guard de destino fresco/local; a opção nativa exige seleção explícita e binários PostgreSQL 17 autorizados sob usuário não-root. Não alterar essas barreiras para usar o banco hospedado como atalho.

A inspeção de metadados realizada no R19 não autoriza criar contas, usuários, chaves, segredos, grants, projetos pagos ou mudar o release gate. Antes de uma operação externa, conferir a autorização atual, o alvo e o impacto. Uma branch de teste ou URL de preview não isola automaticamente o backend e seus consumidores.

## Tratamento de falhas
Falta de registry, Docker ou permissão de browser é bloqueio de ambiente. Registrar o comando e parar a etapa, sem remover testes, fabricar lock, usar tipos globais como aprovação ou simular PostgreSQL. Um defeito real encontrado após execução deve ser reproduzido e corrigido com regressão; preservar logs reprovados. Não atualizar hashes de relatório para fazê-los corresponder artificialmente a outra fonte.

## Decisão de continuidade
Se o remoto continuar no R9 e o ambiente não mudar, a ação pendente é integração/execução, não outro incremento funcional. O executor deve devolver o bloqueio exato e a próxima ação necessária em vez de acrescentar novas camadas de teste. Se HEAD avançar, conferir o que já foi integrado antes de aplicar qualquer pacote. M2 permanece posterior ao aceite comprovado de M1.
