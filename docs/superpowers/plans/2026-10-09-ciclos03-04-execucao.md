# Ciclos 03 e 04 — implementação integrada, sem liberação

> Executar com superpowers:executing-plans e testes RED/GREEN. Pedido atual autoriza seguir os dois ciclos; não encerra suas dependências.

**Objetivo:** ligar a autorização persistida ao despacho HTTP de chamados e implementar administração de membros com MFA/capabilities, revisões, recibos e sucessão.
**Base:** pacote C02 SHA256 a5dc7624c30768ce394d29af5c2f2d2cf964755106bb7c71d2b47b6200b1e9e6; remoto PR26/f60baed. A árvore local contém 75 arquivos cumulativos, não clone completo. Dependências auxiliares são fontes do mesmo SHA; package de harness não pertence à entrega.
**Spec:** plano original CG03/CG04 e Plano de Ciclos (C03/C04). Spec complementar da origem continua não recuperada.

## Restrições
Sem push/merge/deploy ou reenvio do SQL previamente bloqueado. Sem modificar as 12 migrations, escopos de Thiago ou fatores reais. C03 não será declarado concluído sem migration CLI, upgrade e SQL/HTTP completos. C04 não será declarado operacional sem store PostgreSQL, browser, política e revisão independente. Motores locais podem avançar conforme linha 47 do plano original.

## Tarefas desta execução
- [x] Integridade da entrada e reconsulta do PR.
- [x] Baseline focal: 262 testes existentes aprovados.
- [x] C03.1: despacho HTTP autenticado, catálogo privado de referências e revalidação de escopo na mesma conexão emprestada; nenhum recurso é escolhido pelo navegador.
- [x] C03.2: recusas de C/A+C/revisão/tenant, limites, notas e preservação de resultado confirmado; Requests/Responses e loopback quando disponível.
- [x] C04.1: capability de administração distinta de scopes e condicionada à prova real de assurance; snapshot obrigatório, vazio não concede.
- [x] C04.2 (modelo/store de teste; SQL pendente): lista paginada, convite a pessoa existente, revisão/expiração/revogação, sucessão explícita; CAS e recibo/auditoria no mesmo contrato transacional.
- [x] C04.3: despacho HTTP, parsers e negações diretas; nenhum e-mail é enviado por criar um convite.
- [x] Regressões da composição, typecheck focal, mutações relevantes e autorrevisão.
- [ ] Pacote cumulativo, patches, handoff e estados reais.

## Decisões registradas
1. PostgreSQL/CLI continuam ausentes e downloads não foram recuperados; não executar SQL em produção para substituir o banco descartável. Nenhuma migration fabricada.
2. C03 entrega um montador HTTP opt-in que exige adaptadores server-only. Não altera runtime ou release flag automaticamente. Coleção e abertura genérica ficam fechadas nesse montador até integração integral, em vez de filtrar páginas no browser.
3. O despacho de negócio é uma porta que DEVE usar a conexão emprestada e os serviços/serializadores existentes. Não abrir segunda transação. Ausência de montagem real é dependência explícita, não fallback.
4. C04 administra vínculo da equipe no workspace. Não edita escopos de tickets/notas, grants de obras, conta vizinha ou configuração do GEO. Convite não cria pessoa por e-mail.
5. Store de membros exige lock/CAS por workspace, auditoria e recibo atômicos. O adapter em memória pertence exclusivamente aos testes; não será exportado como produção.
6. Migração, fornecedores, sessões externas e UI operacional não serão presumidos a partir dos testes locais.

## Resultado do ciclo local
- C03: 39 testes de montagem/HTTP; C04: 39 aplicação,17HTTP,13estadoUI,4DOMsimulado,1registro browser. 113novos,375combinados incluindo262 regressões selecionadas. Não é a suíte integral do repositório.
- Teste de navegador bloqueado na navegação por política, antes de qualquer verificação do painel. Dez checks escritos, nenhum homologado. Não contornar o bloqueio.
- Autorrevisão independente da passagem de implementação: encontrados/corrigidos recibo/membro, contexto mutável, validade do sucessor na confirmação, limite de revisão e modal que impediria conciliação. Quatro mutações detectadas; fonte restaurada. Sem revisor externo disponível; revisão independente pendente.
- Typecheck focal passou com ferramentas globais; não instalação pelo lock.
- SQL, migration CLI, upgrade, concrete ticket executor/directory, store administrativo, configuração de capacidades, aceitação de convite, montagem runtime/OpenAPI/build e CI seguem pendentes. C01,C02,C03,C04 permanecem abertos em seus gates integrais.
