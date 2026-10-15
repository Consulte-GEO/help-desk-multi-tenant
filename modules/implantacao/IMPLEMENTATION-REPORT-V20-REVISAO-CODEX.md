# R05 — integração, revisão e qualificação em 15/10/2026

R01–R05 foram integradas no checkout completo sobre `dcf5607`, após conferir 285 hashes do pacote cumulativo. Fonte executável qualificada: `e8fe0708097afb808a5054fe5400f1e25677abaa`; [CI Linux](https://github.com/Consulte-GEO/setup-implantacao-obras/actions/runs/38677189647), repetido com sucesso no PR13 pelo run38677194191. Commit, merge e publicação autorizados diretamente pelo mantenedor nesta conversa, sem Claude.

## Problemas corrigidos

- Typecheck/build da aplicação falhavam com imports `.ts` e `Object.hasOwn`: habilitados imports de tipos no fluxo `noEmit` e biblioteca ES2022, preservando target e padrões existentes.
- Snapshot válido de 3.600 resultados ultrapassava o limite ao ser duplicado no estado; a tela permanecia em loading. Cópia independente de dados e rascunho no controlador e mutation Vuex mantém os limites do parser de entrada.
- Correção decimal aceitava `9007199254740991.1` e gravava `9007199254740991`. Comparação decimal normalizada recusa arredondamento e underflow, preservando decimais comuns e originais.
- Falha ao reler storage após persistir marcador deixava uma operação nunca enviada irrecuperável. Agora faz compare-and-clear ou mantém `cleanup_required`, sem consulta de recibo nem POST de uma intenção não enviada.
- Seis vulnerabilidades reportadas pelo npm audit, cinco altas: Vue3.5.42, Vite6.4.3 e plugin-vue5.2.4 compatível, com lock atualizado e dependências transitivas corrigidas. Auditoria integral e de produção: zero. A manutenção de segurança substitui a referência histórica ao Vite5; arquitetura Vue3/Vuex4 foi preservada.
- Runner dependia do reporter implícito do Node: TAP explícito no teste do cwd. Asserção legada de versão exata51 foi corrigida para manter o piso51 e aceitar releases posteriores; verificações de scripts permanecem exigidas.
- A simulação de ACK perdido encerrava socket antes de headers, permitindo repetição transparente do Chromium. Resposta parcial com timeout finito comprova resultado desconhecido e replay sem duplicação.

Os seis novos cenários de regressão falharam antes da correção e passaram depois; revisão independente Codex confirmou os três defeitos de produto corrigidos e executou 59 testes focais sem falha.

## Resultado no checkout completo Linux

| Gate | Resultado |
|---|---|
| Instalação pelo lock, tipos integral/servidor/cliente e build SFC/Vite | Aprovados |
| Smoke / contraste | 627 / 89 aprovados |
| Writer XLSX | Aprovado |
| Laudos / integração Deno do provedor simulado | 105 / 28 aprovados |
| Integridade / processos | 138 / 286 aprovados, sem skips |
| Intake / similaridade / implantação | 27 / 21 / 23 aprovados |
| PostgreSQL17.11, driver8.16.3, cluster próprio | 11 aprovados, cleanup confirmado |
| Chromium ponte / HTTP / painel Vue | 10 / 8 / 16 aprovados |
| Auditoria npm | Zero vulnerabilidades |

Evidências com SHA256 em `evidence/codex-r05-20261015/ci-source.json`. Capturas desktop claro e celular escuro foram inspecionadas. No celular a tabela exige rolagem horizontal e isso permanece explícito na interface.

As falhas iniciais foram preservadas na área privada de análise: configuração TypeScript, versão exata legada, smoke sensível a CRLF, sockets/symlinks restritos no Windows, falta de Deno, instalação inicial PG17 e simulação de ACK. Nenhum SKIP foi tratado como aprovação; o CI final executou Deno, HTTP e PostgreSQL reais em ambiente descartável.

## Limites de liberação

SQL continua candidato, sem migration remota. O teste nativo usa identidades/arquivos sintéticos e verifica isolamento, concorrência, replay e reabertura de pool; não comprova reinício físico/restore de produção. Vuex real é exercitado nos testes Node; o painel Chromium usa o store-port explicitamente simulado. Não houve jornada autenticada completa do produto com backend/storage de produção.

A rota administrativa existe e permanece indisponível sem binding real autorizado. Ainda faltam portas hospedadas, storage/scanner, qualificação de logout/reload nativos do produto e vínculo com chamado/Dev Agent. IMP-02 permanece parcial; salvar revisão não aprova nem executa importação. Nenhum cliente fictício, segredo ou concessão foi publicado.

PR13 mesclado em `c9856091b91b7609935507b063fac5cb832ecc7b`, publicado no Netlify pelo deploy `6ad04c45232e0761cbda8c49`. https://setup.consultegeo.org respondeu200; seis assets de entrada responderam200 e quatro fontes estáticas de importação corresponderam byte a byte ao commit Git. Evidência: `evidence/codex-r05-20261015/publication.json`. Supabase permanece ACTIVE_HEALTHY, sem escrita remota nesta revisão.
