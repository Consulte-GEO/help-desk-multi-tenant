# Consulte Help Desk — v0.2.0 / avanço do M1

Help Desk independente, multiproduto e multicontrato. Workspace, conta, produto/instância, contrato/versão e cobertura continuam sendo conceitos distintos.

**Esta entrega não encerra o M1 e não está publicada ou liberada para produção.** Há 186 testes locais aprovados e seis verificações HTTP em demonstração de memória. Os 35 cenários PostgreSQL foram escritos, mas não executados. Registry, Docker e navegador apresentaram bloqueios documentados. Não aplicar migrations no Supabase remoto para experimentar.

## Executar localmente

Com Node 22.16 compatível com `package.json`:

```bash
npm test
npm run demo
```

A demonstração usa `http://127.0.0.1:4317`, com perfis e contas fictícios, sem Supabase, driver externo, e-mail ou webhook. Dados desaparecem ao reiniciar. Esse servidor não é runtime de produção e nunca é fallback de falha do banco. A validação visual ainda não foi aprovada.

Em outro terminal, com a demo ativa:

```bash
node scripts/smoke-local-http.mjs
```

## Instalação reproduzível e SQL verdadeiro

Em ambiente com acesso autorizado ao registry:

```bash
npm run deps:resolve
npm run check:lock
npm ci --ignore-scripts
npm run verify
npm audit --audit-level=high
# Com Docker local, depois de instalar as dependências:
npm run test:db:local
```

O lockfile **não existe nesta entrega**: a resolução falhou por DNS. Não foi fabricada integridade de pacotes. O CI exige lock e `npm ci`, sem fallback para `npm install`. O script PostgreSQL cria apenas um container local descartável, exige banco dedicado e recusa targets remotos. Os testes e migrations ainda podem revelar erros quando executados realmente.

`npm run build` copia assets para `dist`; não empacota Netlify Functions. `npm run verify:release` bloqueia corretamente enquanto não houver lock e verificações aprovadas. `.env.example` contém nomes e exemplos não funcionais. Não ligar `HELPDESK_RELEASE_APPROVED` apenas para remover o 503.

## Mudanças principais

Cache idempotente reautorizado, scopes e transições protegidos em SQL candidato, conexão restrita/TLS e guard de schema, rate limiting compartilhado preparado, quotas de sessões/reenvios, manutenção de dados técnicos separada do histórico, paginação de conversa e estado de interface resistente a respostas atrasadas.

A API agora pagina mensagens/notas/timeline com padrão 50, máximo 100 e `next_cursor`, em ordem decrescente de data/ID. Consumidores da pré-versão anterior precisam adaptar a leitura ilimitada. Nenhum consumidor real foi alterado neste pacote.

## Documentação

- [Arquitetura consolidada](docs/01-ARQUITETURA.md)
- [Roadmap e estado dos marcos](docs/02-PLANO-DE-DESENVOLVIMENTO.md)
- [Segurança/publicação](docs/03-SEGURANCA-E-PUBLICACAO.md)
- [Evidências e limitações desta rodada](docs/04-ESTADO-E-EVIDENCIAS.md)
- [Handoff para fechar M1](docs/05-HANDOFF-REVISAO.md)
- [Controles, limites e retenção técnica](docs/06-M1-SEGURANCA-E-LIMITES.md)
- [OpenAPI](docs/openapi.json) e [alterações de versão](CHANGELOG.md)

Destino informado: Supabase `xaelbntjnvztznnpcvtm`; GitHub `Consulte-GEO/help-desk-multi-tenant`; Netlify `help-desk-multi-tenant`, site `ee32e955-42e5-4417-bf4f-39cbef2366cc`. Nada foi enviado ou aplicado a esses destinos nesta rodada.

O pacote não contém código importado do GeoLab ou dos helpdesks open source da pesquisa. Não há auditoria jurídica das dependências. Administração, intakes, filas/participantes, SLA operacional, anexos, dispatcher/e-mails/webhooks e sessão incorporada por pessoa continuam fora da implementação entregue.
