# Implementation Report · Implantação Consulte GEO v5.22.22

## Resumo executivo

**Pedido do Thiago** (texto):

> *"Na tela de fornecedores ao invés do botão Adicionar fornecedor eu
> gostaria de dois botões: Adicionar Usina, Adicionar Laboratório.
> Implemente essa melhoria."*

**Resposta entregue**: dois botões tipados ("Adicionar usina" /
"Adicionar laboratório") no lugar do botão único. O fornecedor já é
criado com o tipo certo desde a partida, eliminando o passo
"crio genérico e depois troco no dropdown".

**Status**: implementado, validado.
**Build verde · 254 OK pipeline (+15) · 89 OK contraste · zero CSS novo ·
zero ação manual no Supabase · zero impacto em schema**.

## Diagnóstico

### O que existia (antes desta versão)

1. **Step7Fornecedores.vue**: um botão único `[Adicionar fornecedor]`
   no header do card + um botão `[Adicionar outro fornecedor]` ao fim
   da lista. Ambos emitiam `add-fornecedor` sem payload.
2. **`novoFornecedor(tipo: TipoFornecedor = 'usina')`** em
   `setup.models.ts` — **já aceitava o tipo como parâmetro** desde a
   v5.22.7. Só não estava sendo usado pelos handlers; sempre
   defaultava para `'usina'`.
3. **Handlers em 3 lugares**: `SetupPage.onAddFornecedor` (cliente),
   `ClientStatusView.onAddFornecedor` (equipe — modo edição em
   protocol page), `ReviewView.onAddFornecedor` (equipe — review).
   Todos chamavam `novoFornecedor()` sem args.
4. **Dropdown "Tipo de fornecedor"** já existia em cada card
   (linhas 61-72) — permite trocar depois da criação.
5. **Mensagem da empty area** mencionava "use o botão acima" (singular).

### O que estava ruim de UX

Pequeno mas chato: o usuário criava o fornecedor genérico (default
"usina"), depois — se quisesse laboratório — abria o dropdown,
trocava, esperava o re-render do card (a cor da borda esquerda muda
de azul para roxo). Dois cliques mais um pulo visual quando bastaria
um clique.

### O que foi alterado

1. `frontend/src/components/Step7Fornecedores.vue` — substituí o
   botão único pelos dois tipados (topo + fim) + atualizei mensagem
   da empty area para o plural.
2. `frontend/src/views/SetupPage.vue` — `onAddFornecedor(tipo)` agora
   aceita o tipo, passa para `novoFornecedor(tipo)`, e registra
   auditoria mais granular (`fornecedor_add_${tipo}`).
3. `frontend/src/views/ClientStatusView.vue` — mesma mudança no
   handler equivalente (modo edição da equipe).
4. `frontend/src/views/ReviewView.vue` — mesma mudança.
5. `frontend/smoke-pipeline.ts` — bloco v5.22.22 com 15 testes
   novos. Também flexibilizei o check de versão da v5.22.21 que
   estava estrito demais.
6. `frontend/package.json` — bump 5.0.22-21 → 5.0.22-22.
7. `README.md` — header e nova seção.
8. `docs/CHANGELOG_SOLICITACOES.md` — entrada v5.22.22.

### O que foi validado

- **Pipeline**: 254 OK / 0 FAIL (eram 239; +15 testes novos)
- **Contraste**: 89 OK / 0 FAIL (sem CSS novo)
- **Build**: verde em 9.63s
- **Typecheck strict**: limpo

### O que NÃO pôde ser validado

- **Visual real em browser**: dois botões lado a lado no `.toolbar`
  (que já é flex com gap). Em viewports estreitos, `flex-wrap` deve
  empilhar verticalmente. Não testado visualmente.
- **Cor da borda esquerda do card** muda conforme tipo
  (`.fornecedor-card--usina` / `.fornecedor-card--laboratorio`) —
  esse comportamento já existia e não foi tocado.

## Decisões registradas

### Por que ambos botões usam `.btn brand` (mesma cor)

Pensei em diferenciar visualmente (usina = primário; laboratório =
secundário), mas concluí que ambos têm peso de uso comparável. Numa
construção típica: 1-2 usinas + 1-2 laboratórios. Não há um "padrão"
e um "exceção". Atribuir cor diferente sugeriria hierarquia
falsa.

Os badges/bordas de card que JÁ existem (`.fornecedor-card--usina`
azul, `.fornecedor-card--laboratorio` roxo) cumprem o papel de
diferenciar **depois** de criar.

### Por que mantive os DOIS botões no topo (e não dropdown ou split-button)

Alternativas consideradas:

- **Dropdown "Adicionar ▾"** que abre menu com Usina/Laboratório:
  dois cliques em vez de um. Pior.
- **Split-button** (botão principal + caret): visual mais carregado,
  e desktopcêntrico. Pior em mobile.
- **Dois botões side-by-side**: mais "honesto" — mostra de cara as
  duas opções equivalentes. Ocupa mais espaço horizontal, mas o
  `.toolbar` já é `flex-wrap` e quebra em mobile.

Fui de dois botões — UX direta, código simples.

### Por que mexi também no botão do fim da lista

O Thiago pediu pra mudar o botão "Adicionar fornecedor". Há **dois**
desses no Step7: um no topo do card e outro centralizado abaixo da
lista (quando há fornecedores). Trocar só um seria inconsistente.

Aproveitei para uniformizar o markup: o segundo agora usa `.toolbar`
(igual ao primeiro) com `justify-content: center` em vez de um wrapper
ad-hoc com `text-align: center`. Menos código div-only.

### Por que `tipo` é parâmetro com default 'usina'

O método antigo era `onAddFornecedor()` (zero args). Para preservar
compatibilidade com qualquer chamada externa que ainda exista (sidebar
de testes, scripts de fixture, etc.), o novo é
`onAddFornecedor(tipo: 'usina' | 'laboratorio' = 'usina')`. Sem args
= comportamento antigo.

### Por que atualizei `ClientStatusView` e `ReviewView` também

Esses dois views renderizam o Step7Fornecedores em modos de edição
da equipe. Como o componente agora SEMPRE emite com tipo, esses
handlers receberiam `'usina'` ou `'laboratorio'` como argumento, mesmo
sem declarar o parâmetro. Funcionaria por type coercion mas:

1. Type-checker tipa o evento como `(tipo: string) => void`, mas o
   handler é `() => void`. TS Vue acharia OK porque parâmetros extras
   são ignorados — mas semanticamente o usuário da equipe clicaria
   "Adicionar laboratório" e veria um "usina" criado (default da
   função).
2. Manter os 3 handlers idênticos protege contra futuras refatorações
   onde alguém troque o emit assumindo que todos os consumers leem o
   tipo.

### Por que `fornecedor_add_${tipo}` em vez de `fornecedor_add` + campo separado

Auditoria local hoje só guarda `acao: string` no audit log. Adicionar
campo `tipo` exigiria estender `AuditEvent` no `setup.models.ts`, o que
puxaria migration de snapshot legado. Concatenar tipo na string da ação
é menos invasivo e atende ao que precisa: contar quantos
"fornecedor_add_usina" vs "fornecedor_add_laboratorio" houve.

## Ambiente usado

- Node 22.22.2, npm 10.9.7
- Vite 5.4.21
- vue-tsc 2.1.6 + TypeScript strict 5.4.5
- Sandbox Linux sem credenciais Supabase / Resend

## Arquivos criados

| Arquivo | Linhas |
|---|---|
| `IMPLEMENTATION-REPORT-V522-22.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/components/Step7Fornecedores.vue` | +20 linhas (botões duplicados topo + fim) +1 linha (mensagem empty area) |
| `frontend/src/views/SetupPage.vue` | +6 linhas (handler aceita tipo + audit granular) |
| `frontend/src/views/ClientStatusView.vue` | +1 linha (handler aceita tipo) |
| `frontend/src/views/ReviewView.vue` | +1 linha (handler aceita tipo) |
| `frontend/smoke-pipeline.ts` | +95 linhas (bloco v5.22.22) + 1 ajuste de flexibilidade |
| `frontend/package.json` | version bump |
| `README.md` | header + nova seção v5.22.22 |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.22 |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Saída |
|---|---|
| Sandbox preservado da v5.22.21 | ok |
| `npx vue-tsc --noEmit` (após cada bloco) | limpo |
| `npx tsx smoke-pipeline.ts` | **254 OK / 0 FAIL** |
| `npx tsx smoke-contrast.ts` | **89 OK / 0 FAIL** |
| `npm run build` | **✓ built in 9.63s** |

## Implementado com sucesso

- [x] Botão "Adicionar usina" no topo do card
- [x] Botão "Adicionar laboratório" no topo do card
- [x] "Adicionar outra usina" no fim da lista
- [x] "Adicionar outro laboratório" no fim da lista
- [x] Emit `add-fornecedor` com payload tipado (`'usina'` / `'laboratorio'`)
- [x] Mensagem da empty area atualizada para o plural
- [x] `SetupPage.onAddFornecedor(tipo)` repassa para `novoFornecedor(tipo)`
- [x] Audit local granular (`fornecedor_add_usina` / `fornecedor_add_laboratorio`)
- [x] `ClientStatusView.onAddFornecedor(tipo)` simétrico
- [x] `ReviewView.onAddFornecedor(tipo)` simétrico
- [x] Smoke pipeline +15 testes
- [x] README + CHANGELOG atualizados
- [x] Package version bump
- [x] Backend .NET: **intocado**
- [x] Schema Supabase: **intocado**
- [x] CSS: **nenhuma linha alterada**

## Parcialmente implementado

Nada.

## Não implementado

Nada nesta versão.

## Correções importantes aplicadas

### Check de versão da v5.22.21 estava estrito

Igual aos checks anteriores que foram flexibilizados. Agora aceita
qualquer versão `!= '5.0.22-20|19|18'`. Consistência mantida.

## Regressões evitadas

- **`novoFornecedor()` sem args** continua funcionando — o default
  `'usina'` foi preservado.
- **Dropdown "Tipo de fornecedor"** dentro de cada card continua
  intacto. O usuário ainda pode trocar o tipo depois de criar.
- **Cards já criados** (em rascunhos salvos) não são afetados. Schema
  do `Fornecedor` é o mesmo.
- **3 views** (SetupPage, ClientStatusView, ReviewView) atualizadas
  juntas — nenhum modo de uso fica para trás.
- **`audit_log`**: ação granular é nova string mas não quebra parsing
  (sempre foi `string` opaca no schema).

## Validações realizadas

| Critério §16 | Status |
|---|---|
| `npm install` funciona | ✅ |
| `npx tsx smoke-pipeline.ts` passa | ✅ 254 OK |
| `npx tsx smoke-contrast.ts` passa | ✅ 89 OK |
| `npm run build` passa | ✅ 9.63s |
| `.env.example` existe, sem secrets reais | ✅ (não tocado) |
| Aplicação abre localmente | ⚠️ não validado (sandbox sem browser) |
| Sem referências a MRV ou Superestrutura | ✅ smoke garante |
| Tipo de Estrutura tem as 6 opções corretas | ✅ smoke garante |
| Projetista é texto livre | ✅ smoke garante |
| Rascunho salva e recarrega | ✅ smoke v5.22.19 |
| JSON técnico gera e valida contra schema | ✅ smoke v5.22.18 |
| Excel técnico exporta | ✅ smoke v5.22.18 |
| Validações aparecem | ✅ smoke v5.22.18+20+21 |
| Auditoria registra eventos | ✅ smoke v5.22.18 + ação granular nova |
| Documentação atualizada | ✅ |
| Backend .NET skeleton intacto | ✅ |

## Bloqueios reais

- **Browser real**: não testado visualmente. Mas a mudança é tão
  conservadora (substituir markup de 1 botão por 2 dentro do mesmo
  `.toolbar`) que o risco é mínimo. O `.toolbar` já cobre flex-wrap
  mobile.

## Pendências que exigem ação manual

1. **Teste em browser real após deploy**:
   - Abrir tela de fornecedores (Etapa 6)
   - Confirmar dois botões "Adicionar usina" / "Adicionar laboratório" no topo
   - Clicar "Adicionar laboratório" → card surge com borda esquerda
     roxa (cor `.fornecedor-card--laboratorio`) e o dropdown "Tipo de
     fornecedor" já marcado como "Laboratório"
   - Idem para "Adicionar usina" → borda azul, dropdown "Usina concreteira"
   - Confirmar botões "Adicionar outra usina" / "Adicionar outro
     laboratório" no fim da lista (após ter pelo menos um)
   - Confirmar layout em mobile: `.toolbar` deve quebrar para coluna
     pelo `flex-wrap`

2. **Teste de retrocompatibilidade**: abrir rascunho da v5.22.21
   com fornecedores cadastrados — devem aparecer normalmente, com
   tipo preservado.

## Como validar localmente

```bash
cd frontend
npm install
npx tsx smoke-pipeline.ts    # esperado: 254 OK / 0 FAIL
npx tsx smoke-contrast.ts    # esperado: 89 OK / 0 FAIL
npm run build                # esperado: ✓ built (≈ 10s)
npm run dev                  # abre http://localhost:5173
```

Para testar manualmente: navegar para Etapa 6 (Fornecedores). Os dois
botões devem aparecer no topo do card.

## Como publicar no Netlify

Sem mudanças no `netlify.toml`. Push para `main` dispara rebuild.

## Como configurar Supabase

Sem mudanças no schema. Sem migration. Sem ação em banco. Campo `tipo`
já existia em `Fornecedor` desde v5.22.7.

## Como migrar para .NET 8 + SQL Server

Sem impacto. Frontend-only.

## Próximo ciclo recomendado

Mantém-se a sugestão da v5.22.21:

**v5.22.23** — Link compartilhável `?draft=:id` + lista
`/meus-rascunhos`. Fecha cenários de borda (troca de máquina, várias
obras paralelas).

**v5.22.24** — Cobertura Step6 (Usuários) e Step7 (Fornecedores) no
PendenciasPanel foco. Requer expor IDs persistentes para `usuariosObra`
e `fornecedores` no validation service. Médio.

**v5.22.25** — Pulse animation no input focado. Pequeno.

**v5.22.26** — Limpeza de labels obsoletas `"Etapa N"` no
validationService.ts. Pequeno; dívida técnica.
