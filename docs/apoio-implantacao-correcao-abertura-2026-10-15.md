# Apoio Implantação — correção da abertura

O módulo passava `/v1/implementation-support/session` ao transporte autenticado que já acrescenta `/v1`. A URL resultante `/v1/v1/implementation-support/session` impedia a montagem e mostrava a mensagem genérica relatada pelo usuário. A fachada normaliza somente o namespace desse módulo. Autenticação, autorização e cancelamento permanecem no transporte existente.

PR57, fonte `526e5b5de89ea9e08d3fb0d05c3e5efff8f8db6e`. Regressão reproduzida antes da correção,9 testes de shell aprovados depois; types/build aprovados. A fixture de navegador agora usa fachada e transporte reais, cobrindo24 jornadas (incluindo reabertura, arquivos, laudos e encerramento da sessão), em vez de montar diretamente a biblioteca.

CI [38799697944](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38799697944):5799 aplicação,697 PostgreSQL,632 interface, zero falhas/skips. PR test merge `2cefff96197491817a99a00f99ef2a9a72746bfe`, fingerprint `464502cb2018ce89b02d91e5e0a2979fbad323163a82832eb4781edb838cb28a`. Artefato `12003264151`, digest `sha256:1ac09eebc61c07f4ae0c4905d846e885ad4e75e6e029136d81ae19ecbb3a6c77`. Relatório e logs originais copiados e verificados em `evidence/homologation/runs/156bbe49-753b-43af-a549-5687ea011265`; `latest.json` aponta para a mesma execução. Qualificação específica38799697912 e HDA38799697941 também aprovadas.

Não houve alteração de banco, segredo ou registro de negócio para este hotfix. Verificação autenticada ocorreu em fixture local; a publicação hospedada e seu identificador serão registrados após a conclusão do deploy. Uma página já aberta precisa ser recarregada para obter a fachada corrigida. As mudanças de e-mail continuam em branch separada.
