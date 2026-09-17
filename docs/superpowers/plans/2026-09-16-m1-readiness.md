# Continuidade M1 — prontidão e integridade, v0.10.0

Base: v0.9.0 / fbed9dccfaaf6c388d1ddc24673cfdc6f8afc55e.

Objetivo desta execução: cobrir lacunas verificáveis da inicialização e preparar a execução do banco; não adicionar telas ou autorizar publicação sem homologação.

1. Reproduzir 635 testes da base e tentativas normais de dependências/banco, sem fallback remoto.
2. Testar negação de desvios de permissões, helpers, constraints e triggers na inicialização; ampliar a consulta de catálogo com privilégios efetivos por tabela/coluna/função. Nenhum dado de atendimento será lido por esse guard.
3. Criar manifesto de integridade das oito migrations; recusar mudança, remoção, ordem divergente, arquivos extras e links simbólicos antes de qualquer SQL. SHA-256 prova integridade relativa ao manifesto revisado, não qualidade do SQL.
4. Preparar cenário real de upgrade 001–007→008 com fixtures sintéticas, em banco novo e local, além dos testes de drift. Não considerar os casos escritos como executados.
5. Executar regressões locais, verificação padrão, smoke HTTP, tentativas SQL/browser, empacotar ZIP, patch e Git bundle com relatório de evidências.

Restrições: nenhuma escrita remota, segredo/MFA ou gate de produção alterado; nenhuma migration anterior reescrita. Schema continua 0.9.0. Sem novos privilégios, sem auto-repair do banco. Constantes de segurança são do desenvolvedor, não recebidas do request.

Riscos e aceite: SQL de catálogo requer PostgreSQL17 real, inclusive Supabase/pooler e o login helpdesk_app. Catálogo não comprova o corpo/semântica de policies/triggers/helpers, nem detecta mudanças após a inicialização. Testes independentes de isolamento continuam obrigatórios. URLs/conteúdo SQL/erros do driver não entram em resposta pública.


## Resultado desta execução
Etapas de implementação 2–4 concluídas em código; testes locais e integridade aprovados. Prontidão PostgreSQL/upgrade não executados. Dependências e navegador bloqueados. Estado detalhado no documento04. Não declarar M1 concluído nem iniciar publicação.
