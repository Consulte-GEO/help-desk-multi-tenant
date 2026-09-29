# M1-R3 — falhas de conexão e evidência TLS do diagnóstico

## Objetivo e base
Continuar a revisão do M1-R2 entregue, sobre a fonte remota b9481b9, sem iniciar M2 nem liberar atendimento. A base de código/configuração/testes foi reconstituída e seu fingerprint conferido; não é clone integral nem autorização de publicação. O baseline R2 executou 1.099 testes.

## Achados a reproduzir
O diagnóstico ouve erros do pool, mas não do cliente tomado emprestado. Um evento assíncrono de conexão fora de uma Promise pode encerrar o processo e imprimir informação do driver. O verificador TLS também não verifica se o socket autorizado já foi destruído ou encerrado; flags históricas não provam transporte atualmente utilizável. Estas hipóteses de código precisam de regressões vermelhas antes de correção; não há incidente remoto constatado.

## Decisão
Manter a arquitetura e o pool exclusivo do R2. Registrar listener no cliente obtido, antes das consultas, sem registrar texto de erro. Após falha de conexão, não enviar consultas adicionais nessa conexão; nunca reconectar nem reenviar. Ausência de confirmação do rollback continua sendo falha, mesmo havendo descarte. Encerrar o pool e descartar o cliente uma vez, inclusive em erro; listeners de terceiros não serão removidos. Falhas observadas durante cleanup impedem sucesso.

TLS só passa para TLSSocket autorizado, criptografado e ainda aberto nos dois sentidos. Testes de transporte usarão handshake Node TLS real em loopback, certificados efêmeros criados em diretório temporário por OpenSSL e limpeza dos processos/sockets/arquivos próprios. Certificados/chaves não serão versionados ou distribuídos. Um servidor TLS de teste não é PostgreSQL nem node-postgres: o relatório separará esses níveis.

## Limites preservados
Sem endpoint, segredo, grants, migrations, dependências npm ou mudança na liberação de produção. Mesma API0.19.0/schema0.18.0 e mesmo lockfile. Lower-level probeDatabaseReadOnly permanece exclusivo de conexões ociosas administradas pelo chamador; a proteção de eventos pertence ao dono do diagnóstico completo. Nenhuma consulta de negócio, mutação, teste Supabase ou login real será executado nesta rodada.

## Aceite
Reproduzir falha por evento assíncrono em subprocesso; depois emitir somente relatório seguro, sem crash ou conteúdo do erro. Testar evento entre consultas e na liberação, ausência de novas consultas após quebra e preservação de listeners existentes. Provar handshake confiável, recusa de CA/hostname inválidos, recusa de sockets encerrados, incluindo fechamento após handshake válido. Executar suíte total, preservar falhas ambientais e atualizar gate mínimo sem aprovar evidência antiga.

## Riscos não resolvidos por este incremento
Compatibilidade do driver pg fixado/TLS dentro da Function; PostgreSQL real do R2; login Auth/M2M; capacidade, restore e governança. Timeouts existentes do driver não equivalem a um watchdog externo de duração total. Não abrir liberação de produção para contornar a falta de homologação.
