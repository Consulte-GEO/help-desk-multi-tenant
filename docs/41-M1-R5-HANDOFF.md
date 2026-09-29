# Handoff — Help Desk M1-R5

Leia PROJECT_HELP_DESK.md, docs39–43, manifesto e a documentação atual do checkout remoto. Base remota conferida:b9481b9fabde2fd9c442e44099bc17608b59571a. R2–R5 são incrementos locais não publicados. O repositório remoto não foi alterado nesta sessão.

## Entrega
Verificador offline somente leitura,30 novos testes, pacote cumulativo com fonte executável recuperada e bundle Git local. API/interface0.19.0/schema0.18.0 e11migrations preservados. Não houve nova mudança no núcleo do atendimento. Node1.163/1.163 passou; HTTP memória35. SQL207 escritos,0executados;browser0;instalação/audit/typecheck e gate não aprovados. Os6TLS locais reais estão incluídos nos1.163.

## Escolher UMA variante
- `helpdesk-m1-r2-r5`: checkout compatível com o remoto sem R2–R4.
- `helpdesk-m1-r5-only`: checkout com o R4 exato já integrado.

Não aplicar ambas; não usar R5-only sobre R2/R3. A inspeção before deve passar antes de `git apply --check` e de qualquer aplicação. Divergência exige conciliação, não atualização artificial de hash. Usar a inspeção after em seguida. Não copiar toda a pasta source sobre um checkout existente.

A pasta source e o bundle evitam recuperar novamente código a partir de vários ZIPs em futuras sessões. Seu histórico é local recuperado, não a história upstream. Use em pasta nova para revisão/testes. Nunca force-push. Documentos de estado originais contidos na recuperação são históricos; docs40/41/42 desta entrega prevalecem para o estado local, e a nova leitura remota prevalece para mudanças concorrentes.

## Próxima execução
1. Reinspecionar HEAD e conferir se já houve integração; preservar arquivos locais e staged. Conferir before, aplicar uma variante, conferir after.
2. Instalar pelo lock real, executar verify e audit no registry autorizado. Não substituir por typecheck global.
3. Executar207 cenários em PostgreSQL17 novo/descartável, inclusive os casos R4 de interrupção de conexão própria. Não usar Supabase remoto para esses runners.
4. Executar TLS6 e HTTP/browser71; gerar homologate:local/check:homologation com o novo fingerprint e os resultados integrais sem skips.
5. Em ambiente explicitamente autorizado, validar pg/TLS/runtime dentro da Function e jornadas Auth/M2M/revogação/isolamento. Não ligar a flag global de produção como atalho.
6. Capacidade/abuso, restore, residência/RPO/RTO, revisão independente e aceite M1. Só depois M2.

## Revisão focal
Scripts/check-integration.mjs: limites, nomes de caminhos Windows/Linux, erros seguros, Git somente leitura, correspondência de todas as preimages/afterimages, formatos de patch recusados, integridade versus autenticidade, ausência de garantia atômica sob edição concorrente. Não ampliar o formato para renames/binários/drops sem novos critérios e testes.

O verificador não executa testes nem certifica correção de código: relatório `ok:true` significa apenas inspeção da integração. Os resultados de instalações/testes/ambientes continuam em evidências separadas.
