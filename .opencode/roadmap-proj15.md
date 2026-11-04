# Roadmap — Project 15 (estudo profundo → melhorias substanciais)

Dependência: F0 é fundação; F1/F2/F3/F4/F5 podem rodar em ondas após F0 (F1 antes de F2/F3 —
compartilham fila de correção e semântica de "fraco"); F6 fecha desduplicação; F7 fecha.
Gates por fase conforme seção 19 do Plan.md; revisor: agente principal (subagentes read-only).

## Fase 0 · Contratos de integridade
- [x] D15-0a id de tentativa: gerar na criação, preservar na migração, dedupe por id no merge (fallback legado) — `attempt-identity.ts` (chave estável qid·ts·tipo·modo; resultado fora da identidade)
- [x] D15-0b mergeDaily sem inflação (checkpoints por dia; união de evidências; nunca somar o mesmo dia 2×) — reimport idempotente + restante truncado preservado
- [x] D15-0c StorageEvent passa por invalidação de derivados
- [x] D15-0d Validador único de envelope de backup (null-root seguro) — `backup-envelope.ts` (folha)
- [x] D15-0e Docs de identidade/migração alinhadas (id + v8)
- Gates: vitest 593/593 (9 novos em proj15-fase0) · tsgo limpo · build OK (precache 122) · lint 0 erros

## Fase 1 · Ciclo de aprendizado fechado
- [x] D15-1a Categorias de erro IA persistidas por questão (merge idempotente)
- [x] D15-1b Fila de correção: erro → retry direcionado → "Próximo passo" aponta o retry
- [x] D15-1c Transferência: retry aprovado agrega 1 questão NÃO vista comparável à sessão de erro
- [x] D15-1d Preenchimento com revisão antecipada rotulado "treino extra"
- [x] D15-1e Paridade prática/exame do contrato de erros
- Gates: vitest 602/602 (9 novos em proj15-fase1; fixtures de v6/srs/13 atualizados pela causa D15-1b/1c) · tsgo limpo · build OK (precache 122) · lint 0 erros · E2E essay (proj14_f6.py) verde

## Fase 2 · Recomendação e métricas honestas
- [x] D15-2a nextAction por necessidade atual (recência + severidade de lapse; vocab ponderado)
- [x] D15-2b Semântica única de "fraco" (latest em tipos e tópicos; best como contexto rotulado)
- [x] D15-2c Períodos separam nova/repetida/vencida/exame com n e rótulo de mistura
- [x] D15-2d Cartão de evidência: revisões vencidas vs antecipadas, lapses, componentes de fala
- [x] D15-2e Readiness distingue itens não vistos e rotula confiança de repetidos
- Gates: vitest 615/615 (13 novos em proj15-fase2; fixture vocab do proj14 atualizado pela causa D15-2a) · tsgo limpo · build OK (precache 122) · lint 0 erros (12 warnings, base)

## Fase 3 · SRS de vocabulário com rigor
- [x] D15-3a Promoção de caixa apenas com item vencido (regra única em vocab.ts)
- [x] D15-3b Typed recall opcional (config); falha demove; off = comportamento atual
- [x] D15-3c Sentido pedido roda entre sentidos acumulados; erro recorrente visível no cartão
- Gates: vitest 627/627 (12 novos em proj15-fase3; fixtures plus-settings/vocab-fundacao/proj13 atualizados pela causa D15-3a/3b) · tsgo limpo · build OK (precache 122) · lint 0 erros (12 warnings, base)

## Fase 4 · UX AAA (contraste, copy, undo, navegação)
- [x] D15-4a Âmbar de texto só via --warning-ink (QuestionRow, PassageText, TemplateWarning + PlusWordText/PlusPhraseCard, mesma regra D14-6b)
- [x] D15-4b Copy PT ("tipos de tarefa", plural real em SectionPage; estendido a session/exam/ExamRunner/PracticeEntry/meta do progresso — critério "sem 'questão(ões)'/'task types' no bundle")
- [x] D15-4c Undo de exclusão (vocab) com toast "Desfazer" (padrão reutilizável; snapshot fiel via restoreVocabItem; Toaster montado no __root)
- [x] D15-4d Rótulos mobile Sessão/Simulado + aria-current na habilidade ativa (item do menu + destaque no trigger "Habilidades")
- [x] D15-4e Headings h3 em settings (7 cartões) · elevação na escala da marca (textarea/toggle shadow-card, sonner shadow-pop) · cópia de relatório com caminho de falha (execCommand checado) · contraste home (muted-foreground/80 → muted-foreground, axe light 4.03:1)
- Gates: vitest 631/631 (4 novos em proj15-fase4) · tsgo limpo · build OK · lint 0 erros (12 warnings, base) · axe 0 nas 11 rotas (2 temas) · Playwright 390×844 sem overflow · console limpo · undo verificado em browser (toast + restauração)

## Fase 5 · Robustez offline e erros
- [x] D15-5a SW com identidade por build (hash do manifest + código → VERSION/cache-name no sw.js de saída; `scripts/sw-version.mjs` + placeholder `__SW_VERSION__`)
- [x] D15-5b Fallback do SW para navegação 5xx com cache disponível
- [x] D15-5c Contrato de erro único nos handlers IA (safeParse + imports dinâmicos dentro do try/catch; handlers testáveis `handleGradeLanguage`/`handleTranslateWord`/`handleTranslatePhrase`; inputValidator apenas tipa o transporte)
- [x] D15-5d navigator.onLine só pós-mount (PlusWordText, PlusPhraseCard)
- [x] D15-5e Import confirma persistência antes de ok:true (flush conferido; rollback em memória + undo preservado; settings com mensagem de falha explícita)
- [x] D15-5f Rejeição por chave não drena bucket global; chave/payload pesam no limite (peso = 1 unidade por 2 kB, teto 4)
- Gates: vitest 645/645 (14 novos em proj15-fase5) · tsgo limpo · build (precache regenerado, sw b-hash) · lint 0 erros (12 warnings, base)

## Fase 6 · Manutenção
- [x] D15-6a Serviço IA compartilhado: `src/lib/plus/aiGradeRun.ts` (`runAiGrade` + `aiGradeFailReason`) consumido por `useAiGrade` (stale-response preservado via runRef) e `ExamAiAnalysis`
- [x] D15-6b ExamRunner sem cache/request IA próprios: revisão extraída para `examReview.tsx` + `examReviewShared.ts` (gabarito/CAUSE_LABEL/ReviewRow); ExamRunner 1.649 linhas
- [x] D15-6c Exports não consumidos: visibilidade reduzida (rg antes de cada mudança) — `keyToMidnight`, `isBeforeDayKey` (dates.ts), `typesOfSection` (offline.ts), `flushAiCache` (aiCache.ts), `essayContentWords` (essay.ts) agora internos; rg confirma 0 consumidores fora dos módulos
- [x] D15-6d 12 warnings de lint: corrigidos os reais (PracticeShell: rótulo de vencimento por render — memo sem dep artificial; deps do atalho com `loadDraft`; `statusOf`+`SOURCE_BADGE` extraídos para `src/lib/pte/question-status.ts`), deliberados documentados (override `react-refresh` off em `src/components/ui/**` no eslint.config.js — convenção shadcn; disable no arquivo em SectionIdentity — tokens co-localizados por design PRD §8). 0 warnings.
- Gates (F6 completa): vitest 645/645 · tsgo limpo · lint 0 erros 0 warnings · build OK (precache 122, sw bin9l8p) · E2E essay prática+exame (proj14_f6.py) verde 43/43 — incluiu 2 regressões de /progress corrigidas: legend de prontidão sem wrap (overflow 74px em 390px) e contraste do rótulo de mistura (`muted-foreground/80` → `muted-foreground`, mesmo critério D15-4e)

## Fase 7 · Fechamento AAA
- [x] D15-7a E2E versionado `scripts/e2e/proj15_f7.py` (correção→retry→transferência, lapse→treino, undo vocab, 11 rotas 390×844) — **54/54 ok**. Causa-raiz do item pendente anterior: (1) flake do roteiro — upload de backup disparava o `change` pré-hidratação (evento perdido, valor retido, re-disparos silenciosos); corrigido com `networkidle` + intervalo + re-disparo manual do change; (2) bug REAL descoberto pelo E2E: helpers server-only em `src/server/*` eram bloqueados do grafo do cliente pela import-protection (500 no chunk do WFD → página de erro na prática) — movidos para `src/lib/ai/*.server.ts` (`gateway.server.ts`, `rate-limit.server.ts`, `run-id.server.ts`), imports dinâmicos dos handlers e testes atualizados; (3) asserção do undo ajustada para a LISTA (o toast de remoção cita a palavra).
- [x] D15-7b Gates completos + varredura final (console limpo, axe 0, overflow 0) — varredura das 11 rotas no E2E: overflow 0 · axe 0 · console limpo em todas.
- [x] D15-7c AGENTS.md atualizado + aviso ao monitor (`.opencode/monitor-notice-proj15.md`)
- Gates: todos os anteriores + E2E 100% verde — vitest 645/645 · tsgo limpo · build OK (precache 122, sw bin9l8p) · lint 0 erros 0 warnings · E2E 54/54 (exit 0)
