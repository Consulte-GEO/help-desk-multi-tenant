# Handoff — integração R9 (29/09/2026)

Fonte integrada sobre `b9481b9` em `codex/m1-r9-integracao`. Ler `PROJECT_HELP_DESK.md`, `README.md`, `AGENTS.md`, `docs/05-HANDOFF-REVISAO.md`, `docs/59-M1-R9-COERENCIA-DAS-EVIDENCIAS.md` e `docs/63-M1-R9-INTEGRACAO-ESTADO-E-EVIDENCIAS.md` antes de continuar. A história upstream permanece intacta; não fazer force-push do bundle de recuperação.

O workflow Linux [36592018825](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/36592018825) aprovou instalação/audit, 1.202 aplicação, 209 PostgreSQL 17 e 71 HTTP/browser. A tentativa anterior [36590603711](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/36590603711) falhou por conexão prematura ao banco; a correção foi feita com regressão antes/depois. Os logs da tentativa aprovada e o relatório do gate estão em `evidence/homologation/`; não misturar com resultados anteriores.

Próxima prioridade: publicar o commit de evidências e verificar o gate/build no Netlify. Depois conferir Function/Auth/M2M hospedados, carga, restore, revisão independente, residência/RPO/RTO e aceite operacional. M2 administrativo só segue após M1.

O usuário autorizou nesta tarefa commit, merge e publicação. Essa autorização não equivale a liberar atendimento real nem a alterar migrations remotas, dados, usuários, MFA, segredos ou buckets. Manter `HELPDESK_RELEASE_APPROVED` fechado até os critérios operacionais serem comprovados. Registrar base, branch, commit, CI, deploy e riscos após cada etapa efetiva.
