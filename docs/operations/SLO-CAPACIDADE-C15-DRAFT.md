# C15 — plano de medição de capacidade / SLO (não aprovado)

O plano original menciona 10mil tickets e consultas à origem em500ms como **alvos a aprovar/medir**, não compromissos comerciais. Nenhum teste de carga hosted foi executado nesta rodada; nenhum percentil, RPO/RTO, throughput, quota ou custo foi declarado aprovado.

## Registro exigido por execução

Identificar proprietário/janela autorizada, fonte/fingerprint/schema/deploy/configuração/pooler/região, coorte/canais, carga real ou sintética, número de instâncias, conexões máximas, perfil de acesso e taxa. Capturar latência da operação, espera de admissão, fim a fim, percentis e falhas/429/503 por coorte (ocupada, vizinha e outro workspace). Informar amostra e duração, não somente média.

Comparar efeito sobre a operação vizinha, limpeza de contexto nas conexões, TLS/CA, quotas transacionais, deadlocks, limites de Function e consumo/custos de lookup/Storage/scan/envio. A mesma origem deve qualificar lookups e degradação; não simular um fornecedor rápido para aprová-lo. O teste de capacidade local histórico não é evidência desse ambiente hospedado.

Reutilizar e ampliar o runner de capacidade PostgreSQL descartável e os clientes hosted já existentes. Nada neste documento instala/provisiona serviço ou dispara carga. Evitar testes de impacto na produção sem janela/cancelamento/limites combinados. Registrar erros e condições inconclusivas; não ampliar limites ou desligar gates para passar.

## Aceite

A autoridade de liberação só pode atestar capacity/restore depois dos relatórios reais e aceites. Quadro atual: metas não aprovadas; medição hosted ausente; custo não aprovado; responsável/janela não designados; bloqueio mantido.
