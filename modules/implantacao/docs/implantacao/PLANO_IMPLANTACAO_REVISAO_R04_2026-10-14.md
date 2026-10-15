# Plano revisado — Implantação e Importações R04

**14/10/2026 · candidato 5.0.22-55 · cumulativo R01 a R04.** Próximo objetivo é qualificar e montar os módulos já construídos, não acrescentar estados de aprovação aparentando operação inexistente.

## Estado
| Entrega | Estado verificável após R04 | Falta para concluir |
|---|---|---|
| IMP-00 baseline/destino | Base remota confirmada; checkout integral indisponível no container | Build e gates pelo lock, receptor e contrato efetivo |
| IMP-01 integridade | Núcleo/ponte cumulativos testados focalmente | App real com XLSX e receptor |
| IMP-02a persistência | Serviço e SQL candidato | PostgreSQL real, RLS/privilégios, restore/durabilidade |
| IMP-02b transporte | Handler/cliente testados; 8 cenários TCP/HTTP com banco simulado | Montagem com portas de identidade e dados reais |
| IMP-02b recuperação R04 | Consulta de recibo, journal e novo controlador testados | sessionStorage nativo e hard reload real no navegador |
| IMP-02b integração Vuex R04 | Binding dinâmico e projeção de estados testados em harness | Vuex 4 real pelo lock e componente/tela montados |
| IMP-02 arquivos | Metadados e porta de inspeção | Upload, bytes imutáveis, scanner, download e purge |
| IMP-03 Help Desk | Não montado | Vínculo/protocolo/eventos idempotentes e comunicação |
| IMP-04 a IMP-13 | Mantêm parciais/não iniciados do plano original | Não concluídos por esta entrega |

## Lote seguinte: fechamento verificável do IMP-02

### 1. Integrar o cumulativo numa árvore completa
Confirmar HEAD/branch/instruções e concorrência; aplicar R04 somente sobre a base sem pacotes anteriores. Instalar pelo lock, compilar toda a aplicação e repetir suites legadas/focais. Não considerar os 367 testes locais substitutos do build nem a pasta codigo um repositório completo.

### 2. Qualificar o banco antes de montar a escrita
Executar qualificador PG17 em banco descartável; corrigir defeitos por testes reais preservando ACLs/RLS. Testar papel restrito, versões concorrentes, replay, perda ambígua de COMMIT, reinício físico, restauração e queda do pool. Não criar migration hospedada até revisão dos resultados. O DDL candidato não mudou na R04.

### 3. Construir as portas de produção
Reutilizar sessão e diretório autorizados do Setup/Help Desk, respeitando decisões de origem M08 ainda não qualificadas. Nada de usuário, conta ou obra autorizados por texto livre. Montar rate limit, pool restrito, timeouts e scanner reais. Não publicar fixtures de teste. Manter capacidade false até aceites.

### 4. Registrar módulo Vuex e montar tela
Usar `registerImportProcessSession` sem substituir stack. Depois da sessão/capability: registrar, restorePending, retomar processo. Componente deve apresentar `presentation.serverVersion` e `receiptVersion` separadamente. Conectar guardas de edição e aviso de saída; evitar perda de edição no conflito. Desmontagem chama dispose; logout/troca de escopo chama endSession.

### 5. Validar a recuperação no browser real
Com requestHash e recibo corretos, cortar resposta depois do commit, recarregar e confirmar recuperação GET sem novo POST/revisão. Com escrita não executada, recibo ausente precisa continuar pendente. Refazer com auth revogada, quota, marcador malformado, duas abas e respostas tardias. Ausência de recibo e perda do conteúdo original exige procedimento assistido, não tentativa automática de "salvar de novo".

Escopo aceito da R04: o marcador é por sessão da aba e recupera confirmação de saveRevision. Não preserva rascunhos não enviados; não cobre fechamento de aba, outro dispositivo ou intents de criação/arquivos. Não ampliar alegações sem ampliar os testes e o armazenamento autorizado.

### 6. Completar arquivos privados
Implementar envio limitado, confirmação pelos bytes/versionamento imutável, scanner, URLs privadas de download, retenção e purge com recibos. Verificação de metadados não é upload; política de retenção gravada não é descarte executado.

## Aceite do IMP-02
Uma pessoa autorizada retoma a mesma revisão em outra sessão/dispositivo; outra conta não lê; colisão de versões preserva edição; confirmação perdida se recupera sem duplicação; arquivo inseguro não alimenta snapshot; histórico e recibos resistem a reinício/restore; UI distingue gravado, exportado e importado; evidências reais e aceite operacional pertencem à mesma versão.

## Evolução após esse gate
Só então avançar IMP-03 com vínculo ao chamado, notificações e projeções, seguido de implantação guiada/triagem/histórico/OCR, plano aprovado, Dev Agent e execução/conciliação. Não escrever diretamente no sistema de destino usando permissões amplas para contornar o gate.

## Regras de continuidade
Cada rodada deve entregar código cumulativo, handoff, relatório e plano. Distinguir implementado, teste focal, banco real, navegador, deploy e operação. Registrar limites de ambiente com exatidão. Nenhuma autorização de publicação remota decorre de um teste local aprovado.
