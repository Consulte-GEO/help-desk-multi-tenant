# M1-R16 — Pós-condições observáveis após recusas M2M

## Base e diagnóstico
Fonte R15 recuperada de `recovery/source.tar.gz`, fingerprint `41cef90c7d1013cff2eeed333f99dbe4d7e6d910dc5ca63dbf7ee6e67da9d1ae`; baseline local 1.364/1.364. Remoto consultado em 01/10/2026: R9 `78bbb00112331531168ae24600604cb7f3148770`. Instalação/typecheck/audit/PostgreSQL continuam bloqueados neste ambiente. Não usar banco remoto como substituto da fixture descartável.

O R15 confere o estado humano antes do bloco M2M e aceita as respostas negativas esperadas. Não relê o chamado humano depois da tentativa `machine-cannot-write-human`, nem examina as notas internas do chamado da integração após `machine-deny-note`.

Reprodução em memória, com handler real e identidades sintéticas: executar uma gravação com identidade autorizada de teste e devolver a resposta negativa original ao cliente simula um servidor defeituoso. R15 aprovou tanto a nota persistida sob 403 quanto a mensagem humana persistida sob 404. Também aprovou uma alteração de timestamp sem mudar a versão. Isso é uma lacuna no cliente de aceitação, NÃO uma falha de autorização constatada no produto ou no destino hospedado. As permissões reais do handler recusam a identidade M2M normalmente.

## Especificação objetiva
Ampliar exclusivamente `includeMachineWrites:true` com quatro GETs finais, usando rotas e identidades já disponíveis:
1. `machine-post-denials-notes`: agente A lê `/v1/tickets/<M2M>/notes?limit=100`; exige 200 e coleção vazia e completa.
2. `machine-post-denials-human-ticket`: solicitante A relê o próprio chamado; exige o DTO público versão 3/high e os mesmos campos estáveis observados antes do bloco M2M. `available_actions` permanece consultivo e não entra no snapshot.
3. `machine-post-denials-human-messages`: relê a coleção completa; mensagem única e representação canônica idêntica à observada antes das recusas.
4. `machine-post-denials-human-timeline`: relê a coleção completa; três eventos públicos esperados e representação canônica idêntica à anterior.

Guardar comparações somente na memória do processo; não imprimir corpos, notas, mensagens ou snapshots. Falhas interrompem novos envios; as etapas restantes ficam bloqueadas. Respostas negativas anteriores permanecem registradas como recusas HTTP, mas não autorizam um resultado agregado positivo diante de efeitos inesperados.

## Compatibilidade e limites
Plano legado mantém 18 etapas. Plano M2M passa de 39 para 43 (18 humanas + 21 M2M existentes + 4 GETs), além dos 28 controles prévios. Nenhuma nova intenção mutável, chave, credencial, permissão, campo de configuração ou opção. O hash da MESMA configuração e todas as chaves anteriores são preservados; a execução continua exigindo autorização atual.

As consultas podem detectar efeitos visíveis persistentes, não provar ausência universal de efeitos: outbox, auditoria privada, recursos ocultos de outra conta, efeitos transitórios/desfeitos, respostas falsas consistentes, concorrência e atomicidade exigem correlação SQL e evidência independente. Não inferir causalidade: uma divergência pode ser uma mudança concorrente legítima; reprovar e reconciliar, sem limpeza, nova chave ou retry automático. A nova nota é lida apenas pelo agente já autorizado; não ampliar privilégios da integração.

API/interface 0.19.0, schema 0.18.0, 11 migrations/lock/core/autorização inalterados. M1 aberto; nenhuma autorização remota herdada.

## Execução
- [x] Conferir pacote/hash, remoto e baseline.
- [x] Reproduzir a lacuna antes da correção: 11 regressões falharam, incluindo três aprovações falsas da suíte antiga.
- [x] Implementar as quatro pós-condições e snapshots efêmeros.
- [x] Executar regressões, suíte inteira e gates disponíveis, preservando falhas.
- [x] Rever diff, aplicar patches em fontes limpas e atualizar estado/handoff/backlog.
