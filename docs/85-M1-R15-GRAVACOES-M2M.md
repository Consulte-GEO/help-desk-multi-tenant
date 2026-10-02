# M1-R15 — Gravações M2M na suíte de aceitação existente

## Base e prioridade
R14 recuperado com fingerprint `722e5bb449cd4844f7b08d224a60bcf57367f39b4f2032ccb5b9730cae59b101`: 1.347 testes aprovados nesta rodada antes de alterar código. Remoto observado: R9 `78bbb00112331531168ae24600604cb7f3148770`. M1 segue aberto; dependências/driver/PostgreSQL hospedado não estão aprovados por esta recuperação.

O R12 entrega gravações por solicitante e agente e deixa gravações M2M no backlog. Esta extensão cobre esse recorte usando o MESMO comando `test:hosted:write`, transporte e endpoints, sem criar outro serviço, comando, ferramenta ou permissão. A execução efetiva do CI e da aceitação hospedada continua sendo o fechamento necessário, não é substituída pelos testes da suíte.

## Especificação objetiva
- A configuração schema 1 passa a aceitar o campo opcional booleano `includeMachineWrites`. Ausente/false preserva exatamente as 18 verificações humanas e suas chaves. True exige hash de configuração diferente e acrescenta 21 verificações M2M. Não ativar implicitamente o novo bloco em arquivos antigos.
- Preservar os 28 controles prévios de leitura R10. Conferir identidade, conta, instância e capacidades da integração e sua cobertura ANTES da primeira gravação, inclusive humana.
- A integração A cria seu próprio chamado com chave derivada de executionId em namespace separado `machine`; recebe uma mensagem própria, com actor_type integration. Replays são cenários explícitos, sem retry de erro.
- Recusar gravação da integração em conta B, instância B, chamado humano A, nota interna e prioridade. Recusar mensagem do solicitante A no chamado da integração. Testes de produto/conta usam os controles positivos A/B do R10.
- Conferir replay histórico de criação versão 1, estado atual versão 2/normal, mensagem única e timeline pública com criação/mensagem. Solicitantes A/B não leem o chamado da integração. Busca autorizada da integração retorna exatamente um chamado da execução, sem páginas pendentes.
- Chaves de tentativas recusadas são distintas. Preservar chaves e recibos no relatório sanitizado, nunca criar outra intenção automaticamente após incerteza. Nova invocação com a MESMA configuração só é recuperável enquanto retenção, identidade e autorizações permanecerem compatíveis.
- Mantêm-se limites de 5 s / 64 KiB por resposta, sem redirecionamentos/retries, relatório sem tokens/texto privado e flags de PostgreSQL/atomicidade/operação false. Nenhuma limpeza automática de chamados.

## Plano local
1. Escrever regressões de opt-in, plano legado, confirmação, caminho completo, recusas e perda de respostas; executar RED.
2. Ampliar o cliente existente e seu exemplo separado; executar regressões e corrigir causas, não remover asserts.
3. Rodar suíte completa, gates disponíveis, uma cópia limpa de integração; registrar bloqueios reais.
4. Atualizar handoff/backlog e empacotar variantes cumulativa R10–R15 e somente R15 sobre R14 exato.

## Restrições e revisão
Não alterar core/SQL/API/permissões, lock ou 11 migrations; não chamar memória/sockets de Auth/PostgreSQL reais. Nenhuma autorização histórica permite push/deploy/mutação externa. Rever em especial consentimento antigo, deriva de identidade/cobertura, duas autorias na mesma conta, resposta perdida e efeitos de tentativas recusadas. Revisão nesta sessão pelo próprio executor; revisão independente segue pendente.

## Resultado da revisão local
Foram implementados os21passos, com17regressões novas e1364aprovaçõesNode. Primeira expectativa para conta/produto foi corrigida para404/resource_not_found após ler deny() e observar o handler; notas/prioridade permanecem403. TS18046 na verificação de scopes foi reproduzido e corrigido; typecheck suplementar passou. Core/autorização/SQL não foram alterados. Evidências detalhadas em docs86. A versão de configuração, sem opt-in, preserva o percurso anterior.
