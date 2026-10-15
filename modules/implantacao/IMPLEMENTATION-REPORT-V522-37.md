# Implementation Report · Implantação Consulte GEO v5.22.37

## Resumo executivo

Evolução da ajuda contextual: cada etapa agora aceita **até 5 imagens**
de exemplo, com carrossel (setas) no painel do cliente quando há mais
de uma. Pipeline: **551 OK (+16) · Contraste: 89 OK · Build: ✓ 7.47s**.
1 migration nova (altera tabela existente). Sem Edge Function.

## Demanda

> "Permitir anexar até 5 imagens de exemplo e, se inserido mais de
> uma, o usuário poderá alternar entre os exemplos com uma seta."

## Mudanças

### Modelo de dados (migration 015)

`image_path text` (single) → `image_paths text[]` (até 5):

```sql
alter table public.setup_step_help
    add column if not exists image_paths text[] not null default '{}';

update public.setup_step_help
   set image_paths = array[image_path]
 where image_path is not null and length(trim(image_path)) > 0
   and coalesce(array_length(image_paths, 1), 0) = 0;

-- constraint: máximo 5
check (coalesce(array_length(image_paths, 1), 0) <= 5)
```

`image_path` fica deprecado mas mantido (leitura de dados antigos);
o frontend sincroniza com a 1ª imagem ao salvar.

### Service (stepHelpService.ts)

- `MAX_IMAGES_PER_STEP = 5`
- `StepHelp.image_paths: string[]`
- `normalizeRow()` — garante array mesmo lendo dados pré-015
  (fallback de `image_path` → `[image_path]`)
- `resolveImageUrls(paths[])` — URLs públicas em lote
- `saveStepHelp` trunca em 5 + sincroniza `image_path`

### Admin (AdminStepHelpView.vue)

- `<input type="file" multiple>` + `onPickImages`
- `slotsLeft = maxImages - image_paths.length`; sobe só o que cabe,
  avisa o que ignorou
- Input desabilitado ao atingir 5
- Grade de thumbnails (`object-fit: cover`, 4:3) com botão × remover
- Contador "N/5"

### Cliente (StepHelpPanel.vue)

- `imageUrls[]` + `imageIndex`
- 1 imagem: exibe direto
- 2-5 imagens: setas ‹ ›, indicador "N/total", dots clicáveis
- `prevImage`/`nextImage` com wrap-around circular
- Clicar abre tamanho real (nova aba)

## Decisões registradas

**Por que `text[]` e não tabela filha `setup_step_help_images`?**

Até 5 itens, sem metadados por imagem (sem legenda individual, sem
ordenação manual complexa). Um array é mais simples de ler/escrever
e de migrar. Se no futuro precisar de legenda por imagem ou
reordenação drag-and-drop, aí sim vira tabela 1:N.

**Por que manter image_path?**

Dados da v36 podem já existir em produção com `image_path` populado.
Remover a coluna quebraria leitura durante a transição. Mantenho,
sincronizo com `image_paths[0]` ao salvar, e `normalizeRow` cobre a
leitura de registros antigos que só tenham `image_path`.

**Por que wrap-around no carrossel?**

Galeria pequena (≤5). ‹ na primeira volta pra última. É o
comportamento esperado em carrosséis de poucos itens; evita
"becos sem saída" na navegação.

**Por que truncar em 5 em três camadas?**

Defesa em profundidade: (1) constraint no banco, (2) `slice(0,5)`
no service ao salvar, (3) `slotsLeft` na UI ao subir. Qualquer
caminho que escape de uma camada é pego pela próxima.

## Limitações aceitas

- **Sem reordenação** das imagens (ordem = ordem de upload). Para
  mudar, remove e re-sobe.
- **Sem legenda por imagem** (só título/descrição da etapa toda).
- **Sem crop/resize**: imagem sobe como está (≤5MB cada).

## Arquivos novos

| Arquivo | Linhas |
|---|---|
| `supabase/migrations/20260522_015_step_help_multiple_images.sql` | ~50 |
| `IMPLEMENTATION-REPORT-V522-37.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/services/stepHelpService.ts` | image_paths[], resolveImageUrls, normalizeRow, MAX=5 |
| `frontend/src/components/StepHelpPanel.vue` | carrossel com setas + dots + indicador |
| `frontend/src/views/AdminStepHelpView.vue` | upload múltiplo + thumbnails + remover |
| `frontend/smoke-pipeline.ts` | +16 testes; flex v36 |
| `frontend/package.json` | bump 5.0.22-37 |
| `README.md`, `docs/CHANGELOG_SOLICITACOES.md` | atualizados |

## Validações executadas

| Validação | Resultado |
|---|---|
| Baseline v5.22.36 | 535 OK |
| `vue-tsc --noEmit` | limpo |
| Pipeline | **551 OK / 0 FAIL** (+16) |
| Contraste | **89 OK / 0 FAIL** |
| Build | **OK 7.47s** |

## Nota sobre o ambiente de build

Persiste o comportamento da v36: arquivos criados na sessão somem
durante `vite build`. Mitigação: copiar os arquivos e rodar o build
no mesmo comando encadeado (`&&`). Irrelevante em produção (Netlify
builda do checkout git). A re-validação do zip foi feita assim.

## Pendências manuais (deploy)

### 1. Aplicar migration 015 (DEPOIS da 014)

```bash
# SQL Editor: cole 20260522_015_step_help_multiple_images.sql → Run
# OU: supabase db push --project-ref yglcnirbnbwjqpvalqif
```

**Importante**: a 015 pressupõe que a 014 (tabela + bucket) já foi
aplicada. Se você ainda não aplicou a 014, aplique as duas em ordem.

### Validar
```sql
-- coluna existe
select column_name from information_schema.columns
 where table_name = 'setup_step_help' and column_name = 'image_paths';

-- constraint existe
select conname from pg_constraint where conname = 'setup_step_help_max_5_images';
```

### 2. Push do frontend → Netlify

Sem variáveis novas. Sem Edge Function. Mesmo bucket Storage.

### 3. Smoke tests

#### A. Admin — upload múltiplo
1. `/admin/ajuda` → etapa Concretos
2. Selecionar 3 imagens de uma vez → 3 thumbnails aparecem, "3/5"
3. Adicionar mais 3 → sobe 2, avisa "1 ignorada (limite 5)", "5/5"
4. Input fica desabilitado em 5
5. Remover 1 (botão ×) → "4/5", input reabilita
6. Salvar → "Salvo ✓"

#### B. Cliente — carrossel
7. Wizard → Etapa 3 → expandir ajuda
8. Com 1 imagem: sem setas
9. Com 2+: setas ‹ ›, indicador "1/4", dots
10. Clicar › avança; na última, › volta pra 1ª (wrap)
11. Clicar num dot pula direto
12. Clicar na imagem abre tamanho real

#### C. Compat dados v36
13. Se havia ajuda da v36 (image_path único), após migração 015 o
    cliente vê a imagem normalmente (migrada para image_paths[0])

## Como migrar para .NET 8

- Opção A: coluna `ImagePaths` como JSON/array no EF Core
- Opção B (se crescer): tabela `SetupStepHelpImage` (1:N) com
  `StepHelpId`, `Path`, `SortOrder`
- A normalização de leitura (`normalizeRow`) vira lógica no DTO mapper

## Próximo ciclo recomendado

- Reordenação das imagens (drag-and-drop) — exigiria tabela 1:N
- Legenda por imagem
- Crop/resize no upload
- Preview do painel montado dentro do admin
- **Deploy consolidado v32-v37** (segue pendente — agora com
  migrations 014 + 015)
