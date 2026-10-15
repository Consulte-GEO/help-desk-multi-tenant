# Relatório de desenvolvimento — Implantação e Importações R02

**Data:** 14/10/2026 · **Estado:** desenvolvimento local parcial, não publicado e não operacional.
**Repositório alvo:** Consulte-GEO/setup-implantacao-obras.
**Base remota reinspecionada:** `dcf5607652281bb688f366e6a4f05e07eb698d31` (`main`).
**Fonte desta sessão:** pacote R01 montado no container + leitura conectada atual. O clone integral falhou por DNS. A tentativa alternativa de download não produziu arquivo utilizável. Nenhum checkout parcial foi apresentado como clone integral.

## Entrega

R02 é cumulativa em relação à R01 **sobre a mesma base remota**. Contém as correções anteriores e as novas. Não é um dist Netlify, nem um checkout completo. A integração final da página monolítica continua sendo uma transformação guardada no aplicador.

Candidatos de versão: frontend **5.0.22-53**, Copilot **3.6.0**, ponte **1.1.0**. SimilarityEngine 2.0.0, ImportIntegrity 1.0.0 e contrato geomat 1.2.0 são preservados da R01. Essas versões só entram no checkout integral quando o aplicador for executado; não descrevem produção.

## Mudanças realizadas

### Conversor

O comando de preparar dados passa a conservar o mapeamento confirmado. A chamada legada a refreshMapping que recalculava as escolhas não é usada nessa transição. A ponte registra a identidade do File, aba, cabeçalho, mapeamento, unidades confirmadas, políticas de conversão e referências usadas no preparo. Se algo mudar, recusa exportação até novo preparo e revisão, mesmo no modo rascunho. Edição normal dos valores revisados continua permitida.

A montagem gerada pelo aplicador verifica a versão da própria ponte antes de iniciar. Arquivo ausente/antigo não aciona o BOOT nem permite cair silenciosamente no fluxo anterior. Portas necessárias de loading e utilitários também são verificadas antes da instalação.

### Contratos canônicos

`modules/import-process/canonical.ts` valida snapshots, registros, campos, localizadores e vínculos. Distingue valor bruto/normalizado, presença e papel semântico; recusa proposta/padrão marcado como medição, fonte sem localização, IDs duplicados e referências inexistentes. Objetos com getters, prototypes especiais, ciclos, números não finitos e texto não representável são recusados.

A serialização determinística e SHA-256 têm limites. Comandos têm teto de 1 MiB; resposta composta pode chegar a 4 MiB. Este hash é verificação de conteúdo, **não assinatura, autorização ou prova de aprovação**. A semântica das decisões livres do snapshot não é executada nem aprova uma importação.

### Processos e arquivos — IMP-02a

Serviço de aplicação TypeScript independente de framework para criar processo, salvar nova revisão, ler processo/revisão, cancelar, declarar arquivo e finalizar a verificação. Requer resolver de autoridade vivo e portas de repositório/inspeção fornecidos pelo servidor.

Revisão anterior não é sobrescrita; cada mutação exige a versão esperada, gera evento e recibo na mesma unidade transacional. Repetir a mesma intenção retorna o recibo anterior; reutilizar a chave com conteúdo diferente gera conflito. Papel/solicitante/escopo são conferidos novamente, inclusive no replay. Falha de gravação não tem fallback local nem retorno positivo.

O processo não expira como o rascunho curto de abertura de chamado. Nas APIs desta fatia há apenas `draft` e `cancelled`, com `awaiting_ticket`; não existem protocolo inventado, execução, aprovação técnica ou notificação automática.

Arquivos recebem chave derivada de IDs de escopo/artefato, nunca do nome original. Há limite de 60 MiB por arquivo, 1 GiB e 1.000 arquivos por processo. Retenção é parâmetro obrigatório do servidor (90 dias somente na fixture de teste); registra-se retainUntil, sem rotina de descarte implementada. Inspeção do armazenamento é uma porta que deve verificar bytes, hash, MIME, privacidade, segurança do formato e scanner. Sem conclusão, o artefato permanece pendente; divergência conclusiva gera rejeição explícita. Nenhum upload real ou scanner foi montado nesta sessão.

### PostgreSQL

O adaptador `postgres.ts` usa uma conexão, contexto local à transação, lock de processo, parâmetros SQL, CAS, COMMIT/ROLLBACK e descarte de conexão após confirmação incerta. A conexão exige papel restrito `setup_import_app` e não aceita postgres como runtime. Portas não funcionam após fechamento da transação.

O DDL candidato cria cinco tabelas privadas: cases, revisions, artifacts, events e receipts, com RLS/FORCE, chaves compostas, histórico append-only, vínculo do head da revisão e exigência de evento/recibo ao confirmar a transação. Fica fora de migrations e exige qualificação explícita. Não foi executado, compilado por PostgreSQL ou aplicado ao Supabase.

O contexto GUC protege contra cruzamento acidental de escopo pelo servidor; **não autentica cliente**. A origem real de autoridade e eventual trava/lease precisam ser qualificadas. Duas leituras da autoridade não representam transação distribuída nem eliminam matematicamente a janela entre a última checagem externa e o COMMIT.

## Evidências desta execução

| Verificação | Resultado | Alcance |
|---|---:|---|
| Baseline R01 Node | 101/101 | Reexecução local dos testes do pacote |
| Suíte de integridade/exportador/ponte/aplicadores, cumulativa | 119/119 | Fontes reais com colaboradores focais quando necessário |
| Contratos/processos/transporte SQL | 85/85 | Inclui repositório transacional em memória e transporte SQL simulado |
| Total das duas suítes finais Node | 204/204 | Zero falhas, cancelamentos ou skips nas execuções finais |
| SimilaritySelfTest | 21/21 | Mesmo motor fonte, não somado como 21 cenários independentes de tudo acima |
| Chromium offline | 10/10 | DOM/ponte, colaboradores sintéticos, sem leitura/geração real de XLSX |
| Typecheck estrito do módulo novo | exit 0 | TypeScript global 5.8.3, não instalação do lock do frontend |

Logs vermelhos e verdes preservados. A primeira tentativa de fixture de testes teve erro sintático, corrigido antes de implementar o serviço; não se usou esse erro como prova de comportamento ausente. Os testes do novo aplicador também foram verificados contra o predecessor, registrando falhas e posterior aprovação. A revisão final foi realizada nesta sessão; não houve revisor independente/subagente.

## O que NÃO está concluído

Build/typecheck/smoke completos do projeto, dependências instaladas pelo lock, página real com XLSX, aceitação pelo receptor geomat/Novo GEO, SQL/RLS/concor­rência reais, runtime/HTTP, resolver de acesso da origem, upload/storage/scanner, retomada entre dispositivos, retenção efetiva, Help Desk e Dev Agent.

O teste que reabre o serviço após dois dias usa o mesmo repositório em memória: prova separação lógica de sessão/processo, **não durabilidade em disco ou banco**. O teste de 500 arquivos é fixture de leitura, não teste de carga do PostgreSQL.

Não houve push, PR, merge, deploy, migration remota, alteração de usuário/MFA/secrets, buckets, chamadas pagas de IA, e-mails ou cadastros produtivos. O Help Desk e a wiki não foram alterados.
