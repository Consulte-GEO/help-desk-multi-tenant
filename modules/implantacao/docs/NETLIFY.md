# Netlify · Implantação Consulte GEO · v5.22.45

## Projeto

- Nome: `setupobras`
- Site ID: `e2e27b7f-6ec4-4d4e-8c28-037ef37622c5`
- Produção: `https://setup.consultegeo.org`
- Branch configurada: `main`

## Fonte de verdade

`netlify.toml`:

```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "dist"
```

Não publique a raiz e não configure na UI um Base directory que duplique
`frontend`. Assets de `frontend/public/` são copiados pelo Vite para `dist`.

## Estado observado em 07/08/2026

O deploy de produção `6a75f5a745722500080cea23` está `ready`, mas usa o commit
`2f35b6cf55236fbd5a7aaa6bcc7da8b901363d56`. Ele não contém a V8. O `main` do
GitHub já mudou para `69b2e0d6d7d2612cba46a489dee70bf2f4ae5172`, também sem o
histórico V8 local.

O resumo do deploy atual informa três páginas geradas, um redirect processado e
**nenhuma regra de header processada**. Esse dado pertence ao deploy antigo e
reforça a necessidade de conferir os headers após um preview V8.

Nenhum deploy frontend V8 foi executado. O repositório ligado ainda não contém
a árvore V8 e o build oficial ficou bloqueado pelo registry npm interno. Acionar
produção nesse estado publicaria uma fonte diferente da árvore validada.

## Pré-requisitos do preview V8

1. integrar a branch/pacote V8 ao GitHub sem force-push;
2. confirmar as migrations 016–023 no histórico remoto;
3. confirmar `submit-for-validation` ACTIVE v4 e `share-draft-link` ACTIVE v1;
4. executar `npm ci`, build, typecheck, smoke e audit em registry íntegro;
5. disparar deploy de preview; somente depois promover para produção.

## Variáveis de build

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_APP_ENV
VITE_APP_NAME
```

Nunca configure `SUPABASE_SERVICE_ROLE_KEY` no Netlify do frontend.

## Checklist pós-deploy

Rotas:

```text
/
/importa.html
/pre-analise.html
/laudos.html
```

Fluxos:

- salvar e recarregar draft;
- editar com token correto e negar token errado;
- compartilhar link por e-mail controlado;
- submeter, bloquear draft e abrir protocolo;
- painel admin;
- página de status do cliente;
- Pré-importação e Pós-importação;
- PDF de laudos.

Headers esperados conforme `netlify.toml`:

```text
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: ...
Strict-Transport-Security: ...
```

Não declare produção validada sem conferir rotas, fluxos, console e headers no
deploy novo.
