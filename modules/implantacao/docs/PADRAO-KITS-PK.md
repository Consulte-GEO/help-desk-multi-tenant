# PADRÃO DE KITS (PK) · Consulte GEO

> **Documento normativo.** Define que **todo** desenvolvimento de interface, e-mail e
> documento do Consulte GEO — a começar pelo módulo **Implantação de Obras** — usa
> os quatro kits HTML abaixo como **fonte única de verdade**. Nada de cor, fonte,
> componente, espaçamento ou layout é criado fora do que os kits definem.
>
> Versão do PK: **1.0** · Vinculado à entrega **v04** · Idioma da interface: **pt-BR**

---

## 1. O que é o PK

**PK = Padrão de Kits.** É a regra de governança visual do produto. Em vez de cada
tela, e-mail ou relatório reinventar cores e componentes, tudo deriva de quatro
artefatos canônicos entregues como HTML:

| Kit | Arquivo | Papel | O que é fonte de verdade |
|---|---|---|---|
| **Design System** | `Consulte GEO Design System.html` | Sistema de UI | Tokens OKLCH, tons de status, componentes (botão, campo, tabela, card, badge, alerta), padrões AppShell / AdminListPage / drawer, comportamento de telas |
| **Brand Kit** | `Consulte GEO Brand Kit.html` | Identidade | Símbolo °geo, wordmark, favicon/app icon, âncoras de marca em HEX, tipografia (Mona Sans + JetBrains Mono), escala tipográfica 1.250, grid base 4px, tom de voz |
| **Email Kit** | `Consulte GEO Email Kit.html` | E-mail transacional | Estrutura das 7 partes do e-mail, blocos reutilizáveis, marcadores `{{ }}`, dark mode, rodapé + LGPD, compatibilidade entre clientes |
| **Report Kit** | `Consulte GEO Report Kit.html` | Documentos | Moldura A4 retrato/paisagem, cabeçalho/rodapé, peças de conteúdo, núcleo vs. extensão, documentos comerciais e de laboratório |

**Regra de ouro:** se o valor não está em um kit, ele não entra no código. Para
mudar a marca inteira, muda-se **um** lugar (as 5 âncoras de marca) — todo o resto
segue.

---

## 2. A quem se aplica

Aplica-se a **todo artefato visual do Consulte GEO**, em qualquer stack:

- Telas do produto (Vue 3 + Bootstrap 5 + Design System Consulte GEO).
- Protótipos e provas de conceito (HTML/CSS derivado dos tokens).
- E-mails transacionais (HTML table-based a partir do Email Kit).
- Documentos e laudos (a partir do Report Kit).
- Slides, one-pagers e material de apoio que usem a marca.

Não se aplica a: modelagem de banco, contratos de API e lógica de negócio — mas a
**apresentação** desses (telas de exportação, viewers de JSON, telas de mapeamento)
segue o PK.

---

## 3. Tokens canônicos (não redefinir)

### 3.1 Âncoras de marca — HEX (para e-mail/documento) e OKLCH (para app)

| Token | HEX | OKLCH | Uso |
|---|---|---|---|
| `--brand-navy` | `#182863` | `oklch(29% 0.12 265)` | Wordmark, ação primária, foco (light) |
| `--brand-navy-deep` | `#0E1B40` | `oklch(22% 0.09 265)` | Profundidade |
| `--brand-purple` | `#3E2D71` | `oklch(31% 0.13 290)` | Meio do gradiente |
| `--brand-magenta` | `#C5117E` | `oklch(54% 0.22 350)` | Acento, contadores, foco (dark) |
| `--brand-magenta-light` | `#E8459E` | `oklch(67% 0.20 350)` | Hover do acento |
| **Gradiente da marca** | — | `linear-gradient(135deg, #182863 0%, #3E2D71 55%, #C5117E 100%)` | Topbar, botão de ação única, cabeçalho de e-mail |

As âncoras **não invertem** no dark mode. A marca é a marca. O que muda no dark são
apenas as variáveis semânticas (superfícies, texto, bordas, tons de status).

### 3.2 Superfícies e texto (semânticas)

| Token | Light | Dark |
|---|---|---|
| `--bg` | stone-50 `#faf9f7` | slate-950 |
| `--surface` | `#ffffff` | slate-900 |
| `--fg` | navy-900 `#16213e` | stone-50 |
| `--fg-muted` | stone-500 `#8a8275` | slate-400 |
| `--border` | stone-200 `#e6e1d6` | slate-800 |
| `--ring` / `--focus` | navy-700 | magenta-500 |

### 3.3 Tipografia

- **Display / corpo:** `Mona Sans` (variável, peso 200–900, largura 75–125%). Fallback: `Plus Jakarta Sans`, `system-ui`.
- **Números / código / kicker:** `JetBrains Mono`.
- **Escala 1.250 (Major Third):** 12 · 13 · 14 (base) · 16 · 20 · 25 · 31 · 39 px.
- **Kicker:** mono, 10px, CAIXA-ALTA, `letter-spacing: 0.18em`, cor muted. Aparece **acima de todo título de página, card e grupo de campos** — é o ritmo do produto.
- **Títulos:** peso 800/900, `letter-spacing: -0.015em`.
- **Números e IDs:** sempre mono, tabulares. Código de obra e referências em `#000123`.

### 3.4 Forma, elevação, movimento

- **Raios:** 2 (xs) · 4 (chips) · 6 (inputs/botões) · 8 (cards) · 12 · full (dots/badges).
- **Elevação:** cards **planos** por padrão (só borda). Sombra apenas em menus/modais/toasts.
- **Movimento:** duração 150/250/400ms, easing `cubic-bezier(.16,1,.3,1)`. Uma animação: fade-in 4px. Sem bounce/parallax. Respeita `prefers-reduced-motion`.
- **Densidade:** global via `[data-density=compact|comfortable|spacious]`. Componentes herdam, não carregam tamanho.

> Os valores completos estão em `prototype/v06/assets/design-system.css` (`:root`), que é a
> materialização do Design System para este módulo. **É proibido** hard-codar hex/px
> em componente — sempre referenciar token.

---

## 4. Padrão de TELAS

Toda tela do produto segue o **AppShell** do Design System:

- **Topbar** 56px com gradiente de marca (em light **e** dark), badge °geo + wordmark, busca/⌘K, densidade, tema, notificações, tenant, usuário.
- **Sidebar** 224px: navegação principal + bloco Administração + card "Obra ativa".
- **Main**: container central (máx. 1400px), `kicker → título → descrição`, ação primária única à direita.

Componentes obrigatórios (classes do `design-system.css`, portáveis para Vue):

| Elemento | Classe base | Regra |
|---|---|---|
| Botão | `.btn` + `.brand/.primary/.secondary/.ghost/.destructive` | **Uma** ação `.brand` por tela |
| Campo | `.field` > `.label` + `.input/.select/.textarea` | Label sempre em kicker mono; `*` para obrigatório |
| Tabela editável | `.table` + `.row-input/.row-select` | Cabeçalho sticky em kicker mono |
| Card | `.card` + `.card__head/__body/__foot` | Plano; header com kicker + título |
| Status | `.pill` / `.badge` + tom | Só os 6 tons: neutral, info, warning, success, danger, brand. **Nunca** inventar tom |
| Alerta | `.alert` + tom | Ícone + título + texto (nunca cor sozinha) |
| Stepper | `.stepper` > `.step` | Estados: pendente / ativo / concluído |
| Prévia | `.tree-node` + `.floor-card` | Peça com borda esquerda por tipo |
| Validação | `.val-row` + severidade | error/warning/info com ícone + código + path |
| Exportação | `.json-viewer` + `.seg` | Área técnica isolada da interface do usuário |

Materialização de referência: **`prototype/v06/index.html`** (fluxo Obra → Estruturas →
Peças → Prévia → Validação → Exportação).

---

## 5. Padrão de E-MAIL

Todo e-mail transacional deriva do **Email Kit** preservado em `prototype/v06/emails/`:

- **Estrutura de 7 partes:** preheader oculto → cabeçalho gradiente (badge + wordmark) → kicker → título → corpo → ação/detalhe → rodapé + LGPD.
- **Técnica:** `<table role="presentation">`, largura 600px, **estilos inline**, cores em **HEX** (e-mail não suporta OKLCH nem custom properties).
- **Marcadores:** dados dinâmicos como `{{ nome }}`, `{{ referencia }}`, `{{ url_revisar }}` — preenchidos pelo backend, nunca hard-coded.
- **Dark mode:** `@media (prefers-color-scheme: dark)` + `meta color-scheme`.
- **Rodapé:** assinatura + aviso LGPD (Lei 13.709/2018) + link de preferências.
- **Blocos reutilizáveis:** `kicker`, `title`, `para`, `button`, `buttonRow`, `detail`, `noteBox`, `codeBox`, `statTiles`.

**Os 10 e-mails históricos do kit** (preservados em `prototype/v06/emails/`):

| # | Arquivo | Evento |
|---|---|---|
| 01 | `01-conta-criada.html` | Confirmação de conta |
| 02 | `02-redefinir-senha.html` | Redefinição de senha |
| 03 | `03-cadastro-aguarda-validacao.html` | Submissão aguardando validação da equipe Consulte GEO |
| 04 | `04-cadastro-aprovado.html` | Cadastro aprovado para implantação |
| 05 | `05-convite.html` | Convite para equipe/empresa |
| 06 | `06-novo-acesso.html` | Alerta de novo acesso |
| 07 | `07-codigo-verificacao.html` | Código de verificação (OTP) |
| 08 | `08-exportacao-pronta.html` | Exportação técnica concluída |
| 09 | `09-resumo-semanal.html` | Resumo semanal (digest) |
| 10 | `10-cadastro-devolvido.html` | Cadastro devolvido para ajustes |

> Os e-mails 03/04/10 mapeiam diretamente o fluxo de implantação
> (**submeter → validar → aprovar/devolver**). Em produção, a imagem do badge deve
> apontar para uma **URL HTTPS absoluta**, não para caminho relativo.

---

## 6. Padrão de DOCUMENTO (relatórios/laudos)

Todo documento (proposta, contrato, declaração, laudo de compressão, etc.) deriva do
**Report Kit**: moldura A4 (retrato/paisagem), cabeçalho com kicker + emissão, rodapé
paginado, peças de conteúdo repetíveis, e a distinção **núcleo** (obrigatório) vs.
**extensão** (opcional). Tokens `--cs-*` em HEX, mesma marca e tipografia.

---

## 7. Vocabulário — interface × técnica (regra dura)

O usuário final entende **obra**, não modelagem de banco. Esta separação é obrigatória.

**Permitido na interface:** Obra, Estrutura, Bloco, Torre, Contenção, Área Externa,
Anexos, Apoio, Peça, Pavimento, Etapa, Classificação, FCK, Volume, Concreto,
Projetista, Nomenclatura no Sistema, Regra Aplicada, Prévia, Validação, Exportação técnica.

**Proibido na interface principal** (só em JSON técnico, aba de mapeamento, docs
internas e relatórios da equipe): `Ges_*`, `Con_*`, `Utl_*`, `Pro_*`, `CTe_*`,
"Grupo de Unidade", "Unidade Tipo".

**Proibido em qualquer lugar público:** referências a **MRV**. Substituições fixas:
"Estruturas" (não "Edificações no padrão MRV"), "Tipo de Estrutura", "Número da
Estrutura", "Nomenclatura no Sistema", "Regra Aplicada", "Adicionar linha",
"Carregar exemplo completo com projetista".

Regras de campo: **Tipo de Estrutura** restrito a Bloco/Torre/Contenção/Área
Externa/Anexos/Apoio. **Projetista** é texto livre, opcional, não bloqueia salvamento.

---

## 8. Acessibilidade (contrato)

WCAG 2.1 AA (AAA quando sem custo), conforme `ACESSIBILIDADE.md`:

- Foco **duplo**: `outline` de alto contraste + anel magenta (`--focus`).
- `prefers-reduced-motion`: zera transições/animações.
- **Print B&W**: some o chrome, cores viram preto no branco, floor cards mantêm borda esquerda preta como pista de tipo.
- `forced-colors` (Windows High Contrast): botões/badges/foco usam cores do SO.
- `.sr-only` para rótulos de leitores de tela. Status **nunca** por cor sozinha (sempre ícone + texto).

---

## 9. Do / Don't

**Sempre**
- Referenciar tokens; kicker acima de cada título; uma ação `.brand` por tela.
- Manter `customerInput` original (não corrigir dado do usuário silenciosamente).
- Isolar interface do usuário da exportação técnica.
- Números/IDs em mono tabular; datas `dd/MM/yyyy`; locale pt-BR.

**Nunca**
- Hard-codar hex/px em componente. Inventar cor de status ou tom novo.
- Usar React/Next/Tailwind/Pinia neste projeto (stack é Vue 3 + Bootstrap 5 + DS).
- Emoji na UI do produto. Ilustração desenhada à mão ou foto de banco de imagem.
- Expor termos de banco (`Ges_*` etc.) ou **MRV** na interface.
- Gradiente em texto de e-mail (usar cor sólida navy como fallback de Outlook).

---

## 10. Checklist de conformidade (gate de PR)

Um artefato só é "conforme PK" se:

- [ ] Cores, fontes e raios vêm de tokens — zero hex/px avulso.
- [ ] Kicker mono presente acima de títulos de página/card/grupo.
- [ ] Componentes são os do Design System (botão, campo, tabela, card, pill, alerta).
- [ ] Status usa apenas os 6 tons; nenhum tom novo inventado.
- [ ] Light **e** dark testados; foco duplo visível; `reduced-motion` respeitado.
- [ ] Nenhuma referência a MRV; nenhum termo `Ges_/Con_/Utl_/Pro_/CTe_` na interface.
- [ ] Tipo de Estrutura restrito à lista; Projetista livre e não bloqueante.
- [ ] E-mail: table-based, inline, 600px, preheader, `{{ }}`, rodapé LGPD, dark mode.
- [ ] Documento: moldura Report Kit, cabeçalho/rodapé, núcleo vs. extensão.
- [ ] Contraste ok (gate `smoke-contrast.ts`: `89 OK, 0 FAIL`).

---

## 11. Materializações entregues (v04)

| Artefato | Caminho | Deriva de |
|---|---|---|
| CSS do Design System | `prototype/v06/assets/design-system.css` | Design System + Brand Kit |
| Telas do módulo | `prototype/v06/index.html` + `prototype/v06/assets/app.js` | Design System |
| Símbolo da marca | `prototype/v06/assets/geo-symbol.png` | Brand Kit |
| 10 e-mails + galeria | `prototype/v06/emails/*.html` | Email Kit |
| Este padrão | `docs/PADRAO-KITS-PK.md` | — |

---

## 12. Migração para a stack oficial

- **Vue 3 + Bootstrap 5:** `design-system.css` entra como camada de tokens/componentes;
  cada bloco do `prototype/v06/index.html` vira um `.vue` (AppShell, Stepper, ObraForm,
  EstruturasTable, PecasTable, PreviewTree, ValidationPanel, TechnicalExportPanel,
  JsonViewer). As classes já são framework-agnósticas.
- **E-mails:** os `.html` viram templates do serviço de envio; `{{ }}` mapeia para as
  variáveis do backend .NET 8.
- **Contrato migrável:** nada no PK impede a migração para .NET 8 + SQL Server — o PK
  governa **apresentação**; o contrato de dados (JSON técnico de 7 seções) segue
  independente e migrável.

> Mudou uma cor no `design-system.css`? Atualize os tokens no topo do
> `smoke-contrast.ts` (a duplicação é intencional — força revisão consciente) e rode o
> gate antes de declarar verde.
