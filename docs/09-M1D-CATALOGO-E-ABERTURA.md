# M1d — Catálogo autorizado e abertura guiada

## Resultado funcional

O usuário autenticado abre “Novo chamado”, recebe opções com **conta + sistema/ambiente + serviço**, descreve a solicitação e confirma. Havendo apenas uma opção na lista completa, ela é selecionada automaticamente. Havendo mais de uma, não se escolhe a primeira. O formulário não exige conhecer IDs internos.

Selecionar contexto não seleciona contrato. A abertura chama `/contexts/resolve`; uma cobertura única segue para criação, mais de uma exige escolha explícita, e nenhuma cobertura impede criação. `/tickets` continua fazendo a revalidação transacional. Não há triagem sem contrato nesta entrega.

Esse incremento implementa descoberta de leitura sobre o modelo existente. Não cria backoffice, novas entidades específicas de produto ou autorização baseada em label/UUID.

## Contrato implementado

```http
GET /v1/support-contexts?limit=50
Authorization: Bearer <identidade válida>
X-Workspace-Id: <workspace autorizado>
```

Resposta ilustrativa, com IDs fictícios:

```json
{
  "items": [{
    "account_id": "00000000-0000-4000-8000-000000000101",
    "account_name": "Cliente de exemplo",
    "product_instance_id": "00000000-0000-4000-8000-000000000401",
    "product_name": "Sistema de exemplo",
    "environment": "production",
    "service_code": "SUPPORT",
    "service_name": "Suporte ao sistema"
  }],
  "next_cursor": null
}
```

Parâmetros aceitos: `limit` inteiro 1–100 (padrão 50), `cursor` opaco até 1600 caracteres e `account_id` opcional. Duplicados, desconhecidos e seletores vazios são recusados. Sem body. `Cache-Control: no-store`. Requer o scope existente `contexts:resolve`; lista sem grants não ganha acesso universal. Filtro de conta não autorizada resulta em 404 na aplicação. Métodos não implementados retornam 405/Allow. Não há contador global de contas ou contratos.

Cada tupla conta/instância/serviço aparece uma vez, mesmo com várias coberturas. Os identificadores permanecem necessários na API, mas o usuário não os digita no formulário. O DTO só expõe sete campos públicos. Nomes têm até 160 caracteres Unicode e são tratados como texto, não HTML. Código de serviço preserva caixa/acentos e tem até 80 caracteres; caracteres de controle são recusados pelo contrato de aplicação. Metadados impróprios falham com erro seguro, não são repassados como objeto interno arbitrário.

## Autorização e SQL candidato

O fluxo é `handler → HelpdeskService → catálogo → UnitOfWork → Store`. Na memória, fixtures são explicitamente fornecidas e verificadas contra coberturas. No PostgreSQL, o adaptador chama `helpdesk_auth.support_contexts` pelo client transacional já existente. Nenhuma função do demo é importada pelo runtime.

O helper é privado e `SECURITY DEFINER` com `search_path=''`, função executável por `helpdesk_app`, não PUBLIC/anon/authenticated/service_role. Não amplia grants diretos de SELECT de produtos/serviços. Verifica workspace, scope, conta e produto usando vínculos atuais. Só considera cobertura habilitada, versão publicada, contrato ativo e intervalo de vigência contendo o horário do statement. Joins usam workspace e FKs existentes.

A migration 006 adiciona índice parcial de cobertura por workspace/conta/instância/serviço com collation C, helper e schema_version 0.5.0. As cinco anteriores não mudam. Não há nova tabela, migração de dados de cliente ou criação automática de conta/contrato. **Isso é código SQL candidato, não SQL executado ou RLS comprovada.**

Paginação usa tupla `(account_id, product_instance_id, service_code COLLATE "C")`. A aplicação compara UTF-8 e rejeita resposta desordenada, duplicada ou acima do limite pedido. O cursor incorpora o escopo de ator/workspace/filtro; não é assinatura, credencial ou garantia de autenticidade do cliente. Mesmo um seletor alterado continua sujeito às permissões. O catálogo não fixa snapshot entre páginas: uma cobertura nova anterior ao cursor só aparece após recarregar desde o início.

## Estado de interface

`support-catalog-state.js` mantém operação ativa por referência e geração, página seguinte, itens projetados e seleção. Fechamento, reinício e troca de sessão descartam estado anterior. Um resultado antigo não pode repovoar o formulário de outro perfil. Carregar mais preserva escolha explícita; página duplicada/cursor repetido/objeto malformado produz erro, não loop ou opção fictícia. As cópias retornadas não alteram o estado privado.

`app.js` renderiza labels via `textContent`, usa o contexto selecionado no snapshot do envio e continua protegendo rascunhos/mutações anteriores. Erro oferece nova tentativa; ausência de cobertura orienta revisão dos vínculos. Não habilita entrada manual para contornar o erro. A versão visível foi corrigida de 0.3.0 para 0.5.0.

Os 24 testes de estado foram executados; **a integração DOM e visual ainda não foi validada**, devido ao bloqueio do navegador. Os 14 testes browser escritos são uma base, não uma matriz completa de acessibilidade ou falhas.

## Verificações e limites

407 testes locais aprovados, incluindo 38 de catálogo de aplicação, 18 HTTP in-process, dois do adaptador/sentinelas SQL e 24 de estado puro. 13 checks HTTP reais de loopback aprovados, usando memória. Há 60 cenários SQL escritos e 14 browser escritos, mas não executados/aprovados no ambiente desta rodada. TypeScript global, OpenAPI estrutural e build estático são verificações distintas da homologação real.

A consulta pode exigir muitas checagens de autorização quando há múltiplos contratos/coberturas. Índices, plano e custo de joins precisam ser medidos com dados sintéticos representativos, pelo papel da aplicação. GET pode consumir orçamento do limitador, mas o helper não grava tickets, eventos ou outbox. Nomes de cadastro são visíveis aos autorizados e devem ser revisados antes de colocar dados reais. Escopos/contratos precisam ser provisionados pelo processo aprovado; CRUD administrativo não está incluído.

## Referências e rastreabilidade

Base funcional: `docs/01-ARQUITETURA.md`, HD-105 em `02-PLANO-DE-DESENVOLVIMENTO.md` e handoff histórico v0.4.0. Os relatórios originais permanecem em `docs/research/`; esta evolução não altera a separação workspace/conta/contrato/produto.

Documentação técnica consultada para manter as fronteiras já adotadas: PostgreSQL 17 RLS (`https://www.postgresql.org/docs/17/ddl-rowsecurity.html`) e node-postgres transactions (`https://node-postgres.com/features/transactions`). Essas referências explicam os mecanismos; não comprovam nossa migration. Testes reais com papel restrito são necessários.
