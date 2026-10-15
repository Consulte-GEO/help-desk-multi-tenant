# HDA-04.analysis-worker — contrato técnico da E04

## Responsabilidades

`registration-analysis-worker.ts` orquestra somente análise. `registration-analysis-ports.ts` define o dono transacional e o motor de análise. `analysis-request.ts` reduz o contexto; `strict-json.ts` valida os bytes de saída. `workers/dev-agent-bridge/{config,subprocess,runner}.ts` controla a chamada ao executável candidato. Nada importa um executor de cadastro ou um canal de email.

## Fluxo

1. Verificar habilitação estrita e cancelamento; no máximo uma iteração por instância do worker.
2. Criar claim com chave persistível do chamador. A transação confere autorização e retorna apenas após confirmação.
3. Recibo repetido não inicia modelo. Reserva nova é comparada com contexto, hash, finalidade, fence e prazos.
4. Carregar operação com finalidade read em outra transação autorizada. Conferir snapshot, revisão, lease e stateHash exatos.
5. Reservar margem de 1.500 ms para liquidação; orçamento insuficiente não inicia modelo. O deadline local é conservador em relação ao tempo de banco observado.
6. Anexos sem qualificação: registrar indicação de revisão manual, sem ler bytes ou invocar modelo. Excertos só por resolvedor privado e hash exato; documentação indisponível também produz revisão manual.
7. Revalidar depois da seleção de documentação. Invocar motor fora de qualquer transação.
8. Validar saída pelo contrato da ação e reautorizar antes da liquidação. Modelo não pode fornecer target, approval ou executionAllowed como autoridade.
9. Confirmar complete/fail com chave determinística derivada do claim. Confirmação desconhecida termina a iteração com dados mínimos para consulta, sem novo modelo/fail compensatório.

A porta de transação deve executar a função de admissão antes e depois de esperas e antes de COMMIT. A biblioteca não substitui o bloqueio/autorização no SQL. Cancelamento/flag não desfaz uma transação já confirmada.

## Limites concretos do transporte candidato

| Controle | Limite/comportamento |
|---|---|
| stdout bruto | 262.144 bytes; exceder encerra o processo |
| stderr bruto | 16.384 bytes; só se guarda contagem, não conteúdo |
| stdin | perfil canônico HDA, até 65.536 bytes totais |
| JSON do fornecedor | profundidade24, 8.192 nós, 128 membros/objeto, 1.024 itens/array, string até65.536 bytes |
| Excertos | referências exatas da tarefa; máximo20, texto até8.000 bytes por excerto e24.000 bytes agregados |
| Processos | Linux não-root; caminho canônico e arquivo não gravável por grupo/outros; SHA256 e versão exatos |
| Tempo | configuração de1.000 a240.000 ms para a chamada toda; worker pode cancelar antes pelo lease |
| Turnos | 2 no comando candidato |
| Orçamento | string decimal explícita de0,01 a1,00 USD; limites locais de configuração, não garantia de faturamento do provedor |
| Sessões/ferramentas | bare, sem ferramentas, sem MCP herdado, sem continuação/persistência de sessão |

Esses números são limites deste código candidato, não validação de capacidade operacional. Alterações exigem atualização de testes e qualificação do host. A versão/modelo usados nas fixtures são sintéticos; não selecionar o modelo fictício do teste em produção.

## Identidade e isolamento

O modo bare não lê a assinatura OAuth pessoal. O adaptador recebe somente chave dedicada da API do modelo, por resolvedor privado, e não a salva. Não herda process.env; define PATH, HOME, diretórios de configuração, localidade/fuso e a chave permitida. Os identificadores de workspace, conexão, tenant e contrato não são copiados como campos do envelope de stdin; o texto informado no chamado continua podendo conter dados pessoais e depende de minimização na origem.

O processo atual do Dev Agent e seus hooks não são alterados. A nova invocação candidata é separada, sem ferramentas. A whitelist de flags não garante confinamento do SO: o host deverá fornecer usuário dedicado, binário/depêndencias imutáveis e controles de rede/filesystem. A E04 não configura esses recursos e não suporta Windows nativo sem novo adaptador de supervisão.

## Resultados operacionais privados

`disabled`, `busy`, `idle`, `replay_no_launch`, `exhausted`, `withheld`, `reconciliation_required`, `draft_ready`, `needs_information`, `manual_review`, `analysis_failed`. São estados da iteração, não estados públicos de chamado/cadastro. O resultado contém claimCommandId, settlementCommandId, finalidade conhecida e operationId autorizado, sem prompt, stderr ou saída bruta.

Não há API de consulta de conciliação exposta neste recorte. O host deve consultar recibos atuais sob a identidade/finalidade autorizadas. Mesmo recibo histórico válido não cria uma nova reserva.

## O que a prova local demonstra

A fixture gera um processo Node real para simular sucesso, falhas, timeout, stderr excessivo, versão divergente e cancelamento. Um teste compõe esse processo com o worker e o modelo transacional E02. Isso testa fluxo de controle, parsing e contrato de confirmação; **não** testa raciocínio do Claude, custo real, banco PostgreSQL ou isolamento hospedado.
