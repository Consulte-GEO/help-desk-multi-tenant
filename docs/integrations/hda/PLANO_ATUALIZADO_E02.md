# Plano atualizado — HD-DA-CADASTROS / E02

**Base V2 preservada; checkpoint de execução E02 em 14/10/2026.** Última principal observada `a06c21a8ec828ad38b04dd4005137f2fca5b6eb5`. Este documento não altera o escopo aprovado nem anuncia implantação do fluxo.

| Pacote | Situação | Saída necessária |
|---|---|---|
| HDA-00 — qualificação | Parcial | Código/contrato real da API/IdP e configuração do host Claude; autorizações sem credenciais no documento |
| HDA-01 — domínio/contratos | Implementado e testado no subconjunto local | Integração/regressão do core e vetores .NET |
| HDA-02 — persistência | Parcial: análise/serviço/adaptador locais e SQL candidato | PostgreSQL17, core completo, migration/manifest/readiness; parte de aprovação/execução depende de HDA-07/08 |
| HDA-03 — abertura + tarefa | Não implementado | Mesma transação da abertura; ID de intenção persistente e eventos idempotentes; sem job duplicado em replay |
| HDA-04 — conector CLI | Não implementado | Host real, credenciais somente leitura, reserva confirmada, entrega do job autorizada, processo supervisionado/heartbeat e limites |
| HDA-05 — leitura/prévia Novo GEO | Contrato candidato da E01 | Leituras e prévias reais autorizadas, com ausência de efeitos demonstrada |
| HDA-06 — revisão de rascunho | Não implementado | UI, diferença entre revisões, correção/complemento, revisão de alvo por autorização renovada |
| HDA-07 — aprovação | Não implementado | Aprovação humana sobre conteúdo/efeitos/preview exatos e intenção de execução |
| HDA-08 — execução na origem | Não implementado | Endpoint restrito, idempotência persistente e recibo na transação de negócio |
| HDA-09 — callback/conciliação | Não implementado | Evento autenticado não substitui recibo da origem; tratar resultado desconhecido |
| HDA-10 — resultado/notificação | Não implementado | Reutilizar worker/email existentes, sem novo canal paralelo |
| HDA-11 — piloto | Não iniciado | Gates do core/origem/SQL/navegador/CLI/retorno e aceite registrado |
| HDA-12 — usuário novo + IdP | Não implementado | Saga, efeitos e convites separados, depois do piloto |
| HDA-13 — demais cadastros | Não implementado | Uma família qualificada por vez; sem executor genérico de tabelas |

## Sequência de continuidade executável

### E03 — fechar a evidência da persistência de análise

1. Reinspecionar principal, pacotes aplicados e alterações concorrentes. Aplicar apenas a diferença necessária; não copiar o contexto de verificação para o projeto.
2. Executar regressão integral da árvore real, tipos, contratos, lock, auditoria de dependências, segredo e build. Os 227 testes locais são uma parcela, não substituto dessa etapa.
3. Rodar o candidato em cluster PG17 descartável próprio com a suíte nativa. Comparar todos os hashes/vetores e estados Node↔SQL, incluindo NULL, Unicode, lease expirado, recibo antigo, rollback e concorrência.
4. Qualificar também a instalação sobre a base real de migrations em cluster descartável: fixture sintética do runner não prova compatibilidade do core. Cobrir RLS/grants vivos, catálogos de prontidão, defaults/owners, falta de associação indevida e upgrade/rollback.
5. Se aprovado, gerar a migration pelo procedimento oficial Supabase CLI, atualizar manifests/inventários e testes do mesmo commit. Não editar os 17 arquivos históricos nem o marcador isoladamente; não aplicar no ambiente hospedado nesta etapa.
6. Publicador de binding/escopo real, limites de fila, retenção e política de propostas devem ser qualificados antes de habilitar entradas de produção. Não converter as seeds do runner em dados reais.

### E04 — HDA-03 e primeira composição de análise

Usar a transação já existente da abertura para gravar intenção de análise. Preservar o protocolo/outbox de e-mail e recibo originais. O evento de abertura deve mapear para uma única operação de automação persistente; sucesso da abertura não afirma que a CLI foi executada. Campos das cinco ações/oito tipos atuais não ativam todos os cadastros automaticamente.

Depois, HDA-04 pode consultar a tarefa somente com lease confirmado e escopo atual. Um replay de claim retorna metadados, não autorização para relançar o modelo. Mecanismo de retomada/renovação deverá manter fencing e parar resultados tardios.

## Critério de conclusão

Cada pacote conserva estados separados: implementado, testado localmente, testado em PostgreSQL, navegador, deployado, homologado e operacional. Permanecem 81 casos de negócio previstos; nenhum foi promovido a aceite operacional por contagem de testes locais. Entregar ZIP cumulativo e handoff por incremento.
