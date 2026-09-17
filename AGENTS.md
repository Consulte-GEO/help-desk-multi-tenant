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

## Estado v0.12.0
M1 aberto.753 locais/32 HTTP aprovados;125 SQL/32 browser escritos, não homologados. API 0.12/schema 0.9; oito migrations/23 tabelas/18 operações. Ler documentos 04, 05 e 16 e revisão histórica 15. Apenas GitHub foi reinspecionado nesta rodada; ausência antiga de trabalho remoto não autoriza sobrescrita.

Preservar UUIDs nos limites persistidos/Auth e aliases somente no domínio/demo. Rejeitar NUL/surrogate, não substituir. Conferir parent e filhos nas conversas. Responsabilidade não concede acesso, filtros apenas operador por conta; motivos/eventos internos não saem ao cliente. Cache é snapshot original reautorizado; repetir resposta não é leitura atual.

Sessão humana só em memória, rotação única compartilhada e sob demanda. Não repetir mutações após401/503; recusa pré-dispatch é distinta de confirmação perdida. Logout local limpa a UI e pede scope local ao provedor, não garante invalidar JWT copiado antes de exp. Não promover metadata do JWT para autorização, nem desativar MFA/CAPTCHA para fazer passar testes. Sessões M2M não foram substituídas. Os testes de Auth são sintéticos e não comprovam o provedor real.

Não alterar migrations/hashes, gates ou fixtures para fabricar aprovação. A contagem de testes não substitui execução real, capacidade/restore ou revisão independente.
