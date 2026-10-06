# Help Desk — levantamento e plano de continuidade

**Data:** 06/10/2026. **Repositório exclusivo do núcleo:** [Consulte-GEO/help-desk-multi-tenant](https://github.com/Consulte-GEO/help-desk-multi-tenant). Este pacote trata do Help Desk independente; o plano do Financeiro permanece separado.

## Conclusão

O Help Desk tem um núcleo significativo já implementado: autenticação/adaptadores, contexto de atendimento, abertura de ticket, conversa pública, notas internas, estados, prioridade, assumir/liberar responsabilidade, busca, paginação, controle de concorrência, idempotência e outbox transacional. Não é necessário reconstruir essa fundação.

O R24 está integrado e o CI do código atual passou. Entretanto, **M1 operacional continua aberto**: a publicação atual responde `503 release_gate_closed`, e os testes hospedados com Auth, Function, banco e identidades reais ainda precisam de aceite. Depois disso, faltam principalmente administração, equipes/participantes, dispatcher/entregas, SLA/roteamento, anexos seguros e dois conectores reais. Conhecimento, canais adicionais e IA entram após a operação humana funcional.

## Como usar

1. [Diagnóstico, evidências e requisitos](DIAGNOSTICO-E-REQUISITOS.md): fotografia atual e lacunas.
2. [Matriz de capacidades](CAPACIDADES-ATUAIS.csv): cada capacidade, código existente, trabalho restante e entrega responsável.
3. [Tickets históricos](TICKETS-HISTORICOS.csv): os 38 IDs HD-101 a HD-605 preservados e relacionados ao plano atual.
4. [Reaproveitamento e fronteiras](REAPROVEITAMENTO.md): o que manter e onde estender, sem misturar Help Desk e Financeiro.
5. [Plano detalhado](../../superpowers/plans/2026-10-06-helpdesk.md): entregas HD-P01 a HD-P33, dependências, interfaces, arquivos e testes.
6. [Roteiro para o Codex](ROTEIRO-CODEX.md): prompt da próxima sessão e padrão de encerramento.
7. [Cobertura](COBERTURA.md): contagens e limites, sem percentual artificial de conclusão.

Os IDs de capacidade `HD-Cxxx` foram criados **neste levantamento**. Não são uma numeração histórica recuperada. Os tickets `HD-xxx`, em contrapartida, vêm de `docs/02-PLANO-DE-DESENVOLVIMENTO.md`. Os CSVs usam UTF-8 com BOM e separador ponto e vírgula.

## Próximo incremento recomendado

Atualizar o estado pós-merge e confirmar por teste uma possível falha na retomada da abertura de ticket após resposta perdida. Em seguida, executar a homologação M1 já preparada, em destino isolado autorizado. Não criar mais ferramentas genéricas de gate como substituto de executar os clientes existentes. Administração M2 vem com seu próprio fluxo de usuário, persistência, autorização e teste, sem considerar que tabelas já existentes constituem backoffice.

Esta rodada inspecionou código, histórico, CI e metadados de infraestrutura e produziu documentação. Não criou usuários, tickets, infraestrutura, segredos, grants ou mensagens, nem abriu o gate publicado.
