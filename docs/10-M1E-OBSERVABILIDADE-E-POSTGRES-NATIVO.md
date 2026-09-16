# M1e — Observabilidade HTTP e PostgreSQL nativo | v0.6.0

## O que muda para a operação

A API passa a registrar uma projeção JSON controlada por requisição concluída na aplicação. Ela informa a rota normalizada, resultado, código de erro, fase e duração observada, sem copiar o conteúdo do atendimento. Falhas antes de inicializar o backend deixam de depender exclusivamente de um erro genérico sem diagnóstico correlacionado.

O operador pode reunir esses registros em JSONL e obter contagens e tempos por rota usando uma ferramenta offline. Não é um endpoint público de métricas nem um painel com acesso global aos clientes. Não foram configurados exportador, armazenamento externo, alertas ou retenção do provedor.

A segunda entrega é um executor explícito para PostgreSQL 17 previamente instalado, independente de Docker. Ele prepara um cluster local temporário e invoca os mesmos 60 cenários SQL já escritos. **O ciclo com servidor real não foi executado nesta sessão.** Os testes deste executor usam respostas controladas para comandos PostgreSQL; somente a criação de arquivos, o cancelamento de subprocessos Node e verificações de isolamento local foram exercitados de fato.

## 1. Registro fechado de diagnóstico

`src/observability/http.ts` produz exatamente estes campos:

| Campo | Interpretação |
|---|---|
| `event_schema` | Versão 1 do formato de diagnóstico, independente da versão da API. |
| `component` | Sempre `helpdesk.http`. |
| `release` | Versão do código da API, 0.6.0 nesta entrega. |
| `occurred_at` | Horário UTC de emissão. Não é um relógio de SLA. |
| `request_id` | UUID de correlação; acompanha o header e os problemas HTTP. |
| `phase` | `http`, `bootstrap` ou `dispatch`. |
| `route` | Rota de uma lista fechada, com `{ticket_id}` no lugar do identificador; desconhecidas viram `unmatched`. |
| `method` | Método conhecido ou `OTHER`. |
| `status` / `status_class` | Resultado HTTP e classe, como 429 / `4xx`. |
| `severity` | `info` abaixo de 400, `warn` em 4xx, `error` em 5xx. |
| `error_code` | Código permitido, `unclassified_error` quando desconhecido, ou `null` em sucesso. |
| `duration_ms` | Duração monotônica observada; `null` para intervalo inválido ou acima de 24 horas. |

Não entram no registro: nome da conta, usuário, IP, bearer, chave M2M, chave de idempotência, subject/body, mensagens, notas, query string, cursor, UUID do chamado, SQL, conexão do banco ou texto livre da exceção. `request_id` é a exceção intencional à exclusão de identificadores: serve para correlação, não identifica a pessoa e não é usado como dimensão de agregação.

Um `X-Request-Id` que corresponda ao formato UUID aceito é normalizado para minúsculas; um valor inválido é substituído por UUID gerado. Isso corrige a aceitação anterior de uma sequência contendo apenas hífens. O header é não confiável: não comprova identidade, origem, unicidade global nem autorização. O operador não deve deduplicar requisições apenas por esse valor.

A lista de códigos inclui o `rate_limit_exceeded` efetivamente lançado pelo limitador. A observação não altera `Retry-After`, corpo, ETag, resultado transacional ou chave idempotente.

## 2. Fases e limites de interpretação

`http` mede do início do handler ao momento em que a resposta foi construída. Não inclui transferência completa pela rede, renderização no navegador ou, no caso de inicialização bem-sucedida, toda a espera anterior na fábrica do runtime.

`bootstrap` registra falha durante inicialização. Requisições concorrentes compartilham a mesma promessa de inicialização, mas cada falha respondida pode produzir seu próprio registro de requisição. A promessa rejeitada é descartada para permitir uma tentativa posterior, sem carregar dados de demonstração.

`dispatch` registra erro inesperado que escape do runtime já inicializado. O wrapper não emite um segundo registro quando o handler termina normalmente. Esse comportamento foi testado localmente; não foi homologado no Netlify.

O sink console escreve JSON com `info`/`warn`/`error`. Falhas síncronas ou rejeições assíncronas do observador são contidas e não alteram o atendimento. Isso é **diagnóstico best-effort**: pode haver perda de registros. Não é auditoria durável, entrega garantida, trilha regulatória ou substituto dos eventos transacionais do domínio. O instrumento não implementa OpenTelemetry/OTLP, amostragem, propagação W3C nem rastreio completo de banco/worker/webhook.

## 3. Resumo operacional offline

Executar com um arquivo JSONL que contenha as mensagens JSON individuais:

```bash
npm run --silent logs:summary -- observacoes.jsonl > resumo.json
```

A flag `--silent` evita que o cabeçalho do próprio npm misture texto ao JSON redirecionado. Também é possível chamar diretamente `node --experimental-strip-types scripts/summarize-http-logs.ts observacoes.jsonl`.

Exemplo reproduzível desta entrega, com registros gerados por chamadas HTTP locais e identidades fictícias:

```bash
node --experimental-strip-types evidence/m1e/generate-loopback-observations.mjs
npm run --silent logs:summary -- evidence/m1e/loopback-observations.jsonl
```

Esses exemplos não são telemetria de produção. São quatro chamadas com resultados 200, 403, 429 e 503. O arquivo `loopback-observations-checks.json` identifica explicitamente a origem sintética dos dados.

O resumo informa janela observada, registros aceitos/ignorados/rejeitados, volume, status, erros e fases por rota/método. Calcula média, mínimo, máximo e histograma de latências. Faixas não cumulativas terminam em 10, 50, 100, 250, 500, 1.000, 2.500, 5.000, 15.000, 30.000 e 60.000 ms; a última faixa não tem teto (`upper_bound_ms: null`). **Não fornece p95/p99 exatos ou disponibilidade/SLA comprovados.**

O agrupamento não retém request IDs nem identificadores de clientes. São contagens de registros, não necessariamente de requisições únicas: exportações duplicadas, registros perdidos e a janela escolhida mudam os números. Não há filtro por tenant porque não são armazenadas dimensões de cliente nesse formato.

Limites: arquivo regular até 256 MiB, linha até 16 KiB, leitura incremental e validação estrita do formato. Linhas maiores ou registros HTTP malformados são rejeitados; linhas de outras fontes ou que não sejam JSON são ignoradas e contabilizadas. Campos adicionais em um registro `helpdesk.http` levam à rejeição, sem copiá-los. Objetos malformados não são convertidos implicitamente para texto. Um export do provedor que envolva a mensagem em outro envelope precisa primeiro ser convertido para as mensagens JSON individuais por um processo autorizado; não há integração automática de coleta nesta entrega.

## 4. PostgreSQL 17 nativo, sem fallback

Pré-requisitos: ambiente local autorizado Linux/macOS (ou Linux no WSL), usuário **não root**, dependências do projeto instaladas e binários PostgreSQL 17 previamente instalados. O projeto não baixa nem instala o servidor, não usa `sudo` e não muda políticas do ambiente.

```bash
# Exemplo de diretório; utilizar o diretório real da instalação autorizada.
export HELPDESK_TEST_DB_ENGINE=native
export HELPDESK_TEST_PG_BIN=/usr/lib/postgresql/17/bin
npm run test:db:local
# Ou, explicitamente:
npm run test:db:native
```

Sem `HELPDESK_TEST_DB_ENGINE`, `test:db:local` continua escolhendo Docker. Engine desconhecido é recusado. Uma falha em um engine não provoca tentativa em outro nem uso do Supabase remoto. Para homologação agregada com engine nativo, exportar as duas variáveis acima e executar `npm run homologate:local`; os pré-requisitos de lock/instalação continuam obrigatórios.

O runner verifica `initdb`, `pg_ctl` e `psql` executáveis no mesmo diretório real e com versão 17.x consistente. Isso não é auditoria de procedência ou assinatura dos binários; registrar origem/versão e revisá-las na homologação real.

## 5. Ciclo de vida e limpeza

O executor cria somente uma pasta temporária própria com permissões restritas e marcador aleatório. Gera senhas aleatórias para o administrador de teste e o login `helpdesk_app`, utiliza SCRAM, inicia o cluster em loopback com porta efêmera e socket Unix desativado. Cria apenas `helpdesk_test` nesse cluster e passa URLs locais geradas à suíte existente. Os segredos não vão nos argumentos do processo; eventuais ocorrências das senhas geradas na saída do teste são substituídas antes de reportá-la.

O ambiente dos filhos exclui variáveis de produção, `PGHOST`/`PGSERVICE`/`PGOPTIONS`, senha herdada e preload Node; utiliza HOME temporário, localidade C e fuso UTC. A suíte mantém sua própria proteção de URLs locais e banco novo. Não apaga schemas já existentes para conseguir aprovação.

SIGINT/SIGTERM solicitam cancelamento apenas dos subprocessos iniciados pelo executor. Na limpeza, verifica propriedade e ausência de substituição por symlink, consulta o estado do próprio `pg_ctl`, solicita parada quando necessário e só remove o diretório depois de confirmar a parada. Marcador alterado, symlink, estado desconhecido ou parada falha resultam em **falha e preservação**, com caminho de recuperação local para inspeção manual. Não procura PIDs por porta nem remove diretórios de outras instalações. SIGKILL, queda do sistema ou crash do próprio executor podem impedir a execução do finally: não há garantia de limpeza nesses casos. Inspecionar a pasta/identificação do cluster antes de uma recuperação manual.

No ambiente desta sessão, o processo tem UID 0 e não possui as dependências/servidor necessários. O comando nativo recusou na configuração, **sem criar cluster**. Docker também está indisponível. Não houve execução real de initdb, migrations, RLS ou teste SQL.

## 6. Compatibilidade e critérios ainda abertos

API/interface 0.6.0; schema esperado **0.5.0**. As seis migrations anteriores foram preservadas por hash. Nenhum novo endpoint HTTP público, tabela, migration, política RLS ou privilégio. A OpenAPI permanece com 16 operações/13 caminhos. O contador mínimo da suíte local na homologação foi atualizado para 451, sem alterar os mínimos de SQL (60) e HTTP/browser (27).

Antes de uso real: resolver/auditar dependências, executar PostgreSQL 17 e os 60 cenários (fresh install e upgrade aplicáveis), validar Auth/pooler/Functions, executar o navegador, medir custo/volume dos logs e timeouts, calibrar carga, definir retenção/acesso/alertas, revisar restauração e decisões operacionais. A preparação do runner não encerra HD-102; diagnósticos locais não encerram observabilidade operacional de produção. M2 não foi iniciado.
