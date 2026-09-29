# M1-R2 — Diagnóstico privado de runtime

**Entrega local de 28/09/2026. Não publicada. M1 permanece aberto.**

## Objetivo e limite

Separar a inspeção de configuração/banco da liberação do atendimento. O runtime de produção continua exigindo `HELPDESK_RELEASE_APPROVED=true` antes de inicializar. O diagnóstico não altera essa variável, não fabrica aprovação e não cria endpoint público. Não há novo módulo administrativo, autenticação alternativa ou campo específico de produto.

A entrega inclui uma correção de configuração: percent-encoding inválido, tipos inesperados e caracteres de controle passam a produzir erros seguros. A verificação antes da refatoração reproduziu falhas; os logs RED/GREEN acompanham o pacote. A exportação `validateRuntimeConfig` continua disponível no mesmo módulo público.

## Como executar

Requer checkout íntegro e dependências instaladas pelo lock real. Os comandos abaixo não contêm segredos. Usar variáveis previamente disponibilizadas pelo canal autorizado; nunca colar senhas em prompt, log, shell compartilhado ou arquivo versionado.

```sh
# Offline: verifica somente a forma da configuração; não conecta ao banco.
npm run --silent runtime:preflight

# Ajuda; não exibe os valores do ambiente.
npm run --silent runtime:preflight -- --help

# Conexão real: somente após autorização explícita do destino.
npm run --silent runtime:preflight -- --connect
```

O modo padrão não carrega `.env`, não importa `pg`, não acessa rede e não grava arquivos automaticamente. Ele valida a sintaxe, **não** a validade das credenciais, o conteúdo da CA, a correspondência da chave ao projeto, a conectividade ou a segurança efetiva do banco. A existência de `--connect` não é autorização para executá-lo contra um destino remoto.

Variáveis lidas: `HELPDESK_DATABASE_URL`, `HELPDESK_DATABASE_CA`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `HELPDESK_RATE_LIMIT_HMAC_KEY`, `HELPDESK_RELEASE_APPROVED`. Segredos não são aceitos nos argumentos. Usar `--silent` evita o preâmbulo do npm ao capturar JSON. Os avisos experimentais do Node ficam em stderr, separados do relatório.

## Modo conectado

O processo cria um pool próprio, com `max:1`, limites de conexão/consulta de 5 segundos e TLS com verificação de certificado. Não usa o pool que atende tickets. Confirma um `TLSSocket` criptografado e autorizado antes de emitir SQL. A inspeção do socket depende da estrutura interna do `pg 8.16.3`; uma futura incompatibilidade falha fechada, não desativa TLS.

Numa única conexão o probe inicia `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, configura timeouts locais, confirma `transaction_read_only=on` e reutiliza os guards existentes de papel, schema e segurança. Não chama operações de negócio, Auth, rate limiter, provisionamento ou migrations. Termina em `ROLLBACK` mesmo quando os checks passam. Falha de rollback, descarte ou encerramento reprova o resultado. A conexão própria é descartada e não retorna ao atendimento.

O export de baixo nível `probeDatabaseReadOnly` exige conexão **nova, ociosa e reservada**. Não pode ser usado dentro de transação de negócio: seu rollback encerraria a transação do chamador. O orquestrador e a CLI garantem essa separação pelo pool exclusivo. O teste SQL usa o export inferior e não comprova TLS.

## Relatório e aceite

JSON `helpdesk.runtime-preflight.v1`, etapas com `passed`, `failed` ou `not_executed`, códigos sanitizados, timestamps UTC e fingerprint canônico antes/depois da execução. Se o código mudar durante a execução, a CLI retorna falha. Sucesso gera exit 0; falha, exit 1.

`success:true` indica somente aprovação do **modo selecionado**. As afirmações abaixo permanecem falsas em todos os resultados:

```json
{
  "production_approved": false,
  "operational": false,
  "auth_tested": false,
  "hosted_function_tested": false,
  "business_operations_dispatched": 0
}
```

`release_flag` apenas observa o valor recebido; não comprova nem concede aprovação. O relatório não contém URL, senha, token, CA, SQL, stack trace ou dados de clientes. Hashes locais não constituem assinatura ou atestação independente.

## Compatibilidade e arquivos

API/interface 0.19.0; schema 0.18.0; 18 operações HTTP; 11 migrations preservadas. `package-lock.json` e todas as dependências mantidos. A única extensão de comandos é `runtime:preflight`. `runtime-config.ts` concentra validação pura; `runtime-preflight.ts` concentra o diagnóstico; a CLI apenas coleta configuração e serializa evidência.

Os mínimos do gate passaram para 1.099 testes de aplicação, 204 PostgreSQL e 71 HTTP/browser. Isso não aprova testes escritos: a nova fonte precisa produzir seus próprios logs. O relatório CI da base permanece histórico e não foi recalculado para acomodar o incremento.

## Referências técnicas

Fontes públicas consultadas nesta rodada, separadas das evidências de execução do projeto:
- node-postgres, SSL: https://node-postgres.com/features/ssl — parâmetros SSL na connection string podem substituir a configuração SSL fornecida ao cliente.
- PostgreSQL 17, SET TRANSACTION: https://www.postgresql.org/docs/17/sql-set-transaction.html — semântica de READ ONLY. Não significa ausência absoluta de I/O, logs ou efeitos da infraestrutura.
- Node.js 22, TLS: https://nodejs.org/docs/latest-v22.x/api/tls.html — propriedades encrypted/authorized.
- Código primário fixado de pg 8.16.3: https://raw.githubusercontent.com/brianc/node-postgres/pg@8.16.3/packages/pg/lib/connection.js — stream TLS negociado. Inspeção documental não substitui executar o driver no destino.
