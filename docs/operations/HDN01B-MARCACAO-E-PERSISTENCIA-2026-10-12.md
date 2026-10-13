# HDN-01b — marcação e persistência do checklist

## Estado desta entrega — 12/10/2026

Incremento local sobre HDN-01a. Base inicial `6f7bc83`; base final reconsultada `fb4c7b943bc8e83541c000ba59f32fb2ab448914`. O PR28 de acesso simples avançou a principal durante o trabalho. As três preimagens modificadas coincidem por Git blob; nenhum arquivo de login ou controle de visibilidade é alterado.

**85 testes novos e 99 regressões focais passaram: 184 no conjunto final, zero falhas, cancelamentos, skips ou TODO.** Typecheck focal com TypeScript 5.8.3 e tipos Node 25.1.0 globais; declaração de compatibilidade String.isWellFormed somente no harness. Runtime local Node 22.16.0. Não é instalação pelo lock nem CI integral.

## Escopo implementado

Marcação unitária (`done`, `not_applicable`, `pending`), executor atribuído verificado, quatro escopos existentes, notas internas existentes como evidência, revisão dupla, reconhecimento de risco, auditoria e recibo. Adapter usa a conexão do runner existente; composição reutiliza a autorização por recurso. Montador HTTP interno opcional para ler e marcar, sem UI ou rota montada no runtime.

Evidência `note:<UUID>` comprova somente a existência de uma declaração registrada pelo executor no mesmo chamado, não a verdade da ação executada na origem. Não aceita URL livre, nota de outro autor/cliente/chamado ou data futura. Não envia e-mail nem executa cadastro no GEO.

A marcação avança a revisão do checklist e não o status/versão do chamado. Alterar a revisão do chamado não herda as confirmações anteriores. Reset limpa a entrada corrente e conserva antes/depois na auditoria. Reenvio autorizado recupera o recibo original; resultado desconhecido não aciona outra gravação automática.

A revisão final reproduziu um recibo cuja revisão era posterior ao snapshot corrente do mesmo ticket. Agora isso é recusado; recibos de revisões anteriores do ticket continuam históricos e não repõem o estado antigo. Um teste falhou antes da correção; outro passou como controle de compatibilidade.

## PostgreSQL e fronteiras

Cinco tabelas e helpers estão escritos em `supabase/candidates/hdn_execution_checklist.sql`, fora das migrations. O candidato define tabelas privadas ENABLE/FORCE RLS, funções específicas com autorização, locks e snapshot/auditoria/recibo na mesma transação. O request usa `helpdesk_app`, não postgres/service_role. A instalação é limitada ao banco descartável próprio do runner.

**O SQL não foi compilado nem executado por PostgreSQL nesta rodada.** PostgreSQL, Docker e CLI Supabase não estão disponíveis neste ambiente; o acesso ao registry falhou por DNS. Há **12 subtestes SQL escritos e registrados, zero executados**, além de seu agrupador. Nenhuma instalação ou grant hospedado foi feito. Os testes antigos D/E/G já passaram na consolidação R1; não reabrir aquela pendência histórica como se não tivesse sido executada.

Nos testes locais, resolver, executor e adapter são reais, mas autoridade/driver/estado persistido são controlados. Não comprovam locks, atomicidade ou durabilidade de produção. Os nomes das funções e o SQL candidato ainda exigem verificação no banco real.

## Conclusão pendente

Executar o cenário completo e regressões em PG17; corrigir a integração demonstrada; gerar migration pelo fluxo CLI autorizado e testar upgrade/readiness. Qualificar a publicação de templates e binding no intake, delegar a leitura do checklist no workflow pela mesma conexão, impedir desvios por resolução antiga, montar UI/endpoints/contratos e executar CI e revisão independente. Nenhum template draft, capability ou escopo foi ativado.

Autorrevisão realizada em passagem separada. Não houve revisão independente, novo build, navegador, CI, CodeQL, commit remoto ou deploy. A entrega é código candidato para integração, não aceite operacional.

## Referências técnicas

Documentação PostgreSQL 17 consultada: Row Security Policies — https://www.postgresql.org/docs/17/ddl-rowsecurity.html; CREATE FUNCTION — https://www.postgresql.org/docs/17/sql-createfunction.html. Essas fontes são referências técnicas, não evidência de execução do SQL. O changelog Supabase não foi recuperado (tipo de conteúdo não suportado); não foi usada API nova de Supabase.
