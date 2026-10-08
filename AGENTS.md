> **HD-P06 — 08/10/2026:** recebimento compatível de link revisado e aprovado em CI; API/interface0.26.0/schema0.19.0. Fragmento hash privado, URL limpa e validação só por confirmação, sem adoção de sessão. Template preparado, não aplicado. [Entrega e limites](docs/131-HD-P06-RECEBER-LINK-DE-RECUPERACAO.md). CI1660/229/121 aprovado e revisão limpa; merge/publicação pendentes. Template não aplicado; atendimento fechado e ativação/aceite reais pendentes.

> **HD-P06 — 08/10/2026:** solicitação explícita de link integrada/publicada pelo PR19; API/interface0.25.0/schema0.19.0. Pedido email-only sem sessão, retorno condicional e cancelamento sem reenvio/logout fictício; scopes e configuração preservados. [Entrega e limites](docs/130-HD-P06-SOLICITAR-LINK-DE-RECUPERACAO.md). CI1654/229/118 aprovado, navegação corrigida. Merge5c45db7 e produção6ac7cbb8 verificados; atendimento fechado e entrega/SMTP/CAPTCHA/callback/PKCE reais pendentes.

> **HD-P06 — 08/10/2026:** conclusão de recuperação por link direto integrada/publicada pelo PR18; API/interface0.24.0/schema0.19.0. Contexto privado só de senha, MFA preservado, sem workspace/scopes; nenhum e-mail/callback/PKCE nesta fatia. [Entrega e limites](docs/129-HD-P06-CONCLUIR-RECUPERACAO-POR-LINK.md). CI1644/229/115 aprovado; Important corrigido e minor de texto registrado. Merged9932d4 e produção6ac77fa0 verificados; atendimento fechado, envio/PKCE/callback/recuperação real pendentes.

> **HD-P06 — 07/10/2026:** outro TOTP da própria conta integrado/publicado pelo PR17; API/interface0.23.0/schema0.19.0. Exige catálogo vivo verificado/AAL2, retoma pendente ou cria com nome distinto; preserva fatores confirmados e não amplia scopes. [Entrega e limites](docs/128-HD-P06-OUTRO-AUTENTICADOR-TOTP.md). CI1629/229/112 aprovado e revisão sem Critical/Important; minor de texto registrado. Mergedf3d2b9 e produção6ac6f2d7 verificados. Atendimento fechado; recuperação/remoção/QR/admin MFA e aceite real pendentes.

> **HD-P06 — 07/10/2026:** consulta da segurança da própria conta integrada/publicada pelo PR16; API/interface0.22.1/schema0.19.0. Catálogo vivo limitado, fatores confirmados/pendentes e AAL consultivo; dados privados descartados e resposta tardia isolada. Nenhuma gestão/remoção de fatores ou ampliação de scopes. [Entrega e limites](docs/127-HD-P06-CONSULTA-DA-SEGURANCA.md). Revisão corrigida com10 testes; CI1619/229/109 aprovado. Merge4c663a2 e produção6ac6b8ee verificados. Atendimento fechado; gestão de fatores/recovery/admin obrigatório e aceite real pendentes.

> **HD-P06 — 07/10/2026:** primeiro TOTP opcional da própria conta integrado/publicado pelo PR15; API0.22.0/schema0.19.0. Chave manual, catálogo vivo e confirmação, pendente retomado sem criar outro, sem remoção/reset de fatores. Segredo retirado do DOM ao encerrar e nova entrada após confirmação. [Entrega e limites](docs/126-HD-P06-PRIMEIRO-AUTENTICADOR-TOTP.md).9 novos/27 focais/106 interface aprovados; revisão sem achados. Atendimento fechado; fatores adicionais/recovery/QR/admin obrigatório e aceite real pendentes. CI1609/229/106 aprovado; merge912bea2 e produção6ac6ad5e verificados.

> **HD-P06 — 07/10/2026:** login TOTP existente e guard MFA integrados/publicados pelo PR14; API0.21.0/schema0.19.0. Auth valida bearer exato antes de exigir AAL2 para fatores verificados e antes dos vínculos; grants/scopes vivos preservados. Login espera código antes de workspace, cleanup privado e resposta antiga protegidos. [Entrega e limites](docs/125-HD-P06-LOGIN-TOTP-E-VALIDACAO-DE-MFA.md).73 focais/103 interface aprovados; enrollment/recovery/MFA administrativo obrigatório e aceite real pendentes. Atendimento fechado; CI1600/229/103 aprovado; merge24559ce e produção6ac6991e verificados.

> **HD-P06 — 07/10/2026:** código adicional para troca de senha integrado/publicado pelo PR13; API0.20.4/schema0.19.0. Solicitação explícita ao próprio canal cadastrado e nonce opcional, sem reenvio automático ou configuração alterada. Corrigida corrida de despacho concorrente com código/senha;67 focais e99 interface aprovados. [Entrega e limites](docs/124-HD-P06-CODIGO-PARA-TROCA-DE-SENHA.md). Atendimento fechado; SMTP/MFA/recuperação e M1 operacional pendentes. CI1565/229/99 aprovado; merge1c04c76 e produção6ac68492 verificados.

> **HD-P06 — 07/10/2026:** troca da própria senha integrada/publicada pelo PR12; API0.20.3/schema0.19.0. Payload Auth restrito, campos limpos no envio, requisição única e nova entrada após resultado; respeita recusas MFA/autenticação recente sem alterar configuração. [Entrega e limites](docs/123-HD-P06-TROCA-DE-SENHA-AUTENTICADA.md). Atendimento fechado; senha/MFA/SMTP reais, recuperação completa e M1 operacional pendentes. CI1554/229/96 aprovado; merge33c2f86 e produção6ac67460 verificados.

> **HD-P06 — 07/10/2026:** encerramento global das próprias sessões integrado/publicado pelo PR11; API0.20.2/schema0.19.0. Confirmação explícita, limpeza local imediata, novo login bloqueado enquanto o pedido aguarda resultado; logout local continua padrão. [Entrega e limites](docs/122-HD-P06-ENCERRAMENTO-GLOBAL-DE-SESSOES.md). Atendimento fechado; aceite Auth entre dispositivos, MFA/recuperação/administração e M1 operacional permanecem pendentes. CI1544/229/92 aprovado; merge e6ed434 e produção6ac66dae verificados.

> **Troca segura de workspace — 07/10/2026:** PR10 integrado8f3c797/publicado; API0.20.1, CI1536/229/89 aprovado. Troca confirmada com logout local e nova autenticação; cancela sem apagar rascunho, bloqueia envio/abertura não reconciliada. Corrigida retenção de motivo/textos/avisos antigos no DOM, regressão red/green. [Evidência e limites](docs/121-HD-P05-TROCA-SEGURA-DE-WORKSPACE.md). Schema0.19.0/12 migrations/25 tabelas/19 operações intactos, sem grants/scopes novos. Atendimento fechado; aceite Auth/M2M real, cadastros, MFA/capacidade/restore e backoffice permanecem pendentes.

> **Descoberta de workspaces — 07/10/2026:** PR9 integrado e0d877f/publicado; CI1536/229/85 aprovado. API0.20.0/schema0.19.0,12 migrations/25 tabelas/19 operações. Discovery humano restrito, UUID opcional, seleção explícita quando múltiplos e revalidação emme. Migration012 aplicada; vínculos/scopes preservados, admin revisão2. [Evidência e limites](docs/120-HD-P05-DESCOBERTA-DE-WORKSPACES.md). Atendimento fechado; login humano real/M2M/cadastros/MFA e administração continuam pendentes. Onze migrations anteriores imutáveis; não repetir bootstrap.

> **Login antes da liberação — 07/10/2026:** PR8 integrado emced323a/publicado; CI1510/223/81 aprovado. Runtime permite somente autenticação/lifecycle técnico com atendimento fechado, mantendo TLS/role/schema/segurança/quotas. Configuração/capabilities200 operationalfalse, me401 sem bearer, quatro rotas de atendimento503 confirmadas em produção. [Evidência e limites](docs/119-HD-P03-LOGIN-ANTES-DO-ATENDIMENTO.md). Login humano real/M2M e percurso operacional continuam pendentes; não ampliar escopos nem inventar cadastros/contratos/SLA.

> **Bootstrap inicial — 07/10/2026:** PR7 integrado/publicado; CI1482/223/79 aprovado. Titular escolheu a pessoa humana já cadastrada como primeiro administrador, mantendo contexts:resolve/tickets:read. Aplicado por operador privado, role agent→admin, revisão1→2 com a mesma lista, um audit; replay não criou novo efeito. Nenhum grant à aplicação nem campo Auth foi alterado. [Evidência e limites](docs/118-HD-P03-PRIMEIRO-ADMINISTRADOR.md). Não repetir bootstrap; M1/Auth/M2M/cadastros e backoffice continuam pendentes, gate fechado.

> **HD-P03 — 07/10/2026:** PR5/6 integradas; CI1458/215/79 aprovado. Diagnóstico readonly executado dentro da Function de produção: dez checks aprovados (configuração, conexão/TLS, papel restrito, schema/segurança, rollback/cleanup), zero operações de negócio. [Evidência e limites](docs/117-HD-P03-DIAGNOSTICO-NO-RUNTIME.md). Gate fechado; Auth/M2M/percurso de atendimento/capacidade/restore continuam pendentes. Histórico de logs inicialmente vazio foi complementado pelo provedor; não alterar bindings ou credenciais por essa ausência inicial.

> **Continuidade HD-P03 — produção:** clientes read/Auth/write adaptados a production, três exemplos de site separado removidos e 140 testes focais aprovados. CI Linux run37560232763 aprovado: 1.450 aplicação, 215 PostgreSQL e 79 interface. PR4 integrado em0789dc3 e código publicado em produção (deploy6ac5aaaf); aceite operacional pendente. [Política e evidência](docs/116-HD-P03-VALIDACAO-EM-PRODUCAO.md).

> **HD-P03 — 06/10/2026:** homologação hospedada na mesma base/site HelpDesk, conforme decisão do usuário. CI Linux 1.447/215/79 aprovado; PR4 pronto para revisão. Aceite Auth/Function/base atual permanece pendente. Leia [docs/116-HD-P03-VALIDACAO-EM-PRODUCAO.md](docs/116-HD-P03-VALIDACAO-EM-PRODUCAO.md).

> **Decisão do usuário — 06/10/2026:** O único ambiente do Help Desk é produção: site helpdesk-consultegeo e projeto Supabase HelpDesk xaelbntjnvztznnpcvtm. Desenvolvimento, implantação e validação hospedada usam esse destino. Não solicitar ambiente ou credenciais de teste ao usuário.

> **HD-P02 — 06/10/2026:** recuperação da abertura corrigida;14 testes focais e79 verificações de interface aprovados. Windows1447/1424/23 (mesmas falhas anteriores); CI novo/aceite hosted pendentes. Leia [docs/115-HD-P02-RECUPERACAO-DA-ABERTURA.md](docs/115-HD-P02-RECUPERACAO-DA-ABERTURA.md). M1 operacional aberto.

> **HD-P01 — 06/10/2026:** PR3/R24 integrado em `b4dd000`; CI R24 1436/215/71 aprovado, gate publicado fechado e M1 operacional aberto. Estado corrente e mapa das onze migrations em [docs/114-HD-P01-ESTADO-POS-R24.md](docs/114-HD-P01-ESTADO-POS-R24.md). Números e destinos anteriores abaixo são históricos.

> **M1-R24 — 05/10/2026:** base canônica R23 `072287f`, com R20–R22 já integrados. Estado, revisão e evidências desta rodada em [docs/113-M1-R24-REVISAO-E-ESTADO.md](docs/113-M1-R24-REVISAO-E-ESTADO.md). M1 operacional aberto; M2 não iniciado. Os estados antigos abaixo são históricos.

> **Integração Codex — 02/10/2026:** R10–R19 integrado; CI Linux 1417 Node, 215 PostgreSQL17 e 71 HTTP/browser aprovados. Lock, audit e typecheck aprovados; evidência única verificada. Leia docs/105-M1-R19-INTEGRACAO-CODEX.md. M1 operacional permanece aberto. Autorização atual permite commit, merge e publicação sem Claude; estados e restrições antigos abaixo são históricos.

> **Retomada R19 — 01/10/2026:** ler o estado/handoff/tarefa nos documentos 102–104. Código R18 preservado; 1.417 Node revalidados. Lock existente: usar npm ci, não regenerá-lo por orientação histórica. 215 SQL e navegador ainda não executados com sucesso nesta rodada. M1 aberto; sem nova autorização externa. Números e passos antigos abaixo são históricos.

# Instruções de continuidade — Help Desk

Leia README, docs/01-ARQUITETURA.md, docs/02-PLANO-DE-DESENVOLVIMENTO.md docs/04-ESTADO-E-EVIDENCIAS.md e docs/06-M1-SEGURANCA-E-LIMITES.md antes de alterar o código.

## Fronteiras obrigatórias
- Workspace, conta, produto/instância, contrato/versão e cobertura são conceitos distintos.
- Não introduzir laboratório, obra, aluno ou identificadores específicos como colunas obrigatórias do core.
- Não acessar o banco GeoLab ou legado para armazenar tickets deste produto.
- Nunca usar service_role, postgres ou BYPASSRLS como identidade normal de request.
- Não expor schemas/tabelas de domínio diretamente a browsers ou sistemas consumidores.
- Não tratar header, UUID ou JWT metadata como autorização.
- Notas internas têm tabela, endpoint e DTO próprios; não participam de outbox externo.
- Preservar versões publicadas e snapshots; alterar políticas em nova versão.
- Idempotência é persistente/transacional; contexto de pool somente transacional.
- Memória e credenciais `demo-*` são exclusivamente de testes/loopback. Nunca fallback de produção.

## Execução segura
- Esta entrega não autoriza implicitamente deploy, merge, migration remota, alteração de segredo/MFA, criação de infraestrutura cobrada ou alteração de outros sistemas.
- Reinspecionar GitHub/Supabase/Netlify antes de publicação: podem existir mudanças concorrentes.
- Trabalhar em branch isolada. Não sobrescrever o repositório remoto porque a inspeção antiga disse que estava vazio.
- Testar SQL com login real restrito em banco descartável; os testes de memória não comprovam RLS.
- Não alterar políticas de segurança do ambiente de execução para contornar bloqueios de navegador/rede.
- Não marcar requisito concluído só por haver arquivo, migration ou teste escrito.

## Qualidade
Escrever testes negativos antes da correção; executar npm test, typecheck, check:contracts e build. Executar a suíte PostgreSQL e a interface em ambiente apto. Não publicar com lockfile ausente, dependência não auditada ou capabilities fictícias. Documentar explicitamente não executado, bloqueado e não implementado. Entregar evidências por commit e atualizar a matriz de status.

## Estado atual v0.19.0
API/interface0.19.0; schema esperado0.18.0. Onze migrations intactas,25 tabelas,18 operações. Ler docs04/05/23. Comparar vigência [início,fim) com fuso explícito e microssegundos exatos; não normalizar calendários impossíveis. Validação integral da coleção privada antes de seleção/criação: resultado inválido é503, não no_coverage/primeira gravação. Reenvio autorizado mantém snapshot original, sem consultar novamente elegibilidade. O relógio continua sendo do servidor; precisão do comparador não é alta resolução do relógio.

1.040 testes locais/35HTTP passaram.201SQL/36browser escritos, não homologados. Registry falhou por DNS; sem lock real/npm ci/audit. M1 aberto e M2 não iniciado. Nenhuma reinspeção ou escrita remota nesta rodada. Preservar todos os locks, scopes, notas-only, efeitos e command tags anteriores. Histórico abaixo não é estado atual.

## Registro histórico v0.18.0
API/interface/schema candidato0.18.0. Onze migrations,25 tabelas,18 operações. Nota-only não pede UPDATE na consulta inicial; o trigger privado serializa o pai com NO KEY UPDATE. Não resolver isso ampliando grants/notes-read nem tirando os locks de outros comandos. DML exige confirmação de uma linha; UPDATE0 mantém412. Nada de INSERT RETURNING para notas, sucesso por resposta ausente ou retry automático de mutação. Leia docs22. Os dez arquivos SQL anteriores permanecem intactos.

1002 testes locais/35HTTP passaram.196 SQL/36browser escritos, não homologados. Sem lock real/npm ci/audit; typecheck global não é instalação. M1 aberto, M2 não iniciado. Nenhuma escrita ou leitura remota nesta rodada. Conferir destinos antes de integrar. Histórico abaixo preservado para rastreabilidade.

## Estado v0.17.0
M1 aberto.982 locais/35HTTP de memória aprovados;187SQL/36browser escritos, não aprovados. API0.17/schema0.16;10 migrations intactas/25tabelas/18operações. Ler docs04/05/21. Sem inspeção ou escrita remota.

Preservar microssegundos nos SELECTs e cursores; não passar o timestamp PostgreSQL por Date antes de paginar. ORDER BY coluna nativa qualificada, não alias textual. Comparações exatas, mesmas regras de desempate do cursor. shared/instant.js deve ir ao build e ao fingerprint. Representação de recibo histórico não muda; Date.parse não deve confundir instantes distintos ou datas impossíveis. Cursor antigo já truncado exige reiniciar a coleção. Não alterar calendários/SLA/TTL/fluxos sob pretexto desta correção.

## Registro histórico v0.16.0
M1 aberto.950 locais/35 HTTP de memória;179 SQL/35 browser escritos, não homologados. API/schema0.16;10 migrations/25 tabelas/36 funções/18 triggers. Ler docs04/05/20. GitHub lido vazio; Supabase/Netlify não reinspecionados, nenhuma escrita remota.

R14-06 possui candidato de write_effects, produzido pelo banco e ligado a pg_current_xact_id. Não dar acesso ao app/clientes, não backfill do passado, não confundir com cache idempotente ou entrega externa. Preservar001–009. Memorystore é modelo de referência, não PostgreSQL. Deferir verificação não é permitir confirmar pares incompletos. Não remover triggers/asserts para aprovar uma sequência inválida. No-op/replay sem novo efeito; notas/atribuições sem outbox. Conferir atualizações do inventário e efeitos da tabela na retenção/restore/custo antes de produção.

## Registro histórico v0.15.0
M1 aberto. 905 testes locais/35 HTTP de memória aprovados;146 SQL/35 browser escritos, não homologados. API/schema0.15, nove migrations/24 tabelas/18 operações. Leia docs04/05/19. Sem publicação nem inspeção remota nesta rodada.

Human scope versions é teto por pessoa/workspace, não autorização de conta. Perfil ausente é vazio; backfill único preserva relações humanas legadas ativas. Não voltar ao fallback de cinco scopes para novos humanos. Os helpers has_scope/resolve_human consultam a mesma revisão. Setter SQL é privado, SECURITY INVOKER, sem EXECUTE do app/clientes. CLI scopes:plan não executa SQL. Não colocar credenciais no plano, não conceder self-service de escopos para "facilitar" o backoffice.

Recibo da própria nota exige tickets:read/notes:write/operador; coleção continua exigindo notes:read. Não usar SELECT irrestrito ou RETURNING como atalho. UPDATE/DELETE do histórico são recusados; não declarar WORM, revogação instantânea de JWT ou transações concorrentes homologadas. Preservar migrations001–008. R14-06 ainda aberto.

## Registro histórico v0.14.0
M1 aberto.868 testes locais/35 HTTP aprovados; 125 SQL/35 browser escritos, não homologados. API 0.14/schema 0.9; oito migrations,23 tabelas,18 operações. Leia docs 04/05/18 e revisão histórica15. Sem publicação.

Reenvio validado por namespace e recurso/operação. Cache inválido NÃO é ausente; não executar work, reparar/limpar cache ou gerar nova key. Retornar snapshot histórico autorizado, não GET atual. Preservar falta histórica de assignedTo, ordem JSONB e autoria original. Scopes humanos granulares ainda não têm configuração persistida: conferir R14-04/05/06 antes de anunciar perfis só leitura/escrita de notas.

Leitura humana do provedor limitada a64 KiB decodificados e ao sinal5000ms, UTF-8 estrito. Metadados não autorizam. Não ampliar orçamento sem teste real com dados sintéticos representativos.

## Registro histórico v0.13.0
M1 aberto.789 locais/35 HTTP aprovados; 125 SQL/35 browser escritos, não homologados. API0.13/schema 0.9; oito migrations/23 tabelas/18 operações. Ler documentos 04,05,17 e revisão histórica15. Sem reinspeção ou escrita remota nesta rodada.

available_actions é snapshot consultivo do GET, não autorização. Não armazenar em cache de reenvio, não inferir escrita pelo papel e não adicionar fallback do frontend para /me. Cada comando revalida. Notas read/write independentes. Falha opcional remove itens privados antigos, conserva rascunho da mesma identidade e não bloqueia conversa pública. GET/diálogo inválido não é sucesso vazio.

Preservar UUIDs nos limites persistidos/Auth e aliases somente no domínio/demo. Rejeitar NUL/surrogate, não substituir. Conferir parent e filhos nas conversas. Responsabilidade não concede acesso, filtros apenas operador por conta; motivos/eventos internos não saem ao cliente. Cache é snapshot original reautorizado; repetir resposta não é leitura atual.

Sessão humana só em memória, rotação única compartilhada e sob demanda. Não repetir mutações após401/503; recusa pré-dispatch é distinta de confirmação perdida. Logout local limpa a UI e pede scope local ao provedor, não garante invalidar JWT copiado antes de exp. Não promover metadata do JWT para autorização, nem desativar MFA/CAPTCHA para fazer passar testes. Sessões M2M não foram substituídas. Os testes de Auth são sintéticos e não comprovam o provedor real.

Não alterar migrations/hashes, gates ou fixtures para fabricar aprovação. A contagem de testes não substitui execução real, capacidade/restore ou revisão independente.
