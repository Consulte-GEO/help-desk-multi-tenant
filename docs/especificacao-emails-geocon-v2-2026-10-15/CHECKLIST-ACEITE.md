# Aceite da gestão de e mails

Critérios para a implementação futura da V2. Estes cenários não são testes já executados do produto. Registrar evidência, commit e resultado real ao desenvolver; o relatório VERIFICACAO-DOCUMENTAL.json deste pacote trata somente dos documentos e do protótipo.

## Cenários de produto

| ID | Cenário | Resultado esperado | Requisitos |
|---|---|---|---|
| AC-01 | Evento com três destinatários e duas tentativas para um deles | Uma comunicação, três linhas e denominador três; tentativas no detalhe | EMV2-01, EMV2-06 |
| AC-02 | Dois eventos do mesmo chamado, mesmo assunto e horário | Duas comunicações com identidades próprias | EMV2-01 |
| AC-03 | Evento público e evento interno relacionados | Audiências e metadados permanecem isolados | EMV2-01, EMV2-14 |
| AC-04 | Lista, detalhe e agregados consultados em duas contas/obras isoladas | Nenhuma linha, contagem, cursor ou informação de existência vaza | EMV2-02, EMV2-13, EMV2-14 |
| AC-05 | Admin e equipe consultam o mesmo grupo autorizado | Admin recebe completo; equipe recebe apenas máscara e identificação opaca, inclusive erros e campos técnicos | EMV2-04, EMV2-14 |
| AC-06 | Equipe tenta filtrar endereço integral ou consultar identificador de outro contexto | Consulta recusada/limitada sem funcionar como oráculo de destinatário | EMV2-02, EMV2-14 |
| AC-07 | Conjunto autorizado maior que uma página e que o limite da referência de 5.000 | Indicadores correspondem ao conjunto completo, não à página/limite | EMV2-02, EMV2-06 |
| AC-08 | Evento `email.clicked` verificado sem `email.opened`/`email.delivered` | Clique registrado; abertura e entrega não são fabricadas | EMV2-06, EMV2-08, EMV2-10 |
| AC-09 | Mesmo callback reapresentado e depois callback com identidade igual e conteúdo diferente | Repetição idêntica não conta de novo; conflito exige atenção | EMV2-11 |
| AC-10 | Assinatura inválida, bytes alterados ou janela temporal inválida | Nenhum fato ou indicador de negócio alterado | EMV2-10 |
| AC-11 | Evento assinado do mesmo provedor, mas de GEOCON/GEOLAB ou sem correlação | Nenhuma associação por e-mail/tag/assunto; fluxo durável de pendência conforme contrato | EMV2-10 |
| AC-12 | Clique chega antes de entrega e abertura chega com instante anterior | Fatos independentes e cronologia qualificada; nenhuma regressão do desfecho | EMV2-08, EMV2-11 |
| AC-13 | Abertura/clique para intenção com `unknown` ou falha posterior | Atenção/falha permanece prioritária; datas comprovadas preservadas | EMV2-08 |
| AC-14 | Enfileiramento e lease sem aceite do provedor | Não há Saiu ou data Enviado inventados | EMV2-04, EMV2-06, EMV2-07 |
| AC-15 | Histórico anterior à coleta com entrega conhecida | Entrega preservada; abertura/clique N/D, não zero | EMV2-04, EMV2-12, EMV2-16 |
| AC-16 | Coorte mista ou interrupção conhecida da coleta | Cobertura por sinal explícita; não publicar taxa de N como se todos tivessem coleta | EMV2-06, EMV2-12 |
| AC-17 | Callback posterior à implantação para envio antigo | Fato observado pode aparecer; coorte antiga não se torna integralmente acompanhada | EMV2-12 |
| AC-18 | Abre, fecha, pagina, filtra e atualiza painel | Nenhum envio, retry, cancelamento ou mudança de configuração | EMV2-02, EMV2-15 |
| AC-19 | Muda workspace/identidade enquanto consulta anterior está pendente | Cancela/descarta resposta velha e limpa dados privados | EMV2-14, EMV2-15 |
| AC-20 | Revoga acesso durante polling ou expira sessão | Fluxo nativo de sessão e limpeza, sem conservar cartões/detalhes privados | EMV2-14, EMV2-15 |
| AC-21 | Erro transitório da consulta com contexto ainda válido | Aviso e instante da última leitura; não transformar erro em zero ou sucesso | EMV2-15, EMV2-16 |
| AC-22 | Usa teclado, Escape, retorno de foco, zoom 200% e tela 360 px | Diálogo utilizável, sem foco no fundo e com fechamento acessível | EMV2-03, EMV2-17 |
| AC-23 | Atualização de 15 s com diálogo visível/aba oculta | Sem sobreposição; suspende ao ocultar/fechar; preserva foco e scroll | EMV2-15 |
| AC-24 | Payload inclui URL de clique com token, HTML, headers e dados adicionais | Projeção e logs não persistem/exibem conteúdo desnecessário ou segredo | EMV2-09, EMV2-11, EMV2-13 |
| AC-25 | Instantes diferem só em microssegundos e filtro cruza data local | Ordenação/cursor e intervalo corretos; exibição não perde a precisão persistida | EMV2-02, EMV2-04, EMV2-13 |
| AC-26 | Consulta fila com `retry_wait`, `leased`, `sending`, `unknown`, `suppressed` | Estados e idade apropriados; nenhum Pulado genérico ou botão de reenvio | EMV2-07, EMV2-08 |
| AC-27 | Abertura/clique é recebido para chamado em atendimento | Não resolve, aceita ou encerra chamado; não cria ciência | EMV2-05, EMV2-08 |
| AC-28 | Publicação da nova coleta | Schema/código compatíveis, evidência de início de coleta, piloto e segurança preservados | EMV2-18, EMV2-19 |

## Evidências exigidas

Os testes focais devem cobrir os casos negativos que protegem autorização, correlação, idempotência e ciclo de entrega. SQL precisa executar com papel restrito em banco descartável. A verificação de interface deve inspecionar tanto DOM/respostas quanto o resultado visual em desktop e celular; máscara apenas no CSS não satisfaz AC-05.

Executar também os checks vigentes do repositório, incluindo testes, typecheck, contratos e build conforme AGENTS.md. Não declarar homologação PostgreSQL a partir de teste de memória, nem aceite de produção a partir de fixture. Registrar separadamente testes locais/CI, publicação e aceite real autorizado.

Se algum critério depender de dado ausente, registrar o bloqueio concreto e sua consequência no aceite. Não ajustar fixture, reduzir escopo de segurança ou preencher datas presumidas para fazê-lo passar.
