# Relatório de implementação — R04

**Data:** 14/10/2026 (America/Sao_Paulo). **Alvo:** Consulte-GEO/setup-implantacao-obras. **Base remota lida:** dcf5607652281bb688f366e6a4f05e07eb698d31. **Candidato:** 5.0.22-55. **Cumulativo:** R01 + R02 + R03 + R04.

## Entrega
Consulta autorizada de recibo no serviço/HTTP/cliente; marcador mínimo de recuperação por aba; controlador com recuperação somente por GET após reconstrução; ligação dinâmica ao Vuex; apresentação de estados e guardas; correção do ciclo de vida; aplicador R04 e ajuste de isolamento de teste. Não adiciona dependências, não altera migrations nem SQL candidato e não habilita runtime.

O benefício testado é recuperar a confirmação de uma gravação cuja resposta se perdeu sem possuir o conteúdo original em memória e sem repetir a importação/gravação. A fonte de confirmação continua sendo o recibo autorizado do servidor, não o storage do navegador. Com recibo ausente, preserva incerteza, sem afirmar rollback e sem produzir novo UUID/POST.

## Alterações de produto
1. `service.ts`, `contracts.ts`, `http.ts`: GET de operação atual, restrito ao ator e escopo vivos. Hash e conteúdo da revisão também são conferidos ao validar recibos. Não devolve conteúdo do pedido.
2. `client.ts`: valida envelope, requestHash esperado e versão/ETag.
3. `recovery-journal.ts`: permite somente metadados mínimos; recusa campos extras, troca de identidade, sobrescrita de marcador pendente, falha de readback e limpeza não efetivada. Sem localStorage ou tokens.
4. `controller.ts`: marca antes do envio, recupera após reconstrução, preserva confirmação quando cleanup falha, evita callback tardio após logout e distingue detach de clearSession.
5. `vuex-binding.ts`, `presentation.ts`: namespace próprio e estado por sessão; gate explícito; preserva módulos anteriores; diferencia versão consultada de versão confirmada. Binding entregue, mas não registrado no store publicado.
6. Aplicador R04 mantém os cuidados de origem e hashes; incrementa candidato sem mudar resoluções do lock nem iniciar deploy.

## Testes desta sessão
| Verificação | Resultado | Alcance |
|---|---:|---|
| Suíte cumulativa de integridade/aplicadores/exportador | 127/127 | Node; não é app Vue completo |
| Contratos/processos/HTTP/cliente/recuperação/Vuex | 240/240 | Node; storage/identidade simulados |
| Total das duas suítes | **367/367** | 0 fail, 0 skipped, 0 cancelled, 0 todo |
| Cenários com TCP/HTTP reais | 8, dentro dos 240 | Quatro novos; repositório e identidade sintéticos |
| SimilaritySelfTest | 21/21 | Reexecutado |
| Chromium offline da ponte cumulativa | 10/10 | DOM e colaboradores sintéticos; sem XLSX real |
| Typecheck estrito servidor e cliente | Aprovado | TypeScript global 5.8.3, Node 22.16.0 |
| Chromium via HTTP local | Bloqueado | ERR_BLOCKED_BY_ADMINISTRATOR antes das assertions |
| PostgreSQL | Bloqueado, exit 2 | Sem binários PG17/driver pg e execução como root; zero queries |

A base R03 foi reexecutada: 123/123 integridade e 166/166 processos. Houve falhas iniciais porque o pacote incremental não continha normalizationService no local de execução e o cwd não era a raiz de código; o arquivo de baseline foi copiado exclusivamente para a montagem local de testes e o contexto foi corrigido. Isso não transformou o pacote em clone completo.

A revisão detectou um problema real no teste do qualificador quando iniciado por npm a partir de frontend: ele resolvia o script pelo cwd. Agora usa caminho relativo ao próprio arquivo. Um teste de subprocesso separado prova o caso, isolando NODE_TEST_CONTEXT para não receber saída interna em vez de uma execução independente. O cenário negativo original (exit 2 e bloqueio) não foi removido.

## Revisão
Revisão feita pelo próprio autor, não por agente independente. Foram examinados transações, escopo, composição do hash, armazenamentos locais, corridas, limpeza e registro do módulo. Achados corrigidos com regressão RED→GREEN: teardown da tela apagava o marcador; binding antigo podia limpar marcador de montagem nova; teste do qualificador dependia do cwd. Todos os testes da entrega foram reexecutados depois das correções.

Os logs vermelhos e verdes ficam em `evidencias/r04/`. Tests escritos depois de funcionalidades existentes (como os quatro cenários TCP adicionais) foram usados como cobertura complementar, não apresentados como o RED original. Os novos comportamentos de serviço, journal, controlador, binding e aplicador tiveram testes falhando antes da implementação.

## Limites obrigatórios
Não houve execução com banco real, Vuex real pelo lock, uploads, sessionStorage nativo, hard reload real, outra máquina, receptor de importação ou IA paga. Os testes de reconstrução do controlador usam um StoragePort simulado: provam protocolo/estado e isolamento lógico, não persistência do navegador. O único teste Chromium aprovado desta rodada é a ponte antiga offline. Não houve tentativa de contornar a política do navegador.

O marcador serve à recuperação de saveRevision; não é um backup de rascunho e não recupera automaticamente uma criação/registro de arquivo cujo POST perdeu resposta. Fechar aba, apagar storage ou logout pode remover o localizador. Marcador malformado e ausência de recibo bloqueiam novas ações até resolução; a interface final e o procedimento assistido ainda precisam ser montados.

A aplicação real segue sem esse módulo montado. Cadastro, OCR, histórico, aprovação pelo Dev Agent, executor e conciliação mantêm os estados do plano. Nenhum push, merge, deploy, SQL remoto, mensagem ou importação real ocorreu.
