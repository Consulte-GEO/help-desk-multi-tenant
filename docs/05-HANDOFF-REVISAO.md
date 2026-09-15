# Handoff para revisão e próxima implementação

## Objetivo imediato

Revisar a fundação local v0.1.0, resolver dependências e provar persistência/autorização em PostgreSQL real antes de ampliar o produto. Não assumir que o código já está no GitHub ou no Netlify.

## Contexto que o revisor precisa

Os dois relatórios defendem Help Desk independente. O segundo acrescenta workspace e separação física de notas. Esta entrega adota as duas fronteiras workspace/conta e preserva contrato/versionamento. Não existe código anterior recuperado do repositório: ele estava vazio no momento da inspeção. O Supabase tem alerta para a função pública rls_auto_enable; existe migration candidata para revogar execução pública, ainda não aplicada.

Há núcleo e API testados localmente; driver/configuração/auth possuem testes com doubles. O banco real não foi executado, o navegador foi bloqueado e não existe publicação. A interface é inicial e usa JavaScript nativo; o domínio TypeScript é independente do transporte. Não houve cópia de código GeoLab nem de projetos OSS.

## Ordem de trabalho recomendada

1. Conferir o estado atual do repositório e preservar mudanças concorrentes. Criar branch de revisão isolada ou usar o bundle local entregue.
2. Ler os documentos, conferir todos os arquivos e executar testes locais. Revisar especialmente `src/application/helpdesk.ts`, `src/http/serialization.ts` e `src/infrastructure/postgres.ts`.
3. Instalar dependências em ambiente autorizado, gerar lockfile, auditar, fixar toolchain e CI. Confirmar se o empacotador inclui a dependência pg usada pela importação dinâmica.
4. Rodar `supabase/tests/rls.test.ts` em PostgreSQL 17 local descartável. Corrigir migrations/testes pelo resultado real, não por inspeção apenas. Não apontar esses testes ao Supabase remoto.
5. Ampliar cenários de FK, escopo, escrita cruzada, contratos simultaneamente suspensos, idempotência e deadlocks; verificar o papel exato do pooler.
6. Revisar helpers SECURITY DEFINER, owner BYPASSRLS, FORCE RLS, exposição de schema, grants herdados e data access com auth revogada. Autenticação de request não pode depender de claims editáveis.
7. Executar e corrigir a interface em navegador. Testar mensagens grandes, formulários, perfis, drafts separados, estados 401/403/409/412/503 e reenvio após timeout.
8. Implementar limites distribuídos e lifecycle de sessões/idempotência antes de piloto. Desenvolver administração e protocolo incorporado por usuário conforme M2/M6.
9. Registrar evidências e somente então solicitar/aplicar o fluxo de publicação autorizado.

## Pontos de revisão que não podem ser omitidos

- `SELECT FOR SHARE` ocorre em helper autorizado limitado; confirmar bloqueios e corrida com suspensão em PostgreSQL real.
- A constraint trigger de criação exige evento e outbox antes do commit. Conferir seu funcionamento e seus privilégios.
- O login de aplicação não deve ter privilégios de configuração contratual nem acesso direto a credenciais.
- Papéis/escopos e RLS têm responsabilidades complementares. Exercitar todos os caminhos reais, inclusive M2M revogado.
- Mensagens/timeline ainda não têm paginação. Credenciais/sessões e idempotência não têm limpeza implementada.
- Outbox não é entrega: worker, assinatura, ledger, backoff e DLQ ainda faltam.
- A tabela de auditoria administrativa existe, mas o backoffice e sua emissão efetiva de eventos não estão implementados.
- Snapshot de política e função de calendário não equivalem a SLA operacional.
- `support-sessions` por usuário externo não existe; token de máquina nunca substitui a identidade de cada cliente.
- Build estático não comprova Functions, Auth, Storage, RLS, backup ou prontidão de produção.

## Reuso futuro de GeoLab/GEOCON/outros sistemas

Reaproveitar somente depois de inventariar o código atual. Bons candidatos: tokens de design, componentes acessíveis de formulário/tabela, convenções de erro e logging, ferramentas de teste e padrões de notificação. Extrair componentes puros; remover suposições de laboratório, tenant e banco antes de importar.

Não copiar em bloco policies Supabase, helpers privilegiados, fluxo de permissões, MFA ou integrações de credenciais. Esses componentes são específicos das relações de confiança do sistema de origem. O novo banco tem fronteiras próprias. Prompts ou relatórios anteriores não são evidência de que um módulo está correto, publicado ou autorizado para reutilização.

## Definição de entrega

O revisor deve informar por requisito: codificado, testes locais, testes reais, revisão de segurança e publicação. Relatar o commit base/resultado, arquivos alterados, comandos executados, falhas, pendências e efeito remoto. Não concluir com “tudo pronto” quando apenas a suite de memória passar.
