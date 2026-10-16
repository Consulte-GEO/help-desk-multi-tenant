# Conformidade dos envios e foco dos modais — HD-002 e Apoio Implantação

**Estado corrente:** [PR66](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/66) implementado, revisado e qualificado na fonte741c58b;7249 verificações integrais aprovadas, com provas complementares do Apoio preservadas. Ainda sem merge/publicação. PR65 já publicado/verificado; preparação e limites abaixo preservados.

## Escopo autorizado

Continuidade dos itens prioritários após o merge/publicação do PR65. Recorte delimitado sobre fluxos existentes: corrigir o documento de erro de quatro handlers montados e qualificar os recibos de escrita do core contra o OpenAPI existente. A falha recorrente do gate complementar revelou também disputa de foco nos modais do Apoio Implantação, corrigida neste mesmo PR. Não cria rota, campo de cadastro, operação ou concessão de acesso. MFA e Novo GEO seguem adiados, scanner cancelado e modelos técnicos homologados ausentes.

## Divergência reproduzida e correção

O schema `Problem` exige `title`, mas os handlers de workflow, checklist de execução, abertura Consulte GEO e catálogo/rascunho devolviam esse erro sem o campo. Os novos cenários atravessam a composição real `createConsulteGeoRuntimeHandlers`, recusam autenticação antes de SQL/diretório e reproduziram separadamente as quatro falhas de contrato. Gate fechado e conflito de versão/resultado incerto também falharam pelo mesmo motivo.

Cada handler recebe somente o título genérico estático “Não foi possível concluir a solicitação.”. Os mapas de código/status, detalhes seguros, UUID de correlação, diagnóstico de precondição, admissão e instruções para resultado incerto permanecem. Não substituir esses tradutores pelo erro genérico do core: a mensagem específica de `transaction_outcome_unknown` orienta conciliação da mesma intenção/chave e não pode virar repetição automática. O handler opcional de intake genérico/anexos não é montado nem ampliado como parte desta entrega.

## Qualificação acrescentada

`tests/openapi-write-responses.test.ts` reutiliza o gate offline existente; não adiciona dependência ou validador ao runtime. Dez cenários novos:

- Criação201/replay200 com Location, ETag e marcador de replay. Após alteração posterior, o recibo reproduzido conserva a versão original e não duplica chamado.
- Mensagem pública e nota interna201/200; identidade do recibo no replay e ausência da nota no canal público/outbox.
- Prioridade, atribuição e transição200; recibo/ETag originais no replay, sem interpretar recibo histórico como consulta atual.
- Falta de versão428, versão divergente412, entrada400 e mídia415 no core, com snapshot de memória inalterado.
- Quatro cenários separados de recusa401/403 na composição montada, sem SQL ou fallback legado; corrigem a divergência reproduzida.
- Recusa503 por gate fechado antes de autenticação/SQL e sem fallback.
- Workflow412/503, erro desconhecido sanitizado e instrução de conciliação preservada, sem Retry-After automático para resultado incerto.

As respostas passam pelo schema do método/status/mídia reais; cabeçalhos privados e a correlação são conferidos separadamente. Os recibos de sucesso usam HTTP + serviço/unidade de trabalho reais em memória. O cenário de erro do serviço de workflow usa uma porta sintética para provocar recusas; não é prova de commit PostgreSQL ou callback produtivo. O mapa de recursos da composição não pode ser consultado nos cenários de recusa inicial: o pool da fixture falha se utilizado.

Resultado red/green: quatro cenários de core passaram antes da correção; seis cenários operacionais falharam por contrato (incluindo cada um dos quatro handlers). Depois da adição do título,10/10 passaram. A primeira versão do teste de criação trocava a identidade, e foi corrigida para manter o mesmo principal antes de avaliar replay; nenhuma alteração do produto foi feita para satisfazer essa fixture equivocada. A revisão apontou duas fragilidades P3: mantida a mesma audiência desde a criação com igualdade integral do recibo, e leitura pública agora exige200/schema e a mensagem esperada antes de comprovar ausência da nota. Delta52f53c9 reconferido pelo revisor com10/10 aprovados e sem achados restantes. Conjunto focal com handlers/leituras/checklist/rascunhos:92/92 aprovado. OpenAPI45 operações,21 migrations e lock conferidos.

## Falha complementar: foco diferido do modal

Os runs iniciais de Apoio Implantação38945287624 e38945589335 falharam por botão de devolução desabilitado, enquanto as execuções do merge passaram. A captura original de38945589335 mostra o texto do motivo no campo de nome, motivo vazio e contador0/2000. O helper `useModalA11y` agendava incondicionalmente um segundo callback para focar o primeiro campo, mesmo quando outro campo já havia sido selecionado; também não distinguia callbacks de uma abertura anterior após fechar/reabrir. O guard de20 caracteres corretamente impedia o envio sem motivo; não foi relaxado. A captura isolada não é um rastreamento temporal completo, mas o callback incondicional explica o sintoma e a regressão determinística reproduz a condição. Captura, corpo da tela e resultado originais de38945589335 preservados por hash em `evidence/write-contract-20261016/initial-apoio-failure/`, com origem/digest no `origin.json`; estes são diagnósticos de uma execução falha, sem qualificá-la como aprovada.

Correção: o foco inicial continua acontecendo quando nenhum campo interno foi escolhido. Se o foco já está no modal, respeita essa escolha. Cada abertura tem geração própria e o fechamento invalida os callbacks anteriores; listeners/Tab/Shift+Tab/Escape e restauração ao gatilho permanecem. Não muda os campos, o conteúdo, a validação ou o comando da devolução. O teste full shell do Apoio não foi relaxado nem teve sleeps/retries acrescentados.

Cinco regressões determinísticas em `tests/implementation-modal-focus.test.ts` controlam as filas dos callbacks sem dependência nova. Antes da correção:2 aprovações/3 falhas (foco escolhido e callbacks antigos). Depois:5/5 aprovadas. Com os dez cenários de escrita:15/15. A execução local anterior do full shell chegou à segunda devolução aprovada, mas terminou com erro de recurso bloqueado; não é aprovação da jornada completa. Build completo e typecheck raiz aprovados. Ao importar o helper para a suíte raiz, três acessos de array passaram também sob noUncheckedIndexedAccess; assertions de não nulidade explicitam as guardas de lista não vazia já existentes, sem mudar o JavaScript emitido. Revisão acumulada da fonte741c58b encerrada sem achados;15 testes novos e97 focais aprovados. Os workflows de Apoio da fonte741c58b (38946660061 e38946665951) passaram, incluindo a jornada full shell inalterada. A qualificação integral do HelpDesk permanece pendente até seu gate próprio.

## Qualificação integral da fonte final

[CI da fonte38946660036](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38946660036) aprovado sobre `741c58b823c90b271eb63e43710e1b9c49b69279`: **5894 aplicação +700 PostgreSQL17 +655 interface =7249**, zero falha, skip, cancelamento ou todo. [Merge de teste38946666009](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38946666009) também aprovado. HDA, Apoio Implantação e CodeQL aprovados na fonte final. Instalação limpa/audit, build, types, contrato, migrations/upgrade e interface concluídos no CI apto Linux. São15 cenários novos e97 focais, sem afirmar que todos os7249 são novos.

Artefato original `helpdesk-homologation-741c58b823c90b271eb63e43710e1b9c49b69279-38946660036-1`, digest `sha256:f2c26c33ac20194d313c5e571b8d73530dcf3c62a7982eab074b5c265fc95cd5`. Fingerprint `ba55ad5e3447760d17478145c2e38473b36b35f53b3667ad076b6395227fbaf7`. Relatório e seis logs originais preservados em `evidence/homologation/runs/c040f45d-e9e8-4769-a915-cf39b8b81c09/`, com bytes/hashes e relatório reconferidos contra as fontes antes/depois da cópia. Recibo `evidence/write-contract-20261016/ci-qualified.json`; `check:homologation` aprovado. Commits posteriores de documentação/evidência preservam esse fingerprint e não qualificam código diferente.

Apoio complementar da mesma fonte:43 verificações full shell e30 de navegador nativo, todos aprovados, com relatórios/logs originais em `evidence/write-contract-20261016/apoio-qualified/`. Origem38946660061, artefato `implantacao-741c58b823c90b271eb63e43710e1b9c49b69279-38946660061`, digest `sha256:a3515520e8f1f486cb4dd46b47cfa7977a69fc8e3fd6a6b4d6e7a7567e5f8fe0`. O merge38946665951 também aprovou Apoio. Diagnóstico falho antigo permanece separado, sem ser convertido em sucesso. Nenhum teste/guard foi desabilitado para encerrar a ocorrência.

Revisão independente acumulada encerrada sem achados pendentes na fonte741c58b. Os limites de fixtures/aceite humano permanecem; nem a prova do core em memória nem os relatórios do Apoio confirmam envio real em produção. A prévia inicial falhou no build antes da preservação da evidência; a prévia do commit documental final será conferida sem remover os gates existentes. Produção permanece no PR65/6fe9ea8; este PR66 não foi mesclado/publicado e não exige migration.

## Limites e continuidade

HD-002 permanece parcial. O gate não é validador genérico de requisições, cabeçalhos serializados ou todas as respostas da API. ETag/Location/replay são verificados pelos cenários acima; o schema de corpo não comprova sozinho esses recibos. Sucessos duráveis CG/checklist/intake e suas combinações continuam com suas bancadas existentes; nenhuma jornada humana hospedada é substituída pelas fixtures.

Sem alteração de OpenAPI, DSL, formulários publicados, política SLA, outbox, grants, segredos, SQL ou flags. Não repetir operações reais em produção para fabricar conformidade. Após qualificação, abrir PR de revisão da continuidade; publicação dessa nova fonte permanece distinta da autorização de publicação do PR65.

Próximos recortes ainda executáveis: ampliar a conformidade de requisições/cabeçalhos e demais respostas existentes; validação de e-mail somente em versão explícita e com equivalência DSL/publicador/SQL/UI; busca de conversa com contrato/audiência próprios. SLA/autoridade continuam sujeitos à definição vigente, sem inventar regras técnicas ou antecipar MFA/Novo GEO.
