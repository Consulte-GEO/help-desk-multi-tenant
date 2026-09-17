# Revisão local — v0.17.0

Base 35426e0d90753902e977c71f0717c9c37302bedd. Revisão pelo mesmo agente; sem revisor independente/subagentes ou pentest.

- Conferidos módulos afetados, cláusulas WHERE/ORDER e ausência de interpolação de entrada em identificadores SQL. to_char é somente projeção; coluna nativa qualificada em ORDER BY.
- Verificados helper UTC3/6 e ordenação de empates iguais à comparação de cursor. Nenhuma conversão para Date antes de comparar microssegundos.
- Preservado contexto/escopo de cursor e autorização prévia de cada coleção. Testes HTTP de75 registros incluem conta não autorizada e acesso negado às notas pelo cliente.
- Reenvio conserva o snapshot. Offset e datas impossíveis foram reproduzidos em testes específicos. Não há write/callback de nova mutação no caminho de correção.
- Novos SELECTs usam o mesmo papel/policies e dez migrations inalteradas. Dados incompatíveis retornam erro seguro, não fallback. Não declarar que RLS ou SQL executaram.
- Oito casos SQL usam interfaces existentes após conferência (addMessage/addNote) e tabela helpdesk_core.ticket_events. SQL escrito e checagem TypeScript global não comprovam execução.
- Novo módulo shared copiado ao build, roteado pela demo e incluído no sourceFingerprint. SmokeHTTP final verificou o asset real com status200/javascript.
- Browser teve regressão escrita e tentativa bloqueada na navegação. Não há captura visual nova aprovada.
- Não houve inspeção remota, publicação, migration, segredos ou políticas alteradas. Os próximos passos continuam no handoff.
