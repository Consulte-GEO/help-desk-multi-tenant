# Plano atualizado — E04 / HD-DA-CADASTROS

**14/10/2026 · Versão 2.0+E04.** Principal observada: `164113065839f3f985404b6ec812da311b6ade1d` (PR42). O plano V2 e os 81 aceites permanecem como referência.

| Pacote | Situação |
|---|---|
| HDA-00 | Parcial; instalação, autenticação dedicada, modelo, CLI e API/IdP reais ainda precisam de qualificação |
| HDA-01 | Contratos locais preservados; .NET e integração integral pendentes |
| HDA-02 | Parcial; E03 preservada; PostgreSQL17, upgrade real, publicador, cotas/retencão e promoção pendentes |
| HDA-03 | Não iniciada; abertura + intenção + tarefa devem compartilhar a transação original |
| HDA-04 | Recorte analysis-worker implementado e testado localmente com processo sintético; não montado e não operacional |
| HDA-05 | Contrato candidato de prévia preservado; origem não qualificada |
| HDA-06 | Interface de revisão de rascunho não implementada |
| HDA-07 | Aprovação da execução não implementada |
| HDA-08 | Escrita idempotente na origem não implementada |
| HDA-09 | Callback/conciliação da execução na origem não implementados |
| HDA-10 | Resultado público/notificação HDA não compostos; conservar Resend existente |
| HDA-11 | Piloto não iniciado |
| HDA-12 | Criação de usuário + IdP não implementados |
| HDA-13 | Expansão por tipo de cadastro não iniciada |

## Próximos blocos e critérios verificáveis

**E05 / qualificação integrada, prioridade de fechamento.** Recuperar checkout integral e deps pinadas em Linux apto. Aplicar o overlay reconciliando trabalho concorrente. Executar testes/build/contratos/segredos/migrations e o runner PostgreSQL17 próprio. Em seguida executar o candidato sobre a cadeia completa de migrations e os papéis reais em outro cluster descartável, sem produção. Guardar uma evidência única por fonte. Se PG17 continuar indisponível, registrar o bloqueio e não chamar inspeção estática de aceite nativo.

**HDA-00 / host de análise.** Confirmar onde roda o Dev Agent atual. O adaptador E04 é candidato Linux/WSL sob usuário não-root; não migra o host nem promete suporte nativo Windows. Qualificar o binário exato, flags, modelo, limites e autenticação. O modo bare desta versão usa chave de API dedicada, não assinatura OAuth pessoal. Qualquer alternativa de autenticação requer decisão registrada, sem copiar HOME/cookies do operador ou remover proteção da sessão atual.

**HDA-02 / composição.** Publicar o binding por fluxo autorizado, nunca pela fixture. Compor `RegistrationAnalysisTransactions.run` com o `runTransaction` existente e seu guard de admissão, conferindo antes/depois de esperas e antes de COMMIT. Vincular identidade do worker a direitos próprios; não convertê-lo em usuário humano. Provar leitura/replay/revogação, limites de fila, recuperação e retenção. Só então gerar migration aditiva e atualizar catálogo de prontidão/manifest.

**HDA-03 / abertura atômica.** Após comprovar HDA-02, integrar a intenção e a tarefa à mesma conexão/transação da abertura. Provar chamada dupla, rollback tardio e resposta perdida preservando protocolo, snapshot e outbox de email. A família Cadastros e acessos não autoriza automaticamente todos os tipos.

**HDA-04 / operação de análise.** Compor claim/read/settlement com o banco qualificado e um supervisor do serviço, sem executar a CLI numa Netlify Function de abertura. Implementar seleção editorial de excertos e observabilidade mínima sem conteúdo privado. Qualificar isolamento do sistema operacional e da rede, credencial dedicada de modelo, limpeza e terminação da árvore de processos. O código de subprocesso não é, sozinho, um sandbox. Executar com fixture autorizada primeiro; só depois permitir um pedido real.

Manter decisões, aprovação humana, execução e notificação em entregas separadas. Não abrir flags de produção nesta continuidade apenas porque os testes locais passaram.
