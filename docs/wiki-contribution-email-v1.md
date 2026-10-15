# Avisos de contribuição do Wiki — contrato v1

Implementação própria do Wiki, com transporte Resend e configuração já existentes do Help Desk. Não usa o ledger de chamados, não modifica os treze helpers ou o contrato dos quatro schemas e não muda o aprovador textual. A nova Function `wiki-notification-worker` tem agendamento nativo exclusivo a cada minuto; contexto nativo `production` é obrigatório. O bit `published`, corpo e headers da requisição não autorizam execução.

## Componentes e configuração

Fonte SQL no repositório Wiki: `supabase/changes/wiki_cg_contribution_email_v1.sql`; migration oficial CLI `20261015164036_wiki_cg_contribution_email_v1.sql`. Três tabelas privadas com ENABLE/FORCE RLS, sem policies: `wiki_cg.colab_email_config`, `colab_email_outbox`, `colab_email_attempts`. Nenhum acesso direto dos clientes ou worker às tabelas/schema Wiki/Auth. Os novos wrappers SECURITY DEFINER têm search_path vazio, EXECUTE exclusivo do login existente `helpdesk_notification_worker` e guard `session_user`.

O runtime lê somente as variáveis já usadas pelo worker de notificações: `HELPDESK_NOTIFICATION_DELIVERY_ENABLED`, `HELPDESK_RELEASE_APPROVED`, `HELPDESK_NOTIFICATION_DATABASE_URL`, CA opcional, `HELPDESK_CONSULTEGEO_ORIGIN`, `RESEND_API_KEY`, `RESEND_FROM` e `HELPDESK_NOTIFICATION_SENDER_VERIFIED`. Não há segredo, destino ou flag novos no browser. A origem deve ser exatamente `https://helpdesk.consultegeo.org`.

A configuração SQL nasce com `delivery_enabled=false`, recipiente não configurado. Mesmo desabilitada, a fila registra cada novo evento de envio. Após qualificação/deploy, o operador privado pode selecionar **a conta Auth real já existente** e chamar `wiki_cg.email_configurar(uuid,true)`. Essa função valida endereço exato `thiago@consultegeo.com.br`, confirmação e acesso Wiki vigente. Não altera `colab_config.aprovador_id`. Não ativar antes de qualificar o runtime e conferir a configuração hospedada.

Não há backfill automático. Para um evento histórico real especificamente autorizado, o owner pode chamar `wiki_cg.email_enfileirar(event_id)`. Só aceita evento `enviar` do autor e tipo `novo`/`correcao`, deduplica por evento e conserva a data original mesmo se a proposta já foi aprovada. Para suspender entregas, alterar somente a flag privada da nova configuração; os eventos e tentativas permanecem preservados.

## RPCs do worker

Todas são chamadas pelo driver PostgreSQL privado; o navegador não as executa.

| Função | Resultado |
|---|---|
| `public.wiki_cg_email_contract()` | texto `wiki-cg-contribution-email-v1` |
| `public.wiki_cg_email_claim()` | `{eventId:string,leaseId:uuid,revision:number}`, `null` quando sem item/gate fechado, ou `{attention:true}` quando um item chega ao limite operacional |
| `public.wiki_cg_email_begin(p_event bigint,p_lease uuid,p_revision bigint,p_from text)` | os mesmos IDs, revisão incrementada e envelope `{from,to,subject,text,html,idempotencyKey}`, ou `null` para bloqueio auditado |
| `public.wiki_cg_email_finish(p_event bigint,p_lease uuid,p_revision bigint,p_result jsonb)` | `{state,attention}` |

`finish` aceita somente `{state:'accepted',providerMessageId:uuid}`, `{state:'unknown'}`, `{state:'not_accepted',retryable:true,reason:'rate_limited'}` ou `{state:'not_accepted',retryable:false,reason:'rejected'}`. Campos extras/recibos malformados não podem inventar aceitação. Resultado aceito significa aceitação Resend; não comprova caixa postal.

O trigger AFTER INSERT de `colab_eventos` grava fila na mesma transação para `acao='enviar'` e tipos solicitados. Criação/clique/rascunho/salvamento não notificam; replay da operação não duplica; reenvio após ajustes cria novo evento e novo aviso. Mensagem contém apenas número/tipo/horário UTC verdadeiro do envio e link autenticado. Não afirma que a proposta ainda aguarda decisão nem inclui texto, mídia ou título do rascunho.

## Falhas e recuperação

Claim usa LIMIT1/FOR UPDATE SKIP LOCKED; cada lease dura60s. `begin` revalida a conta atual e grava SENDING/envelope antes da rede. Perder ACK dessa gravação impede o envio; o ledger posteriormente recupera estado incerto. Envelope e chave idempotente são imutáveis, inclusive remetente. Uma mudança de remetente exige atenção em vez de substituir silenciosamente o payload de uma chave antiga.

Não aceitação transitória tem backoff60s/5m/30m/2h/6h, até seis tentativas. Timeout, falha de rede,5xx,409, ACK perdido e SENDING abandonado são UNKNOWN. Nova tentativa usa exatamente o mesmo envelope/chave e só começa antes de22h da primeira tentativa, margem conservadora menor que a retenção de24h do Resend. Após o limite, estado ATTENTION impede novo envio automático; resposta permanentemente recusada vira FAILED. Nenhum job apaga histórico ou gera chave nova para contornar incerteza.

Auditoria guarda estados, tentativas e códigos seguros, sem endereço, envelope ou resposta bruta. A Function observa `delivery_attention` nas transições que exigem operador; falhas de execução geram evento seguro sem credenciais. A inspeção privada das tabelas continua responsabilidade operacional, assim como reconciliação de desconhecidos após a janela e prova de entrega/callback.

## Verificação desta implementação

RED: fila ausente em PostgreSQL nativo e testes Node novos sem implementação. Falhas adicionais encontradas pelo ensaio real: query de catálogo com parêntese extra e cursor que bloqueava lote inteiro; ambos corrigidos e reexecutados. Teste de recibo de atenção falhou antes da correção e passou depois.

GREEN: onze testes focais Node; nove cenários integrados PG17 com login de sessão real restrito e Resend channel real usando fetch simulado; SQL de fila/rollback/replay/ajustes/correção/privacidade. Publication v2 também exercitada. `typecheck`, `check:contracts` e `build` Help Desk aprovados. O fingerprint existente percorre `src`, `tests`, `supabase` e `netlify` integralmente; não precisou mudar inventários.

Suíte ampla Windows no sandbox:5.648 testes,5.510 pass/138 fail, sem skips. Falhas incluem symlink EPERM, Unixsocket EACCES, CLI/HTTP loopback e carregador visual; não se declara a suíte geral verde. Log integral de integração em `.analysis/wiki-email-v17-helpdesk-tests.log` no workspace compartilhado; cada falha consta pelo nome. CI Linux completo, promoção/configuração/deploy e prova hospedada ficam para o integrador. Nenhum email real, DDL remoto, env, commit ou push foi executado pelo implementador.

Runner reproduzível no repositório Wiki:

```sh
WIKI_PG_BINDIR=/caminho/pgsql/bin \
WIKI_EMAIL_HELPDESK_ROOT=/caminho/helpdesk \
node supabase/tests/run_email.mjs
# Repetir com --v2 para publication v2; sem HELPDESK_ROOT executa só a fronteira SQL.
```

O runner cria cluster novo local/loopback, elimina variáveis PG herdadas e usa conexões próprias para `session_user`. Não aceita URL externa. Windows requer processo autorizado para initdb; pg_ctl usa stdio ignore para não reter pipes nos filhos. Cleanup valida caminho absoluto exclusivo dentro do diretório temporário antes de remover somente o cluster criado por aquela execução.

## Composição Help Desk + Wiki com TLS real

No checkout Help Desk com dependências instaladas, Node 24, PostgreSQL 17 e OpenSSL 3 locais:

```sh
WIKI_EMAIL_SOURCE_ROOT=/caminho/absoluto/checkout-wiki \
WIKI_PG_BINDIR=/caminho/absoluto/pgsql/bin \
WIKI_OPENSSL_BIN=/caminho/absoluto/openssl \
node --experimental-strip-types supabase/tests/run-wiki-email-composition.mjs
```

Em PowerShell, defina essas três variáveis com `$env:NOME='C:/caminho/absoluto'` e execute o mesmo comando Node. A raiz Help Desk deriva do próprio arquivo; o Wiki exige checkout Git local explícito. Nenhum DSN externo é aceito. O cluster descartável escuta apenas `127.0.0.1`, elimina configuração PG herdada e usa credencial sintética. Certificado local com SAN e `rejectUnauthorized:true` qualificam TLS real; CA não confiável e conexão plaintext devem falhar.

O teste verifica os fingerprints das vinte migrations imutáveis (schema 0.26.0), instala Wiki/publication v2/collaboration/email e compara integralmente o catálogo dos quatro schemas, ACLs, papéis, associações e treze helpers anteriores. Executa os dois guards e os dois runtimes, primeiro com gate Wiki fechado e depois com um envio aceito por provider simulado em memória. Não acessa Resend nem envia email real. Fontes congeladas de runtime/Function/email SQL são verificadas antes e depois da execução.

Após sucesso e cleanup confirmado, somente `evidence/wiki-email-v17/composition.json` é conservado: hashes SHA256 das fontes e migrations, resultado TLS, catálogo e nove verificações. Não contém DSN, senha, certificado, chave ou caminhos temporários. A remoção valida o caminho absoluto exclusivo do cluster, exige parada do PostgreSQL e confirma a ausência da pasta. Falha de parada preserva o cluster para recuperação; não produz evidência de sucesso. Esse ensaio local não substitui configuração, agendamento ou recebimento hospedados.
