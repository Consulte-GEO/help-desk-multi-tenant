# Relatório de implementação — Implantação e Importações R03

**Data:** 14/10/2026. **Candidato:** 5.0.22-54. **Base remota:** dcf5607652281bb688f366e6a4f05e07eb698d31. **Entrega:** R01 + R02 + R03 cumulativas, pacote incremental para integração no Codex. Não é clone completo, build de produção, PR nem deploy.

## Resultado desta rodada

Avanço no IMP-02b: transporte HTTP, cliente de sessão e controlador de salvar/retomar com conflitos e confirmação incerta. Módulos reais e testados focalmente; nenhum endpoint ou tela montado na aplicação publicada. Sem migração, storage remoto, alterações de autenticação/MFA, notificações, integração ativa Help Desk/Dev Agent ou importação no destino.

## Desenvolvimento

### Transporte HTTP

`modules/import-process/http.ts` cobre criar processo, consultar processo, salvar/ler revisões, cancelar rascunho, declarar arquivo e solicitar verificação. Usa Bearer validado por porta de servidor, diretório de escopo autorizado e admissão por identidade. Barreira fechada por padrão, Origin exato para POST, comandos de shape fechado, limite por bytes lidos, UTF-8 fatal, If-Match e Idempotency-Key obrigatórios conforme a operação. Respostas têm ETag, requestId, no-store, nosniff e erros sanitizados.

Contas/obra de processos existentes vêm de um localizador confiável, não de campos arbitrários enviados na revisão. Seleção da criação continua sendo autorizada pelo serviço real. Origin não foi usado como autenticação. Não existe operação de aprovar/executar ou endpoint de upload de bytes.

### Cliente e estado de apresentação

`modules/import-process-client/client.ts` integra com fetch da sessão do host, sem guardar tokens/cookies ou instalar outro login. Confere recibo, operação, versão, ETag, hash e shape da resposta. Não envia credenciais para basePath externo, não segue redirects e não faz retry automático.

`controller.ts` prepara a integração com Vuex: retomar, editar, salvar, recuperar recibo e limpar estado. 412 preserva o rascunho do operador. ACK perdido mantém uma intenção imutável e bloqueia novas edições até recuperar a mesma chave. Uma recusa posterior de autenticação não apaga a incerteza anterior. Recibo confirmado e leitura posterior falha é `refresh_required`, não falso erro de gravação. Resposta tardia após logout ou troca de caso não reintroduz dados.

**Limite:** intenção pendente vive em memória do cliente; não se promete recuperação automática da mesma chave depois de hard reload. Módulo não foi conectado ao Vue atual. A persistência multi-dispositivo real continua dependente de PostgreSQL, autoridade e storage qualificados.

### Correções adicionais

Revisões com campos inesperados agora são recusadas no serviço mesmo quando alguém recompõe o hash. Diretório que devolve escopo inválido é indisponibilidade interna, não erro de digitação do usuário. Violações semânticas dos dados retornam 422; corrupção interna não é apresentada como campo inválido. Bearer exagerado é recusado antes de chamar autenticação. Aplicadores verificam a versão do manifesto, evitando aplicar o manifesto R03 com um aplicador histórico.

### Qualificador PostgreSQL

Ferramenta `tools/qualify-import-process-postgres.mjs`: cria exclusivamente cluster PostgreSQL 17 próprio, local e descartável, por socket Unix privado. Requer usuário de SO não-root, binários locais e driver pg instalado em diretório explícito. Não aceita host remoto, DSN, senha ou base existente; não instala pacote. Ausência de requisitos retorna exit 2, `postgresqlExecuted=false`, nunca SKIP verde.

Onze cenários com driver real foram preparados. **O corpo dessa suíte não foi executado**: este ambiente não tem binários/driver e roda como root. O DDL candidato da R02 ficou intacto e fora das migrations. A lógica de segurança/pré-requisitos do runner recebeu doze testes locais; eles NÃO são doze testes de PostgreSQL.

## Evidências executadas nesta sessão

| Verificação | Resultado | Alcance |
|---|---:|---|
| Integridade/exportador/ponte/aplicadores | 123/123 | Inclui quatro novos testes do aplicador R03 |
| Contratos/serviço/SQL double/HTTP/cliente/qualificador | 166/166 | Inclui quatro jornadas HTTP com socket real |
| Total Node focal cumulativo | **289/289** | Zero fail/skip/cancel/todo nessas duas suítes |
| SimilaritySelfTest | 21/21 | Motor reaproveitado |
| Typecheck estrito servidor | Aprovado | TypeScript global 5.8.3 |
| Typecheck estrito cliente | Aprovado | TypeScript global 5.8.3 |
| Compilação do cliente para módulos de navegador | Aprovada | Compilador global, não lock do frontend |
| Chromium offline da ponte anterior | 10/10 | DOM em memória, colaboradores sintéticos, sem XLSX |
| Chromium da jornada nova HTTP | **Bloqueado** | ERR_BLOCKED_BY_ADMINISTRATOR antes da navegação; zero testes de interface executados |
| PostgreSQL real | **Não executado** | Runner exit 2 / blocked; nenhuma query |

O novo total agrega 85 testes aos 204 da R02. Contagens não substituem integração no checkout completo. Os 4 testes de HTTP real ainda usam MemoryRepository e fixtures de identidade/inspeção; demonstram o protocolo TCP/HTTP e o comportamento do serviço/cliente, não a durabilidade de banco.

Logs RED/GREEN, correções de fixtures, logs finais e falhas de ambiente estão preservados em `evidencias/r03`. A primeira execução de integridade falhou por ausência da referência normalizationService.ts no delta; a cópia-base já entregue foi conferida e usada no workspace de validação. Não se fabricou outro serviço. A compilação inicial do HTTP encontrou parameter properties incompatíveis com strip-only e foi corrigida. A navegação negada no Chromium não foi contornada com outra URL, flags ou acesso alternativo ao host bloqueado.

## Estado remoto e limites

main do Setup foi lido pelo conector e continua na base indicada. Não houve checkout integral recuperado; trabalho e commits são snapshots locais do pacote. Não houve revisão independente por outro agente; foi feita revisão própria com testes adversariais e correções registradas.

Não foram executados: npm ci/build/typecheck/smoke completos do Vue, suíte completa do repositório, leitura/exportação real de XLSX no aplicativo, banco PostgreSQL, scanner/storage real, sessão do provedor, jornada multi-dispositivo, deploy e aceite operacional. Não repetir contagens históricas como homologação atual. Merge e publicação continuam exigindo autorização específica e gates reais.
