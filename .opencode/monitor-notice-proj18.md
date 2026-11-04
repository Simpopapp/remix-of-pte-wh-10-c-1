# Aviso pendente ao monitor (OpenCode) — projeto 18

- Data: 2026-11-04 (UTC) · Status: monitor indisponível nesta sandbox (conforme a
  obs. do Plan.md — "PULAR O QUE DEPENDER DO MONITOR"). O remix concluiu o
  projeto 18 integralmente (pilares completos: planejamento · PRD · roadmap,
  Fases 0–8 do roadmap-proj18, todas `[x]` com gates reais). Para ativar o
  monitor: reinstalar dependências (ver `.opencode/AVISO-OPENCODE.txt`), subir
  `opencode serve --port 4096 --hostname 127.0.0.1` (workspace `/dev-server`) e
  entregar a mensagem abaixo.
- **Mensagem a entregar quando o monitor estiver no ar:**
  "remix finalizado (+roadmap-proj18 completo: Fases 0–8)"

## Resumo para o monitor

- Projeto 18 (melhorias de alto impacto alinhadas ao propósito central)
  concluído neste remix, Fases 0–8 do roadmap-proj18, gates verdes:
  - F0 (integridade): HIW com transcript FALADO distinto do texto exibido
    (normalizador sem fallback silencioso); paridade oral prática×exame
    (`decideOralVerdict` no widget de fala do simulado, `not_gradable` →
    score null); retry de IA universal no `AiGradeFeedback` ("Tentar
    novamente" reexecuta `runAiGrade`).
  - F1 (IA no SST): kind `sst` na orquestração única (schema Zod dedicado com
    Ortografia no lugar de Coesão; handler server-only; prompt dedicado);
    score de progresso continua o local.
  - F2 (recomendação v2): next-action lê `targetScore`/`examDate`/correção
    pendente/tipos nunca tentados (ação de diagnóstico rotulada).
  - F3 (prontidão honesta): confiança exige diversidade + transferência
    (itens inéditos); repetição não sobe confiança; aviso de frescor > 14 dias.
  - F4 (revisão fiel do simulado): resposta submetida + causa persistidas por
    questão (cap 2.000); revisão reconstrói do registro persistido após
    reload; `referenceFor` com caso essay; caps 500→2.000/300→600.
  - F5 (vocabulário): `lastReviewTs` + cursor de rotação de sentidos
    persistido por entrada; merge por evidência de revisão (lapsos recentes
    sobrevivem a restauração antiga).
  - F6 (novo tipo): `read_fib_bank` (drag & drop com banco compartilhado +
    teclado acessível) no catálogo, manifesto e blueprint do simulado.
  - F7 (conteúdo): pisos de banco elevados (describe_image 20 · 2.694
    questões · 23 tipos no manifesto) + samples de retell_lecture e SST (30
    cada) + 14 gráficos SVG sintéticos com proveniência honesta.
  - F8 (fechamento): E2E `proj18_f8.py` 67/67 exit 0 (HIW end-to-end, retry IA
    com rede bloqueada, SST com IA real, revisão pós-reload, rotação de
    sentidos, banco em prática, varredura 390×844 + axe 0) + smoke da F7 7/7.
    O E2E expôs e fechou 3 defeitos reais de UI: overflow 15px em /progress
    (min-content do grid — `min-w-0` nos cartões), contraste AA dos selos
    verdes (novo token `text-success-ink` light+dark) e do âmbar do essay.
- Gates finais: vitest 771/771 (81 arquivos) · tsgo limpo · build OK com
  precache gerado (131 assets, sw b131hmc4) · lint 0 erros 0 warnings
  (7 prettier corrigidos em proj18-fase7.test.ts) · E2E exit 0.
- AGENTS.md raiz atualizado (kinds IA essay|swt|sst; `text-success-ink`;
  inteligência de progresso honesta; E2E proj18_f8 registrado).
