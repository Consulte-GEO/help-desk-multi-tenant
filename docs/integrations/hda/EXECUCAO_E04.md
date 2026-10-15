# Execução E04 — processador de análise e conector Claude candidato

**14/10/2026 · HD-DA-CADASTROS · V2.0+E04.** Implementação local do recorte independente HDA-04.analysis-worker, cumulativa E01–E03. **Não é integração operacional.**

## Base e escolha do incremento

A E03 foi recuperada do ZIP original, com 275 testes do subconjunto aprovados antes das alterações. O repositório remoto foi reinspecionado pelo conector GitHub: principal `codex/m1-reproducibilidade`, commit `164113065839f3f985404b6ec812da311b6ade1d` (PR42, diagnóstico de respostas operacionais). Essa inspeção não é auditoria completa nem validação hospedada.

PostgreSQL 17, `pg` e checkout integral não estão disponíveis. Clone/download tiveram falha de resolução DNS; tentativa pelo downloader disponível também falhou. O runner nativo permaneceu bloqueado com `executed:false`. Não houve alteração da rede, remoção de guardas, criação de ambiente remoto ou uso do Supabase como banco de teste.

A V2 permite desenvolver HDA-04 sem credenciais de execução com fixtures e flags desligadas (`03_DEPENDENCIAS_E_CONFLITOS_V2.md`, seção de paralelização). Por isso foi desenvolvido esse recorte, em vez de declarar HDA-02 concluída ou repetir apenas a inspeção estática do SQL.

## Entregue

Sete módulos novos: parser do JSON bruto, montador de contexto mínimo, contratos do processador, worker de uma iteração, configuração da CLI, supervisor de subprocesso e adaptador Claude. Há três arquivos de testes novos e uma fixture de processo sintético.

O worker utiliza a persistência existente por porta transacional. Só chama o modelo após a reserva ter sido confirmada pelo dono da transação. Reautoriza ao carregar o estado, após carregar documentação e antes de registrar o resultado. Não mantém transação durante a chamada ao processo. A confirmação incerta retorna metadados para conciliação; nunca transforma a incerteza em outra chamada ao modelo ou em um comando compensatório de falha.

O resultado identifica a chave estável da liquidação e, quando conhecida, sua finalidade (`complete` ou `fail`). Nenhum texto de saída ou erro bruto entra nesse diagnóstico. Repetição de claim não fornece outra reserva. Desativação/cancelamento interrompe o processamento e não aprova nem cria cadastro. O monitoramento contínuo de revogação depende do host; aqui há revalidação nas fronteiras descritas.

A CLI candidata usa binário com SHA256 e versão exata, `shell:false`, diretório/home privados, ambiente explícito, nenhuma ferramenta/MCP, timeout e terminação de grupo de processo. A saída bruta é limitada e parseada antes de qualquer proposta. Custos e metadados de sessão do fornecedor não são usados como autoridade nem persistidos.

Anexos não qualificados e documentação ausente/divergente levam à revisão manual sem invocar o modelo. Conteúdo da wiki exige igualdade entre texto, hash e referências da tarefa; a aprovação editorial continua obrigação do publicador da referência, não é concedida pelo hash.

## Evidências da rodada

| Camada | Resultado |
|---|---|
| Node do subconjunto cumulativo | 345 testes aprovados; zero falhas/cancelamentos/skips |
| Novos testes E04 | 70: 27 parser/contexto, 20 supervisor/CLI e 23 worker/recibos |
| Integração local completa deste recorte | Fila em modelo transacional → processo sintético real → parser → rascunho; sem banco ou IA reais |
| TypeScript focado | Aprovado com TS5.8.3 e @types/node22.19.7 disponíveis localmente |
| Vetores Python | 14 válidos + 12 inválidos; zero falhas; .NET não validado |
| PostgreSQL 17 | Não executado; pré-requisitos ausentes |
| Claude real / API / IdP / navegador | Não executados |
| Checkout completo / build / npm ci / audit | Não executados |

Os testes com subprocessos rodaram como usuário Linux sem root. A fixture é um executável Node que emula o protocolo CLI, sem chamadas à rede, sem Claude instalado e sem credenciais reais. A chave de teste é um literal sintético. Não foi usada a assinatura pessoal do Claude nem gasto crédito de IA.

A checagem inicial de tipos utilizou a instalação disponível de @types/node25.1.0; a checagem final foi repetida com @types/node22.19.7. O lock real fixa outra versão (22.15.30), portanto o typecheck da árvore integral continua obrigatório. Uma rodada de teste executada como root recusou corretamente a fixture do supervisor; a regressão foi reexecutada sem root e os logs foram preservados. Nenhum teste foi ignorado para obter aprovação.

## Correções encontradas na autorrevisão

1. Desativação após a escrita preparada e antes da confirmação não era propagada ao dono da transação. A porta passou a exigir a função de admissão e o worker a fornece em todas as transações. O teste comprova rollback no **modelo**, não no PostgreSQL.
2. Falha de criação de diretório podia devolver caminho privado. Erros não tipados são convertidos em erro seguro sem causa/path/stderr.
3. Recibo de outro contexto podia copiar o identificador da operação para o diagnóstico antes de ser recusado. A atribuição agora só ocorre depois da conferência de contexto e hash.
4. A resposta de confirmação desconhecida passou a informar a finalidade da liquidação, quando conhecida, para permitir consulta do recibo sem inventar um novo comando.

Os testes negativos foram observados falhando antes das correções e passando depois. A revisão foi autorrevisão; não houve revisor independente.

## Limites preservados

Nenhum arquivo anterior da E03 foi modificado. SQL candidato, migrations, schema/version marker, configurações e permissões hospedadas permanecem intactos. Nenhum hook de abertura, endpoint HTTP, cron ou conexão da CLI ao atendimento foi montado. Não houve push, merge, deploy, convite, email, consulta ao GEO ou criação de cadastro.

HDA-02 continua parcial. HDA-03 não foi iniciada. HDA-04 tem código local testado, mas host/CLI real, SQL, observabilidade e montagem ainda pendentes. Os 81 aceites de negócio continuam pendentes de comprovação integral; 345 testes técnicos não significam 345 funcionalidades nem homologação operacional.
