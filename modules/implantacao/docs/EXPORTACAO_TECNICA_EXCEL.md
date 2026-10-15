# Exportação técnica em Excel · v5.22.45

## Objetivo

O wizard Vue exporta uma pasta `.xlsx` preenchida a partir do mesmo
`TechnicalJson` usado na submissão. A implementação está em
`frontend/src/services/excelExportService.ts` e usa o gravador interno
`frontend/src/vendor/xlsxStyleLite.ts`, carregado dinamicamente. Ele cobre o
subconjunto necessário ao produto — múltiplas abas, estilos, formatos numéricos,
mesclas, filtros, larguras/alturas e painéis congelados — sem depender de CDN ou
pacote XLSX em runtime.

## Abas geradas (13)

| # | Aba | Conteúdo |
|---:|---|---|
| 1 | `Instruções` | finalidade, glossário e descrição das abas |
| 2 | `Resumo` | dados da obra, protocolo, contagens e status de validação |
| 3 | `Estatísticas` | volume, distribuição por etapa/FCK e principais unidades |
| 4 | `Estruturas` | grupos/estruturas expandidos e projetista |
| 5 | `Peças (cadastro)` | linhas cadastradas pelo cliente antes da expansão |
| 6 | `Unidades geradas` | combinação final estrutura × peça |
| 7 | `Concretos` | catálogo de traços/FCK/aplicação |
| 8 | `Padrões de Moldagem` | idades, ensaios, valores e quantidade de CPs |
| 9 | `Usuários da obra` | usuários e perfis vinculáveis |
| 10 | `Fornecedores` | usinas/laboratórios e contatos |
| 11 | `Mapeamento Banco` | materialização técnica para as tabelas de destino |
| 12 | `Validações` | bloqueantes, alertas, sugestões e pendências internas |
| 13 | `JSON Técnico` | fonte de verdade serializada em uma célula larga |

A aba ativa inicial é `Resumo`. Cabeçalhos, faixas semânticas, larguras,
congelamento e filtros são aplicados programaticamente. FCK e volume são células
numéricas, não texto.

## Diferença para a exportação da Pré-importação

`frontend/public/importa.html` gera outra pasta de trabalho, destinada ao layout
de importação de concretagens, com duas abas: `Importação` e `Proveniência`. Não
confundir essa saída operacional com a planilha técnica de implantação do wizard.

## Backend futuro

O skeleton .NET preserva o endpoint planejado para gerar Excel a partir do JSON
salvo. Até o cutover, a geração oficial do protótipo ocorre no navegador. O
backend futuro deve consumir o mesmo `TechnicalJson` e manter os nomes/semântica
das 13 abas ou versionar explicitamente qualquer mudança.


## Gate do gravador interno

```bash
cd frontend
npm run smoke:xlsx
```

O gate gera uma pasta de trabalho sintética. Na V8, a exportação técnica real de
13 abas também foi serializada e aberta com `openpyxl`, confirmando nomes de abas,
estilos, mesclas, filtro automático, congelamento e conteúdo do JSON técnico.
