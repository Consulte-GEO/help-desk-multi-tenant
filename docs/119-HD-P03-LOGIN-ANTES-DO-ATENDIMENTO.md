# HD-P03 — autenticação antes da liberação do atendimento

O gate de atendimento também impedia carregar a configuração pública de Auth e validar o próprio acesso ao workspace. Isso bloqueava o aceite de login necessário para decidir a liberação operacional.

O adaptador hospedado agora inicializa autenticação com o gate fechado, usando a mesma configuração, conexão TLS, papel restrito, verificações de schema/segurança e limitador PostgreSQL. A fábrica estrita `createProductionRuntime` continua exigindo aprovação literal `true`. Nenhuma migration, grant, segredo, cadastro ou infraestrutura foi alterado.

Com o gate fechado, a API permite somente GET capabilities/public-config/me e o ciclo existente POST integration-tokens / DELETE integration-tokens/current. Os demais métodos/caminhos retornam 503 `release_gate_closed` antes da autenticação ou do serviço de domínio. Os contadores técnicos do limitador continuam ativos. `/me` mantém a resolução real da identidade e os escopos vigentes; o papel administrador não acrescenta escopos.

Configuração pública e capabilities incluem `operational:false` nesse modo. Todas as capacidades de atendimento aparecem indisponíveis; encerramento de sessão de integração reflete o callback existente. No modo aprovado, o contrato anterior é preservado.

A interface valida a sessão e `/me`, informa que identidade/acesso foram confirmados e que o atendimento ainda não foi liberado. Não consulta chamados nem apresenta uma lista vazia como se estivesse operacional. Permite encerrar a sessão no provedor; senha/tokens permanecem sujeitos às regras atuais de descarte e memória local.

## Verificação e limites

Testes negativos escritos antes da implementação comprovaram a ausência do bloqueio. Os novos testes cobrem rotas/métodos, cabeçalhos sem autoridade, quotas, escopos preservados, lifecycle técnico e validação de configuração. O navegador usa provedor sintético explicitamente identificado; isso não comprova login de uma pessoa no Supabase de produção.

CI Linux, revisão, merge, implantação e verificações HTTP de produção serão registrados após execução. M1 operacional continua aberto: login humano real, aceite M2M, cadastro do primeiro atendimento, capacidade e restore ainda precisam de evidência própria. O bootstrap do administrador já aplicado não deve ser repetido.
