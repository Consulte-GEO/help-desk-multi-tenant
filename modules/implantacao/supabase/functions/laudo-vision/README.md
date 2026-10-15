# Edge Function `laudo-vision` · V14

Proxy server-side da leitura assistida do Leitor de Laudos (`/laudos`). A chave da
OpenAI fica **somente aqui**; o cliente público nunca a vê.

## Deploy

```bash
supabase functions deploy laudo-vision --project-ref yglcnirbnbwjqpvalqif --no-verify-jwt
```

`verify_jwt=false`, igual à `importa-openai`: quem chama é uma **página estática**
(`laudos.html`), que não tem sessão Supabase. A proteção não é o JWT — é:

- **origin allowlist** (`setup.consultegeo.org` + localhost de dev). Requisição sem
  `Origin` é recusada com `origin_required`, salvo `LAUDO_VISION_ALLOW_NO_ORIGIN=true`;
- **consentimento explícito** (`consent: true`) por lote, marcado pelo operador;
- **quota por origem e por sessão** (RPC `ocr_laudo_reservar_quota`), reservada
  **antes** de cada unidade consumida — inclusive as duas passadas e a releitura;
- validação de MIME, assinatura real do arquivo, dimensões e teto de resolução.

## Pré-requisitos

| Item | Por quê |
|---|---|
| Migration `20260903_026_ocr_laudo_telemetria.sql` aplicada | a quota é RPC `security definer`; sem ela a função **falha fechada** (`rate_limit_unavailable`) |
| `OPENAI_API_KEY` | credencial do provedor |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` | injetados pelo runtime; usados só para quota e telemetria |

Opcionais: `LAUDO_VISION_PRIMARY_MODEL` (padrão `gpt-5.6-luna`),
`LAUDO_VISION_RETRY_MODEL` (padrão `gpt-5.6-terra`),
`LAUDO_VISION_ALLOW_NO_ORIGIN`.

O alias curto `gpt-5.6` é **bloqueado**: resolve para modelos diferentes conforme a
conta e a data, o que seria troca silenciosa de motor de leitura.

## Contrato

Uma página por chamada.

```jsonc
// requisição
{
  "consent": true,
  "session_id": "<id gerado no navegador>",
  "file_hash": "<sha256 do PDF>",
  "file_name": "laudo.pdf",
  "page": 3,
  "page_count": 7,
  "profile": "auto | generico | polimix | concrelab | prisma",
  "image_base64": "...",
  "mime": "image/jpeg",
  "image_diagnostics": { "blur": 0.2, "contrast": 0.8 }
}

// resposta
{
  "ok": true,
  "page": {
    "pagina": 3,
    "resultados": [ { "linha": 1, "cp": {"estado":"valor","valor":"101","raw":"101","motivo":null}, "…": {} } ],
    "legibilidade": 0.87,
    "avisos": [],
    "laudo_numero": {}, "laboratorio": {}, "obra": {}
  },
  "divergences": [ { "resultIndex": 0, "campo": "mpa", "a": {}, "b": {} } ],
  "validation_codes": ["DIVERGENCIA_ENTRE_PASSADAS"],
  "diagnostics": { "used_retry": false, "passes": 2, "openai_calls": 2, "…": {} },
  "reading_token": "<uuid da leitura, para a confirmação>"
}
```

Confirmação da revisão humana (mede *false fill* sem guardar dado do laudo — a
função hasheia os valores antes de gravar):

```jsonc
{ "action": "confirm", "reading_token": "<uuid>",
  "fields": [ { "result_index": 0, "field": "mpa", "verdict": "corrigiu",
                "ocr_value": "32.4", "final_value": "32.9" } ] }
```

## Como a leitura é feita

1. **Duas passadas independentes** do modelo primário sobre a mesma imagem, com
   estratégias de varredura diferentes (`linhas` e `colunas`). Nenhuma das duas vê
   o resultado da outra — anti-ancoragem.
2. **Consenso posicional.** Campo em que as duas concordam vale; campo divergente
   vira `ilegivel` com os dois candidatos anexados, para o operador decidir na tela.
3. **Passada única não é consenso.** Se uma falhar tecnicamente, a sobrevivente é
   devolvida marcada (`PASSADA_UNICA_SEM_CONSENSO`) e com confiança rebaixada.
4. **Releitura funcional** com o modelo de retry só quando campo crítico (MPa ou
   idade) continua pendente. Ela **substitui** a interpretação anterior — não se
   garimpa valor entre leituras contraditórias.
5. **Structured Outputs estrito** (`json_schema`, `strict: true`), `store: false`,
   `reasoning.effort: none` nos modelos que suportam.
6. **O código valida o que o modelo propõe**: faixas de MPa/idade/datas, unidade de
   idade nunca inferida, estado `valor`/`ausente`/`ilegivel` decidido no servidor.

## Limites

`MAX_IMAGE_BYTES` 6 MB · corpo 9 MB · resolução até 30 000 patches de 32 px ·
1 retry técnico por passada (`408/500/502/503/504`) · quota 240/h por origem e
120/h por sessão.

## Não publicado ainda

Esta função **não foi deployada** na entrega V14 — o código é novo e nunca chamou o
provedor. Publique em preview, rode o corpus com laudos reais e só então libere.
