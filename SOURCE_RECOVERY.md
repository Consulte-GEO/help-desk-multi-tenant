> Atualização M1-R6: esta recuperação agora inclui R2–R6. Estado local e handoff em docs44–48,1177 testes Node aprovados; PostgreSQL209 escritos/0executados nesta rodada. O manifesto externo informa o commit e fingerprint atuais. Demais limites de recuperação abaixo permanecem.

# Fonte recuperada — Help Desk M1-R5

Esta árvore permite executar e revisar a fonte cumulativa R2–R5 em uma pasta nova, sem reconstruir deltas de ZIPs anteriores. Antes do incremento, o fingerprint R4 e seu baseline1.133 foram verificados. O lock coincide com o Git blob upstream. Os arquivos de domínio/API/migrations não foram alterados pelo R5.

Isto não é um clone do HEAD remoto nem a história completa dos seus commits/documentos/evidências. Parte da documentação histórica vem do pacote original e não deve substituir documentos mais recentes do checkout real. Para estado local use PROJECT_HELP_DESK.md e docs39–43. Para fatos remotos reconsulte o repositório. O manifesto informa a revisão remota consultada, o commit local e o fingerprint final.

Use as variantes de patch para integração em checkout existente. Não copiar esta árvore sobre trabalho concorrente, não force-push o bundle. Nenhuma configuração secreta, dependência instalada ou aprovação de produção acompanha a fonte. O gate deve continuar recusando publicação até as validações pendentes.
