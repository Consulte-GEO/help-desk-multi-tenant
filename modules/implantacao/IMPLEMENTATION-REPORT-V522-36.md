# Implementation Report · Implantação Consulte GEO v5.22.36

## Resumo executivo

Sistema completo de ajuda contextual configurável por etapa do wizard:
vídeo do YouTube + imagem de exemplo + título/descrição, configurados
pelo admin e consumidos dinamicamente nas telas do cliente. Pipeline:
**535 OK (+21) · Contraste: 89 OK · Build: ✓ 6.83s**. 1 migration nova
+ Storage bucket. Sem Edge Function nova.

## Demanda original

> "Na tela de administrador, para cada aba de cadastro da implantação,
> incluir um link para vídeo do YouTube e uma imagem de exemplo.
> Configurável pelo admin. Depois implementar nas telas do usuário que
> faz o cadastro."

Decisões do usuário às perguntas de escopo:
1. Imagem: **upload via Storage**
2. Etapas: **todas**
3. **1 vídeo + 1 imagem**, tudo dinâmico (vazio não aparece)
4. Título + descrição: **sim**
5. **Executar tudo em sequência** (admin + consumo no wizard)

## Arquitetura

```
ADMIN (/admin/ajuda)                  CLIENTE (wizard)
─────────────────────                 ─────────────────
AdminStepHelpView.vue                 SetupPage.vue
  │ edita por etapa                     │ step atual (1..7)
  │                                     ▼
  ├─ saveStepHelp() ──┐               StepHelpPanel.vue
  ├─ uploadImage() ───┤                 │ getStepHelp(stepKey)
  │                   │                 │ só se enabled=true
  ▼                   ▼                 ▼
setup_step_help    Storage           setup_step_help (leitura)
(Postgres + RLS)   step-help-images  + resolveImageUrl()
                   (bucket público)
```

### Tabela setup_step_help (migration 014)

| Coluna | Tipo | Nota |
|---|---|---|
| step_key | text unique | chave estável: dados-basicos, concretos… |
| youtube_url | text | link cru que o admin colou |
| youtube_video_id | text | ID extraído/normalizado |
| image_path | text | path no bucket (não URL) |
| help_title | text | ≤ 200 chars |
| help_description | text | ≤ 1000 chars |
| enabled | boolean | toggle por etapa |
| updated_by, updated_at | — | auditoria + trigger |

RLS: leitura `enabled=true OR is_admin()`; escrita só `is_admin()`.

### Storage bucket step-help-images

- Público para leitura (qualquer cliente vê a imagem)
- Upload/update/delete só admin (RLS em storage.objects)
- Path: `{step_key}/{timestamp}-{filename-sanitizado}`

## Decisões registradas

**Por que step_key texto e não número da etapa?**

A numeração das etapas JÁ mudou no projeto: v5.22.11 removeu a antiga
Etapa 2 e renumerou tudo. Se a ajuda fosse atrelada a número, toda
renumeração futura quebraria os vínculos. `step_key` estável
(`dados-basicos`, `estruturas`, `concretos`, `pecas`, `usuarios`,
`fornecedores`, `revisao`) desacopla. O mapa `STEP_KEY_BY_ID` traduz
o número atual → chave num único lugar.

**Por que guardar image_path e não image_url?**

A URL pública do Storage tem o formato
`https://{projeto}.supabase.co/storage/v1/object/public/{bucket}/{path}`.
Guardar a URL inteira no banco congela o domínio. Guardamos só o
`path` e derivamos a URL no frontend via `getPublicUrl()`. Se o
projeto migrar de domínio/região, nada quebra.

**Por que extrair o videoId em vez de embedar a URL crua?**

- URLs `watch?v=` NÃO funcionam em `<iframe>` (YouTube bloqueia) —
  precisa ser `/embed/`
- Normalizar previne XSS: só geramos embed se o ID casar
  `[A-Za-z0-9_-]{11}`; não dá para injetar `javascript:` ou URL
  arbitrária
- Permite thumbnail de graça (`img.youtube.com/vi/{id}/...`)

**Por que "tudo dinâmico"?**

O `StepHelpPanel` só renderiza se `hasContent` (tem vídeo OU imagem).
Etapa sem nada configurado = nenhum painel, zero ruído visual. Dentro
do painel, vídeo e imagem aparecem independentemente (CSS
`:only-child` faz o único presente ocupar a largura toda).

**Por que import estático no router (não dynamic import)?**

Inicialmente usei `() => import('../views/AdminStepHelpView.vue')`.
Troquei para import estático por consistência com os demais views
(SetupPage, ReviewView, etc. são todos estáticos) e para evitar um
problema de resolução do bundler.

**Por que guard de race no StepHelpPanel?**

Trocar de etapa rápido dispara vários `getStepHelp` async. Sem guard,
a resposta de uma etapa antiga poderia sobrescrever a atual. O
`loadedKey` marca a etapa "vigente"; respostas obsoletas são
descartadas (`if (this.loadedKey !== stepKey) return`).

## Limitações aceitas

- **1 vídeo + 1 imagem por etapa** (conforme pedido). Galeria/playlist
  exigiria modelagem N:1.
- **Sem versionamento** da ajuda (última escrita vence).
- **Imagem até 5MB**, validada no cliente + Storage. Sem
  redimensionamento automático.
- **Sem preview de como fica no wizard** dentro do admin (o admin vê
  previews isolados de vídeo e imagem, não o painel montado).

## Arquivos novos

| Arquivo | Linhas |
|---|---|
| `supabase/migrations/20260522_014_setup_step_help.sql` | ~155 |
| `frontend/src/services/youtubeService.ts` | ~46 |
| `frontend/src/services/stepHelpService.ts` | ~122 |
| `frontend/src/components/StepHelpPanel.vue` | ~97 |
| `frontend/src/views/AdminStepHelpView.vue` | ~321 |
| `IMPLEMENTATION-REPORT-V522-36.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/router/index.ts` | rota `/admin/ajuda` + import |
| `frontend/src/views/AdminDashboardView.vue` | link "Ajuda das etapas" no topbar |
| `frontend/src/views/SetupPage.vue` | `<StepHelpPanel :step-id="step" />` |
| `frontend/smoke-pipeline.ts` | +21 testes; flex check v35 |
| `frontend/package.json` | bump 5.0.22-36 |
| `README.md`, `docs/CHANGELOG_SOLICITACOES.md` | atualizados |

## Validações executadas

| Validação | Resultado |
|---|---|
| Baseline v5.22.35 | 514 OK |
| `vue-tsc --noEmit` | limpo |
| Pipeline | **535 OK / 0 FAIL** (+21) |
| Contraste | **89 OK / 0 FAIL** |
| Build | **OK 6.83s** |

## Nota sobre o ambiente de build desta sessão

Durante esta sessão, o sandbox apresentou um comportamento em que
arquivos criados na sessão somem do disco quando um processo pesado
(`vite build`) roda. Os arquivos pré-existentes (do clone) sobrevivem;
os novos não. Isso afeta SÓ o ambiente de validação, não o código.

Solução aplicada: rodar o `vite build` no mesmo comando shell que
copia os arquivos (encadeado com `&&`), garantindo que o bundler os
leia antes de qualquer perda. A tripla completa passou assim.

Em produção (Netlify), isso é irrelevante: o build roda a partir do
git checkout, com todos os arquivos presentes desde o início.

## Pendências manuais (deploy)

### 1. Aplicar migration 014

```bash
# SQL Editor: cole 20260522_014_setup_step_help.sql → Run
# OU: supabase db push --project-ref yglcnirbnbwjqpvalqif
```

**Atenção**: a migration cria um bucket de Storage. O Storage precisa
estar habilitado no projeto Supabase (já vem habilitado por padrão).

### 2. Validar Storage

No Dashboard → Storage, confirmar que o bucket `step-help-images`
existe e está público.

### 3. Push do frontend → Netlify

Sem variáveis novas. Sem Edge Function nova.

### 4. Smoke tests

#### A. Admin configura
1. `/admin` → clicar "Ajuda das etapas" → vai para `/admin/ajuda`
2. Para a etapa Concretos: colar link YouTube → "✓ Vídeo reconhecido"
3. Preview do vídeo aparece à direita
4. Fazer upload de uma imagem → preview aparece
5. Preencher título + descrição
6. "Salvar etapa" → "Salvo ✓"

#### B. Cliente vê
7. Abrir o wizard `/` → ir até a Etapa 3 (Concretos)
8. Painel "Material de apoio" aparece (colapsado)
9. Expandir → vídeo embed + imagem + texto
10. Ir para uma etapa SEM config → nenhum painel aparece

#### C. Dinâmico
11. No admin, desativar (toggle) uma etapa → cliente deixa de ver
12. Remover o vídeo mas manter imagem → cliente vê só imagem
    (ocupa largura toda)

#### D. YouTube robusto
13. Testar formatos: `youtube.com/watch?v=X`, `youtu.be/X`,
    `youtube.com/embed/X` → todos devem ser reconhecidos
14. Colar link inválido → "Link de YouTube inválido"

## Como migrar para .NET 8

- Tabela `SetupStepHelp` (EF Core), mesmo schema
- Endpoints: `GET /api/step-help` (público), `GET /api/step-help/{key}`,
  `PUT /api/step-help/{key}` (admin), `POST /api/step-help/{key}/image`
  (admin, multipart)
- Storage: trocar Supabase Storage por Azure Blob / S3; o `image_path`
  vira a key do blob; URL pública derivada no backend
- Normalização de YouTube: porta direta do `youtubeService` (lógica
  pura, sem dependência)

## Próximo ciclo recomendado

- **Preview do painel montado** dentro do admin (como o cliente vê)
- **Reordenar/galeria** se 1 imagem for pouco
- **Ajuda também no /r/:token** (equipe) se fizer sentido
- **Analytics**: quantos clientes expandiram a ajuda por etapa
- Deploy consolidado v32-v36 (segue pendente)
