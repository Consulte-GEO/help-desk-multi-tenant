# Plano revisado — Implantação e Importações R03

14/10/2026. Evolução cumulativa da R02. Prioridade: transformar os módulos desenvolvidos em uma operação verificável; não adicionar telas aparentando capacidades inexistentes.

## Estado por incremento

| Bloco | Estado após R03 | Próxima evidência necessária |
|---|---|---|
| IMP-00 baseline e destinos | Parcial | Checkout completo e receptor real qualificado |
| IMP-01 integridade | Núcleo, ponte e contratos testados focalmente | Fluxo completo do aplicativo com XLSX |
| IMP-02a processos/revisões | Serviço + SQL candidato | PostgreSQL real, privilégios e durabilidade |
| IMP-02b transporte/retomada | HTTP, cliente e controlador implementados; 4 ensaios HTTP reais | Montagem no runtime e Vuex; sessão/autoridade reais; navegador |
| IMP-02 arquivos | Metadados e inspeção por porta | Upload privado, bytes, scanner, download e purge |
| IMP-02 completo | **Ainda não concluído** | Retomada real entre dispositivos e recuperação de intenção após reload |
| IMP-03 Help Desk | Não montado | Vínculo idempotente, protocolo, projeções e comunicação |
| IMP-04 a IMP-13 | Mantêm os estados parciais/não iniciados da R02 | Não foram declarados concluídos nesta rodada |

## Próximo lote obrigatório

### A. Integrar a fonte cumulativa no checkout completo

Confirmar HEAD/branch/instruções e concorrência. Aplicar somente R03 contra a base ainda sem os pacotes anteriores. Se R01/R02 já tiverem sido integradas, reconciliar o delta em vez de alterar hashes para forçar aplicação. Instalar pelo lock, repetir todos os gates legados e focais, montar /importa real e comprovar XLSX completo.

### B. Qualificar PostgreSQL antes de montar escrita

Executar `tools/qualify-import-process-postgres.mjs` como usuário de SO não-root no cluster descartável criado pela própria ferramenta. Requisitos e onze cenários em QUALIFICACAO_POSTGRESQL_R03.md. O executor desta sessão não chegou a aplicar o DDL. Corrigir o que o banco real revelar por TDD, sem afrouxar RLS/ACLs, nem transformar blocked/skip em sucesso.

Completar além do runner: papel e memberships efetivos, falha ambígua de COMMIT, reinício físico do cluster, restore, snapshots grandes e revisão de compatibilidade do provedor. Só depois gerar migration oficial no fluxo do projeto. Não copiar o SQL candidato para produção automaticamente.

### C. Implementar portas reais no runtime existente

Mapear sessão e diretório de contas/obras à fonte autorizada já escolhida no Help Desk/Setup. Localizar caseId apenas dentro do acesso atual; usuário/CNPJ/nome não autorizam. Rate limit também antes da autenticação no gateway. Construir pool restrito, autoridade e inspetor no servidor. Não usar environment()/MemoryRepository ou chaves do cliente como substitutos. Manter flag fechada até o aceite.

### D. Armazenamento e retomada

Implementar upload restrito, confirmação sobre bytes imutáveis, scanner, limites de ZIP/PDF, versão do objeto e download autorizado. Conectar snapshots aos arquivos reais. Não declarar ready após gerar link de upload. Decidir e executar retenção/purge de forma operacionalmente autorizada.

A intenção de salvamento incerta do cliente R03 só vive em memória. Implementar recuperação autorizada após hard reload sem localStorage inseguro com tokens e sem gerar UUID novo automaticamente. Não confundir esse ponto com a persistência da revisão no servidor.

### E. Conectar interface ao Vuex

Usar o cliente de sessão e controlador entregues, sem trocar Vuex/stack. Projetar tela para retomar caso, mostrar confirmação do servidor, preservar conflito, recuperar recibo e distinguir ready/uncertain/refresh_required. Só expor ações cuja capability real estiver qualificada. clearSession deve ser conectado ao logout/revogação/troca de escopo do host; não é logout por si.

O ensaio de navegador novo compilou mas foi bloqueado pela política do ambiente antes da navegação. Executar em navegador autorizado no ambiente de desenvolvimento do Codex, não tentar contornar a política daqui. Depois testar a própria aplicação, pois o host incluído em tools/tests é apenas fixture.

## Critério para concluir IMP-02

Pessoa autorizada cria processo e anexa arquivo seguro; fecha dispositivo; retoma a mesma revisão em outra sessão/dispositivo; outra conta não lê; edições concorrentes não se sobrepõem; ACK perdido se recupera sem duplicação, inclusive após recarregar segundo o contrato implementado; arquivo rejeitado não alimenta snapshot; histórico e recibos são duráveis; nenhum erro vira salvo; todas as ações acima têm testes reais e aceite. Exportar continua diferente de importar.

## Entrega seguinte

ZIP cumulativo, handoff e plano atualizado com evidências do mesmo código. Separar implementado, teste focal, PostgreSQL real, navegador real, publicação e operação. Não abrir atendimento nem executar agente com acesso amplo para contornar pendências.
