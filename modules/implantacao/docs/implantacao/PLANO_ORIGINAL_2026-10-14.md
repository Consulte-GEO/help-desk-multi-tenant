# Implantação, importações e laudos no Help Desk Consulte GEO
## Avaliação técnica e plano de desenvolvimento

**Data de referência:** 14/10/2026 · **Versão do plano:** 1.0
**Natureza:** análise de código e documentação; arquitetura proposta e tarefas de desenvolvimento.
**Estado desta entrega:** documentação produzida. Nenhuma funcionalidade implementada, migration aplicada ou publicação realizada nesta análise.

---

## 1. Decisão recomendada

Criar uma área **Implantação e Importações** vinculada aos chamados do Help Desk, reaproveitando os motores e o editor do `setup-implantacao-obras` em vez de reconstruí-los. O Help Desk coordena atendimento, identidade, permissões, comunicação e acompanhamento; a ferramenta especializada prepara os dados; o adaptador do sistema de destino valida e executa somente o plano aprovado.

A prioridade é colocar esses processos a serviço da Consulte GEO. Preservar a arquitetura independente e o isolamento existentes, sem investir agora em um framework genérico para outras empresas.

A unidade de trabalho deixa de ser “um arquivo convertido neste navegador” e passa a ser **um processo rastreável**, com solicitante, cliente, obra, chamado, arquivos originais, revisões, pendências, aprovação, execução e conferência no destino.

**Fluxo-alvo:**

```text
Cliente / equipe de suporte
  → chamado e contexto autorizado
  → processo de implantação ou lote de importação
  → arquivos originais preservados
  → leitura e classificação
  → estrutura / dados normalizados em rascunho
  → revisão das pendências
  → prévia de criação, vínculo e alteração
  → aprovação humana de uma versão exata
  → exportação assistida OU execução por adaptador autorizado
  → recibos e leitura de conferência no sistema de destino
  → conciliação
  → comunicação ao solicitante e encerramento
```

**Não confundir:** estrutura aprovada pelo cliente, importação autorizada pelo suporte e aprovação técnica de laudo/concretagem são decisões diferentes.

---

## 2. Base examinada e limites da evidência

### 2.1 Repositórios

| Repositório | Branch consultada | Commit de referência |
|---|---|---|
| `Consulte-GEO/setup-implantacao-obras` | `main` | `dcf5607652281bb688f366e6a4f05e07eb698d31` |
| `Consulte-GEO/wiki_consultegeo` | `main` | `569f331850e639e153768995c311f5657f47fa4e` |
| `Consulte-GEO/help-desk-multi-tenant` | `codex/m1-reproducibilidade` | `5e873fd9e1361501566e37368f8b5147bf2f0c2d` |

Foram examinados os pontos centrais de importação, exportação, normalização, propostas, auditoria, rotas, prévia da estrutura e integração do Help Desk, além das páginas da wiki relacionadas a implantação, dependências dos cadastros, laboratório, integração e suporte. Os arquivos e localizadores constam em `MATRIZ_EVIDENCIAS_2026-10-14.md`.

Isto não é uma certificação integral do repositório, de todas as páginas da wiki ou da segurança do ambiente hospedado. A leitura dos endereços públicos não forneceu uma jornada completa navegável. Não foram enviados arquivos de clientes, feitas chamadas ao provedor de IA, executadas importações, consultadas tabelas de negócio hospedadas ou rodadas as suítes nesta sessão. Os resultados de testes mencionados nos documentos dos projetos são **evidência declarada por essas entregas**, não testes reexecutados aqui.

### 2.2 Estado operacional relevante do Help Desk

O checkpoint publicado em 14/10/2026 descreve API/interface 0.30 publicadas, compatibilidade restrita de autenticação com schema hospedado 0.19 e promoção para 0.23 ainda pendente. Atendimento, origem real M08 e entrega operacional de e-mails permanecem separados da publicação da interface. [H01]

O plano respeita essas barreiras. Desenvolver as ferramentas especializadas e seus testes não exige abrir o atendimento. Tornar a integração operacional exige qualificar os pré-requisitos já existentes; não se deve ligá-la apenas porque uma nova tela ficou pronta.

### 2.3 Premissas adotadas

- Foco de negócio no Novo Consulte GEO descrito na wiki; o contrato efetivo de destino precisa ser qualificado antes de qualquer escrita automática.
- O usuário externo pode preencher, enviar arquivos, revisar a representação da obra e acompanhar pendências. Isso não lhe concede acesso administrativo nem autorização para escrever diretamente nos cadastros produtivos.
- O suporte trabalha em nome do solicitante com identificação dos dois atores, e não por compartilhamento de senha.
- O projeto não será reescrito em outro framework. Preservar Vue/Vuex e os motores existentes no Setup; usar as convenções atuais do Help Desk para sua interface e backend. [S01]
- Preservar a decisão registrada no projeto Help Desk de um único destino hospedado de produção. Testes automatizados usam ambientes locais descartáveis; piloto hospedado utiliza a produção existente, com autorização, isolamento e barreiras de liberação. [H05]
- Integração com Claude CLI é uma possibilidade de execução supervisionada, não pré-requisito para cada conversão ou leitura.

---

## 3. Diagnóstico: o que já existe e deve ser aproveitado

### 3.1 Cadastro e visualização da nova obra

A importação de planilha já existe em `implantacaoImportService.ts`, incluindo modelo R02 e leitura de modelos R00/R01 com avisos. O resultado alimenta o mesmo modelo do assistente de cadastro; entidades recebem identificadores novos e os vínculos de concreto são remapeados. A prévia visual também já existe em `Step8Preview.vue`, com árvore da obra, pilhas de pavimentos, FCK e pendências. [S02, S03]

Portanto, a solicitação não exige começar um novo editor nem uma nova visualização. Exige torná-los parte de uma jornada persistente e autorizada, melhorar completude, comparação entre versões, acesso externo e correspondência com o que realmente será criado no destino.

### 3.2 Pré-análise das planilhas

O `IntakeAuditor` é determinístico, reutilizável em navegador e Node, e já produz achados com proveniência. Entretanto, o arquivo declara analisar **planilha de controle tecnológico** e seus campos incluem data de concretagem, NF e volume por caminhão. Isso não equivale ao perfil de cadastro inicial de uma obra. [S04]

É necessário separar a classificação do documento da validação. Um arquivo que descreve torres, peças e FCK não pode receber a régua de uma lista histórica de caminhões.

### 3.3 Conversão de históricos

Há detecção de abas e cabeçalhos, expansão de mesclas, associação de colunas, normalizações, propostas por similaridade, revisão humana, exportação e proveniência. O fluxo de pré-análise já prevê reaproveitar mapeamento e inventário na conversão. [S05, S06]

O valor principal está nesses motores. As regras técnicas frágeis, o estado concentrado no navegador e a falta de integração com o destino precisam ser corrigidos antes de automatizar a gravação.

### 3.4 Leitura de laudos

O leitor já separa PDF com texto de página que exige visão, possui perfis declarativos, distingue valor/ausente/ilegível, preserva origem e permite revisão. O contrato e a suíte sintética existentes são ativos importantes. [S07]

O Excel técnico de seis abas produzido pelo leitor **não comprova compatibilidade com o importador final**. O próximo passo é ligar a extração a um modelo de entidades e a adaptadores de exportação/execução efetivamente qualificados.

### 3.5 Auditoria posterior

O `PostAuditor` identifica problemas de plausibilidade, como NF repetida, volumes e datas suspeitas. Porém, no trecho examinado, escolhe `sheets[0]` de cada arquivo, monta os agrupamentos de duplicidade dentro de cada arquivo e não recebe uma referência aprovada para comparar com o destino. [S08]

Esse motor deve ser preservado como **auditoria de qualidade do consolidado**, mas não apresentado como prova de que a importação foi completa e fiel. É preciso acrescentar a conciliação de origem, plano aprovado e destino.

### 3.6 Help Desk

O código existente oferece escopo autorizado, catálogo, rascunhos com controle de versão, abertura transacional e recibos. Há verificação de titular, workspace, conta, referências externas e hashes. [H02, H03]

Duas limitações importam para esta integração: o runtime configura rascunho de abertura com 1.800 segundos; e `lockEvidence`/`lockLookup` recusam o caminho ainda não qualificado. Um processo de implantação que leva dias não deve simplesmente reutilizar esse rascunho curto, nem pressupor que os arquivos já possam participar do fluxo sem desenvolvimento adicional. [H02, H03]

---

## 4. Achados prioritários e tratamento

| ID | Prioridade | Evidência observada | Consequência possível | Tratamento proposto |
|---|---|---|---|---|
| A01 | P0 | Exportadores distintos para SQL Server e `geomat:criar_obra`; wiki não documenta contrato público completo de laboratório | Gerar arquivo válido para o alvo errado | Matriz de capacidades por produto, versão, material e operação; homologar um destino prioritário |
| A02 | P0 | Wiki afirma não existir importação de resultados por planilha; conversor preserva colunas de resultados | Prometer uma integração que o destino não possui | Separar exportação técnica, importação de concretagens e envio de resultados; confirmar canais reais |
| A03 | P0 | Pré-análise orientada a histórico, com NF/data/volume | Cobrar campos indevidos de planilha de implantação | Perfis separados `implantacao_obra`, `historico_concreto` e `consolidado_destino` |
| A04 | P0 | `freshProposals` e ações de aceite preenchem Slump/Flow a partir do nominal do traço | Registrar especificação como medição realizada | Separar previsto de medido; ausência de medição não se resolve com inferência |
| A05 | P0 | Conversão de unidade por magnitude sem unidade explícita; padrões operacionais de volume | Alteração aparentemente plausível, mas sem evidência | Proposta identificada e revisão; não aplicar como fato técnico; bloquear destinos incompatíveis com desconhecido |
| A06 | P0 | Número da concretagem agrupado apenas por data/bloco/unidade | Juntar eventos distintos realizados no mesmo local/dia | Identidade e agrupamento explícitos de evento, entrega, amostra e CP |
| A07 | P0 | Tipos agrupados globalmente por etapa/FCK/concreto no exportador geomat | Colapsar peças com projetistas, croquis, volumes ou significado diferentes | Equivalência estrutural explícita; assinatura completa ou escolha de tipo pelo revisor |
| A08 | P0 | Pós-auditoria não compara fontes nem lê todas as abas como conjunto | Não detectar registros perdidos, alterados ou duplicados entre arquivos | Conciliador com evidência por item, escopo e horário da leitura de destino |
| A09 | P0 | Proxy de visão documentado com Origin, consentimento e sessão gerada no browser | Confundir controles de origem/custo com autorização interna | Identidade autenticada ou capacidade curta vinculada a processo/conta; quotas no servidor |
| A10 | P0 | Modo local do conversor aceita lembrar chave de IA e configurar URL HTTPS de proxy | Segredo em cliente e configuração indevida no uso corporativo | Modo integrado somente por proxy autorizado; remover coleta/persistência de chave nesse modo |
| A11 | P0 | Rascunhos/tickets próprios do Setup e rascunhos de abertura curtos no Help Desk | Dois protocolos, status divergentes e perda de contexto de longa duração | Help Desk como autoridade do atendimento; processo especializado durável, com referências e recibos |
| A12 | P1 | Limites de pré e pós-importação diferem; datas antigas tratadas com janelas fixas | Alertas contraditórios, bloqueio indevido de históricos | Catálogo único de regras por finalidade; limites não apresentados como norma universal |
| A13 | P1 | IA pode elevar score que participa de aceite por “alta confiança” | Confiança declarada pelo modelo tratada como evidência | Separar score heurístico, decisão de associação e autorização humana; medir erro em corpus |
| A14 | P1 | README estático antigo versus build Vite; versões divergentes em documentos | Publicação errada ou manutenção de arquivo inativo | Índice de fontes ativas, atualização de instruções e teste do artefato publicado |
| A15 | P1 | Cache imutável geral de assets; exceções específicas para laudos | Motor estático de outro fluxo ficar incompatível com a tela | Fingerprint/versionamento uniforme e smoke de arquivos publicados |
| A16 | P1 | Router tem `/laudos`; `/laudo` não aparece nele | Link divulgado levar ao caminho incorreto | Qualificar alias e redirecionar explicitamente para a rota canônica |
| A17 | P0 | Atualização de laudo pode reiniciar avaliações no produto, segundo wiki | Importação histórica disparar mudanças e comunicações inesperadas | Prévia dos efeitos colaterais e política de execução por tipo de mudança |
| A18 | P0 | Atendimento e M08 continuam fechados no Help Desk | Nova tela aparentar estar operacional sem backend qualificado | Liberação por capacidade real, não por presença de botão ou código |

As fontes de cada achado, seu grau de confirmação e os testes propostos estão detalhados na matriz anexa. Os riscos de produção não foram explorados nem confirmados por chamadas que modificassem o ambiente.

---

## 5. Arquitetura e limites de responsabilidade

### 5.1 Comparação das alternativas

**Somente links ou iframe:** permite acesso rápido, mas não resolve identidade, estado, arquivos, aprovação e recibos. O Setup declara `X-Frame-Options: SAMEORIGIN`; portanto, embutir entre domínios não é uma premissa válida. Link autenticado pode ser a transição, sem enfraquecer o header. [S11]

**Reescrever tudo dentro do Help Desk:** aumenta risco de regressão, duplica parser e mistura regras de engenharia com atendimento. Não recomendado.

**Integração progressiva, preservando os motores:** recomendada. O suporte acessa a ferramenta a partir do chamado, com contexto autorizado, e o processo devolve estados e evidências ao Help Desk. A migração visual/tecnológica de páginas monolíticas pode ocorrer depois, sem condicionar o primeiro ganho de operação.

### 5.2 Autoridade de cada domínio

| Domínio | Autoridade |
|---|---|
| Protocolo, fila, responsável pelo atendimento, comunicação e SLA | Help Desk |
| Autorização de acesso ao chamado e às referências externas | Serviços existentes do Help Desk e fonte de autorização qualificada |
| Processo especializado, revisões de dados, mapeamentos e extrações | Módulo de Implantação/Importações, inicialmente no serviço existente do Setup |
| Cadastros, concretagens, caminhões, amostras, CPs e resultados oficiais | Sistema de destino |
| Interpretação/proposta assistida | Motor determinístico e IA subordinados ao contrato do processo |
| Aprovação técnica de concretagem/laudo e tratamento de NC | Fluxo próprio do sistema de destino e pessoas autorizadas |
| Conteúdo de ajuda e regras documentadas | Wiki com público, versão e revisão editorial |

Manter referências externas tipadas no núcleo do Help Desk. As tabelas e campos específicos de engenharia pertencem à extensão/adaptador. Não criar uma quarta plataforma ou banco independente apenas para este plano; aproveitar os serviços existentes e introduzir persistência especializada incrementalmente.

### 5.3 Integração sem transação distribuída fictícia

O processo especializado pode ser criado antes da abertura do chamado, principalmente para permitir salvar o formulário externo. Até receber o recibo do Help Desk, seu estado deve ser `aguardando_vinculo_ao_chamado`; não inventar protocolo nem afirmar que o suporte foi notificado.

Eventos de sincronização são persistidos em outbox. O consumidor guarda recibos de eventos já processados. Repetição ou resposta perdida não cria segundo chamado. Se houver falha de associação, um reconciliador tenta novamente usando a mesma chave e expõe a pendência ao operador.

O Help Desk projeta o estado do processo para acompanhamento; não mantém uma segunda máquina de execução de importação. A execução especializada referencia a aprovação registrada pela autoridade escolhida, com assinatura/verificação servidor-servidor e sem confiança em campos vindos do navegador.

### 5.4 Acesso externo

Preferir conta identificada, convite ou sessão autorizada limitada à empresa e à obra. Links legados de posse devem ser tratados como capacidades restritas, com escopo, prazo, revogação e migração controlada. Não usar nome da obra, CNPJ ou e-mail como prova de autorização.

O usuário externo não vê credenciais, logs internos, outros clientes, sugestões ainda não revisadas, nomes de tabelas ou tarefas do agente. O cadastro externo é um rascunho submetido ao suporte, e não uma autorização de escrita produtiva.

---

## 6. Modelo de dados e contratos propostos

Estes são conceitos e contratos de desenvolvimento, não tabelas ou endpoints existentes. A implementação deve reconciliá-los com o schema atual e reutilizar estruturas equivalentes.

### 6.1 Entidades

| Entidade | Conteúdo mínimo e invariantes |
|---|---|
| `ProcessingCase` | ID, workspace, conta, solicitante, executor em nome de, referência de chamado, tipo de processo, destino e versão; obra pode ainda não existir |
| `SourceArtifact` | ID, hash dos bytes, tamanho, MIME verificado, nome original somente como metadado, storage privado, dono, classificação e política de retenção |
| `SourceLocator` | Arquivo, aba, célula/linha ou página/região; relação entre fonte e campo |
| `CaseRevision` | Número, versão anterior, autor, motivo, snapshot imutável e hash; alteração cria nova revisão |
| `CanonicalRecord` | Entidade de domínio, ID temporário estável, campos, vínculos e evidências; sem usar IDs da planilha como IDs produtivos |
| `MappingDecision` | Campo/local/entidade, candidatos, escolha, origem, autor, horário, regra e versão do catálogo |
| `ValidationFinding` | Código estável, severidade, registro/campo, mensagem, ação exigida e evidência; erro não deve desaparecer ao mudar de tela |
| `ExecutionPlan` | Destino qualificado, operações ordenadas, dependências, precondições, efeitos colaterais, hash e modo de execução |
| `ApprovalRecord` | Tipo de aprovação, pessoa, escopo, hash aprovado, prazo e justificativa; não é apenas um booleano no draft |
| `ExecutionRun` | Plano, tentativas, estado, checkpoints, identidade de serviço, cancelamento e observabilidade |
| `OperationReceipt` | Chave idempotente, hash de entrada, ID de destino, resultado confirmado ou incerto, instante e evidência |
| `ReconciliationReport` | Referências da fonte e revisão aprovada, leitura do destino, divergências, exceções e decisão final |

### 6.2 Campo técnico

Cada valor deve separar o que o cliente enviou do que será usado. Modelo conceitual:

```text
campo
  raw_value / raw_unit
  normalized_value / normalized_unit
  presence: present | absent | illegible | not_applicable
  provenance: source | normalized | proposed | customer_confirmed | operator_corrected
  semantic_role: measured | specified | calculated | identifier | operational_placeholder
  source_locations[]
  rule_id / rule_version
  review_status / reviewed_by / reviewed_at
```

`proposed` não equivale a medido. Um operador aceitar uma proposta nominal de slump não prova que o ensaio de abatimento foi realizado. Resultados, volumes e horários ausentes não podem ganhar aparência de observações reais.

### 6.3 Granularidade dos dados históricos

Separar **evento de concretagem → entrega/caminhão → amostragem → corpo de prova → resultado de ensaio**, além do documento de laudo e suas revisões. Uma planilha pode estar em qualquer uma dessas granularidades, inclusive com linhas de total.

O importador precisa registrar qual granularidade foi detectada e confirmada. Volume da entrega não deve ser somado uma vez por CP; resultado consolidado não deve ser transformado em dois CPs artificiais. Duas entregas no mesmo dia/local não são necessariamente o mesmo evento. Dois CPs com mesmo resultado não são necessariamente duplicados.

### 6.4 Estados

```text
rascunho
  → aguardando_arquivos
  → em_analise
  → aguardando_complementacao
  → em_revisao
  → pronto_para_aprovacao
  → aprovado
  → pronto_para_exportacao OU pronto_para_execucao
  → exportado_aguardando_execucao OU executando
  → parcialmente_executado / resultado_incerto / falhou / executado
  → em_conciliacao
  → conciliado / conciliacao_com_divergencias
  → concluido
```

Reabertura e cancelamento são transições explícitas. Uma revisão após aprovação invalida aquela autorização para a nova versão. Cancelamento de job não desfaz operações já confirmadas. `exportado` não significa `importado`, e `executado` não significa `conciliado`.

### 6.5 Matriz de capacidades do destino

Registrar, por destino e versão: operação, material, unidade dos campos, template/schema, autenticação, campos obrigatórios, identidade de registro, regra de duplicidade, recursos de simulação, consulta de recibo, leitura posterior e efeitos colaterais.

Destinos que devem permanecer separados na documentação:

1. Novo Consulte GEO e seus contratos efetivos de cadastro/histórico/laboratório.
2. Exportação de implantação para o modelo SQL identificado pelo exportador existente, com compatibilidade a confirmar.
3. `geomat:criar_obra`, identificado explicitamente no exportador Postgres.
4. Excel técnico de leitura de laudos, que pode servir de evidência sem ser aceito por qualquer importador.

Não habilitar escrita automática em um destino porque outro aceitou uma planilha semelhante. A primeira versão deve qualificar **um único destino prioritário**, mantendo os demais apenas como exportadores explicitamente identificados quando aplicável.

---

## 7. Processo 1 — Cadastro e visualização da nova obra

### 7.1 Jornada externa e interna

Entrada com duas opções claras: **Preencher cadastro** e **Importar planilha**. Ambas produzem o mesmo rascunho. O suporte pode abrir o processo a partir do chamado, preencher em nome do cliente e devolver uma versão para confirmação.

Propor cinco blocos de navegação, reaproveitando os componentes existentes: dados da obra; estrutura e peças; concretos e moldagem; pessoas e fornecedores; revisão e envio. Não eliminar os passos internos necessários; agrupar visualmente para reduzir a sensação de formulário extenso.

A tela sempre mostra cliente/obra, etapa atual, pendências e estado real de salvamento. Diferenciar “salvo neste dispositivo”, “salvo no servidor” e “enviado ao suporte”. Trocar de navegador não pode apagar um processo que foi anunciado como salvo na conta.

### 7.2 Importação da planilha de implantação

Preservar modelos R02 e legados. Antes de substituir o rascunho, exibir abas reconhecidas, quantidades, campos ausentes, avisos e o efeito da ação. Permitir **criar nova revisão**, **mesclar itens selecionados** ou cancelar; nunca sobrescrever silenciosamente dados digitados.

Em arquivos não padronizados, classificar se são cadastro inicial ou histórico. Para cadastro inicial, mapear dados básicos, estruturas, tipos, unidades/peças, concretos, padrões de moldagem, pessoas e fornecedores. Nunca exigir NF ou resultados porque a ferramenta de histórico usa esses campos.

### 7.3 Estrutura visual

Evoluir a árvore e as pilhas existentes com busca, expansão/recolhimento, filtros de pendências, legenda de FCK e acesso à célula de origem. Apresentar tipo versus instância de forma compreensível; mostrar volume por unidade e quantidade de repetições separadamente, com total calculado sem duplicidade.

Exemplo conceitual:

```text
Obra — Residencial Exemplo
  Torre A
    Fundação
      Estacas / Blocos
    Estrutura
      Pavimentos 1 a 8 — tipo repetido
      Cobertura — tipo específico
  Torre B
  Área externa
```

Isso é uma visualização da estrutura informada, não reconstrução BIM nem projeto técnico. Não incluir 3D como dependência do primeiro ciclo.

### 7.4 Regras de implantação vindas da wiki

Validar dependências regional/obra/grupo/tipo/unidade, campos de FCK de projeto e dados opcionais, vínculo de traço existente em vez de duplicação, projetista apropriado por tipo, padrão de moldagem conferido com a Qualidade e estrutura completa antes do histórico. [W01, W02, W03]

A prévia deve alertar para configurações de alcance amplo: alteração de traço compartilhado, fornecedor matriz, padrão global, campos do material e usuários com acesso regional. A importação não deve alterar automaticamente um cadastro compartilhado por outras obras.

**Aceite:** um usuário importa uma planilha suportada, entende a árvore, corrige uma pendência, retoma em outro dispositivo, envia a versão e consegue distinguir o que está proposto do que foi efetivamente implantado.

---

## 8. Processo 2 — Analisar planilha recebida

### 8.1 Perfis explícitos

Criar pelo menos `implantacao_obra`, `historico_concreto` e `consolidado_destino`. O sistema pode sugerir o perfil e explicar os indícios, mas o operador pode corrigir a classificação antes das regras de obrigatoriedade.

Em arquivo misto, classificar por aba/bloco e relacionar as partes. Não escolher automaticamente uma aba apenas porque tem mais linhas ou aparece primeiro. Preservar abas ocultas no inventário com indicação própria; não importá-las silenciosamente.

### 8.2 Saída útil para o suporte

A análise deve mostrar: reconhecido, falta complementar, divergente e não aplicável. Cada pendência aponta para campo/célula/linha e informa a consequência. Exemplo: “A Torre B não possui FCK de projeto nas peças indicadas”, não “falha ao processar arquivo”.

Gerar uma resposta ao cliente com apenas as dúvidas necessárias e sem logs internos. O suporte revisa antes de enviar. A solicitação deve retornar ao mesmo processo, com comparação da revisão nova e resolução das pendências já respondidas.

### 8.3 Reaproveitamento sem retrabalho

Cabeçalho, mapeamento, células mescladas, inventário de entidades, classificação de linhas e decisões humanas seguem para a próxima etapa. Não pedir o mesmo arquivo novamente nem repetir a escolha de colunas sem alteração de versão.

**Aceite:** planilha de estrutura sem NF é avaliada pela régua de implantação; planilha histórica sem NF é avaliada pela capacidade do destino; nenhuma é descartada nem corrigida silenciosamente por estar fora de um modelo.

---

## 9. Processo 3 — Converter planilha histórica do cliente

### 9.1 Leitura robusta e preservação

Inventariar arquivos, abas, regiões tabulares, cabeçalhos multinível, mesclas, linhas ocultas, totais, notas de rodapé e fórmulas. Datas devem considerar sistema 1900/1904 quando aplicável e preservar uma data civil sem deslocamento por fuso.

Fórmulas e links externos nunca são executados como código. Quando a informação disponível for um valor calculado em cache, isso deve aparecer na proveniência. Ausência de valor calculado exige revisão; não transformar expressão em número adivinhado.

Registrar a disposição de toda linha relevante: exportada, consolidada com rastreabilidade, excluída por ser total/cabeçalho, rejeitada pelo revisor ou pendente. Totalizações e recortes não podem apagar material fora do selecionado sem constar do diagnóstico.

### 9.2 Mapeamento sem perder significado

Distinguir data da concretagem, moldagem, rompimento e lançamento; FCK de projeto, especificado no traço e resistência medida; volume da entrega, aplicado, devolvido e total; resultado de CP individual versus consolidado por exemplar/idade.

Associar blocos, peças, usinas, laboratórios e traços em catálogo autorizado com identificadores e versão. As sugestões de similaridade continuam úteis, mas a lista só pode conter entidades válidas para aquela conta/obra/material. Confirmar a existência do vínculo no momento da execução.

Perfis de importação por cliente são configurações versionadas. Reaproveitar uma regra de um cliente em outro só após revisão, sem expor dados ou permitir associação cruzada.

### 9.3 Agrupamento e deduplicação

O operador deve visualizar quais linhas formarão cada concretagem, quais são caminhões e quais apenas detalham CPs. Duas concretagens no mesmo dia e unidade precisam permanecer separáveis por evento explícito, horário, local/aplicação, referência original ou decisão humana.

Usar identidade composta de acordo com o contrato qualificado. NF isolada ou NF+nome de usina não é uma chave universal: série, filial/emissor, obra, origem e granularidade precisam ser considerados quando disponíveis. Colisão gera revisão, não descarte automático. Duplicidade de arquivo, linha e entidade são classes diferentes.

### 9.4 Data de corte

Registrar data de corte acordada com o cliente, período coberto, último arquivo aceito e política de inclusão. Exibir itens posteriores ao corte e sobreposição com lançamentos manuais já existentes. Alterar o corte gera nova revisão e nova análise de colisões. [W01, W03]

### 9.5 Exportação e execução

Produzir arquivo estritamente compatível com o destino e um pacote separado de evidências. Um modo de rascunho pode continuar exportando pendências, desde que o arquivo seja inequivocamente marcado e não seja elegível ao executor.

Valores extraordinários exigem validação contextual. As faixas presentes no código não devem ser divulgadas como limites universais de engenharia. Dados incompatíveis com o contrato de destino bloqueiam execução; dados suspeitos, mas representáveis e confirmados, podem seguir com justificativa conforme política aprovada.

**Aceite:** mesma entrada e mesmas decisões geram o mesmo conteúdo de domínio; todas as linhas têm disposição explicada; volumes não se multiplicam por CP; repetição do lote não cria registros duplicados; dados ausentes não ganham medição fictícia.

---

## 10. Processo 4 — Ler laudos e reconstruir o histórico necessário

### 10.1 Preservar a estratégia atual de leitura

Manter extração determinística primeiro para PDF com texto. Enviar ao modelo visual somente páginas/regiões que realmente necessitem, por ação autorizada e política de dados. Manter os perfis declarativos, estados por campo e revisão humana. [S07]

PDF com camada de texto incompleta exige detecção de qualidade por página/região, não apenas teste binário de “há algum texto”. Releitura localizada não pode apagar resultados já conferidos nem fundir linhas diferentes.

### 10.2 Revisão por evidência

Interface lado a lado: documento e resultado estruturado. Clicar no valor destaca página e região/célula correspondente. Filtros: campo crítico ausente, divergência, vínculo incerto, revisão pendente e possível revisão de laudo existente.

Preservar identificação do documento, emissor, número, revisão, data, material, amostragem, numeração original de CP, idade e unidade, resistência, datas e demais valores realmente apresentados. Valor ausente permanece ausente. Não usar uma média/consolidado como se fossem resultados individuais.

Não eliminar corpos de prova só porque idade e resistência se repetem. Não inferir 12 horas a partir de “1” ou “2” sem unidade. Data/idade divergente vira pendência revisável, não reescrita automática.

### 10.3 Dois caminhos de negócio

**Há concretagens/caminhões/CPs no destino:** procurar candidatos no escopo da obra, laboratório, entrega, amostra e ensaio. Aplicar a chave da capacidade qualificada, não uma heurística universal. Exibir evidência do vínculo. Correspondência ambígua exige revisão.

**O cliente enviou apenas laudos e o histórico ainda não existe:** montar um rascunho das entidades possíveis, com lista explícita de faltantes. O laudo pode não informar volume, local, usina, traço completo ou horários. Não há autorização para inventar esses dados para satisfazer o importador.

Nesse segundo caminho, o processo abre pendências de estrutura/cadastro e solicita complementação. Somente após resolução cria a sequência mínima autorizada: estrutura/vínculos → concretagem/entrega → amostra/CP → resultado → documento/vínculo de laudo. Quando o sistema suporta histórico parcial com campos ausentes, esse modo precisa ser uma capacidade explícita.

### 10.4 Resultados e PDF são entregas relacionadas, não a mesma coisa

A extração de resultados pode terminar com sucesso e o vínculo de PDF falhar, ou vice-versa. Armazenar recibos separados e mostrar pendência real. Uma revisão de laudo pode alterar avaliações, portanto o plano de execução precisa informar “atualiza documento existente”, “adiciona resultado” ou “recusa ambiguidade”. [W04, W05, W06]

Não converter a aprovação da leitura em aprovação técnica. Não encerrar NCs nem mudar avaliação estrutural para “satisfatória” em nome da importação.

### 10.5 Qualificação da IA

Construir corpus de referência com documentos autorizados e sanitizados, distribuídos por emissor/layout/material, PDF digital/imagem, revisões e quantidade de páginas. Medir omissões, preenchimentos incorretos, associação errada de linha, vínculo incorreto no destino e esforço de revisão.

Duas passadas em consenso são uma técnica de verificação, não garantia de verdade. IDs de modelos presentes no código precisam ser validados quanto à disponibilidade e comportamento antes de homologação; não fazem parte de uma promessa de compatibilidade deste plano.

**Aceite:** todo campo crítico exportado tem evidência e decisão; resultado sem vínculo não é importado silenciosamente; nenhum CP é inventado; a operação informa quais entidades foram criadas e quais permaneceram pendentes.

---

## 11. Processo 5 — Auditar e conciliar a importação

### 11.1 Dois modos claramente nomeados

1. **Auditar qualidade do consolidado:** análise interna de consistência e plausibilidade, sem afirmar fidelidade à origem.
2. **Conferir importação com a origem:** conciliação entre fonte, versão aprovada, execução e dados lidos no destino.

O modo 2 recebe quatro referências: arquivo(s) original(is), snapshot aprovado, recibos de execução e extração/consulta do destino com escopo e horário. Na fase assistida, a equipe pode anexar o consolidado exportado do destino; sua abrangência deve ser verificada antes de classificá-lo como evidência suficiente.

### 11.2 Conferências

Conferir existência, ausência, duplicidade, vínculo e valor por entidade/campo. Comparar contagens de eventos/entregas/CPs, volumes sem multiplicidade, período, usina, laboratório, unidade, FCK/traço, resultados/idades, PDF e situação do vínculo.

Diferenças precisam informar valor esperado, encontrado e origem. Classificar: não criado; criado a mais; valor divergente; vínculo errado; atualização posterior legítima; evidência insuficiente; leitura de destino incompleta.

Totais iguais não garantem importação correta: duas linhas trocadas podem preservar a soma. A aprovação do lote exige também correspondência por registro.

### 11.3 Concorrência e efeitos derivados

Leitura de destino deve incluir identificadores e revisão/horário quando disponíveis. Mudanças posteriores do usuário não são automaticamente erro da importação. Relatórios materializados podem atrasar; preferir leitura da entidade oficial para comprovar a gravação e acompanhar reconstrução do relatório separadamente.

Não manter consulta repetindo indefinidamente sem expor atraso. Definir prazo operacional de espera e estado “aguardando atualização do relatório”, independente do estado do dado principal.

### 11.4 Encerramento

Encerrar somente com todas as operações do escopo resolvidas, conciliação sem divergências bloqueantes e exceções explicitamente aceitas por pessoa autorizada. O relatório final explica período, destino, itens criados/vinculados/ignorados e pendências fora do escopo.

Notificação ao cliente deve usar estados reais: “arquivo preparado”, “dados importados; conferência em andamento”, “importação conferida” ou “necessária complementação”. Não enviar “concluído” apenas após download do Excel.

---

## 12. Segurança, privacidade e execução segura

### 12.1 Identidade e autorização

Autenticação precisa identificar pessoa/serviço e autorização precisa verificar workspace, conta, referências de obra, operação e capacidade. A verificação é feita no servidor em leitura, correção, aprovação, execução, download e retorno de resultados. A revogação de acesso depois da aprovação impede uma nova execução não autorizada.

Origin/CORS, consentimento e uma sessão gerada pelo navegador não equivalem a autorização. A OWASP orienta não depender apenas de Origin, e a documentação de Edge Functions diferencia verificação de usuário, serviço e mecanismos próprios. [E01, E03]

Preservar RLS/grants/funções endurecidas existentes. Novas tabelas expostas precisam de autorização testada; um usuário autenticado não pode ver todos os processos. Credenciais privilegiadas permanecem no servidor, nunca em URL, relatório, log ou arquivo de configuração exportável.

### 12.2 Arquivos e conteúdo não confiável

Validar extensão permitida, MIME, assinatura, tamanho, número de páginas/linhas/abas e tamanho descompactado. Usar nomes internos próprios e armazenamento privado. Conteúdo de planilha/PDF é dado não confiável, inclusive instruções dirigidas à IA. Não executar macros, fórmulas como código, URLs internas ou comandos presentes no documento. [E02]

Previews devem escapar texto. Arquivos exportados precisam tratar formula injection conforme tipo de célula e formato, sem converter indiscriminadamente números legítimos em texto. Implementar varredura e quarentena de arquivos no caminho servidor conforme política adotada; sem capacidade de verificar um arquivo, o estado deve ser explícito.

### 12.3 Dados enviados à IA

No modo integrado, limitar ao conteúdo necessário e a provedores/modelos autorizados. Remover a opção de chave de IA pessoal lembrada no navegador desse fluxo. URLs de proxy são configuração administrativa allowlisted, não livre escolha de cada processo.

Registrar finalidade, política de envio e consentimento/autorização aplicáveis. Não assumir que `store:false` equivale a retenção zero ou resolve todas as obrigações de privacidade. Prazo de retenção dos originais, derivados, logs e corpus deve ser definido com os responsáveis; não estabelecer prazo legal neste plano.

Cache de extração deve incluir escopo autorizado, hash do arquivo e versões do pipeline. Não revelar a um cliente que um arquivo de outro cliente já foi processado. Telemetria usa identificadores opacos e contagens; não copia texto do laudo nem valores pessoais.

### 12.4 Aprovação e imutabilidade

O hash aprovado deve cobrir conteúdo de domínio, destino, referências, ações, precondições, política, versões dos mapeamentos e lista de arquivos. Campos voláteis que não alteram a decisão, como instante de geração do download, ficam fora do conteúdo canônico explicitamente definido.

Qualquer mudança relevante exige novo plano e nova aprovação. Controle de versão otimista deve impedir que dois revisores sobrescrevam decisões. Reaproveitar os códigos e semântica de conflito existentes quando aplicável, em vez de uniformizar tudo em um erro genérico.

### 12.5 Execução, repetição e recuperação

Operações usam chave idempotente estável vinculada à revisão/ação e hash. A entrega de jobs/eventos pode ocorrer mais de uma vez; os efeitos de negócio não podem se repetir por isso. A tentativa repetida com a mesma chave e conteúdo diferente é recusada.

Após timeout, consultar recibo/estado no destino antes de reenviar. Sem confirmação, o estado é **resultado incerto**, não “falhou, tentar tudo de novo”. A unidade transacional deve ser declarada por adaptador; lote grande pode ter partes confirmadas e partes pendentes.

Rollback de dados não é sinônimo de excluir a obra. Usar compensação autorizada e restrita a registros comprovadamente criados pelo lote, ainda sem dependências/alterações posteriores e cuja operação inversa seja suportada. Caso contrário, abrir tratativa de correção. Nunca usar “recriar estrutura” como mecanismo de rollback.

### 12.6 Notificações e efeitos colaterais

Mapear programação, geração de CPs, descarte de contraprova, atualização de relatório, reinício de aprovação e e-mails. Não alterar regras técnicas para esconder problemas do histórico. Separar notificações operacionais externas dos eventos internos de auditoria.

Entrega de e-mail é eventual via outbox, com recibo e tentativa controlada. Falha no e-mail não repete uma importação concluída. Conteúdo público não deve trazer tokens, parâmetros técnicos ou notas internas.

---

## 13. Integração com Dev Agent Claude CLI

O agente atua como **analista/proponente**, não como administrador irrestrito da produção.

Ferramentas conceituais permitidas: ler caso autorizado, consultar catálogo, extrair dados, propor mapeamentos, gerar plano, registrar pendência e consultar resultado. A aprovação pertence a uma pessoa autorizada. A escrita pertence a um executor restrito, com escopo e recibos.

```text
Arquivo ou cadastro solicitado
  → agente avalia e propõe
  → regras determinísticas validam
  → pessoa revisa o diff e aprova o hash
  → executor aplica o conteúdo aprovado
  → agente/serviço recebe os recibos
  → conciliador verifica o destino
  → Help Desk comunica o resultado
```

Não conceder ao agente SQL arbitrário, acesso a secrets, deploy ou liberdade para “corrigir” valores técnicos durante a execução. O runner de produção não deve usar o contexto de desenvolvimento do CLI com permissões amplas. Documento anexo ou texto da wiki nunca pode alterar as permissões do executor.

O contrato deve funcionar também sem o agente: parser determinístico, revisão manual, exportação e conciliação continuam disponíveis. Não colocar um LLM entre cada clique do usuário e a persistência de um formulário simples.

---

## 14. Interface e experiência do suporte

### 14.1 Navegação

No Help Desk: **Implantação e Importações**, com entradas “Nova obra”, “Analisar planilha”, “Importar histórico”, “Ler laudos” e “Conferir importação”. Mostrar somente ações liberadas para o perfil e explicar indisponibilidades reais.

Dentro do chamado, exibir um cartão do processo: versão, estado, pendências, responsável, próximo passo e último evento. Um chamado pode ter processos relacionados, mas deve ficar claro qual é o principal e quais são complementações.

### 14.2 Área de trabalho

Cabeçalho persistente de contexto; lista de arquivos/revisões; tabela de revisão com origem; painel de pendências; prévia dos efeitos; histórico; controles de envio, aprovação e execução em regiões distintas. Evitar uma grade larga com todos os detalhes sempre visíveis.

Ações em lote devem dizer exatamente qual subconjunto afetam: linhas selecionadas, filtradas ou todo o arquivo. Campos críticos exigem autorização própria; um botão “aceitar tudo” não deve transformar todas as inferências em fatos.

### 14.3 Consistência visual

Usar a identidade Consulte GEO e os componentes/tokens já adotados pelo projeto, com adaptação por superfície. Não migrar framework apenas para reproduzir aparência. Priorizar contraste, teclado, leitura móvel para cliente, revisão em desktop para suporte e mensagens de erro compreensíveis.

Progresso de leitura precisa mostrar arquivos/páginas/linhas processados, cancelamento real e possibilidade de retomada. Não informar porcentagem fictícia em uma fase sem estimativa mensurável. Processamento em lote deve liberar memória de páginas já concluídas e evitar repintar uma tabela inteira a cada célula.

---

## 15. Plano de desenvolvimento por incrementos

**Legenda:** P0 = segurança/integridade ou pré-requisito; P1 = operação e produtividade; P2 = expansão. Tamanho relativo S/M/L orienta divisão do trabalho, não é compromisso de prazo. Caminhos novos são propostas e devem respeitar convenções atuais após reconciliação do HEAD.

### IMP-00 — Baseline, contratos e destino prioritário

**Prioridade:** P0 · **Tamanho:** M · **Dependências:** nenhuma.

**Trabalho:** reconciliar HEAD, instruções, fonte ativa das páginas, builds, migrations, testes e estado hospedado documentado. Construir a matriz de capacidades. Resolver documentalmente a divergência “resultados por planilha” versus integração de laboratório. Obter o template/API efetivamente utilizado e um exemplo aceito, sanitizado. Definir campos realmente exigidos por operação e a primeira capacidade a homologar. Mapear efeitos colaterais e dependências M08/upgrade/e-mails do Help Desk sem alterá-las.

**Arquivos existentes:** Setup `README.md`, `CLAUDE.md`, `netlify.toml`, `docs/PRE-IMPORTACAO-CAMPOS.md`, `docs/OCR-LAUDOS.md`, exportadores; Help Desk `PROJECT_HELP_DESK.md`, `docs/147-PUBLICACAO-UX10-2026-10-14.md`; wiki páginas citadas.

**Entregáveis propostos:** `docs/integracao-helpdesk/BASELINE.md`, `CAPACIDADES_DESTINO.md`, `DECISOES.md`, corpus inicial autorizado e manifesto de compatibilidade.

**Aceite:** cada capacidade está qualificada, planejada ou indisponível; nenhuma rota/payload desconhecido é apresentado como existente. O próximo desenvolvedor sabe qual arquivo é fonte e qual é gerado.

### IMP-01 — Contrato canônico e correções de integridade

**Prioridade:** P0 · **Tamanho:** L · **Dependência:** IMP-00.

**Trabalho:** separar dado medido/especificado/proposto, presença e unidade; introduzir IDs de fonte e registros; preservar CPs; corrigir agrupamento de concretagens; corrigir equivalência de tipos no exportador; centralizar políticas de validação; impedir aceite técnico indevido de nominal/volume. Manter compatibilidade dos outputs anteriores ou criar nova versão declarada.

**Arquivos existentes:** `frontend/src/models/setup.models.ts`, `frontend/src/services/geoControleExportService.ts`, `frontend/src/services/implantacaoImportService.ts`, `frontend/src/services/validationService.ts`, `frontend/public/assets/similarity-engine.js`, `frontend/public/importa.html`.

**Novos propostos:** `schemas/import-case.v1.schema.json`, `schemas/import-plan.v1.schema.json`, módulo de proveniência e regras em localização compatível com a estrutura existente.

**Testes de partida:** dois eventos no mesmo local/dia; peças de mesmo FCK com projetistas diferentes; slump ausente com nominal no traço; CPs distintos com resistência igual; volume repetido em linhas de CP.

**Aceite:** a aprovação humana não transforma especificação em medição; informações estruturalmente diferentes não colapsam; origem bruta e decisões são preservadas.

### IMP-02 — Processos duráveis, arquivos e permissões

**Prioridade:** P0 · **Tamanho:** L · **Dependências:** IMP-00/01.

**Trabalho:** persistir casos e revisões; controlar acesso por conta/processo; tratar arquivos privados e limites; definir retenção; criar salvamento recuperável e concorrência; implementar capacidades curtas de abertura da ferramenta; proteger proxy de IA por identidade/job e quotas reais. Separar expiração de sessão da duração do processo.

**Arquivos existentes:** `setupDraftService.ts`, `setupAuditService.ts`, `setupShareService.ts`, `authService.ts`, `supabase/functions/laudo-vision/index.ts`, função de proxy usada pelo conversor, migrations existentes e políticas.

**Novos propostos:** serviço/repositório de processos e revisões, contratos de arquivo, testes de autorização e migrations incrementais geradas pelo fluxo do projeto. Não copiar tabelas do Help Desk para outro banco como atalho.

**Aceite:** processo retoma em outro dispositivo; usuário de outra conta não lê nem escreve; troca de papel/expiração é respeitada; falha de gravação não aparece como salvo no servidor; arquivos inválidos ficam em estado explícito.

### IMP-03 — Ligação ao Help Desk sem atendimento duplicado

**Prioridade:** P0 · **Tamanho:** L · **Dependências:** IMP-02; qualificação operacional do Help Desk somente para a liberação hospedada.

**Trabalho:** abrir/vincular processo a chamado com chave idempotente; reutilizar catálogo/formulários e referências externas; criar outbox/inbox de eventos; mapear protocolos legados do Setup; exibir cartão de acompanhamento; controlar visibilidade de mensagens e pendências. Não fazer dois sistemas dispararem a mesma notificação.

**Arquivos existentes:** Setup `ticketService.ts`, `SubmitTicketModal.vue`, `ClientStatusView.vue`, `ReviewView.vue`; Help Desk `src/application/form-draft.ts`, `src/application/support-intake.ts`, `src/application/consultegeo-request-catalog.ts`, `src/infrastructure/consultegeo-intake-store.ts`, `src/infrastructure/consultegeo-runtime.ts` e handlers já usados.

**Novos propostos:** adaptador de processo externo e projeção do status, com contratos próprios e testes de replay.

**Aceite:** resposta perdida/reenvio não gera segundo chamado; processo longo não expira como rascunho de abertura; caminho de arquivos/evidências é qualificado, não simulado por retorno positivo; sem origem real, a capacidade segue indisponível.

### IMP-04 — Jornada de nova obra e prévia melhorada

**Prioridade:** P1 · **Tamanho:** M/L · **Dependências:** IMP-01/02; IMP-03 para integração no chamado.

**Trabalho:** aperfeiçoar escolha manual/planilha, leitura R02/legado, mesclagem por revisão, campos do contexto, árvore, pilhas, busca, contagens e comparação. Implementar confirmação do cliente e revisão interna separadas. Explicitar vínculos e impacto de cadastros compartilhados.

**Arquivos existentes:** `SetupPage.vue`, `Step1DadosBasicos.vue`, `Step3GruposEditor.vue`, `Step4Concretos.vue`, `Step5PecasEditor.vue`, `Step6UsuariosObra.vue`, `Step7Fornecedores.vue`, `Step8Preview.vue`, `PadraoMoldagemEditor.vue`, `PendenciasPanel.vue`, `implantacaoImportService.ts`.

**Aceite:** cadastro manual e importado têm validação equivalente; estrutura exibida corresponde ao payload; erro aponta ao item/célula; confirmação externa não libera execução administrativa.

### IMP-05 — Triagem por finalidade e complementação

**Prioridade:** P1 · **Tamanho:** M · **Dependências:** IMP-01/02.

**Trabalho:** classificar documento/aba, separar perfis de implantação/histórico/consolidado, inventariar regiões, produzir pendências específicas, resposta revisável ao cliente e retomada com comparativo. Reusar `IntakeBridge` onde aplicável.

**Arquivos existentes:** `frontend/public/pre-analise.html`, `assets/intake-auditor.js`, `assets/intake-selftest.js`, `assets/implantacao-import-core.js`, `docs/INTEGRACAO-IMPORTA.md`.

**Aceite:** planilha de nova obra não recebe exigências de caminhão; uma nova revisão resolve apenas os achados realmente corrigidos; dados não são reenviados à IA sem necessidade.

### IMP-06 — Conversão histórica e catálogo autorizado

**Prioridade:** P0/P1 · **Tamanho:** L · **Dependências:** IMP-01/02/05; catálogo qualificado para escrita final.

**Trabalho:** modularizar progressivamente engines inline, manter adaptadores de UI, tratar múltiplas abas, datas/mesclas/fórmulas, granularidade, aliases por cliente, corte e colisões. Revisar resultados individuais/consolidados; preservar itens não suportados como pendência. Gerar pacote operacional e evidências com o mesmo hash de revisão.

**Arquivos existentes:** `frontend/public/importa.html`, `assets/similarity-engine.js`, `assets/intake-auditor.js`, `frontend/src/services/normalizationService.ts`; definir módulos novos sem editar bundles gerados.

**Aceite:** todas as linhas relevantes têm disposição; nenhuma alteração técnica sem origem; reimportação não duplica; cabeçalhos repetidos/totais não viram registros; recorte por data de corte é verificável.

### IMP-07 — Leitor de laudos integrado ao processo

**Prioridade:** P1 · **Tamanho:** L · **Dependências:** IMP-01/02.

**Trabalho:** anexar leitura ao caso, persistir revisão, reabrir documentos, exibir origem lado a lado, detectar páginas mistas, limites de lote, cancelamento/retomada, perfis e revisões. Proteger acesso ao proxy; medir qualidade de extração com corpus. Preservar motor de texto e leitura localizada.

**Arquivos existentes:** `frontend/public/laudos.html`, `assets/laudo-app.js`, `assets/laudo-parser-core.js`, `assets/laudo-invariantes.js`, `assets/laudo-perfis.js`, `supabase/functions/laudo-vision/index.ts`, `schemas/laudo-ocr.v1.schema.json`, `tools/run-laudo-tests.js`, `tools/test-laudo-vision.mjs`.

**Aceite:** processamento não perde linhas ao cancelar/recomeçar; revisão identifica arquivo/página/linha; cada export técnico informa pipeline/versão; corpus mede preenchimento incorreto além de cobertura.

### IMP-08 — Reconstrução e vínculo de entidades a partir de laudos

**Prioridade:** P0/P1 · **Tamanho:** L · **Dependências:** IMP-06/07 e capacidades de laboratório qualificadas em IMP-00.

**Trabalho:** construir candidatos de concretagem/entrega/amostra/CP, resolver identidades reais, identificar faltantes e cadastrar somente o conteúdo aprovado. Suportar vincular resultados ao que já existe ou propor histórico mínimo com complementação. Tratar revisão de documento e conflito de amostragens como ações distintas.

**Locais propostos:** adaptadores de domínio do módulo de importações e, somente se necessário, endpoints restritos no sistema de destino após inspeção de sua implementação. Os nomes de serviços na wiki são pistas de investigação, não autorização para escrever diretamente nas tabelas.

**Aceite:** nenhum volume, ensaio ou CP fabricado; caso ambíguo bloqueia associação automática; PDF e resultados possuem recibos separados; aprovação técnica preservada.

### IMP-09 — Plano de execução, aprovação e contrato do agente

**Prioridade:** P0 · **Tamanho:** M/L · **Dependências:** IMP-03/06 ou IMP-03/08 conforme o fluxo.

**Trabalho:** gerar diff de criar/vincular/alterar/não importar, precondições, dependências, efeito em documentos/NC/relatórios e aprovação do hash. Expor ferramentas limitadas ao agente; permitir produzir exatamente o mesmo plano sem IA. Aprovação externa da estrutura é evidência de entrada, não privilégio do executor.

**Locais propostos:** schemas do plano e aprovação; serviço de planejamento no módulo especializado; integração com workflow/checklist do Help Desk, sem duplicação de semântica.

**Aceite:** mudar campo/arquivo/destino invalida autorização; revisor revogado não autoriza nova execução; agente não modifica payload aprovado nem acessa outros processos; draft não executável permanece inelegível.

### IMP-10 — Execução e recibos por destino

**Prioridade:** P0 · **Tamanho:** L · **Dependência:** IMP-09; operacionalização do destino e do Help Desk para modo integrado.

**Trabalho:** implementar um adaptador prioritário, idempotência, unidade transacional, checkpoints, resultado incerto, consulta de recibo, cancelamento seguro e compensações suportadas. Não incluir todos os destinos na primeira entrega. Manter alternativa de exportação assistida quando automação não for suportada.

**Aceite:** falha após commit mas antes da resposta não duplica; lote parcial retoma só o que falta; operação de outro contrato é recusada; e-mail falho não repete escrita; nenhum SQL arbitrário pelo agente.

### IMP-11 — Auditoria completa e conciliação

**Prioridade:** P0/P1 · **Tamanho:** L · **Dependências:** IMP-06 e recibos de IMP-10; modo assistido pode começar antes.

**Trabalho:** extrair `PostAuditor` para módulo testável; analisar todas as abas selecionadas e colisões entre arquivos; acrescentar comparação com revisão aprovada e leitura de destino; classificação de diferenças, regra de tolerância de arredondamento por campo e relatório de conferência. Contabilizar mudanças posteriores e relatórios em atualização.

**Arquivos existentes:** `frontend/public/importa.html` e suas ações de pós-auditoria; novo módulo proposto `assets/import-reconciliation-core.js`, corpus e testes associados.

**Aceite:** encontra registro faltante, extra, trocado e duplicado mesmo com somas iguais; relatório incompleto não produz “conciliado”; tolerância não esconde erro de unidade ou associação.

### IMP-12 — Wiki, ajuda contextual e operação guiada

**Prioridade:** P1 · **Tamanho:** M · **Dependências:** IMP-00, com atualização contínua a cada incremento.

**Trabalho:** revisar páginas conflitantes; documentar caminhos de importação por destino; ligar códigos de pendência a orientações; criar checklist por fase e mensagens ao cliente; manter público interno separado de externo. Reusar ajuda do Setup e iniciativas editoriais do Help Desk.

**Arquivos existentes:** Setup `StepHelpPanel.vue`, `stepHelpService.ts`; Help Desk: ferramentas editoriais HDW existentes, cujos caminhos devem ser reconciliados no HEAD atual; wiki `corpus/50-implantacao/*`, `corpus/40-laboratorio-parceiro/*`, `corpus/60-suporte/*`, `corpus/70-engenharia/integracoes.md`.

**Aceite:** artigo apresentado é apropriado ao público e à versão; `[VERIFICAR]` não vira regra executável por acidente; mudança de texto não concede acesso nem dispara migração.

### IMP-13 — Qualificação, piloto e retirada dos caminhos duplicados

**Prioridade:** P0/P1 · **Tamanho:** M/L · **Dependências:** capacidade liberada com incrementos necessários e pré-requisitos operacionais existentes.

**Trabalho:** baseline e regressão completa, PostgreSQL local real, navegador, corpus, casos adversos, backup/recuperação, migração de links/drafts legados e piloto controlado. Conferir o build publicado, caches, rotas, permissões, outbox e observabilidade. Retirar emissão duplicada de tickets e chaves no modo integrado somente após migração segura.

**Aceite:** estados implementado/testado/publicado/homologado/operacional separados; nenhuma flag aberta para contornar M08, schema ou autorização; plano de suspensão por capacidade; dados e histórico preservados.

---

## 16. Sequência recomendada e entregas úteis

### Entrega A — Integridade e preparação assistida

IMP-00, IMP-01 e primeiras partes de IMP-04/05/06. Corrigir os riscos de inferência/agrupamento e entregar preparo com origem preservada. O resultado é um pacote revisável, não promessa de cadastro automático. Esta frente não precisa aguardar a operação completa do Help Desk.

### Entrega B — Processo persistente ligado ao atendimento

IMP-02/03/04/05, com caminhos já seguros de IMP-06/07. Cliente acompanha estrutura e complementações; suporte trabalha no mesmo contexto e não perde revisões. Sua liberação integrada depende dos gates atuais do Help Desk.

### Entrega C — Histórico e laudos com aprovação e conferência

IMP-06/07/08/09 e primeira versão assistida de IMP-11. Entregar o percurso de dados originais até arquivo compatível e conferência documentada, mesmo antes de um executor automático.

### Entrega D — Automação controlada de um destino

IMP-10/11/13, mantendo IMP-12 atualizado. Somente aqui o agente/executor grava registros, com recibos e conciliação. Após o piloto, expandir por capacidade/material/laboratório, não por liberação geral.

**Primeiro recorte operacional recomendado:** nova obra via R02 ou cadastro manual → revisão visual → pendências no chamado → aprovação → exportação compatível → implantação assistida → conferência. Em paralelo, qualificar o caminho de históricos de concreto, que concentra os riscos de volume, agrupamento e resultados. IA de laudos entra como mais uma fonte desse processo, não como um fluxo isolado sem conferência.

---

## 17. Testes e critérios de liberação

### 17.1 Corpus funcional mínimo

| Grupo | Casos obrigatórios |
|---|---|
| Implantação | R02 completo; R00/R01; obra sem NF; torres em faixa; fundação/área externa; duas peças mesmo FCK com diferenças de projetista/volume/croqui; mesclagem com rascunho |
| Planilhas | Múltiplas abas; cabeçalho repetido/multinível; células mescladas; totais; abas ocultas; datas 1900/1904; números com vírgula/ponto; fórmula sem cache; unidade não explícita |
| Histórico | Dois eventos no mesmo local/dia; várias entregas por evento; vários CPs por entrega; volume repetido por detalhamento; série/filial NF; mesmo número em empresas diferentes; corte e sobreposição |
| Laudos | Digital; imagem; páginas mistas; vários documentos; tabela e gráfico; NF no cabeçalho; prismas sem NF quando aplicável; idades incomuns; CPs com resultados iguais; revisão de laudo |
| Vínculo | CP inexistente; vários candidatos; obra errada; NF certa e laboratório errado; resultado consolidado; múltiplas amostragens em documentos distintos |
| Conciliador | Registro omitido; extra; valor trocado; vínculo errado; somas iguais com linhas diferentes; arquivo de destino incompleto; mudança legítima posterior; leitura de relatório atrasada |

### 17.2 Segurança e recuperação

Testar acesso cruzado entre contas, alteração de referência pelo browser, aprovação de pessoa sem poder, papel revogado após aprovação, arquivo trocado, callback repetido/fora de ordem, digest divergente, token expirado, URL de proxy não permitida, documento com prompt injection, HTML/fórmula maliciosa, excesso de arquivos/descompactação, cancelamento durante OCR e timeout após commit.

Preservar os testes existentes do Setup e do Help Desk. Onde o teste requer Deno, navegador ou PostgreSQL real, ausência do runtime é **não executado**, não aprovação silenciosa. O prebuild do Setup deve preservar fontes novas conforme a allowlist registrada no projeto.

### 17.3 Condições mínimas para liberar uma capacidade

- Conteúdo de domínio determinístico sob a mesma entrada/decisão e compatibilidade de output comprovada no destino escolhido.
- Todos os campos críticos e vínculos rastreáveis; nenhum erro crítico conhecido de preenchimento/vínculo no corpus de qualificação. Isso é um critério de release do corpus, não promessa de erro zero em documentos futuros.
- Isolamento/autorização e idempotência validados, inclusive em PostgreSQL local real quando aplicável.
- Jornada de navegador completa para cliente e suporte, com dados de teste autorizados.
- Recibos e conciliação suficientes para comprovar o escopo concluído.
- Rollout compatível com schema real e gates existentes; comunicação sem envio indevido.
- Responsável operacional confirma o piloto. Quantidade de testes ou build verde isoladamente não significa homologação.

---

## 18. Observabilidade e métricas

Todo evento técnico usa `case_id`, `ticket_id` quando disponível, `revision_id`, `run_id`, `artifact_id`, `operation_id`, `correlation_id` e versões do pipeline, sem dados sensíveis no log.

Medir tempo até primeira análise, tempo de revisão humana, complementações por processo, cobertura por campo, preenchimento incorreto, associação incorreta, linhas sem destino, divergências de conciliação, repetições evitadas, jobs incertos, custo por página/lote e entrega de notificações. Comparar medianas e percentis por tipo de documento/cliente, não apenas média global.

Não prometer percentual de redução de tempo sem baseline. O primeiro piloto registra o processo atual e o assistido com critérios equivalentes. O objetivo é reduzir trabalho repetitivo **sem aumentar preenchimentos errados ou ocultar pendências**.

Alertas internos devem apontar para a ação: fila parada, falha de quota, perda de recibo, job sem heartbeat, callback recusado, lote parcial ou conciliação divergente. Um alerta deve abrir a evidência do caso, não expor o documento inteiro no serviço de logs.

---

## 19. Migração, publicação e rollback

Não transportar tabelas, tokens ou credenciais automaticamente entre projetos Supabase. A migração é por contrato e ownership validado. Rascunhos legados recebem associação de titular e referência de chamado quando comprovadas; casos não associáveis permanecem acessíveis apenas por mecanismo legado controlado até tratativa, sem adoção por coincidência de e-mail.

Preservar números de protocolo antigos como referências; não renumerar nem duplicar atendimento. Capturar revisões e arquivos com hashes, registrar migração por caso e conferir contagens antes/depois. Migrar por lote controlado, sem apagar a fonte antes do aceite.

Publicar em ordem de compatibilidade: migração incremental, código tolerante ao estado real, verificação, habilitação restrita por capacidade. A aplicação nunca deve assumir schema novo pelo simples número de versão do frontend. Não editar migrations históricas nem abrir grants para contornar a promoção pendente do Help Desk.

O rollback de código desabilita novas execuções e preserva leitura/recibos; jobs já confirmados não são reenviados. O rollback de dados é uma operação própria de compensação, sujeita a precondições e aprovação.

Conferir `frontend/scripts/cleanup-legacy.cjs` antes de criar novos fontes, gerar assets pelo caminho oficial e verificar cache/versão das páginas estáticas. Preservar o endereço divulgado `/laudo` por alias explicitamente testado caso seja necessário; a rota canônica encontrada é `/laudos`.

---

## 20. O que adiar

Adiar motor genérico para qualquer empresa, migração integral de framework, editor 3D/BIM, treinamento automático de modelos com documentos de clientes, execução sem aprovação, SQL livre pelo agente, importação irrestrita de todos os materiais e reescrita do módulo de laudos do sistema principal.

Modelos e aliases por cliente, expansão de materiais, reconhecimento adicional e maior automação entram após comprovar os fundamentos de identidade, origem, vínculo, compatibilidade e conferência. Não impedir o uso assistido seguro enquanto esses recursos são desenvolvidos.

---

## 21. Pendências de qualificação que não impedem começar o desenvolvimento

1. Qual é o contrato efetivamente ativo do importador de históricos e qual canal recebe resultados no Novo Consulte GEO? Resolver por inspeção do destino/template e ensaio autorizado em IMP-00.
2. Quais endpoints dão catálogo e readback com IDs/revisões? Sem eles, manter exportação assistida e conciliação com evidência de abrangência conhecida.
3. Quais regras de publicação do Help Desk precisam ser cumpridas para o piloto integrado? Preservar M08 adiada até autorização específica; não alterar a decisão nesta tarefa.
4. Quais documentos reais podem integrar o corpus e qual política de retenção/envio à IA foi aprovada? Usar fixtures sintéticas no desenvolvimento inicial.
5. Qual pessoa/papel pode confirmar estrutura, autorizar importação e aceitar exceções? Implementar separação de capacidades, com política definida antes da liberação.

Essas questões são tarefas de investigação e configuração. Não autorizam adivinhar endpoint, inventar valores faltantes nem paralisar melhorias independentes de interface e integridade.

---

## 22. Definição de pronto por entrega

A entrega deve listar separadamente: **planejado; implementado; testado localmente; testado em PostgreSQL real; testado em navegador; publicado; homologado; operacional**. Quando uma classe não se aplica, explicar. Quando não foi executada, declarar.

Cada incremento de desenvolvimento deve produzir mudanças focadas, testes, evidências vinculadas ao commit, atualização do plano, riscos remanescentes e handoff. Quando a publicação for delegada ao Codex, o pacote deve informar exatamente a base e evitar reintroduzir arquivos antigos sobre commits novos.

**Conclusão:** o maior reaproveitamento está nos motores determinísticos, no editor de estrutura e na proveniência já existentes. A maior evolução necessária é tornar os cinco processos uma cadeia única: pedido → preparação → decisão → execução → comprovação. O critério final não é gerar um Excel bonito, mas saber o que foi criado, por quê, por quem e com qual evidência.
