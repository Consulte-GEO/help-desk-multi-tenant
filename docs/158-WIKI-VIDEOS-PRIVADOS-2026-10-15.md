# Vídeos privados da Wiki — configuração do proxy

Pedido de Thiago em15/10/2026: aceitar vídeos anexados diretamente aos artigos da Wiki, disponíveis aos leitores autorizados. A aplicação Wiki autentica o download no Supabase e reproduz o conteúdo mediante Blob local.

O proxy de `/wiki` e `/wiki/*` permite `media-src 'self' blob:`. As demais diretivas são preservadas, inclusive script somente da própria origem, iframe exclusivamente YouTube sem cookies, object-src none e proteções de enquadramento. O cabeçalho geral do HelpDesk não recebe media-src, Blob, iframe ou script inline.

Dois testes protegem a permissão mínima e a ausência de alteração fora da Wiki. Resultado red→green local confirmado. Validação completa/CI e recibo de publicação serão registrados antes da entrega. Nenhuma API, Function, Auth, regra de atendimento, fila, aprovação, email ou banco do HelpDesk é alterado.

Implementação e autorização das mídias pertencem ao repositório wiki_consultegeo. Este ajuste de CSP não concede acesso a arquivos, não publica conteúdo nem transforma um bucket privado em público.
