# Implementation Report · Implantação Consulte GEO v06 (APP_VERSION 5.23.0)

## Resumo executivo

Implementada a nova etapa **PRÉ-ANÁLISE DE RECEBIMENTO (Triagem da Planilha)**:
análise determinística e 100% local da planilha de controle tecnológico recebida da
construtora, **antes** da configuração da obra e **antes** da conversão. Responde em
segundos o que falta, o que está inconsistente, o que a equipe resolve internamente e
o que precisa ser solicitado ao cliente — com mensagem pronta (WhatsApp/e-mail) e
relatório Excel. Executável apenas com a planilha do cliente, sem nenhum cadastro.

## Arquitetura criada

```
assets/intake-auditor.js    Motor IntakeAuditor (UMD: browser + Node) — determinístico
assets/intake-selftest.js   Suíte C1–C20 + 7 extras (roda no Node como gate e no browser)
assets/pre-analise.js       Camada de página (upload → resultado, mensagens, export)
pre-analise.html            Página da triagem (2 passos, Design System, a11y)
importa.html                Tela de modos com 3 cards (.mode-grid 3 col desktop / 1 mobile)
docs/INTEGRACAO-IMPORTA.md  Cola de ~30 linhas para o importa.html real (v5.22.42)
exemplos/planilha-cliente-exemplo.xlsx  Planilha "suja" realista para demonstração
```

Pipeline do motor: abrir workbook → pontuar/escolher aba (penaliza Instruções/Dashboard)
→ expandir células mescladas (`safeMatrix`, com contabilidade de "preenchido via
mesclagem") → detectar cabeçalho de 1–3 níveis (composição de grupos mesclados) →
inventariar campos canônicos (sinônimos + conteúdo + confiança combinada 60/40) →
detectar linhas de registro reais (ignora total/legenda/título, com motivo) → detectar
granularidade (caminhão/CP/idade/mista + confiança + evidências) → validações →
classificação em 5 categorias → alternativas operacionais → resumo → mensagens.

Estado isolado: a página standalone usa `window.IntakeBridge` (arquivo + diagnóstico)
para o handoff; na integração, `appState.intake` separado de `appState.pre`/`post`.

## Regras implementadas (por campo)

- **Data**: sinônimos amplos; mescladas respeitadas; inválida/futura → BLOQUEADOR;
  >3 anos → ALERTA; **outlier temporal adaptativo** (mediana + 6×MAD, mínimo ~18 meses)
  → ALERTA, independe de limite fixo configurado.
- **NF/DANFE/Remessa**: ausência de coluna ou valores → BLOQUEADOR. **Duplicidade
  condicionada à granularidade**: caminhão + mesma concreteira → BLOQUEADOR;
  granularidade CP/idade → INFORMATIVO (múltiplos CPs); sem concreteira → ALERTA
  ("não é possível confirmar duplicidade"); usinas diferentes → INFORMATIVO.
- **Volume**: campo ausente/vazio → NECESSITA DEFINIÇÃO com alternativa de volume
  padrão (7/8 m³) mediante autorização; ≤0 ou >16 m³ → BLOQUEADOR; "8 m³"/"7m3"/"8,0 m³"
  → normalização registrada (original preservado); "sete metros" → BLOQUEADOR não numérico.
- **FCK × Traço separados**: FCK sem traço → ALTERNATIVA (associar por FCK+aplicação,
  nunca atribuir automaticamente); nenhum dos dois → BLOQUEADOR; FCK extraível de texto
  ("CONCRETO FCK 30", "FCK30 BRITA 1").
- **Conflito de FCK**: varre FCK também em Observações/Traço/Peça/Descrição; valores
  divergentes na mesma linha → BLOQUEADOR exibindo os dois, sem escolher.
- **Local**: métricas por Torre / Bloco-Lado / Pavimento-Local / Elemento-Peça; linha
  sem nenhuma informação → BLOQUEADOR; só texto de peça/descrição → ALERTA (apoio, sem
  resolver estrutura). Não exige correspondência com cadastro (que pode não existir).
- **Usina/Laboratório**: ausente/parcial → ALTERNATIVA (padrão único se houver 1 na
  obra); valores suspeitos ("Anexar NF", "verificar", "-") → ALERTA.
- **Slump**: ausente → ALTERNATIVA (nominal do traço, sem tolerância); 0–30 cm;
  conversão mm→cm **somente com evidência no cabeçalho**, registrada como normalização
  (35 sem evidência → fora do limite, sem conversão silenciosa).
- **Flow**: 0–70 cm; ausência **não** é erro.
- **Placa**: ausente → ALTERNATIVA automática (IMPORT); nunca vai na mensagem ao cliente.
- **Horários**: apenas informativos; fora da mensagem por padrão.
- **Rompimentos**: idades detectadas dinamicamente (12h…91d, "1 d (14 h)" → 14 horas)
  via cabeçalho/subcabeçalho/mesclagem/contexto; inventário idade × coluna × %preenchido;
  "35 MPa" normalizado; ≤0/não numérico → ALERTA; >150 MPa → BLOQUEADOR; nenhuma idade
  é obrigatória.
- **Categorias**: BLOQUEADOR · NECESSITA DEFINIÇÃO · ALTERNATIVA DISPONÍVEL · ALERTA ·
  INFORMATIVO, com cores distintas na UI e proveniência em cada ocorrência
  (DADO ORIGINAL / NORMALIZAÇÃO AUTOMÁTICA / ALTERNATIVA OPERACIONAL / NECESSITA CLIENTE).
- **Fora do escopo da triagem** (regras da Pós-importação NÃO copiadas): Volume
  Aproveitamento/Descartado/não Pago/não Descarregado/Total Programado/Total Projeto —
  colunas penalizadas no mapeamento; sem exigência de bater com cadastros oficiais.

## Melhorias implementadas além do solicitado

1. Self-test executável também **em Node** (gate de CI real), além do botão no browser.
2. Contabilidade transparente de mesclagem no inventário ("N via mesclagem").
3. Outlier temporal robusto (mediana/MAD) — atende "mesmo que o limite configurado mude".
4. `today` injetável no motor → testes determinísticos (sem dependência do relógio).
5. Confiança por campo combinando nome (60%) + conteúdo (40%), exibida no inventário.
6. Anti-armadilha de título mesclado (linha-título repetida não vira cabeçalho) —
   regressão real encontrada com a planilha de exemplo e coberta.
7. Mensagem sem redundância (alternativa embutida na pergunta não é repetida) e
   fechamento/abertura padronizados; WhatsApp com negrito e limite de tamanho por tópico.
8. Linhas ignoradas listadas **com motivo** (nada é excluído silenciosamente).
9. Página no Design System Consulte GEO (PK), com foco duplo, `sr-only`, reduced motion.
10. Aviso LGPD-friendly explícito: processamento 100% local, nada sai do navegador.
11. Planilha de exemplo "suja" incluída no pacote para demonstração/treinamento.
12. Seletor de aba pós-análise (reanalisar outra aba sem novo upload).

## Testes executados e resultados

| Gate | Resultado |
|---|---|
| `node --check` intake-auditor.js / intake-selftest.js / pre-analise.js | OK |
| Self-test **C1–C20** (obrigatórios) em Node | **20/20 verdes** |
| Extras T21–T27 (mm→cm, sem NF, NF vazia, mensagens, linhas TOTAL, relatório 4 abas, status) | 7/7 verdes |
| Self-test no **browser** (botão na página) | 27/27 verdes |
| Upload real da planilha-exemplo no Chromium (Playwright) | resultado correto; 0 erros de página |
| Download `Relatorio_Pre_Analise_Consulte_GEO.xlsx` no browser | OK — abas Resumo, Inventário de Campos, Pendências, Amostras |
| Mensagens WhatsApp/e-mail geradas | 11 tópicos, somente problemas reais; placa/horários fora |
| Light/dark + tela de modos (3 cards desktop / 1 mobile) | OK (screenshots) |

Gates que dependem do repositório oficial (não executáveis aqui — ver Bloqueios):
`npm run build`, `npm run typecheck`, self-test existente do sistema, verificação
manual de que Pré/Pós-importação continuam funcionando no `importa.html` real.
Por construção, **nenhum arquivo do sistema atual foi alterado** por esta entrega.

## Limitações conhecidas

- Grupos de cabeçalho não mesclados (célula-pai solta sem merge) podem não compor o
  contexto do grupo; mitigado por detecção de idade por conteúdo numérico.
- Granularidade "mista" permanece honesta: não classifica duplicidade automaticamente.
- CSV sem múltiplas abas: escolha de aba é trivial (uma só).
- A integração final no `importa.html` v5.22.42 (terceiro card + `appState.intake` +
  handoff nativo) requer o source — cola pronta em `docs/INTEGRACAO-IMPORTA.md`.

## Bloqueio real (declarado)

O pacote `v5.22.42` anexado **não sincronizou** para o ambiente nesta e na sessão
anterior (verificado exaustivamente; apenas os 4 kits HTML chegaram). Por isso a
feature foi entregue como módulo independente + página + kit de integração, sem tocar
(e sem risco de regredir) Pré-importação, Pós-importação, exportação XLSX, inferências,
proxy OpenAI, /laudos, Supabase e Vue Router.

## Versionamento

- Base analisada: Copilot V3.1 / **v5.22.42** → esta entrega: **APP_VERSION 5.23.0**.
- `meta[name=app-version]`, `IntakeAuditor.APP_VERSION` e rodapés atualizados.
- No repositório: atualizar `package.json` para `5.23.0` (ver INTEGRACAO-IMPORTA.md).
- Relatórios anteriores preservados (V05 permanece em docs/).
