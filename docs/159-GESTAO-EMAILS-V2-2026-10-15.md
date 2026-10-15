# Gestão de entrega de e-mails V2

Implementação na branch `codex/email-monitoring-v2`, sobre `e8878675eddf21ed9d0fa4ae3ae89abc90c497a4`. Este checkpoint acompanha a especificação aprovada; não é autorização de produção nem recibo de implantação. A primeira versão monitora notificações de chamados a solicitantes e equipe.

## Comportamento entregue

- Histórico por evento lógico, filtros de período, conta, obra, tipo, estado, fila, atenção, protocolo/assunto e destinatário (este último exclusivo de administradores).
- Modal de entrega com os quatro indicadores Saiu, Entregue, Aberto* e Clicou, legenda de confiabilidade e tabela de destinatários com datas independentes. Tentativas não multiplicam o denominador.
- Detalhe com linha do tempo, tentativas, motivo e próxima tentativa. Identificador do provedor e versão/hash de template são exclusivos de administradores.
- Administradores Consulte GEO recebem endereço completo capturado durante envio autorizado; equipe recebe máscara no SQL. Falta de snapshot histórico aparece como “Destinatário indisponível”. Não buscar o endereço atual em Auth para inventar o passado.
- Coleta nativa de eventos assinados `email.opened` e `email.clicked`, replays idempotentes, conflitos recusados e correlação tardia pelo identificador exato do provedor. Nenhum clique fabrica abertura ou entrega. Telemetria não altera o estado operacional, resolve chamados ou registra ciência.
- Atualização serial a cada 15 segundos enquanto visível; cancelamento de leituras antigas, limpeza ao sair, navegação por teclado, foco no modal e retorno ao acionador.

Ficam fora desta entrega: campanhas/broadcast, criação ou reenvio manual de e-mail, alteração de rotas, tipos, destinatários ou templates pela interface, preferências individuais, exportação, mensagens de autenticação e confirmação de ciência. A gestão do recebimento continua com a Consulte GEO.

## Reaproveitamento e adaptações

GEOCON, commit `61bc63935d5e84cebadfe080cee2317467b8171d`: composição do modal de Broadcast, quatro cartões, legenda e tabela temporal. Reimplementado no HTML/JS nativo do Help Desk, incluindo foco e limpeza de sessão. Não foram copiados React, Tailwind, fila, sender, inferência de abertura/entrega a partir de clique, timestamp de criação como envio ou limite de 5.000 registros como total.

GEOLAB, commit `cf56929875f368e7d2da87f26f5517db4255f991`: princípios de filtros, contagem exata, agregação no servidor e linha do tempo, incluindo as migrations de funil 086 e saúde por evento 087. Adaptados à autorização atual por conta/obra/chamado; a paginação usa cursor cifrado estável em vez de offset ou timestamp sem desempate. Não foram copiados payloads brutos, modelos de laboratório, URLs de rastreio ou restrição apenas por tenant.

Help Desk: preservados ledger, planner,13 RPCs do notification worker, autenticação humana, transação com contexto, resolução local de permissões e codec de cursor do portal. O worker HDA mantém seus sete helpers e contrato independente.

## Mapa para manutenção e handoff Claude

| Área | Arquivos principais |
|---|---|
| Regras e DTO fechado | `src/domain/email-monitor.ts` |
| HTTP somente leitura | `src/http/email-monitor.ts`, `docs/openapi.json` |
| Transação e cursor | `src/infrastructure/email-monitor.ts` |
| Montagem e capability | `consultegeo-runtime.ts`, `runtime.ts` |
| Callback e rollout de worker | `resend-events.ts`, `notification-delivery-store.ts`, `notification-runtime.ts` |
| Compatibilidade HDA | `registration-runtime.ts` |
| SQL legível | `supabase/candidates/hdn_email_monitor_telemetry.sql`, `hdn_email_monitor_queries.sql` |
| Append e verificação offline | `scripts/email-monitor-upgrade.ts`, `email-monitor-source.ts`, `supabase/email-monitor.manifest.json` |
| Contrato completo do banco | `src/infrastructure/email-monitor-security-contract.ts` |
| Interface | `web/email-monitor.js`, `.css`, `.d.ts`, montagem em `web/app.js` |
| Testes reais de autoridade | `supabase/tests/email-monitor-scenarios.ts` |

Ler primeiro a especificação V2 em `docs/especificacao-emails-geocon-v2-2026-10-15/`, este checkpoint, o plano e o ledger em `docs/implementation/EMAIL-MONITOR-V2-PROGRESS.md`. As pastas anteriores de handoff são registros da análise anterior; não presumir que suas listas ainda representam ausência de código após esta entrega.

## Banco, segurança e evolução

O monitor é schema `0.27.0`, migration21 `20261015162000_email_monitor_v2.sql`, append depois da promoção HDA0.26. As primeiras vinte migrations permanecem íntegras. Inventário esperado:88 tabelas,233 funções,516 constraints e três roles reservadas. O contrato histórico0.25 e sua query permanecem congelados, porque compiladores anteriores dependem dos mesmos bytes.

A migration adiciona configuração privada de cobertura e interrupções conhecidas, tipo nativo de recibo, snapshot de endereço e aceite, índices e helpers privados. Mantém o estado do ledger separado da observação de engajamento. Os guards comparam catálogo anterior e final, operador, defaults e ACL antes de publicar a versão. A configuração inicial de cobertura é nula: aplicar a migration não afirma que o provedor já coleta aberturas/cliques.

Os três GETs são `/v1/email-communications`, `/{event_id}` e `/{event_id}/recipients/{intent_id}`. Respostas são `no-store`. O conjunto autorizado é definido antes de filtros, total e agregados. O DTO recusa campos extras. Cursor AES-GCM de cinco minutos é vinculado à identidade, workspace, filtros e hash dos fatos autorizados. Mudança no contexto ou nos dados pode exigir reiniciar a página com409; não tentar reaproveitar o cursor de outra sessão.

## Procedimento de promoção e coleta

1. Conferir CI do commit exato, revisão, catálogo do destino, schema atual e operador. Usar os procedimentos já existentes do projeto para promoção; não executar todo o bootstrap sobre o piloto nem repetir migration19.
2. Aplicar somente o append necessário pela sequência homologada. Não editar hashes para acomodar drift; investigar qualquer recusa do guard. Manter gates operacionais já existentes, MFA e adiamentos de novos clientes.
3. Publicar backend, worker e interface compatíveis. O worker antigo continua aceitando payload sem `eventType`; o runtime novo só envia tipo nativo depois de qualificar schema0.27. Confirmar os workers de notificação e HDA após promoção.
4. Confirmar no provedor, para a integração correta, assinatura do webhook e assinatura de eventos `email.opened`/`email.clicked`, com tracking permitido. Não alterar configuração compartilhada de GEOCON/GEOLAB para testar o Help Desk. Usar mensagem sintética controlada para confirmar o caminho completo.
5. Somente após comprovação, registrar a data real de início de cada sinal na linha singleton privada `helpdesk_integration.hdn_email_monitor_settings`, por operador autorizado e mudança auditada. Consulta de diagnóstico: `SELECT opened_started_at, clicked_started_at FROM helpdesk_integration.hdn_email_monitor_settings WHERE singleton;`. A role da aplicação e o worker não têm acesso direto a esta tabela. Não retroagir datas nem preencher com a data de criação de mensagens antigas.
6. Confirmar perfil admin completo, equipe mascarada, contexto não autorizado sem dados e ausência de interface para cliente. Verificar que logout remove o histórico da memória e que cliques não alteram os chamados.

Interrupções comprovadas são registradas pelo operador na tabela privada `hdn_email_monitor_coverage_gaps`, com `signal` (`opened` ou `clicked`), `started_at` e `ended_at` (nulo enquanto a interrupção estiver aberta). Intervalos usam início inclusivo e fim exclusivo. Uma intenção cuja janela até a última leitura cruza uma interrupção deixa de ser elegível para taxa daquele sinal; fatos observados continuam visíveis. Ao encerrar a interrupção, novas intenções posteriores ao fim voltam a ser elegíveis, sem recuperar artificialmente a cobertura das antigas. Nunca apagar o intervalo para obter uma taxa aparentemente melhor; registrar a correção operacional e sua justificativa pelo processo de mudança existente.

No detalhe, `pendingAgeSeconds` é calculado pelo banco entre o enfileiramento persistido e `asOf` para os estados ainda pendentes. A interface mostra a idade na última leitura; não usa o relógio do navegador nem apresenta previsão de retry como promessa de entrega.

Sem coleta comprovada, a interface continua útil para fila, aceite, entrega e falhas; abertura/clique sem evidência permanecem indisponíveis. Abertura depende de pixel e é aproximada; clique é um evento observado e pode incluir automação. Nenhum dos dois prova leitura humana ou ciência formal.

## Cuidados obrigatórios

- Não consultar tabelas privadas diretamente pelo browser, não expor service-role, não importar payload bruto de callback, URL clicada, corpo ou endereço completo para equipe.
- Não criar outra fila, sender, pixel ou worker para este monitor. Não implementar ações de envio em uma tela aprovada como somente leitura.
- Não usar `createdAt` como envio, não usar estado atual para reconstruir horário de entrega e não completar etapas ausentes pelo funil.
- Não somar tentativas como destinatários. Não transformar falta de evidência histórica em zero, nem misturar contagem histórica com taxa de uma coorte parcial.
- Não remover guards, relaxar catálogo, conceder SELECT em tabelas privadas ou ampliar EXECUTE para fazer um teste passar.
- Não alterar contratos históricos ou migrations já aplicadas. Qualquer mudança posterior exige fonte, compiler, contrato, append e testes consistentes, com revisão de segurança.
- Não reutilizar evidência de outro commit ou apresentar diagnóstico PGlite como prova de RLS/sessão PostgreSQL real. Não alterar CG-10001/CG-10002 nem repetir seeds do piloto.

## Validação

Código `06c0bdbf87cb7e2ed7f0cbf080414effc6eed96f`, merge de teste `8c7cd14d32cb06b5ecd7dcca14af59fc46ac8d0a`: [gate completo aprovado](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38779615398), com5728 testes de aplicação,697 PostgreSQL e632 interface, sem falhas/skips/cancelamentos/todo. HDA também aprovado:40 verificações nativas de candidato,14 com a cadeia completa e49 DOM; CodeQL aprovado. O resultado oficial mais recente e a prévia automática ficam no [PR52](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/52).

O recibo e os logs íntegros dessa execução estão em `evidence/homologation/`. Foram copiados do artefato CI11995732355, sem alterar contagens, datas ou hashes; `validateReport`, `verifyLogs` e `npm run check:homologation` confirmaram compatibilidade com a fonte local. SHA256 da fonte executável: `44831b432decb57e937e68bc81081ab71f917e9958970aa7f0e38c2b9ebc060b`. A documentação posterior não muda essa fonte. Esses resultados homologam testes locais/CI; não atestam o provedor real, implantação ou aceite produtivo.

Para retomar no Claude, usar o [handoff atual](implementation/EMAIL-MONITOR-V2-HANDOFF-CLAUDE.md) e a [matriz de rastreabilidade](implementation/EMAIL-MONITOR-V2-MATRIZ-ACEITE.md). Preservar os registros históricos da especificação e consultar o PR para resultados posteriores.

Os testes incluem validação de filtros e DTOs, HTTP, cursor e contexto, rollout25/26/27, compatibilidade HDA, interface e compiler determinístico. Os cenários PG17 usam logins reais restritos, intake/planner normais, envio sintético e callbacks assinados; não enviam e-mail real. O resultado da execução CI e os achados finais de revisão devem ser consultados no PR e no ledger, que distinguem execução local, ambiente real de teste e produção.
