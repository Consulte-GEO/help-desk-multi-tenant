# Importação de planilha de implantação · v5.22.47

A Etapa 1 do wizard (setup.consultegeo.org) importa uma planilha de
implantação preenchida e monta o cadastro inteiro: obra, estruturas,
peças, concretos, usuários e fornecedores. O cliente só revisa etapa por
etapa antes de enviar.

## Formatos aceitos

| Formato | Abas | Situação |
|---|---|---|
| **R02 (novo, tabular)** | Instruções, Obra, Estruturas, Concretos, Peças, Usuários, Fornecedores | Modelo oficial distribuído no botão "Baixar modelo padrão (.xlsx)" |
| **R00/R01 (antigo)** | Dados Obra l Acessos, Estrutura (seções em 2 colunas), Concreto, Usina, Laboratório | Aceito best-effort com avisos. Não tem Projetista nem concreto por peça — o cliente completa no wizard |

A detecção é automática: presença de `Estruturas`+`Peças` → novo;
`Dados Obra`+`Estrutura` → antigo; nenhum dos dois → erro claro com a
lista de abas encontradas.

## Por que o modelo R02 substitui o antigo

1. O antigo não tinha **Projetista** nem **Concreto aplicado por
   unidade/peça** (pedido direto do produto na V10).
2. O layout antigo usava seções lado a lado em duas colunas na aba
   Estrutura — difícil de preencher e de parsear; o R02 é 100% tabular
   (1 linha = 1 registro).
3. O R02 tem dropdowns nos vocabulários fechados (Tipo de Estrutura,
   Etapa, Perfil de acesso, Tipo de fornecedor) e o dropdown "Concreto
   aplicado" alimentado pela própria aba Concretos (defined name
   `ListaConcretos`).
4. As abas espelham as etapas do wizard — importação 1:1.

O modelo é gerado deterministicamente por
`tools/gerar-modelo-implantacao-r02.py` (openpyxl, Design System
Consulte GEO nos cabeçalhos) e versionado em
`frontend/public/modelos/Modelo-Implantacao-Consulte-GEO-R02.xlsx`.
**Regra de layout do R02:** abas tabulares têm o cabeçalho na LINHA 1,
sem linha de título mesclada acima — título mesclado expandido venceria
a detecção de cabeçalho (bug conhecido da classe de motores de parse).

## Arquitetura

```
Step1DadosBasicos.vue          card + <input type=file> → emit 'import-planilha'
        │
SetupPage.onImportPlanilha     confirmação se já há conteúdo digitado
        │
implantacaoImportService.ts    ponte browser: injeta /vendor/xlsx.full.min.js
        │                      + /assets/implantacao-import-core.js (lazy,
        │                      fora do bundle), lê o File, converte a saída
        │                      do core pelas factories reais de setup.models
        │                      (ids cryptoUid, padroesMoldagem seedados do FCK,
        │                      remapeamento concretoId das peças)
        │
implantacao-import-core.js     parser UMD determinístico, sem DOM, recebe a
        │                      lib XLSX por parâmetro (mesmo padrão do
        │                      intake-auditor / similarity-engine)
        │
store setup/applyImportedData  metadata: só campos não-vazios sobrescrevem;
                               coleções: substituem SOMENTE se vieram ≥1 item;
                               limpa baseline de exemplo; isDirty = true;
                               audit 'planilha_importada'
```

## Regras de dado (herdadas do projeto)

- **Nunca inventar dado**: campo não encontrado fica vazio e vira aviso.
- **Texto original preservado**: descrição do concreto e nome da peça
  ficam como digitados; FCK "FCK 30" extrai `30` mantendo a origem.
- **Volume com >2 casas decimais** é arredondado para 2 **com aviso**
  (a máscara do wizard não aceita mais casas).
- **Ids da planilha nunca são usados** — todos são gerados na importação.
- **Tipo de Estrutura fora da lista** (Bloco, Torre, Contenção, Área
  Externa, Anexos, Apoio) assume Bloco **com aviso** pedindo revisão.
- **Peça com estrutura não encontrada** é ignorada **com aviso** (no
  formato novo; exceção: se existe só 1 estrutura, a peça vai para ela).
- **Etapa vazia** é classificada por heurística do nome da peça
  (estaca/bloco de coroamento/radier→Fundação; arrimo/cortina/
  diafragma→Contenção; passeio/guarita/gourmet→Anexos; senão Estrutura).
- **Seções-template do modelo antigo**: o R00/R01 repete a mesma seção
  em branco ao lado da preenchida; duplicata 100% vazia de uma seção
  preenchida (mesmo tipo + mesmo conjunto de peças) é descartada com
  aviso. Seção vazia SEM par preenchido é mantida.
- **Perfil de acesso** mapeado por regex (engenheir→engenheiro,
  operador/campo→operador_campo, qualidade, laborat→laboratorio,
  analista/gestor/diretor/coorden→analista_gestor); não reconhecido
  fica vazio para o cliente escolher.
- Importar **substitui** as coleções correspondentes — a UI pede
  confirmação quando já existe conteúdo digitado. Coleção que a
  planilha não trouxe não é apagada.

## Gates

```
node tools/run-implantacao-import-tests.js   # I1–I21, fixtures sintéticas
python3 tools/browser-validate-v10.py        # end-to-end no browser (vite preview :4173)
npm run smoke                                # inclui checks estruturais v5.22.47
```

As fixtures do gate são 100% sintéticas (nenhum dado real de cliente é
versionado). O I19 garante que o próprio R02 distribuído continua
parseável pelo importador.

---

## Atualização v5.22.49 (V12) — casamento peça ↔ estrutura

Achado por *dogfooding*: ao preencher o próprio R02 com dados de exemplo, uma
peça referenciou a estrutura pelo **tipo** ("Contenção") enquanto a aba
Estruturas trazia a **nomenclatura** ("Contenções") — a peça era descartada
(com aviso, mas descartada). Duas correções, uma em cada ponta:

**No modelo (origem do erro):** a coluna `Estrutura *` da aba Peças agora tem
**dropdown** alimentado pelas nomenclaturas da aba Estruturas (defined name
`ListaEstruturas`). Como o dropdown é sugestão (`showErrorMessage=false`), o
cliente continua livre para digitar o Número da Estrutura.

**No importador (tolerância):**

- `-` (estrutura única sem numeração) **deixou de ser chave de casamento** —
  antes, duas estruturas com `-` colidiam na mesma entrada e a primeira
  "roubava" as peças da segunda;
- se a referência não casar exatamente, o motor tenta o **tipo de estrutura**:
  casa **apenas quando existe uma única estrutura daquele tipo** e emite aviso
  agregado ("N peça(s) referenciavam a estrutura pelo tipo…"). **Tipo ambíguo
  (2+ estruturas do mesmo tipo) nunca é chutado** — continua virando aviso de
  peça não associada.

Regressões cobertas por `I22` (casa por tipo + não colide em `-`) e `I23`
(ambíguo não chuta). Gate: **23/23**.

Também versionado: `frontend/public/modelos/Modelo-Implantacao-Consulte-GEO-R02-EXEMPLO-PREENCHIDO.xlsx`
(dados 100% sintéticos, gerado por `tools/gerar-exemplo-r02-preenchido.py`) —
serve de referência de preenchimento para o cliente e de fixture de validação
browser: `python3 tools/browser-validate-v10.py frontend/public/modelos/Modelo-Implantacao-Consulte-GEO-R02-EXEMPLO-PREENCHIDO.xlsx`.
O script de validação passou a derivar as contagens esperadas do próprio
resumo exibido na tela, então vale para qualquer planilha (16/16 com o modelo
novo e com a planilha legada real).
