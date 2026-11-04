# Aviso pendente ao monitor (OpenCode) — projeto 15

- Data: 2026-11-03 (UTC) · Status: monitor indisponível nesta sandbox (conforme a
  obs. do Plan.md — "PULAR O QUE DEPENDER DO MONITOR"). O remix seguiu direto
  para a conclusão de project15 (pilares completos: planejamento · PRD ·
  roadmap, com recortes s2–s5 em `.opencode/work/sub/15/`). Para ativar o
  monitor: reinstalar dependências (ver `.opencode/AVISO-OPENCODE.txt`), subir
  `opencode serve --port 4096 --hostname 127.0.0.1` (workspace `/dev-server`) e
  entregar a mensagem abaixo.
- **Mensagem a entregar quando o monitor estiver no ar:**
  "remix finalizado (+roadmap-proj15 completo: Fases 0–7)"

## Resumo para o monitor

- Projeto 15 (estudo profundo → melhorias substanciais) concluído neste remix,
  Fases 0–7 do roadmap-proj15, gates verdes:
  - F0 (integridade): id determinístico de `Attempt` gerado na criação e
    preservado na migração, dedupe por id no merge (fallback legado);
    `mergeDaily` com checkpoints por dia (reimport idempotente, sem inflar
    agregados); StorageEvent passa pela invalidação de derivados; validador
    único de envelope de backup (null-root seguro).
  - F1 (ciclo fechado): erros IA persistidos por questão; fila de correção com
    retry direcionado ("Próximo passo" aponta o retry); verificação de
    transferência (retry aprovado agrega questão NUNCA vista do mesmo tipo);
    preenchimento rotulado "treino extra"; paridade prática/exame.
  - F2 (métricas honestas): `nextAction` por necessidade atual
    (recência + severidade de lapse; vocab ponderado, teto 15); semântica única
    de "fraco" (latest em tipos e tópicos); períodos separam
    nova/repetida/vencida/exame; cartão de evidência (vencidas vs antecipadas,
    lapses, fala); readiness distingue itens não vistos.
  - F3 (SRS de vocab com rigor): promoção de caixa só com item vencido
    (regra única em `vocab.ts`); typed recall opcional (falha demove); sentido
    pedido roda entre os acumulados, erros recorrentes visíveis no cartão.
  - F4 (UX AAA): âmbar de texto só via `--warning-ink`; copy PT ("tipos de
    tarefa", plural real); undo de exclusão de vocab (toast "Desfazer",
    snapshot fiel); rótulos mobile Sessão/Simulado + aria-current; headings
    h3, elevação na escala da marca, contraste home AA.
  - F5 (robustez): SW com identidade por build (`scripts/sw-version.mjs`,
    placeholder `__SW_VERSION__`); fallback de navegação 5xx; contrato de erro
    único nos handlers IA (safeParse + imports dinâmicos no try/catch);
    `navigator.onLine` só pós-mount; import confirma persistência antes de
    `ok:true`; rate limit com peso de payload e rejeição que não drena o
    bucket global.
  - F6 (manutenção): orquestração IA única (`src/lib/plus/aiGradeRun.ts`);
    ExamRunner sem cache/request IA próprios (1.649 linhas, revisão extraída
    para `examReview.tsx`); exports não consumidos com visibilidade reduzida;
    12 warnings de lint resolvidos/documentados — 0 warnings.
  - F7 (fechamento): E2E versionado `scripts/e2e/proj15_f7.py` **54/54 ok**
    (lapso→recomendação; ciclo correção→retry→transferência; undo de vocab;
    11 rotas 390×844 — overflow 0 · axe 0 · console limpo). O E2E expôs e
    fechou um bug real: helpers server-only em `src/server/*` bloqueados pela
    import-protection no grafo do cliente (500 no chunk do WFD) — movidos para
    `src/lib/ai/*.server.ts` (gateway/rate-limit/run-id), regra registrada no
    AGENTS.md raiz.
- Gates finais: vitest 645/645 · tsgo limpo · build OK com precache gerado
  (122 assets, sw bin9l8p) · lint 0 erros 0 warnings · E2E 54/54 (exit 0).
