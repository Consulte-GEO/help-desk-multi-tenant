# Plano revisado — Implantação e Importações R05

**Cumulativo R01–R05 · candidato 5.0.22-56 · base remota dcf5607.**

## Estado após esta rodada
| Bloco | Evidência existente | Pendência |
|---|---|---|
| IMP-00 baseline/contrato de destino | HEAD consultado e arquivos de referência | Checkout completo, build pelo lock e contrato real do receptor |
| IMP-01 integridade | Motores, agrupamentos e ponte com regressões focais | XLSX real, todos os gates originais e aceitação no destino |
| IMP-02a processos/revisões | Serviço, adaptador PostgreSQL e DDL candidato | PostgreSQL real, isolamento, reinício e restore |
| IMP-02b HTTP/recuperação | Handlers, cliente, journal e binding cumulativos | Sessão/autoridade reais, perda de resposta e reload nativo |
| IMP-02d painel R05 | SFC, Options API, edição auditável e rota preparada | Montagem real com Vuex/vue-router e backend qualificado |
| IMP-02 arquivos | Registro/verificação de metadados | Upload imutável, scanner, downloads e purge |
| IMP-03 Help Desk | Contratos/proposta anteriores | Vínculo ao chamado e notificações reais |
| IMP-04…IMP-13 | Preservam estado do plano original | Não concluídos por esta rodada |

## Próximo lote obrigatório: fechar as dependências reais

### 1. Integrar em checkout completo, sem abrir flags
Ler instruções atuais, comparar HEAD e branches concorrentes. Aplicar somente R05 sobre base sem R01–R04 ou reconciliar delta. Não forçar hashes do aplicador. Executar npm ci pelo lock, build, typecheck, smoke, contraste, XLSX, laudos, visão, intake e importação, além das duas suítes cumulativas. O número 418 não substitui esses gates.

### 2. Qualificar biblioteca e rota
Registrar `importProcess` com Vuex 4 real, preservando setup/validation/export. Montar `/admin/processos/:caseId?`, autenticar pelo host existente e testar indisponibilidade, entrada de processo autorizado, alteração de parâmetros, confirmação de saída, módulo substituído, login/troca de conta e teardown. O ID na URL não autoriza acesso. Guard de frontend não deve ser usado como isolamento.

### 3. Qualificar banco
Usar o qualificador em PG17 local descartável, usuário não-root e driver pg instalado pelo ambiente de desenvolvimento. Não usar produção como substituto. Executar constraints/RLS, concorrência e replay; acrescentar reinício físico, restore, perda de conexão no COMMIT e pool. Manter DDL candidato fora das migrations até a revisão desses resultados.

### 4. Construir portas de produção
Conectar pool restrito, sessão, localizador de escopo e rate limit reais. Binding registrado somente depois de contexto autorizado e capacidade do servidor confirmados. Não desserializar funções/autoridade do navegador e não criar usuário/conta sintéticos na aplicação. Conectar journal nativo com identidade atual, mantendo limpeza no logout e preservação na desmontagem.

### 5. Validar jornada no navegador real
Usar sessionStorage nativo e recarga após salvar/antes de confirmar. Recuperação deve ser GET, sem novo POST ou revisão duplicada. Testar recibo ausente, auth revogada, duas abas, quota de storage, namespace substituído, pending, conflito, saída e descarte. Testar edição de texto numérico, zeros, ilegível, original preservado, mudanças obsoletas e documentos com marcação HTML. Interface deve exibir processo/versão/recibo corretos mesmo ao retomar um processo anterior ao pedido pela URL.

### 6. Completar arquivos
Upload privado, verificação de bytes imutáveis e versão, scanner, links autorizados e retenção/purge. Manter segregação de metadados e download; o painel não deve apresentar “arquivo seguro” com base apenas em nome/tamanho declarado.

## Critério de conclusão IMP-02
Usuário autorizado retoma a mesma revisão; outra conta não lê; concorrência preserva edição; ACK perdido se recupera sem repetir efeitos; arquivos inseguros não entram no snapshot; auditoria e recibos sobrevivem a reinício/restore; UI distingue salvar de exportar/importar; aceite real e evidências pertencem à mesma fonte.

## Depois do fechamento
IMP-03 conecta ao chamado e suas comunicações. Em seguida, ampliar cadastro/triagem/histórico/OCR, plano de execução aprovado, Dev Agent, executor de um destino e conciliação. Nenhuma interface de sucesso deve antecipar essa implementação.
