# Help Desk independente — API/interface 0.19.0

**M1 aberto.** Produto genérico multiproduto e multicontrato. O núcleo não incorpora campos próprios de GeoLab, Financeiro ou outro consumidor.

## Retomada atual — R19 / 01-10-2026
Código acumulado R10–R18, revalidado sem mudanças funcionais nesta rodada. **1.417 testes Node e 35 verificações HTTP em memória passaram.** Instalação/auditoria/typecheck padrão, 215 testes PostgreSQL, navegador e gate não foram aprovados aqui. O deploy R9 existe; o acumulado local não está publicado nem homologado.

Leia [documento mestre](PROJECT_HELP_DESK.md), [estado](docs/102-M1-R19-ESTADO-E-EVIDENCIAS.md), [handoff](docs/103-M1-R19-HANDOFF-E-BACKLOG.md) e [tarefa de integração](docs/104-M1-R19-TAREFA-CODEX.md). A próxima ação é integrar e executar a validação real; não criar outra funcionalidade M2 como substituto.

## Instalação e verificação
O `package-lock.json` já existe. Preserve-o e use:

```bash
npm ci --ignore-scripts
npm run check:lock
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
```

O banco da suíte é PostgreSQL 17 novo, local e descartável. Não apontar os testes SQL para o Supabase remoto. Homologação consolidada e conferência das evidências:

```bash
npm run homologate:local
npm run check:homologation
```

O primeiro comando repete etapas deliberadamente para gerar um conjunto coerente; não juntar logs de execuções diferentes. Falta de dependências, SQL ou browser deve manter o gate fechado. O build gera frontend estático; empacotamento e execução da Function são verificações separadas.

## Demonstração e clientes de aceitação
`npm run demo` usa dados fictícios em memória. Os comandos `test:hosted:read`, `test:hosted:auth` e `test:hosted:write` apresentam plano sem rede por padrão; seus exemplos são fictícios. Execução com sessões, gravações e destino precisa de autorização e isolamento explícitos. Não incluir credenciais em arquivos ou logs. Os detalhes permanecem nos documentos 65–100.

API/interface 0.19.0; schema 0.18.0; 11 migrations históricas preservadas; 18 operações HTTP. Nunca ligar `HELPDESK_RELEASE_APPROVED` para contornar pendências, nem usar `postgres`/`service_role` como identidade de atendimento.

## Histórico
[README integral anterior](docs/history/r18-README.md). As decisões arquiteturais e os registros das entregas anteriores continuam disponíveis; seus números e destinos não substituem os estados atuais.
