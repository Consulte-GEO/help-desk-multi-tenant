# Autorrevisão E03

Não houve revisão independente. Esta lista registra achados no código candidato, não incidentes comprovados na produção.

| Achado | Tratamento | Evidência/limite |
|---|---|---|
| ACK não respeitava prazo da reserva | Serviço e adaptador conferem o deadline da reserva além do scope | 9 negativos (6 serviço, 3 adaptador) observaram falha antes da correção |
| Leitura direta de recibo sem finalidade/validade | Recusa no adapter, store envenenado | 2 negativos falharam antes e passaram depois |
| Permissões HDA podiam ignorar teto central no candidato | has_scope read/write e advisory lock da publicação humana | Inspeção estática + cenários nativos escritos, ainda não executados |
| Predicados SQL podiam deixar NULL sem recusa explícita | coalesce false e CHECKs fechados | Estático; banco pendente |
| Conferência da fila não comparava o documento inteiro | queue_hash e trigger diferida de tarefa | Estático; banco pendente |
| Runner aceitava mais variáveis externas e origem mínima | Recusas de PG*/URLs, metadados/lock/arquivos requeridos | Testes de preflight, sem PostgreSQL |
| Socket dinâmico repassado pelo -o | Configuração própria com escape PostgreSQL | Testes de transformação de texto, sem iniciar o servidor |
| Limpeza dependia só do conteúdo do marcador | lstat/realpath, sem symlinks, nlink e prova exata | Testes de filesystem próprio |
| Teste de expiração alterava a fila protegida | Agora aguarda expiração real, sem reescrever registro | Cenário nativo não executado |

Asserções estáticas verificam a presença/forma de controles; podem passar com SQL inválido. A verificação Node de sintaxe não interpreta SQL. Não se declara que os cenários nativos vão passar sem executá-los.

O primeiro lote de testes dos helpers tinha quatro assert.throws que capturavam a própria ausência do helper. Foram corrigidos antes da implementação; o segundo RED demonstrou 19 falhas reais por função ausente. Ambos os logs foram preservados.

TypeScript foi conferido usando tipos Node 22.19.7 disponíveis no ambiente, e não a instalação limpa do lock da aplicação. A diferença é explícita e requer nova verificação no Codex.

Riscos remanescentes: instalação e catálogo reais não testados; runner ainda não executou o percurso de inicialização/parada real; sem teste do modelo/API/IdP; binding e configuração de origem não publicados; cotas/retenção/secret custody operacionais por qualificar. Não se montou nenhum novo endpoint.
