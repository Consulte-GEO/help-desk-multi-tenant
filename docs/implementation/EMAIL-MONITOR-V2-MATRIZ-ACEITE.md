# Rastreabilidade de implementação e aceite V2

Referência: checklist AC-01…AC-28 e requisitos EMV2-01…EMV2-19 do pacote aprovado. Esta matriz liga comportamento implementado às evidências; não transforma testes sintéticos em aceite produtivo nem afirma que toda combinação foi exercitada isoladamente.

Estado produtivo posterior: PR52 integrado/publicado e append21 aplicado. Após ativação de email.opened/email.clicked pelo titular, ambos os callbacks nativos foram recebidos em19:56:43Z, POST200/applied com correlação exata. Cobertura registrada em19:57:29.552038Z, sem retroação; intenção antiga observada segue inelegível. Evidência: `evidence/email-monitor-production-20261015/native-collection-qualified.json`. Aceite autenticado da tela ainda pendente por falha do controle do navegador. Os parágrafos de ausência de merge/produção abaixo registram a etapa histórica de CI; não representam o estado atual. PR55 concorrente tem fonte/recibo próprios preservados.

Conjunto integrado 7f311bd qualificado no [CI38784669764](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38784669764): 5739 aplicação + 697 PostgreSQL17 + 632 interface = 7068 testes, todos aprovados, sem falhas/skips/cancel/todo. Fonte SHA256 377fa67122d2c79bdbd609f541f57202e1eb2f45c8492c2f5a575a71e483f253. O recibo original e os logs estão em evidence/homologation/runs/41ceee85-9c25-41ab-80ac-d5d9bdf77334; latest.json aponta para esse mesmo conjunto. A documentação posterior não altera a fonte executável. HDA, PG suplementar e CodeQL devem ser conferidos nos checks do PR52. Os resultados anteriores abaixo são históricos; não substituem esta qualificação integrada. Não houve merge do PR52 ou implantação produtiva.

Gate completo da fonte06c0bdb:5728 aplicação +697 PostgreSQL +632 interface, zero falhas/skips/cancel/todo. Run38779615398; fonte SHA25644831b432decb57e937e68bc81081ab71f917e9958970aa7f0e38c2b9ebc060b. Ver checkpoint159 e recibo íntegro para a procedência.

Legenda: PG = `supabase/tests/email-monitor-scenarios.ts`, com logins reais restritos e envio/callback sintéticos; UI = testes de estado/DOM e `browser-email-monitor-ui.py`; AUX = diagnóstico SQL auxiliar, sem qualificação de RLS; BASE = testes existentes do ledger, assinatura, autorização e máquina de estados. O teste PG tem16 subcasos; as linhas abaixo podem compartilhar evidência e não são28 novos testes independentes.

| Aceite | Implementação e evidência relacionada | Limite |
|---|---|---|
| AC-01 | Uma linha por intenção; tentativas no detalhe. PG fila com dois destinatários, AUX contagem com tentativas repetidas | Não usar contagem de testes como prova de todas as cardinalidades |
| AC-02 | Identidade de evento no agrupamento e no cursor; PG eventos distintos e fontes privadas | Assunto/horário não são chaves de agrupamento |
| AC-03 | Fontes pública, equipe e revisão separadas; PG fonte privada e BASE escopos | Não expor corpo, respostas ou nota interna |
| AC-04 | ACL conta/obra/chamado antes de filtros e agregados; PG obra não autorizada e filtros forjados; BASE isolamento | Filtros não concedem acesso |
| AC-05 | Snapshot no envio e máscara SQL; PG endereço alterado após ACK e DTO da equipe | Sem reconstrução de endereço histórico via Auth |
| AC-06 | Busca de destinatário apenas admin; testes HTTP/store e PG; solicitante recusado no próprio SQL | Sem oráculo de endereço para equipe |
| AC-07 | Agregados antes de limite; PG paginação e AUX5101 destinatários | AUX não é benchmark PG17 nem prova de capacidade produtiva |
| AC-08 | Clique independente; PG callback antes do ACK sem abertura/entrega inventadas | Cliques não provam identidade humana |
| AC-09 | Replay no-op e conflito recusado; PG repetição/identidade incompatível, BASE receptor | Não sobrescrever recibo anterior |
| AC-10 | Assinatura/bytes/janela e procedência verificados; testes Resend/receiver/BASE e dois callbacks nativos reais POST200/applied | Probe técnico automatizado; não comprova leitura humana |
| AC-11 | Correlação pelo ID exato; PG mensagem alheia permanece unmatched e payload mínimo | Nunca associar por assunto, e-mail ou tags |
| AC-12 | Recebimento tardio e cronologia qualificada; PG/AUX telemetria | O instante de recebimento não substitui o de ocorrência |
| AC-13 | Estado e atenção prioritários; PG cronologia inválida/AUX/BASE máquina de estados | Fato de engajamento não altera estado operacional |
| AC-14 | Lease/enfileiramento não contam envio; PG histórico sem ACK e UI | Saiu exige aceite comprovado |
| AC-15 | Histórico não coletado N/D; PG sem datas/endereço presumidos e UI | Zero é reservado a coleta aplicável sem observação |
| AC-16 | Cobertura por sinal, lacunas abertas/fechadas, sem fração enganosa; PG/AUX/UI | Não apagar interrupções para melhorar indicadores |
| AC-17 | Fato antigo observado permanece com elegibilidade0; PG/AUX/UI | Sem backfill ou consulta retroativa ao provedor |
| AC-18 | Rotas GET e transporte de leitura; HTTP/UI verificam métodos e ciclo do modal | Sem reenvio, retry ou alterações de configuração |
| AC-19 | Abort/generation e limpeza de contexto; estado/UI e cursor cifrado | Resposta tardia não repõe dados de outra sessão |
| AC-20 | Revogação/expiração limpa dados; PG revogação e UI403/logout | Não prometer revogação instantânea de JWT já emitido |
| AC-21 | Polling serial/visibilidade/dispose; testes de controller e browser | Atualização tem cadência de15s, sem segunda fila |
| AC-22 | Modal, foco, teclado, rolagem, desktop/360px; browser e screenshots | Aceite visual produtivo depende da implantação |
| AC-23 | DTO fechado, erros sanitizados, indisponível distinto de vazio; domínio/store/HTTP/UI | Não usar dados fictícios como fallback |
| AC-24 | Montagem condicionada e versões25/26/27; testes runtime/worker/HDA e cadeia real | Schema correto sozinho não substitui catálogo/ACL |
| AC-25 | Cursor AES-GCM contextual; testes reais do codec e PG ordenação/página | Mudança de dados/contexto pode exigir reiniciar com409 |
| AC-26 | Estados preservados, idade no servidor e previsão do ledger; PG/UI/BASE | Horário de retry é previsão, não promessa de entrega |
| AC-27 | Recibo de engajamento separado do ledger/ticket; PG/AUX/BASE | Não cria ciência ou encerra chamado |
| AC-28 | Append21 aplicado em produção, prefixo20 preservado; catálogo27 e workers qualificados;91 assets/13 checks da publicação178dfb5; callbacks reais e início da cobertura comprovados | **Aceite parcial:** falta validação autenticada da tela; fonte concorrente PR55 tem recibo próprio. Ver checkpoint produtivo |

O PR e seu CI são a referência para revisões posteriores. A prévia Netlify é um estágio de publicação separado: manter o gate de release e a configuração produtiva intactos. Nenhum critério desta matriz autoriza alteração dos chamados reais do piloto ou das decisões adiadas pelo titular.
