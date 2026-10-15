# Edge Functions · Implantação Consulte GEO · v5.22.45

## Princípio

As Edge Functions são a fronteira para operações que exigem `service_role`,
envio de e-mail ou composição de dados protegidos. O frontend envia somente os
payloads necessários; a planilha bruta nunca é enviada à IA.

## Funções alteradas na V8

### `submit-for-validation`

Arquivo: `supabase/functions/submit-for-validation/index.ts`

Fluxo V8:

1. valida método, JSON, tamanho, `draftId` e `draftToken`;
2. carrega o draft por id+token e exige estado editável/não bloqueado;
3. aplica rate limit por IP e por draft;
4. cria a submission;
5. reserva número e cria o ticket;
6. bloqueia o draft revalidando id+token+estado;
7. envia os e-mails de equipe e cliente;
8. registra auditoria e retorna somente metadados públicos do protocolo.

A operação cruza Postgres e Resend e, portanto, não é uma transação única. O
fonte implementa **compensação**: remove submission/ticket parciais se reserva,
ticket ou lock falharem antes dos e-mails. Isso reduz órfãos, mas não equivale a
atomicidade distribuída.

### `share-draft-link`

Arquivo: `supabase/functions/share-draft-link/index.ts`

Valida id+token, status e lock do draft antes do envio. O token fica no fragmento
do link (`#draft=...&token=...`), não no path/query HTTP. Inputs livres são
limitados e escapados no HTML.

## Estado remoto confirmado em 07/08/2026

| Função | Estado remoto | Verificação |
|---|---|---|
| `submit-for-validation` | **ACTIVE**, versão **4**, `verify_jwt=true` | fonte remoto inspecionado: exige `draftId + draftToken`, valida lock/status e compensa falhas antes do e-mail |
| `share-draft-link` | **ACTIVE**, versão **1**, `verify_jwt=true` | fonte remoto inspecionado: exige `draftId + draftToken`, valida lock/status e monta token somente no fragmento |
| `importa-openai` | **ACTIVE**, versão **1** | não alterada; segue opcional e recebe somente resumos agregados |

O inventário remoto e os fontes das duas funções V8 foram lidos diretamente no
projeto `yglcnirbnbwjqpvalqif`. Não foi executado um caminho positivo de envio,
pois ele criaria ticket/e-mail real. Uma tentativa de testar respostas
não destrutivas por HTTP a partir do container foi bloqueada pela resolução DNS
do ambiente, não pela função.

## Deploy/redeploy

Use somente quando o fonte remoto precisar ser atualizado:

```bash
supabase functions deploy submit-for-validation \
  --project-ref yglcnirbnbwjqpvalqif
supabase functions deploy share-draft-link \
  --project-ref yglcnirbnbwjqpvalqif
```

Segredos/variáveis:

```text
RESEND_API_KEY
EMAIL_FROM
NOTIFICATION_RECIPIENTS
REVIEW_URL_BASE
CLIENT_STATUS_URL_BASE       opcional
APP_URL_BASE ou SETUP_URL_BASE
```

Mantenha a verificação JWT e preserve a validação de capacidade por
`draftToken`: um JWT anônimo válido, sozinho, não concede posse do draft.


## Automação de deploy

Não há workflow versionado nesta V8. Os secrets do GitHub não foram confirmados,
portanto um pipeline seria potencialmente quebrado. Crie um workflow manual e
protegido somente depois de configurar `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_PROJECT_ID`, environment de produção e confirmação explícita.

## Testes seguros antes de produção

Em preview/staging e com destinatários controlados:

- payload inválido → 400;
- token incorreto → 403 sem revelar outro draft;
- draft bloqueado/não editável → 409;
- submissão válida → um ticket e draft bloqueado;
- falha antes do lock → sem submission/ticket órfão;
- link compartilhado → e-mail correto e token somente no fragmento;
- ausência de Supabase/Resend → erro explícito, nunca sucesso local falso.

---

## Estado em produção · 10/08/2026 (V11)

Inventário vivo confirmado via MCP após os deploys desta data:

| EF | Versão | verify_jwt | Situação |
|---|---|---|---|
| `submit-for-validation` | v4 | ✅ | viva desde 19/05, atualizada 07/08 |
| `share-draft-link` | v1 | ✅ | viva desde 07/08 |
| `importa-openai` | v1 | ❌ (por design) | proxy IA do Copilot importa.html |
| `notify-return` | **v1 — DEPLOYADA 10/08** | ✅ | email de devolução ao responsável |
| `notify-team-comment` | **v1 — DEPLOYADA 10/08** | ✅ | email ao cliente quando a equipe comenta |
| `notify-client-comment` | **v1 — DEPLOYADA 10/08** | ✅ | email à equipe quando o cliente comenta |

As três `notify-*` estavam no source e eram chamadas pelo frontend, mas
nunca haviam sido deployadas (falha silenciosa — PK gotcha #12). Os
imports foram alinhados ao padrão vivo (`esm.sh/@supabase/supabase-js@2.45.4`).
`verify_jwt` por função agora vive em `supabase/config.toml` (fonte do
CLI/CI); o workflow `.github/workflows/deploy-edge-functions.yml` faz o
deploy automático quando o secret `SUPABASE_ACCESS_TOKEN` existir (é
no-op seguro sem ele).

`laudo-vision` e `admin-bootstrap` continuam no source SEM deploy — sem
chamador no frontend; decidir implantar ou remover antes de incluí-las
no CI. As 5 EFs legadas do app anterior (`setup-users`,
`dispatch-analysis`, `run-analysis`, `admin-api`, `gemini-proxy`) não
pertencem a este app — destino em PK backlog §2.4.
