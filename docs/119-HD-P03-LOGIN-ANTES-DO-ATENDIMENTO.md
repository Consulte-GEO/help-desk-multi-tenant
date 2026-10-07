# HD-P03 — autenticação antes da liberação do atendimento

O gate de atendimento também impedia carregar a configuração pública de Auth e validar o próprio acesso ao workspace. Isso bloqueava o aceite de login necessário para decidir a liberação operacional.

O adaptador hospedado agora inicializa autenticação com o gate fechado, usando a mesma configuração, conexão TLS, papel restrito, verificações de schema/segurança e limitador PostgreSQL. A fábrica estrita `createProductionRuntime` continua exigindo aprovação literal `true`. Nenhuma migration, grant, segredo, cadastro ou infraestrutura foi alterado.

Com o gate fechado, a API permite somente GET capabilities/public-config/me e o ciclo existente POST integration-tokens / DELETE integration-tokens/current. Os demais métodos/caminhos retornam 503 `release_gate_closed` antes da autenticação ou do serviço de domínio. Os contadores técnicos do limitador continuam ativos. `/me` mantém a resolução real da identidade e os escopos vigentes; o papel administrador não acrescenta escopos.

Configuração pública e capabilities incluem `operational:false` nesse modo. Todas as capacidades de atendimento aparecem indisponíveis; encerramento de sessão de integração reflete o callback existente. No modo aprovado, o contrato anterior é preservado.

A interface valida a sessão e `/me`, informa que identidade/acesso foram confirmados e que o atendimento ainda não foi liberado. Não consulta chamados nem apresenta uma lista vazia como se estivesse operacional. Permite encerrar a sessão no provedor; senha/tokens permanecem sujeitos às regras atuais de descarte e memória local.

## Verificação e limites

Testes negativos escritos antes da implementação comprovaram a ausência do bloqueio. Os novos testes cobrem rotas/métodos, cabeçalhos sem autoridade, quotas, escopos preservados, lifecycle técnico e validação de configuração. O navegador usa provedor sintético explicitamente identificado; isso não comprova login de uma pessoa no Supabase de produção.

CI Linux [37617567172](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37617567172) aprovado: 1.510/1.510 aplicação, 223/223 PostgreSQL e 81/81 interface, zero skips/falhas. Instalação limpa, audit, lock, typecheck, contratos, migrations e build aprovados. Artefato11481067019, SHA256 `9fd6cc4d9c08411e0bc5040cae32c97f8d8baca9967f43c6a5d3185dbae0f066`; source CI `75823185186c882c64787b4726a97e1bca19306d`, fingerprint `62b07192031a542de44ff3fa1fb89adfd0b73d292c073ed029f9b0adeec46377`. Logs íntegros arquivados em `evidence/authentication-only/ci-green`; evidência canônica validada contra o mesmo fingerprint.

Revisão independente não encontrou achados bloqueantes; sugestão de cobrir configuração da fábrica hospedada incorporada em cinco casos negativos. Windows: 28 novos testes focais e 81 verificações de interface aprovados; suíte geral antes desses cinco casos manteve as 23 falhas conhecidas de plataforma, sem remover testes. O CI Linux completo é a evidência de aprovação.

PR8 integrado em `ced323a982430b51d8a9770ab3cdbe37c68ec246`, checks finais37618120745/37618112573 aprovados. Deploy de produção `6ac635a53bb3bf000865afc8` pronto. [Evidência HTTP](../evidence/authentication-only/production-boundary.json): quatro arquivos servidos idênticos à fonte, public-config/capabilities200 com `operational:false`, `/me` sem bearer401 e quatro caminhos de atendimento503 `release_gate_closed`, incluindo POST tickets. Nenhuma operação de domínio despachada; os contadores técnicos de ingresso continuam ativos. Essas respostas também dependem das verificações de startup reais do banco, sem fallback.

M1 operacional continua aberto: login humano real, aceite M2M, cadastro do primeiro atendimento, capacidade e restore ainda precisam de evidência própria. O bootstrap do administrador já aplicado não deve ser repetido. O primeiro serviço real depende da definição de atendimento pelo titular; não criar clientes, contratos ou SLAs fictícios para preencher essa ausência.
