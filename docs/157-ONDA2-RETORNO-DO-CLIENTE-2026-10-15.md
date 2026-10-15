# Segunda onda — retorno do cliente e aceite do piloto

O aceite autenticado da segunda onda encontrou um defeito após enfileirar o retorno do cliente. O chamado técnico CG-10002 foi aberto pela conta Claude, solicitante da MRV/Residencial Encanto, e atendido por Thiago nas sessões legítimas. O CG-10001 e os comprovantes da primeira onda foram preservados.

## Causa e correção

O evento de retorno possui uma projeção interna com o mesmo UUID do evento público. O instante do commit público é representado com três casas decimais e a projeção privada com seis. Depois de selar o plano privado, a releitura chamava o projetor público, comparando o hash do plano com outra representação JSON. A conferência recusava o evento com `Historical source mismatch` antes de enviar ao provedor. O estado observado era `retry_wait`, zero tentativas e nenhum identificador do Resend.

A migração19 `20261015104831_consultegeo_customer_return_source.sql` substitui exclusivamente o corpo de `hdn_notification_facts_wave2_team(uuid)`. O evento pai continua qualificado pelo validador histórico v024, que verifica evento, outbox, efeito de escrita, snapshot, recibo e referências imutáveis. Ator, ação e transição do retorno permanecem verificados. O plano continua vinculado ao hash exato de sua fonte privada. Não há truncamento de instantes, reescrita de plano, backfill ou criação de nova intenção para recuperar o aviso.

O catálogo/schema0.25 permanece o mesmo:79 tabelas,201 funções e13 RPCs do worker. Nenhuma assinatura, proprietário, ACL, política, trigger, tabela ou superfície do runtime foi ampliada. O append tem fonte e baseline fixos, exige o operador qualificado, o corpo predecessor exato e o catálogo completo antes/depois; reaplicação é recusada. As18 migrações anteriores permanecem idênticas.

- Migração: SHA256 `2548cb772f48a665608fd082646434c4017460666d2d30e6fa50ac8ed8e7657a`,215058 bytes.
- Componente: SHA256 `0263459cb424ce8a9459edaaff11a2b60616a4ac877c0e63aa26fe2e1799ce87`.
- Corpo predecessor: MD5 `f8bb37b0667d9f56b0487b9f155ef225`, confirmado na base hospedada antes da correção.
- [PR49](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/49): correção isolada, integrada à atualização concorrente do backend E06, sem substituir suas alterações.

## Qualificação

A regressão PostgreSQL17 falhou primeiro na fonte4a6fb96, [execução38722677301](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38722677301), ao reler o plano já selado. Após a correção, a fonte4010493 passou680 testes nativos. A fonte integrada cb61a58 passou novamente680 testes em [38725040453](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38725040453), sem falhas, cancelamentos ou testes ignorados.

O ensaio usa a migração19 real, operador e worker restritos em banco descartável. Comprova preservação de todas as79 tabelas, metadados e corpos das demais funções, proprietário/ACL da função alterada, rollback diante de drift, recusa ao app comum, predecessor incorreto e reaplicação. O retorno materializado pode ser relido e autoriza a lease real; a proteção de uso único da prova de contato permanece ativa. A revisão focada não encontrou achados. A [CI integral38725040437](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38725040437) e a qualificação da integração38725045821 passaram:5.625 aplicação,680 PostgreSQL17 e617 interface, total6.922, sem falhas/cancelamentos/skips/todo. Os seis logs originais foram conferidos e integrados. Fingerprint `594fa2785667d77a29713a07aad52c44bab35fe31ae9196ca1cff13e53c4c43d`; artefato11967438733, ZIP SHA256 `7c144ae2a16be70de3e48f987a9541fb00eda4749236f56b07513ed0e416762f` conferido.

A aplicação hospedada foi concluída como `20261015112314_consultegeo_customer_return_source`, em15/10/2026. As79 tabelas mantiveram exatamente contagens e hashes ordenados dos dados antes/depois. O schema0.25 e as201 funções foram preservados; worker sem SELECT em Auth. A leitura da fonte privada voltou a funcionar e o destinatário permaneceu qualificado. O worker recuperou a mesma intenção `581bf26f-093e-408e-8ea4-e0ee09da5c0f`, com uma tentativa, Resend `01a13f4e-1f85-793b-9e4c-9ccae20aa75f` e callback assinado de entrega às11:24:09UTC. A mensagem recebida no Gmail `1a13f4e2674c39d2` tem Thiago como destinatário e SPF/DKIM aprovados; nenhum aviso de retorno foi enviado a Claude. Recibos locais09 e `retorno-recuperado.json` registram essa cadeia.

## Aceite em andamento

CG-10002: `edf32362-1e63-468f-a209-a7396311d621`. Abertura, início, atribuição, resposta pública, pedido de informações, retorno do solicitante e encaminhamento interno foram executados no portal. Checklist3/3 registrado com nota real de evidência. A nota e o checklist não aparecem na sessão do solicitante. O aviso retido foi recuperado. Solução e ações posteriores continuam em validação.

Oito e-mails foram recebidos, com destinatários corretos, uma tentativa por entrega e SPF/DKIM aprovados. Os14 HTMLs de visualização dos sete primeiros (computador/celular) passaram sem transbordamento, logos ausentes ou conteúdo interno. Seus14 links recebidos, inclusive o redirecionamento de rastreamento do provedor, chegaram ao destino HTTPS exato do chamado e à entrada autenticada do portal, sem sessão ou credenciais no teste. Isso comprova o HTML recebido renderizado em Chromium isolado; não é uma captura da interface do Gmail.

Os comprovantes locais estão em `Entregas/Implantacao_Onda2_2026-10-14/aceite-CG-10002`, incluindo HTML/texto/cabeçalhos mínimos, imagens, QA de links/visual, estado antes da correção e capturas do portal. O aceite completo ainda exige executar solução, encerramento, reabertura e cancelamento, conciliando os12 avisos esperados com eventos, fontes, Resend, callback e caixa. O controle do navegador falhou novamente nas interações; as sessões foram preservadas e foi solicitada apenas a apresentação da aba da equipe em primeiro plano, sem recarga ou novo login.

O titular adiou MFA. Os modelos21/22/23/24 continuam preparados, sem audiência, nova política, perfil ou capacidades de aprovação. O painel administrativo protegido e seu aceite também permanecem adiados. O piloto público/equipe conserva a coorte de duas pessoas e a validade até15/11/2026 03:00UTC; a observação de dois dias úteis antecede eventual ampliação.
