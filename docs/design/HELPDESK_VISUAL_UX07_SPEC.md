# UX07 — conhecimento, encerramento e satisfação

Continuidade do plano UX06 §4, autorizada por «Continue». Identidade Consulte GEO; núcleo genérico e componentes opcionais, sem montar rotas nem conceder acesso.

## Interface e decisões
- Preservar os nomes e argumentos existentes de `web/optional-support.js`. Os quatro renderers podem retornar `{dispose}` de modo aditivo; consumidores que ignoram o retorno continuam válidos. `mountCsat` mantém `{dispose}`.
- Um componente é dono apenas de seu subtree. Uma nova montagem no mesmo root descarta a anterior, seus textos e listeners. Destruir o anterior depois não remove o novo componente. Roots distintos não compartilham intenção. O host deve desmontar ao trocar audiência.
- Reutilizar `operations-ui.js` e `operations-experience.css` sem mudar sua implementação. Novo CSS complementar restrito a `[data-support-panel]`, sem fontes novas. Nada de persistência, URLs privadas, HTML vindo de DTO ou polling.
- Conhecimento: título genérico «Ajuda e orientações», snippets autorizados em cartões. `null`/malformado = indisponível; array vazio = nenhuma orientação. Mostrar apenas title/snippet, sem fabricar links/categorias/editorialidade. Abrir chamado continua disponível somente com callback do host. Nenhuma chamada ao renderizar.
- Macro: preview válido exige body string e sent === false; visualização não envia/aplica/copia. Previews antigos são removidos na substituição. Não expor campos extras.
- Pacote: validade legível em São Paulo pelo formatter existente; contagem segura, sem expor id, token ou URL no DOM. Datas inválidas/expiradas não convidam à ação. O relógio local é somente uma barreira UX, nunca autorização; reconferir ao clicar. Callback recebe o id original, uma vez por requisição pendente, sem inferir que retorno void significa download concluído. O host deve recarregar um grant expirado. Opcional `options.now` para testar relógio.
- Acompanhamento: três estados existentes e desconhecido por lookup de propriedades próprias. Não declarar etapas anteriores concluídas, resolução ou prazo sem evidência. Publicação recebida exige validação humana.
- CSAT: select nativo com 1–5 e descrições textuais, sem nota inicial; comentário opcional <=2000, contador e erros associados. Preservar algoritmo de recibo (rating exato e attribution invitation_possession), chave/corpo no replay e sem envio duplicado. Nada de voto no mount ou na mudança da nota. Resposta tardia e handlers antigos após dispose não atuam. Confirmação apaga comentário; token só no adaptador do host.

## Não objetivos
Sem novas APIs, banco, Auth, RLS, gate operacional, publicação editorial, dispatcher, geração de pacote ou integração ao app principal. UX07 não é homologação do host. Não substituir a frente paralela M02.

## Critérios
Node RED/GREEN com estados vazios/malformados, texto não interpretado, desmontagem e concorrência. Chromium em 320/390/768/1024/1440 claro/escuro, foco, teclado, inputs >=16px no móvel, ações >=44px, nenhum overflow de página. Revisar helpers importados, build/MIME e integrar somente por allowlist. Cumulativo UX01–UX07 com matriz e evidências sem reapresentar histórico como execução atual.
