# HD-P02 — Recuperação da abertura de chamados

06/10/2026, America/Sao_Paulo. [Plano HD-P01–33](superpowers/plans/2026-10-06-helpdesk.md), [estado pós-R24](114-HD-P01-ESTADO-POS-R24.md), base de implementação `bc75de7`. API/interface 0.19.0 e schema 0.18.0 preservados. M1 operacional aberto; M2 não iniciado.

## Resultado implementado

A primeira abertura resolve a cobertura e congela a intenção completa antes do POST: payload serializado, chave, eventual `coverage_id`, workspace, pessoa e geração de sessão. Se a confirmação se perder, **Recuperar abertura** envia os mesmos bytes/chave diretamente ao replay de `/tickets`. Não consulta novamente `/contexts/resolve`.

Campos ficam protegidos durante envio/recuperação. Fechar e reabrir o diálogo preserva a intenção na mesma sessão; um pedido novo só é preparado depois de confirmar o anterior. Troca de identidade/sessão limpa a intenção e rejeita conclusão atrasada. Tudo permanece em memória; reload/logout não conservam o recibo pendente. Nesse caso consultar a lista e reconciliar o ticket antes de abrir outro.

Texto canônico inválido é recusado antes do despacho, mantendo o formulário editável. Recibo inválido não confirma: exige snapshot original versão1/status received, dados do pedido e cobertura explícita iguais, timestamps válidos e campos opcionais de operador consistentes com ticket novo sem responsável. Falha de leitura depois de um recibo válido é comunicada separadamente, sem desfazer a confirmação.

Backend, autorização, scopes, contratos, migrations, grants, capabilities e lockfile não foram alterados. O servidor continua reautorizando cada replay; a identidade no frontend apenas isola estado.

## Evidências e limites

- RED original: API de memória realmente criou o ticket (POST201); o transporte abortou sua resposta. A segunda resolução respondeu `no_coverage`; o browser ficou no diálogo em vez de recuperar. A hipótese do levantamento foi confirmada.
- Testes focais finais: **14/14 pass**, em `ticket-create-state`, `ticket-create-recovery-http` e `v019-contract-http`. Replay após vencimento conserva exatamente um ticket/evento/outbox; cobertura explícita/ausente são preservadas. Revogação nega o recibo (404 de privacidade); cache persistente inválido retorna503 e não cria efeito novo.
- `npm run verify` executado: **1447 testes,1424 pass,23 fail,0skip**. Nomes das23 falhas são exatamente os da baseline1436/1413/23, sem nova falha. O agregado encerra na suíte Node; typecheck, contratos, segredos, lock e build foram executados separadamente e passaram.
- Onze migrations conferidas, sem modificação; módulo novo presente e íntegro em dist.
- Interface final: **79/79 pass** (35 HTTP em memória,39 browser em memória,5 sessão humana sintética), zero falhas/skips/erros JS. Usadas as três suítes existentes, por runner temporário com Python absoluto/Playwright1.63/Chromium151; limite de processo240s no Windows (stock120s excedido no encerramento). Nenhuma asserção removida. [Evidência e checksums](../evidence/hd-p02/report.json), [log da interface](../evidence/hd-p02/interface.txt), [testes focais](../evidence/hd-p02/focal.txt) e [Node Windows com23 falhas preservadas](../evidence/hd-p02/node-windows.txt).
- Auditoria das dependências existentes executada: zero vulnerabilidades. Nenhuma atualização de pacote/lock.
- SQL: `test:db:local` recusou Docker indisponível; `test:db:native` recusou configuração PostgreSQL local ausente. Não houve fallback remoto. CI R24 215/215 é evidência histórica, não prova do código novo.
- Não há CI Linux novo, homologação hosted ou publicação desta correção nesta sessão. O gate publicado R24 permanece fechado conforme HD-P01.

## Revisão independente

Revisor Codex encontrou três itens Important, sem Critical/Minor: entrada inválida após trim congelada; erro de leitura após confirmação suprimido; recibo não original aceito. Foram escritos testes que falharam para validação/recibo e uma regressão DOM que constatou ausência de notificação após GET503. As correções preservam a intenção e separam resultado da escrita de atualização da leitura.

## Decisões e custos

- Reutilizar a branch `codex/plano-helpdesk-20261006` limpa existente; ledger adaptado a Windows/headings HD-P, sem novo checkout. Custo: mudanças desta continuidade compartilham a branch de planejamento, identificadas por commits separados.
- Toda falha após despacho conserva unknown; não existe protocolo que prove ausência de efeito para liberar uma chave nova. Custo: erros persistentes podem exigir suporte/reconciliação. Validação local evita congelar pedidos previsivelmente inválidos.
- Descartar memória após mudança de sessão/reload segue a política atual. Custo: recuperar por consulta/reconciliação após perda da página.
- Hosted/produção permanecem HD-P03/04; não inferir aprovação do CI local. Custo: atendimento real ainda não liberado.
- Seleção de cobertura antes do primeiro despacho conserva o comportamento existente de revalidação; mudança nessa jornada é outro incremento. Custo: eventual refinamento de seleção ficará para entrega específica.
- Evidências históricas sobrescritas por runners foram restauradas; esta entrega tem relatório próprio, sem reutilizar aprovação/fingerprint antigos. Revisão não substitui execução final das suítes.

## Matriz de continuidade

| Item | Estado desta entrega | Restante |
|---|---|---|
| HD-P01 / HD-C001–002 / HD-101–102 | Estado/CI/destino/ledger reconciliados; commit bc75de7 | Runtime restrito hospedado em HD-P03 |
| HD-P02 / HD-C040 | Recuperação implementada;14 focais/79 interface aprovados;3 achados de revisão corrigidos | CI Linux integral e aceite hospedado |
| HD-C039 / HD-105 | Replay backend preservado, composição frontend corrigida | Percurso real Auth→Function→banco→UI |
| HD-P03 | Ajuda dos três clientes existentes executada sem efeitos | Mesma base/site HelpDesk definidos; preparar identidades e fixtures reais |
| HD-P04 | Pendente | Capacidade, restore, RPO/RTO e aceite |
| HD-P05–33 | Backlog preservado | Dependências do plano; M2 não liberado |

Próximo passo: HD-P03, usando os clientes read/Auth/write existentes em modo plano e depois execução no site e na base existentes, com fixtures identificáveis. Não criar outro framework de gate nem abrir o gate atual para contornar falta de aceite.
