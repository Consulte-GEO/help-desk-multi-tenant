# Vídeos privados da Wiki — configuração do proxy

Pedido de Thiago em15/10/2026: aceitar vídeos anexados diretamente aos artigos da Wiki, disponíveis aos leitores autorizados. A aplicação Wiki autentica o download no Supabase e reproduz o conteúdo mediante Blob local.

O proxy de `/wiki` e `/wiki/*` permite `media-src 'self' blob:`. As demais diretivas são preservadas, inclusive script somente da própria origem, iframe exclusivamente YouTube sem cookies, object-src none e proteções de enquadramento. O cabeçalho geral do HelpDesk não recebe media-src, Blob, iframe ou script inline.

Dois testes protegem a permissão mínima e a ausência de alteração fora da Wiki. Resultado red→green local confirmado. Nenhuma API, Function, Auth, regra de atendimento, fila, aprovação, email ou banco do HelpDesk é alterado.

Implementação e autorização das mídias pertencem ao repositório wiki_consultegeo. Este ajuste de CSP não concede acesso a arquivos, não publica conteúdo nem transforma um bucket privado em público.

## Homologação da PR51

A fonte `017bdae47c4349c81ec754d56b5058cca2e232c9` foi aprovada na [execução38746430538](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38746430538), evento pull_request sobre a integração `3ead60451c806822150d5cb89d037311509e5c29`. O fingerprint de fonte `383b6decddd715e4026106dd3f74daa0bd8da7fa399afb147e8152da8a706f12` coincide exatamente com o checkout da branch. A CI aprovou lock, instalação, auditoria, aplicação5.627/5.627, PostgreSQL680/680 e interface617/617:6.924 verificações, zero falhas, cancelamentos, skips ou todo nas suítes contadas. Os dois testes de CSP fazem parte da suíte de aplicação e não são somados novamente.

Somente o artefato aprovado11978644916, `helpdesk-homologation-3ead60451c806822150d5cb89d037311509e5c29-38746430538-1`, foi incorporado: os seis logs originais da mesma execução e `latest.json` estão em `evidence/homologation`; o recibo de fonte e a identificação da CI estão em `evidence/wiki-video-v12`. `npm run check:homologation` conferiu fingerprint, integridade dos logs, contagens e coerência da execução. As evidências históricas foram preservadas. Isso qualifica este código em ambiente descartável; não comprova publicação ou reprodução no domínio hospedado.

## Primeira flutuação e limite da investigação

A [execução de push38746380962](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38746380962) da mesma fonte passou aplicação5.627/5.627 e PostgreSQL680/680, mas falhou na interface: `tests/browser-smoke.py:71` esperava `#notes-retry` visível e o encontrou oculto. O log dessa tentativa, já disponível localmente, foi inspecionado apenas para diagnóstico; não foi incorporado como evidência aprovada.

Nesse teste, o interceptor de indisponibilidade das notas é retirado antes da asserção de visibilidade do botão. O snapshot da falha já mostrava notas restauradas e o botão oculto, estado compatível com outra leitura concluída após a retirada do interceptor. Essa é uma hipótese de concorrência/timing, não uma causa raiz comprovada. A suíte focada `browser-note-recovery.py` mantém o interceptor e sincroniza as respostas explicitamente; seus seis casos passaram na execução integral aprovada. Nenhum código de atendimento, teste ou espera foi alterado nesta integração para tentar eliminar a flutuação. Uma execução posterior aprovada não demonstra que a intermitência foi corrigida.

Merge, deploy e verificação dos cabeçalhos publicados continuam a cargo da etapa de integração final; não foram executados ao incorporar estes comprovantes.
