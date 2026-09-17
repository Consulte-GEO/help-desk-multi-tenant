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

## Estado atual v0.18.0
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
