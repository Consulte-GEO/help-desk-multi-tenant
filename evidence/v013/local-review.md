# Revisão local — v0.13.0

Base a0928abdff3b1bc01653c7af4a1b207af179d32e. Não houve subagente/revisor independente. Revisão do diff, regras existentes, contrato e limites do incremento.

| Verificação | Resultado |
|---|---|
| Fonte única das ações | ticketActions chama canReadTicket, canReadInternalNote, canWriteInternalNote, isOperator, hasScope, canTransition e assignmentView; máquina duplicada removida do app. |
| Mutação revalida | Fluxos anteriores inalterados. Testes negam comando após retirar scope e após editar hints no cliente. |
| Cache/histórico | GET somente; não altera TicketDto/lista/StoredResult ou banco. ETag é versão do recurso, não versão de permissões. |
| Nota opcional | Sem read_notes não há fetch de notas. Falha limpa página privada, mascara flags de nota localmente e mantém página pública íntegra. Motivo de falha bruto não é exposto. |
| Rascunho | Pausa no refresh não troca canal privado para público; queda da capacidade de nota exibe somente rascunho público, conservando rascunho pessoal privado em memória da mesma identidade. |
| Controles | Mensagens, nota, transição, prioridade e atribuição verificam hints; servidor ainda autoriza. Histórico mantém política existente de operadores, não foi convertido em leitura de texto de notas. |
| Respostas antigas | Predicate de geração/epoch antes de lançar leituras filhas e antes de aplicar resultado. Troca de identidade é tratada pela camada de sessão anterior. |
| Wiring | IDs HTML e arquivos importados conferidos automaticamente; erros iniciais de notas/assets corrigidos. Não é execução DOM. |
| Contrato | TicketDetail e TicketActions fechados; validadores estritos de consumidores precisam atualizar o schema GET. Novo frontend não suporta backend antigo que omite hints. |
| Texto | Teste da leitura com Unicode suplementar reproduziu falha e passou após alinhar limite existente; sem mudança na regra de escrita ou normalização silenciosa. |
| Cenário de smoke | new→resolved inválido no teste novo; corrigido para new→open→resolved. Workflow não foi relaxado. |
| Dados/efeitos | Oito migrations e regras de acesso do banco intocadas; sem novos scopes ou instalação de dependências; sem escrita remota. |

Riscos remanescentes: banco/driver/provedor e DOM ainda não homologados; permissão pode ser revogada entre GET/comando; usuário pode ver hint antigo até atualizar, mas comando continua revalidando. Nota opcional não concede maior disponibilidade que a autenticação real. Leitura de páginas posteriores continua usando o estado de conversa anterior e a validação do servidor; o novo validador é para a composição inicial/refresh do detalhe. Não apresentar este incremento como auditoria completa de browser ou revogação instantânea.
