# Bancada UX09

Rodar no checkout completo, após aplicar o cumulativo:

```sh
npm test
npm run build
node scripts/visual-integration/check-assets.mjs
node scripts/visual-inbox/verify-integration.mjs
node scripts/visual-opening/verify-integration.mjs
node scripts/visual-access/verify-integration.mjs
python scripts/visual-integration/browser-check.py --output evidence/ux09/integrated
```

Requer Python com Playwright e Chromium. A bancada usa `/usr/bin/chromium` por padrão; a variável `CHROMIUM_EXECUTABLE` permite indicar o binário local. Não modifica políticas do navegador. Todos os requests são interceptados e as respostas são fictícias. Não executar transport.py ou runtime.py dentro da aplicação publicada.

O teste principal é offline por causa da política do ambiente de desenvolvimento. Imports são resolvidos em dados locais e o CSS legado integral é carregado. Os controladores da aplicação NÃO são substituídos. As verificações não aprovam HTTP/CSP, Supabase, PostgreSQL, permissões SQL ou provedores remotos.

`check-assets.mjs` exige `dist` construído e confere referências literais. Bibliotecas de terceiros podem exigir extensão revisada da lista de formatos no futuro; não adicionar exceções para suprimir arquivo inesperado.

O uso de `npm test` é obrigatório no repositório completo: a contagem local documentada corresponde somente aos testes que estavam na cópia seletiva recuperada, não à suíte global do Help Desk.
