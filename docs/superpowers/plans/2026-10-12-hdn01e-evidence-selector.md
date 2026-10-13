# HDN-01e — notas elegíveis no checklist

Objetivo: trocar a entrada manual cotidiana de IDs por seleção de notas já registradas pelo operador no mesmo chamado, sem corpo de nota, nova permissão ou prova de execução no GEO.
Arquitetura: extensão do serviço/store/HTTP atuais; contrato compartilhado limitado; seletor integrado à interface D. A escolha é consultiva, marcação e resolução continuam revalidando no servidor.
Base:6e06900, cumulativoHDN01abcd. Spec: handoffHDN01d §5 e RF-CEN-07/11.

## Restrições
- SQL19 não executado continua pendente. Não criar migration nem ligar fallback de memória.
- Listagem somente operador atualmente atribuído, todas as permissões de marcação preservadas.
- POST de consulta privada, corpo sem ator/conta: revisões e cursor exato; origem/autenticação/quota.
- 20 itens/página, busca21 para has-more, keyset descendente at+UUID. Sem COUNT/total inventado.
- Selecionar no máximo20; sem texto de nota/PII na resposta, URL, log ou evento público.
- Consulta não marca, não cria nota ou audit, não altera status/SLA.
- Erro, troca de item/contexto ou revisão descarta página antiga. Marcação unknown mantém sua intenção, sem consulta de seleção.
- Runtime/build/login/migrations/scopes/fixtures anteriores preservados salvo extensão intencional da mesma suite.

## Tarefas
- [x] Testes negativos do contrato: conta/ator/revisão/ordem/timestamp/cursor/extra/body/duplicado; observar RED e implementar contrato compartilhado.
- [x] Store de consulta parametrizada + serviço na mesma transação; testes de isolamento, current revision, false success/truncation, sem escrita, revogação.
- [x] Handler privado e seletor UI; testes de stale responses, perda de confirmação, teclado/cleanup, falha não vira sucesso vazio.
- [x] Integrar à fixture e suite browser existentes; tentativa real registrada, navegação bloqueada antes do carregamento.
- [ ] Aprovar execução dos23cenários SQL e navegador em ambiente apto; permanece pendente.
- [x] Reexecutar foco integral, types, patches e hashes. Documentar não executado. Gerar cumulativo e handoff.

## Foco da revisão
Paginação com mesmo timestamp/micros; resposta de outra conta; nota nova entre páginas sem duplicar as anteriores; seleção antiga após edição/cancelamento; corpo privado retornado por erro de adapter; progresso não é autorização; nenhum caminho de leitura concede write ou recolhe nota de terceiro.

## Fechamento da fatia local
358testes focais e tipos passaram. Quatro mutações detectadas. Candidato SQL preservado. Autorrevisão, sem revisão independente. Pacote e evidências conferidos separadamente; não converter estas verificações em aprovação de produção.
