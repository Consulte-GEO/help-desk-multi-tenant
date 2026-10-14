# UX09 — integração e revisão transversal

Objetivo: testar a composição real de UX01–UX08 com o `app.js` completo e o CSS legado, corrigir regressões comprovadas e entregar um único cumulativo sem ativar recursos opcionais.

Base: Help Desk `604478e2d05ed019baac6d92a9a04db236fafb82`; frente paralela verificada nesta rodada `785fa2d8aa6e719763f87c8518939dc80fd91f26`. Não mesclar nem publicar nesta sessão. Esta é uma cópia seletiva com o frontend principal integral, não um checkout integral do backend.

## Restrições
- Preservar Auth, escopos, contratos, idempotência, migrations e gate operacional.
- `ADVANCED_ACCESS=false`, sem montar callback GEO ou módulos opcionais no aplicativo.
- Nenhum segredo, fonte tipográfica ou dado real nas fixtures/evidências.
- Não substituir o controlador principal por fixture: simular somente respostas HTTP.
- Falhas em CSS ou assets opcionais não devem alterar permissões ou autorizar comandos.
- Não apresentar testes simulados como PostgreSQL, hosted, CI ou homologação.

## Entregas e ciclos
- [x] Recuperar o controlador completo e dependências de runtime, conferir blobs de origem.
- [x] Aplicar localmente as 19 ligações exatas UX08; confirmar reversão à fonte.
- [x] Criar bancada Playwright com HTML, CSS e módulos originais, fixtures de transporte, com adaptação somente dos endereços de import no modo offline.
- [x] Registrar falhas antes de alterar produto; corrigir apenas as causas identificadas.
- [x] Exercitar login, gate fechado, portal/equipe, filtros, detalhe móvel, criação/revisão/ambiguidade, resposta/nota, conflitos, saída e respostas tardias.
- [x] Validar cadeia de imports e assets estáticos, testar build quando todas as dependências estiverem recuperadas.
- [x] Reexecutar testes focais anteriores e registrar limites da suíte completa.
- [ ] Atualizar aplicador cumulativo, proteção de checkpoints, handoff, matriz e roteiro de publicação.

## Revisão final
Foco perdido em controles ocultos; notas internas expostas na audiência pública; envios repetidos; mensagens de falha que desaparecem; conflitos entre CSS legado e novo; contagens indisponíveis tratadas como zero.
