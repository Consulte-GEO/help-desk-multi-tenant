# M1-R3 — diagnóstico seguro diante de falhas de conexão

**Base remota inspecionada:** `b9481b9fabde2fd9c442e44099bc17608b59571a`. **Base funcional desta rodada:** M1-R2 local. **Não publicado nem homologado.**

## Problemas reproduzidos e correções

### Evento de erro do cliente fora da Promise
O R2 registrava o listener de erro apenas no pool. Na regressão com EventEmitter real, um erro emitido em `setImmediate` pelo cliente durante a consulta encerrava o subprocesso com `Unhandled 'error' event`; seu stderr incluía o conteúdo sintético do erro. Com um listener de terceiros que absorvia o evento, a operação podia prosseguir e retornar sucesso. **Isso foi reproduzido em fixture local, não em produção nem em pg instalado. Não foi constatado vazamento real.**

O diagnóstico completo agora registra seu listener no cliente após obter a conexão e antes das consultas. Uma falha observada invalida a etapa de conexão. Cada consulta verifica a saúde antes do envio e após o recebimento; não se manda outra consulta depois da falha, não se reconecta nem se reenvia. Se não houver confirmação de rollback, a etapa continua falha, mesmo com descarte. Erro SQL sem evento de transporte ainda tenta exatamente um rollback. Falhas durante liberação/encerramento impedem sucesso. Listeners preexistentes são preservados; o listener do diagnóstico permanece no cliente descartável até sua coleta, evitando erro tardio sem handler.

`SqlClient.on` é uma assinatura TypeScript interna opcional para acomodar o driver e os adaptadores de teste existentes, não uma nova API. O helper inferior `probeDatabaseReadOnly` não assume propriedade de conexões de terceiros; seu chamador continua responsável pelo ciclo de vida.

### Socket TLS com autorização histórica, mas encerrado
Depois de um handshake real autorizado, `authorized` e `encrypted` permanecem verdadeiros em um socket destruído ou em encerramento. O R2 aceitava esses objetos; os dois testes vermelhos não dependiam de propriedades TLS fictícias. O verificador agora também recusa `destroyed`, `readableEnded` e `writableEnded`.

## Evidência e novos testes
Foram adicionados 15 testes: oito de ciclo de vida/eventos, seis de TLS e um de integração do comando/gate. As seis verificações TLS realizam transporte e handshake Node reais, com servidor restrito a 127.0.0.1 e porta efêmera: certificado confiável, CA não confiável, hostname incompatível, criptografia sem autorização, socket destruído e lado de escrita encerrado. Não há protocolo PostgreSQL nem execução SQL nesses testes. Certificado/chave são gerados por OpenSSL em diretório temporário e removidos. Nenhuma chave foi incluída no pacote.

```sh
npm run test:tls:local
```

OpenSSL CLI é um requisito da ferramenta de teste, verificado explicitamente no CI; não foi adicionada dependência npm. Chaves de teste não são credenciais reais. O caso negativo que desativa verificação de certificado faz isso exclusivamente na fixture local, para provar que o diagnóstico recusa o transporte não autorizado; o pool de produção continua com `rejectUnauthorized:true`.

## Compatibilidade e revisão
API/interface0.19.0, schema0.18.0; onze migrations e lockfile preservados; 204 cenários PostgreSQL herdados do R2. Nenhum endpoint, grant, política, coluna, credencial ou flag de liberação foi criado. Domínio, notas, snapshots, idempotência, contratos e SQL histórico não mudaram. Build continua estático, separado do empacotamento de Functions.

Revisão pelo mesmo executor: conferidos listeners, consulta após erro, rollback não presumido, descarte único, criptografia/autoridade/estado do socket, ausência de chaves persistidas, no-op offline e manutenção do gate. Não houve subagente, revisão independente ou pentest. Continua necessária a prova com **pg8.16.3**, PostgreSQL17/TLS reais e Function hospedada; Node TLS direto não atesta esses componentes. Timeouts existentes do driver não comprovam um limite total de duração caso o driver/cleanup trave.

## Referências externas consultadas em 28/09/2026
Estas fontes explicam APIs; não são evidência de testes do projeto.
- node-postgres, eventos do Client: https://node-postgres.com/apis/client
- node-postgres, pool/erros e liberação: https://node-postgres.com/apis/pool
- node-postgres, TLS e interação com connection string: https://node-postgres.com/features/ssl
- Node22, TLSSocket e authorized/encrypted: https://nodejs.org/docs/latest-v22.x/api/tls.html
