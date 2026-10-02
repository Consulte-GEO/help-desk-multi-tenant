# M1-R22 — evidências originais e preparação da integração final

Data: 02/10/2026. Base de código `b77399a4334115bc499c35b6cdf6c0a69f345062`, branch `codex/m1-r21-integracao-r20`; base padrão observada `9fa74499f2f81a61de044d5826fbc398c5e167b3`.

## Alteração desta rodada
Incorporar os arquivos originais de evidência R21, arquivar os arquivos substituídos e atualizar os pontos de entrada. Zero mudança em código, testes, workflow do produto, migrations, dependências, frontend, Functions ou regras de autorização. O executor pontual de transferência está numa branch `ops/` separada e não faz parte da branch do produto; não o mesclar à padrão.

## Origem e integridade
CI 37021243365, tentativa1, artefato11233201399. ZIP SHA-256 `8dabfa81f2ad775024a4296ccfb0ac178f1a60d9fe4f31b17440c4bd2aa0ceaf`.
Fingerprint executável `659e9ad6d69d822888486a59b2c9c6bf5d39c7a3ec1391ee29fd048c0e9a6a82`.
Execução interna `ae00a4ca-bcad-4743-98b8-ec2e0afd6c53`. Download do artefato pelo GitHub, digest confrontado, 13 arquivos preservados byte a byte, seis logs verificados pelo gate existente na fonte exata. Não regenerar timestamps, contagens, origem, hash ou relatório. Arquivos anteriores substituídos ficam em `evidence/m1-r22/previous/`; as pastas de runs históricas não foram apagadas.

## Estados
- Implementado: R20 incorporado na branch R21; R22 muda somente documentação/evidência.
- Testado localmente: reconferência do pacote e dos arquivos; ver relatório da rodada.
- Testado em PostgreSQL real: 215/215 no CI R21, PostgreSQL17 descartável, dados sintéticos.
- Testado em navegador: Chromium real no CI, 31 checks de interface e cinco de sessão sintética; 35 HTTP, total71.
- Node: 1436/1436 no CI R21; lock, instalação padrão, audit e typecheck aprovados.
- Deployado: não estabelecido por esta transferência. Produção observada antes desta rodada continua R19.
- Homologado para atendimento real: não. Operacional: não. M1 aberto; M2 não iniciado.

Esta rodada não é outra execução de 1436/215/71. É preservação e verificação da execução citada. Revisão local pelo executor não é revisão independente. `platform_approved:false` permanece no relatório original; gate técnico não concede autorização operacional.

## Próxima prioridade
1. Conferir HEAD/diff, revisar R20 de forma independente e verificar o gate desta fonte; preparar PR sem merge automático.
2. Aprovar separadamente o isolamento e os destinos de homologação: site, banco, Auth, custos, identidades, dados sintéticos, segredos e consumidores de outbox. IDs de examples são fictícios.
3. Só após autorização/preparo, executar os clientes de Auth, leitura e gravação existentes. Conferir dentro da Function TLS/pooler/role; correlacionar efeitos privados somente em leitura autorizada. Nunca rodar a suíte destrutiva de CI no Supabase hospedado.
4. Completar concorrência, capacidade/abuso, backup/restore, residência/RPO/RTO, revisão e aceite operacional antes de M2.

## Retomada no Codex
Usar a branch existente, sem reaplicar R20/R21. Confirmar estado limpo e mudanças concorrentes. `npm ci --ignore-scripts`, `npm run check:lock`, `npm run check:homologation`. Se o gate falhar por mudança de fonte ou validade, obter nova execução completa; não ajustar os originais. A validade do relatório é limitada pelo verificador existente.

Não fazer force-push. Não copiar scripts da branch temporária ops para o produto. Não conceder acesso por UUID/metadata, usar postgres como identidade de atendimento ou abrir HELPDESK_RELEASE_APPROVED para contornar pendências.
