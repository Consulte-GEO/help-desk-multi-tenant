# Consulte GEO M09a Formulários de solicitação

Continuidade autorizada pelo usuário, com decisões de produto delegadas e execução nesta conversa. Base `f3cb786fd522fce436f1f4ad2e06844db4902b4e`, worktree do PR31. Incremento arquitetural: preparação da jornada sobre a configuração publicada, preservando a dependência M08 de origem real. Wiki indicado pelo usuário: `Consulte-GEO/wiki_consultegeo`, revisão `74d55052794723afb6d7eec91e11aa218012393c`.

## Resultado e fronteira

Cliente escolhe explicitamente a ação de acesso: incluir, alterar, desativar, reenviar acesso ou liberar em nova obra. A definição vem de uma versão publicada da configuração M04; checklist, auditoria, identidade do publicador e campos internos ficam fora do descriptor público. Formulários de outras famílias usam a mesma projeção, sem criar estruturas de produto genérico.

Uma projeção pura não autoriza leitura. Seu chamador futuro precisa obter o registro sob autorização de contexto/conta/origem. Não acrescentar endpoint de catálogo sem esse mecanismo. M09a entrega componentes e transporte real para as rotas de rascunho/prévia/abertura existentes; montagem operacional, stores de intake e catálogo autorizado continuam M08/M09b. Capabilities hospedadas não declaram essa jornada pronta.

## Arquitetura

`projectConsulteGeoCustomerConfiguration` valida todo o registro M04, recusa drafts e projeta só formulário público e prazos publicados. `shared/consultegeo-request.js` valida o descriptor exato e a identidade da versão, com limites, cópia e imutabilidade. Não recompila ou altera uma versão publicada.

`web/consultegeo-request.js` monta escolha de ação e `mountSupportIntake`. Troca de ação com dados exige descarte explícito; troca durante salvamento/envio/prévia/conciliação desconhecida é recusada. Troca confirmada destrói os controles antigos, gera outro draft e não transporta respostas pessoais. Logout/destruição cancela consultas e apaga a superfície. Escolha de pessoa e evidências permanece indisponível sem portas reais; não aceita nome/e-mail como permissão.

`web/consultegeo-intake-api.js` usa a closure autenticada existente, caminhos fixos, JSON limitado, If-Match e Idempotency-Key. Não recebe token nem origem arbitrária. Confere draft, conta, obras, formulário/versão, actor/workspace e protocolo no recibo. Erro autoritativo conhecido antes do efeito permite revisão; falha de transporte, resposta incompatível ou confirmação desconhecida preserva intenção/key/payload. Nenhum retry automático. Provider pending significa pendente, não e-mail enviado.

## Decisões de interface

Prazos apresentados como horas úteis configuradas; o prazo calculado e a cobertura são conferidos no servidor. Nenhuma obra, pessoa ou grupo do wiki é seed de permissão. O wiki documenta lookup por e-mail, seleção de tenant por header e divergência de seletor/ACL; essas leituras não se tornam autoridade. O formulário registra solicitação, execução permanece manual no GEO. Implantação permanece planilha XLSX/CSV; Storage/scan não são simulados como disponíveis.

## Verificação

TDD da projeção/privacy/status/shape; da escolha/descarte/clear/respostas tardias; e do transporte/correlação/replay/recusa/limites. Browser Chromium próprio em1440/390 com identidade/estado sintéticos, passando pelos handlers/domínio existentes e publicação M04. Fonte real não é ensaiada com credenciais. Build inclui os assets sem montar no shell nem abrir gates. CI original Linux/Node22/PG17 preserva todas as suítes; revisão independente final e evidência da fonte exata.

Sem nova migration/dependência/schema/rota/OpenAPI. API/interface0.28.0 e schema0.21.0 permanecem. Relatório143 e pacote M09a explicam qualificação documental M08, implementação e próxima fatia; sem merge/deploy/alteração hospedada/envio.
