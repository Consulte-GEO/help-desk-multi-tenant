# Avaliação do banco para geração do JSON técnico

## Fonte avaliada

O arquivo recebido contém o `GeoClienteContextModelSnapshot` do EF Core do banco operacional por contrato. A estrutura confirma que a implantação de estruturas deve gerar uma proposta em staging e, após validação, gravar nas tabelas core do módulo de Gestão, Concreto, Controle Tecnológico e Projeto.

## Tabelas diretamente relevantes

| Tabela | Papel no JSON | Campos principais observados | Decisão de mapeamento |
|---|---|---|---|
| `Ges_UnidadeGrupo` | Estrutura física agrupadora | `Chave`, `Descricao`, `DescricaoCompleta`, `Ges_MapaId`, `Ges_ObraId`, `Ordem` | Cada estrutura normalizada vira um registro. Como `Ges_MapaId` é obrigatório, o implantador deve receber mapa existente ou criar mapa padrão. |
| `Ges_UnidadeTipo` | Modelo técnico da peça | `Descricao`, `Ges_ObraId`, `Ges_ClassificacaoId`, `Utl_ProdutoId`, `QuantidadeProjeto`, `ShowDashboard`, flags de croqui/forma/legenda | Cada combinação de peça + FCK + volume + etapa vira um tipo técnico. `Volume por unidade` vai para `QuantidadeProjeto`. |
| `Ges_Unidade` | Unidade concretável individual | `Descricao`, `DescricaoCompleta`, `Ges_ObraId`, `Ges_UnidadeGrupoId`, `Ges_UnidadeTipoId`, `Ordem`, `MostraMapa` | Ranges são expandidos para uma linha por unidade, preservando vínculo com grupo e tipo. |
| `Utl_Produto` | Produto genérico de suprimentos | `Descricao`, `Utl_TipoFornecimentoId`, `Campos` | O produto técnico representa o traço/material. Para concreto, `Utl_TipoFornecimentoId = 1`. |
| `Con_Concreto` | Dados específicos do concreto | `Utl_ProdutoId`, `Fck`, `Aplicacao`, `Especificacao`, `Composicao`, `Bombeado`, `TempoVencimento` | O JSON não deve depender apenas de texto livre de concreto; deve resolver/criar por FCK + especificação + aplicação. |
| `CTe_PadraoMoldagem` | Padrão de corpos de prova | `Utl_ProdutoId`, `CTe_TipoEnsaioId`, `QuantidadeCp`, `IdadeControle`, `ValorEsperado`, `Crescimento` | Incluído no mapeamento técnico para exportação e implantação de traços novos. |
| `CTe_TipoEnsaioProduto` | Slump/flow e tolerâncias por produto | `Utl_ProdutoId`, `CTe_TipoEnsaioId`, `Valor`, `Tolerancia`, `Ges_ObraId` | Usado quando o traço exige parâmetros de ensaio fresco no cadastro. |
| `Pro_Projetista` | Catálogo de projetistas | `Descricao` | Como a tela agora usa texto livre, a implantação faz upsert por descrição normalizada. |
| `Ges_Classificacao` | Etapa técnica | `Descricao`, `PercentualOverbreak` | O cliente vê etapa; o backend mapeia para IDs sugeridos. |

## Implicações para o JSON

1. O JSON precisa preservar `customerInput` exatamente como o usuário digitou para auditoria e devolução.
2. O JSON precisa conter `normalizedStructure` com grupos, tipos técnicos e unidades já expandidos.
3. O JSON precisa conter `technicalMapping` com nomes de tabelas e campos esperados, porque `Ges_UnidadeGrupo` depende de `Ges_MapaId` e `Ges_UnidadeTipo` depende de `Utl_TipoFornecimentoId`.
4. O JSON deve tratar `Projetista` como texto livre, mas gerar uma lista normalizada para upsert em `Pro_Projetista`.
5. A exportação Excel deve ser derivada do mesmo JSON, para evitar divergência entre prévia, validação, implantação e planilha técnica.

## Decisão técnica

Foi criada uma camada de staging (`Ges_ImplantacaoEstruturaProposta`) com `JsonTecnico` e `HashJson`. Essa camada não substitui as tabelas core; ela protege o fluxo de validação antes da implantação. Só depois do status validado o serviço grava em `Ges_UnidadeGrupo`, `Ges_UnidadeTipo`, `Ges_Unidade`, `Utl_Produto`, `Con_Concreto`, `CTe_PadraoMoldagem` e `Pro_Projetista` dentro de uma transação.
