# Consulte Help Desk — v0.10.0 / prontidão e integridade do banco

Produto independente, multiproduto e multicontrato. **Entrega local; M1 aberto; não publicada.**

## O que muda
A inicialização passa a comparar o catálogo PostgreSQL a um contrato explícito de permissões, funções, policies, triggers e constraints. O guard é somente leitura, não consulta dados de atendimento nem repara o banco. O inventário é candidato e ainda exige PostgreSQL real; não comprova o conteúdo semântico de cada função ou policy.

As oito migrations anteriores possuem agora um manifesto SHA-256. O loader verifica formato, ordem, tamanho, UTF-8, arquivos ausentes/extras/alterados e links antes de executar SQL, e entrega os mesmos bytes verificados ao driver. Não gera nem corrige automaticamente o manifesto.

A suíte de banco ganhou um ensaio de upgrade 001–007→008, num segundo banco local novo com fixtures sintéticas, e cenários de desvio das proteções. **Esses testes SQL foram escritos, não homologados.**

O núcleo anterior foi mantido: catálogo autorizado, abertura guiada, busca no servidor, conversas/notas separadas, prioridade auditável, responsabilidade pelo atendimento e histórico. Não há novo endpoint nem backoffice nesta rodada.

## Execução local
```bash
npm run check:migrations
npm test
npm run demo
```
Node utilizado: 22.16.0. Demonstração apenas loopback/memória, sem dados ou serviços reais. `check:migrations` não executa SQL. O manifesto é uma referência revisável, não assinatura ou prova de segurança.

## Homologação
```bash
npm run deps:resolve
# Revisar o lock real, as dependências, integridades e alertas antes de seguir.
npm ci --ignore-scripts
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```
Docker local é padrão; a alternativa nativa exige PostgreSQL 17 instalado, caminho absoluto e usuário não root, conforme `docs/10-M1E-OBSERVABILIDADE-E-POSTGRES-NATIVO.md`. Nenhum fallback remoto ou instalador automático. As duas suítes SQL executam em série num cluster descartável. O banco de upgrade preexistente é recusado, nunca apagado para fazer passar.

## Compatibilidade e limites
**API/interface 0.10.0; schema candidato 0.9.0**, oito migrations intactas, 23 tabelas, 18 operações/14 caminhos. A nova checagem do banco não é monitoramento contínuo nem certificação de segurança. O build é estático, não bundle de Functions. Ver `docs/04-ESTADO-E-EVIDENCIAS.md` para comandos efetivamente executados e tentativas bloqueadas.

Sem push, merge, deploy, migrations remotas, dados, segredos ou MFA. GitHub foi consultado e retornou repositório vazio; Supabase e Netlify não foram reinspecionados. Antes de integrar, consultar os destinos e preservar trabalho concorrente.

[Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Handoff](docs/05-HANDOFF-REVISAO.md) · [Prontidão e upgrade](docs/14-M1I-PRONTIDAO-E-UPGRADE.md) · [OpenAPI](docs/openapi.json).

M2/backoffice, participantes/filas, intakes, SLA, anexos, worker/e-mail/webhooks e sessões incorporadas permanecem fora desta entrega. Não usar dados reais antes da homologação e liberação explícitas.
