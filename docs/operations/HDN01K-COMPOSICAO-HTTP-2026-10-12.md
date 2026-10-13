# HDN-01k — composição HTTP do checklist e evidência local

Data da entrega: 12/10/2026 (America/Sao_Paulo). Continuidade do handoff HDN-01j.

## 1. Estado que prevalece

A principal foi consultada no PR30 como `6e069005beaa12d7cb55c77af92478c21f7526ca`; o PR permanece aberto/draft, não integrado, no head `a5b23a9143ecc367444a28e9b71d561fd325611c`, branch `review/hdn01-checklist-validation-20261012`. A reconsulta ao final manteve três commits e 12 arquivos alterados.

A HDN-01j já executou e aprovou os 31 cenários PostgreSQL no CI38327100179/1. Os resultados 3741 aplicação / 326 PostgreSQL / 156 interface daquela execução são históricos e se referem à fatia remota de persistência. **Não foram reexecutados nem estendidos para aprovar a HDN-01k.** O SQL candidato e os 31 cenários permanecem byte a byte iguais ao cumulativo J.

A tentativa de incorporar o restante da fonte ao PR por `GitHub.create_tree` foi bloqueada pelas configurações de segurança da ferramenta. Não houve commit/update de ref/merge novo. O conteúdo bloqueado não foi reenviado por outra ação, codificação ou serviço. O Git nativo falhou por DNS. A continuidade efetiva desta rodada é LOCAL.

## 2. Objetivo e lacuna de verificação

O requisito RF-CEN-07 exige checklist por subcategoria antes de finalizar; RF-CEN-11 exige conferência reforçada nas ações sensíveis. A regra de produto e os controles SQL já estavam nos incrementos anteriores. O handoff J pede completar e validar a composição, não criar outro motor isolado.

A fixture usada pela interface até J implementava manualmente os endpoints de consulta, evidência e marcação. Ela utilizava o decisor de domínio, mas não atravessava o handler, serviço, resolvedor, store e executor transacional efetivos. Uma aprovação dessa fixture não comprovaria essas ligações.

Nesta rodada substituí esse roteamento simulado por uma composição com os módulos reais. **Não alterei regras de produto, telas, SQL, permissões ou o runtime de produção.** A mudança é na infraestrutura de integração e suas provas.

Fontes de escopo: `Requisitos Help Desk.md`, Central de atendimento, RF-CEN-07/RF-CEN-11, linhas197–201; plano de implantação, protocolo de cada entrega, linhas95–99; handoff HDN-01j, seção “Prioridade: completar a composição”. O comportamento da origem não foi inferido de exemplos de teste.

## 3. Composição implementada

Novo `tests/fixtures/checklist/composition.ts` liga:

`createExecutionChecklistHttpHandler` → `createExecutionChecklistService` → `createResourceAccessResolver` → `runResourceTicketTransaction` → `createPostgresExecutionChecklistStore` → `runTransaction`.

O servidor existente `tests/fixtures/checklist/browser-server.ts` continua ligado somente a loopback e exige o marcador de fixture. Não há URL hospedada, credencial real ou banco configurável nessa execução. Sua lista de assets permanece explícita; código-fonte do backend, package.json e outros arquivos não são servidos.

A autenticação, a autoridade de recursos e o transporte físico SQL permanecem MODELOS DE TESTE. O transporte mantém estado preparado e estado confirmado separados para exercitar as decisões do executor. Não executa SQL, não implementa RLS e não é um banco de referência para concorrência. Os cenários SQL reais da J continuam sendo a prova separada dessa camada.

O cliente de teste agora envia uma credencial inequivocamente sintética. A origem HTTPS usada para construir `Request` é um nome de teste fixo, sem acesso de rede. A ponte de loopback aceita somente a própria origem local, quando enviada, e a mapeia ao nome interno para exercitar o handler que exige HTTPS. Isso não é um adapter de produção, prova de TLS ou forma de aceitar um Origin informado livremente.

A revalidação real de escopo é exercitada duas vezes pelo resolvedor e comparada com a projeção de escopo retornada pelo driver controlado. Contadores restritos à fixture permitem verificar que a requisição chegou às camadas esperadas; não são propriedades acrescentadas ao produto.

## 4. Cenários novos e resultado

Há 18 cenários de integração no arquivo `tests/execution-checklist-composition.test.ts`, mais o agrupador do runner Node (19 verificações contabilizadas):

| Cenário | Verificação principal |
|---|---|
| Jornada normal | Consulta, seleção, revisão, marcação e recibo atravessam a cadeia real |
| Autenticação ausente | Recusa401 antes de consultar recursos |
| Origem diferente | Recusa403 antes do serviço |
| Alias HTTPS da fixture | Não vira uma segunda origem permitida ao cliente |
| Guard de origem sem a ponte | O próprio handler recusa o Origin divergente |
| UTF-8 inválido | Decoder fatal recebe os bytes originais, sem substituir caracteres |
| Content-Type text/plain | Não contorna o leitor JSON controlado |
| GET no endpoint de marcação | Não grava; método405 |
| Preconditions/chave ausentes | Não iniciam consultas SQL |
| Escopo persistido estrangeiro | O guard real recusa antes da mutação |
| Recibo inválido após preparar SQL | Não confirma o estado preparado no modelo |
| Gate fecha durante preparação | Executor não envia COMMIT |
| Gate fecha após COMMIT confirmado | Sucesso não é reclassificado como recusa; leituras seguintes são bloqueadas |
| Resposta de COMMIT perdida | Mesma chave/corpo é conciliada sem segunda marcação SQL |
| Operador sem atribuição | Consulta permitida, seleção e marcação recusadas |
| Evidência ausente | Serviço recusa antes da mutação |
| Campo privado extra na página | Erro, não lista vazia nem conteúdo renderizável |
| Reset da fixture | Só limpa dados sintéticos e contadores; não altera grants ou templates publicados |

A primeira execução desses cenários contra a fixture J demonstrou a ausência dessas fronteiras (15 cenários iniciais recusados pelo teste; não são 15 vulnerabilidades do produto). Depois da integração, a revisão acrescentou três cenários. Um deles revelou que o alias interno poderia ser enviado diretamente no header Origin; corrigi a ponte de TESTE para recusar esse atalho. Os outros dois foram controles de compatibilidade.

Os testes HTTP anteriores passaram a enviar a credencial e a origem sintéticas esperadas. Antes desse ajuste, quatro cenários antigos falharam porque a nova fixture realmente passou a autenticar. Nenhuma exigência do produto foi removida para recuperar o verde.

## 5. Provas executadas

| Verificação | Resultado desta sessão |
|---|---|
| Integridade da entrada J | 160 hashes internos e76 hashes de fonte conferidos |
| Baseline J reconstruído e executado novamente | 586/586 aprovados |
| Novos cenários | 18/18 + agrupador,19 verificações Node |
| Conjunto focal final | 605/605, zero falhas/skips/cancelamentos/TODO |
| Typecheck focal | Aprovado, TS5.8.3 e @types/node25.1.0 globais |
| Sintaxe Python da suíte | Aprovada |
| Mutações de cobertura | Três detectadas com falha específica; fontes restauradas |
| Chromium | Navegação inicial bloqueada antes de carregar a página |
| PostgreSQL desta rodada | Não reexecutado; aprovação J preservada |
| CI integral da K | Não executado, incorporação remota bloqueada |
| Build/instalação pelo lock/audit da K | Não executados |
| Revisão | Autorrevisão em passagem separada; independente pendente |

As três mutações retiraram, separadamente, a restrição de método do handler, a comparação do escopo persistido e a comparação de autoria do recibo. Cada uma foi detectada pelo cenário correspondente. As alterações deliberadamente incorretas ocorreram SOMENTE no harness local de teste e foram restauradas; não fazem parte do pacote de produto.

O recorte local foi reconstruído a partir dos arquivos entregues e de dependências do repositório conferidas por Git blob. O primeiro ensaio encontrou ausência de resolução do pacote TypeScript; foi corrigida somente a montagem do harness com a ferramenta global já instalada. Isso não equivale a `npm ci`, não altera package/lock do produto e não é uma falha de regra de negócio.

A tentativa do navegador foi com a suíte original, antes de trocar a fixture, e recebeu `ERR_BLOCKED_BY_ADMINISTRATOR` ao navegar para o loopback próprio. Não alterei políticas, proxy, restrições de rede ou flags para contornar esse bloqueio. A suíte da K foi preparada e teve sintaxe verificada, mas não foi homologada visualmente. **Nenhuma screenshot nova ou aprovação de CSS/foco/teclado/mobile foi fabricada.**

## 6. Limites e próximo aceite

Esta entrega melhora a prova de integração local. Não monta o checklist no aplicativo publicado, não qualifica IdP/diretório, não promove os candidatos SQL, não publica templates/bindings e não encerra RF-CEN-07 operacionalmente. O ensaio de falhas da fixture não prova concorrência, rollback ou durabilidade PostgreSQL; essas afirmações continuam vinculadas aos 31 testes aprovados da J, não aos novos modelos.

O próximo passo continua sendo aplicar a composição cumulativa no PR30 pelo fluxo autorizado e executar o CI da fonte completa, incluindo a nova suíte de navegador e os cenários SQL. Depois: fechar armazenamentos/workflow, proteção integral das escritas terminais, templates e vínculos qualificados, migration/upgrade próprios e revisão independente. Não abrir outro módulo para substituir essa integração.

Fonte cumulativa preserva as correções do login simples e do painel pós-login, sem modificar essas telas ou reativar recursos avançados. Escopos de Thiago, fatores Auth,12migrations históricas e release gate permanecem sem alteração desta rodada.
