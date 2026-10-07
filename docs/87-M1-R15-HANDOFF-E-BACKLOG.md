# Help Desk M1-R15 — Handoff e backlog

## Retomada
Ler PROJECT_HELP_DESK.md, README/AGENTS, handoff upstream R9, docs85–88 e o manifesto do pacote. Base remota verificada:78bbb00112331531168ae24600604cb7f3148770. R10–R15 são incrementos locais. Não reaplicar R2–R9; preservar a história remota.

R15 estende a suíte de gravações já existente com opt-in `includeMachineWrites:true`, novo hash de confirmação e21cenários M2M. Configurações antigas mantêm18cenários humanos;28controles R10 antecedem ambos. Mínimo de aplicação1.364;209SQL/71HTTP+browser continuam separados. Nenhum novo comando/endpoint, core, grant, schema, lock ou migration.

## Integração
- Remoto R9 exato sem R10–R14: `helpdesk-m1-r10-r15.patch`.
- R14 exato do pacote anterior: `helpdesk-m1-r15-only.patch`.
- Checkout intermediário ou alterado: reconciliar pelo manifesto/diff; não forçar nem aplicar ambos.
A recuperação local tem fingerprint equivalente, não história upstream completa. Não fazer force-push de commits/bundle locais. Os patches não substituem os documentos/evidências históricos do checkout.

## Ordem de trabalho
| Prioridade | Ação | Condição de saída | Estado |
|---|---|---|---|
| P0-INTEGRAR | Integrar pacote no checkout real | Base/hash/alterações concorrentes conferidos | Pendente externo |
| P0-CI | Toolchain padrão e CI | npm ci/audit/typecheck,1364aplicação/209SQL/71HTTP+browser sem skips no mesmo código | Pendente |
| P0-REVIEW | Revisão independente | R10–R15 e runtime revisados sem relaxar controles | Pendente |
| P0-PRODUCAO | Validar diretamente em produção | Site e base HelpDesk existentes; isolamento entre contas e workspaces preservado |
| P0-AUTH | R11 + R10, ciclos completos | Sessões/permissões reais, expiração/revogações e recuperação | Pendente |
| P0-WRITE | R12/R15 no destino e correlação SQL | Humanas+M2M:replay/concorrência/atomicidade comprovadas separadamente | Suíte pronta localmente; execução pendente |
| P0-OPS | Function/TLS, capacidade, restore e segurança | Residência/RPO/RTO e aceite | Pendente |
| M2 | Administração genérica | M1 encerrado por evidência, não flag | Não iniciado |

## Riscos e limites
A nova opção NÃO deve ser inserida silenciosamente na configuração de execução que já foi aprovada. Ela cria duas intenções extras positivas (chamado/mensagem M2M) e seis tentativas mutáveis que devem ser recusadas; o hash precisa ser revisto. Somente dados sintéticos autorizados. Permalink de deploy não prova isolamento do banco ou notificações.

Recuperação usa configuração/principais/chaves idênticos e retenção válida; chave expirada não autoriza substituição. Falhas interrompem novos envios; sem limpeza automática. O plano antigo continua tendo as mesmas chaves humanas. Tokens vêm do ambiente; nunca incluir credenciais nos anexos ou comandos.

Nesta rodada1364Node/35HTTPmemória;209SQL não executados; browser/instalação/audit/typecheck padrão/gate não aprovados. Tipagem suplementar separada. Revisão pelo mesmo executor, sem parecer independente. Nada foi publicado ou alterado remotamente.

## Recuperação para próxima sessão
O pacote inclui `recovery/source.tar.gz`: snapshot da fonte executável R15 e documentação local, SEM node_modules, credenciais, dist, `.git` ou evidências de homologação herdadas. Serve para revisão em pasta nova e evita reconstruir todos os ZIPs. O fingerprint deve coincidir com o manifesto. Não substitui checkout upstream: não contém história Git completa, e alguns README/AGENTS são registros históricos; começar pelos documentos85–88 e PROJECT_HELP_DESK.md. O gate de homologação continua exigindo execução nova.
