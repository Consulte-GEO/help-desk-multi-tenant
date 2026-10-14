# Help Desk — identidade Consulte GEO / fundação visual UX01

Data: 13/10/2026. Base Help Desk: `604478e2d05ed019baac6d92a9a04db236fafb82` (`codex/m1-reproducibilidade`). Doador: GEOLAB `34a238b08cd1fc21a179b8c176ee28e1a3b742cb` (`main`).

## Objetivo
Aplicar os padrões compartilhados do DS atual do GEOLAB à interface nativa HTML/JS do Help Desk, usando a identidade Consulte GEO do anexo. Não migrar para React, Tailwind ou Bootstrap. Não alterar domínio, autenticação, permissões, contratos, API, migrations ou gate operacional.

## Decisões
1. Tokens semânticos e componentes com raios 10/14/18/24px, campos e botões de no mínimo 44px, cards de 24px, botões primários com gradiente de marca, espaçamento 4/8/12/16/24/32 e tipografia Inter/system, acompanhando `geolab/src/styles.css` e os primitivos atuais. Não redistribuir arquivos de fontes. Não usar fontes externas nem preloads inexistentes.
2. Cores-âncora do anexo: navy #182863, deep #0E1B40, roxo #3E2D71, magenta #C5117E e claro #E8459E. Erro, atenção, informação e sucesso usam tons próprios e texto, nunca apenas cor. Ajustar os tons de texto por tema para contraste.
3. Tema claro, escuro e automático. Apenas a preferência enumerada `auto|light|dark` pode ser persistida na chave `helpdesk.ui.theme`; nenhuma sessão, identidade ou autorização. Falha de storage não pode impedir o acesso.
4. Marca selecionada em configuração de apresentação local ao frontend. Perfil neutro de referência sem logotipo GEO. Não selecionar marca por URL, token, contrato presumido ou conteúdo fornecido pelo usuário. Marca não é autorização nem tenancy.
5. Camada aditiva carregada depois de `styles.css`, reversível, sem alterar `app.js` ou os módulos Auth. Corrigir conflitos comprovados de cascade com escopo `html[data-helpdesk-ds]`. Conservar IDs, nomes, enums, limites, `hidden`, `inert`, `disabled`, autocomplete e handlers de domínio.
6. Navegação móvel como disclosure em fluxo normal, não modal inventado: botão com `aria-expanded`/`aria-controls`, Escape e retorno de foco; não clonar ações/handlers. Manter conteúdo oculto fora da navegação por teclado.
7. Adaptar login simplificado, shell, caixa/filtros/indicadores, detalhe/conversa/notas/histórico, abertura, página de informações, banners e diálogos preservados. A aparência de módulos opcionais não os monta nem libera.
8. Sem remeter fontes de laboratório/obra ao núcleo, copiar o roteador do GEOLAB, alterar autenticação ou retirar motivos obrigatórios. Não exibir totais globais calculados de páginas carregadas. Não declarar uma central operacional pelo seu visual.

## Aceitação e limites
Preservação estrutural verificada contra HTML original com Git blob SHA; testes unitários e browser com HTML real e dados fictícios, sem executar o controlador de negócio. Validar 320/390/768/1024/1440px, claro/escuro/automático, formulários, menus, textos longos e estados fechados. Essa bancada não prova login real, API, PostgreSQL, RLS ou homologação hospedada. CI integral obrigatório no checkout verdadeiro antes de publicar.

A fotografia local contém apenas fontes obtidas e verificadas necessárias à adaptação visual; não é clone integral. Não alterar políticas de rede para obter os demais arquivos. Entregar delta cumulativo desta frente UX, não um substituto integral do repositório nem reaplicação dos pacotes HDN/M02 anteriores.
