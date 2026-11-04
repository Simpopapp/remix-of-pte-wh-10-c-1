# Roadmap — Project 18 (Melhorias de alto impacto, propósito central)

Fonte: `project18.md` · `prd-project18.md` (como). Gates por fase conforme §19
do Plan.md; revisor: agente principal (subagentes read-only verificam
conformidade — PRD §7). Onda 1: s1 (F0) · s2 (F5) · s3 (F6). Onda 2: s4 (F1+F2)
· s5 (F3) · s6 (F4 + blueprint read_fib_bank). Onda 3: s7 (F7). Fechamento:
agente principal.

## Fase 0 · Integridade crítica (D18-0a/b/c) — s1 ✅ (concluída — dados/catalogo/oral/retry já no disco antes desta onda; verificados nesta remix)
- [x] D18-0a HIW: transcript falado distinto nos 3 itens (diverge em `errors`),
      loader sem fallback transcript→text para lst_hiw, item sem transcript
      distinto fora das filas + teste de contrato (bank-integrity D18-0a)
- [x] D18-0b paridade oral: gradeSpeechQuestion retorna gradable; veredito
      decideOralVerdict no widget de fala do exame (not_gradable → null) + teste
      (examSpeech.ts extrai o adaptador)
- [x] D18-0c retry IA: AiGradeFeedback com "Tentar novamente" no estado
      indisponível; botão do exame sobrevive à falha + teste (proj18-fase0-ui)
- Gates: vitest 723/723 (sequencial) · tsgo limpo · build OK · lint 0/0 ·
  Playwright (hiw + rotas base) console limpo, axe 0, 390×844 overflow 0
  (/tmp/browser/proj18-wave1.py, 23/23)

## Fase 5 · Vocabulário produtivo e mescla justa (D18-5) — s2 ✅
- [x] D18-5a lastReviewTs opcional em VocabWord/VocabPhrase + cursor de rotação
      de sentidos persistido por entrada (senseAskCount; advanceSense na
      checagem typed) + teste da 2ª fila com sentido distinto (proj18-fase5)
- [x] D18-5b merge de backup por evidência de revisão (lastReviewTs mais
      recente vence; fallback = regra antiga) + testes do caso do lapso
- Gates: vitest 723/723 · tsgo limpo · build OK · lint 0/0 · Playwright
  (/vocabulary) console limpo, axe 0, 390×844 overflow 0

## Fase 6 · Novo tipo read_fib_bank (D18-6) — s3 ✅
- [x] D18-6a TaskType + TYPE_META + schema próprio + loader/catálogo + 8
      itens iniciais (fonte ai-generated-prediction) + manifest regenerado
      (2.626 questões · 23 tipos) + teste de contagem derivada (proj18-fase6)
- [x] D18-6b FibBankPractice (tocar + arrastar + teclado acessível, gabarito,
      nota) adotado no dispatch da prática; SectionPage deriva do manifesto
- Gates: vitest 723/723 · tsgo limpo · build OK (precache b16w16q7) · lint
  0/0 · Playwright (fib_bank fluxo completo + /reading) console limpo, axe 0,
  390×844 overflow 0

## Fase 1 · IA no SST (D18-1) — s4 ✅
- [x] D18-1 kind "sst" em runAiGrade/schemas/prompts/handler server-only;
      SstPractice via AiGradeFeedback; score de progresso continua o local +
      testes (schema, erro tipado, cache-first, gravação de dimensões <70)
      (proj18-fase1.test.tsx · 10 testes; spelling opcional no shape
      compartilhado, schema dedicado exige spelling no lugar de coesão)
- Gates: vitest 733/733 (sequencial) · tsgo limpo · build OK (b1wwt3o1) ·
  lint 0/0 · Playwright (sst pte-sst-2f5c3b5c: análise IA com Ortografia, sem
  coesão inventada, score local 35 preservado, console limpo)

## Fase 2 · Recomendação v2 (D18-2) — s4
- [x] D18-2 next-action lê targetScore/examDate/correção pendente/tipos nunca
      tentados (ação de diagnóstico rotulada) + testes com valores concretos
- Gates: vitest 771/771 · tsgo limpo · build OK · lint 0/0 · Playwright
  (proj18_f24.py 17/17 — home + progress)

## Fase 3 · Readiness honesto (D18-3) — s5
- [x] D18-3 confiança exige diversidade (itens únicos) + transferência (itens
      inéditos); repetição não sobe confiança; aviso de frescor > 14 dias +
      testes (inclusive não-regressão dos rótulos)
- Gates: vitest 771/771 · tsgo limpo · build OK · lint 0/0 · Playwright
  (proj18_f24.py 17/17 — home + progress)

## Fase 4 · Revisão fiel do simulado (D18-4) — s6
- [x] D18-4 resposta submetida + causa persistidas por questão (cap 2.000);
      revisão reconstrói do registro persistido após reload; referenceFor com
      caso essay; caps 500→2.000/300→600 + testes + blueprint read_fib_bank
- Gates: vitest 771/771 · tsgo limpo · build OK · lint 0/0 · Playwright
  (proj18_f24.py 17/17 — revisão)

## Fase 7 · Conteúdo de alto impacto (D18-7) — s7 ✅
- [x] D18-7a pisos de banco: describe_image 20 · lst_hcs/lst_hiw/lst_smw/
      lst_mcq_multi 10 · lst_mcq 12 · mcq_multi 30 · sgd 21 · read_fib_bank 8
      + testes de contrato (proj18-fase7.test.ts) + dedupe ampliado aos tipos
      novos (canonical-map regenerado, 0 novas duplicatas) + manifest
      regenerado (2.694 questões · 23 tipos) + 14 gráficos SVG sintéticos com
      proveniência honesta (figcaption: OWID CC BY × "Dados ilustrativos")
- [x] D18-7b samples: 30 modelos de retell_lecture + 30 de
      summarize_spoken_text (45–75 palavras, revisão em amostra pelo principal)
- Gates: vitest 771/771 · tsgo limpo · build OK (sw b3rwcho) · lint 0/0 ·
  Playwright smoke OK (7/7 — describe_image di-owid-01 com gráfico sintético +
  proveniência honesta, /vocabulary, rota choice mcq_single; console limpo,
  overflow 0 — /tmp/browser/proj18-f7)

## Fase 8 · Fechamento (D18-F8) — agente principal
- [x] D18-F8a E2E `scripts/e2e/proj18_f8.py` (fluxos: HIW, retry IA, SST IA
      real/fallback, revisão pós-reload, rotação de sentidos, read_fib_bank) +
      varredura 390×844 + axe 0 nas rotas tocadas — JSON no stdout, exit 1 em
      falha → 67/67 ok, exit 0
- [x] D18-F8b gates finais + AGENTS.md raiz (kinds IA essay|swt|sst;
      `text-success-ink` para selos verdes translúcidos; inteligência de
      progresso honesta D18-2/3/4; E2E proj18_f8 registrado) + estado exato no
      roadmap central
- Gates: vitest 771/771 (81 arquivos) · tsgo limpo · build OK (sw b131hmc4,
  131 assets) · lint 0/0 (7 prettier em proj18-fase7.test.ts corrigidos) ·
  E2E proj18_f8.py exit 0 · relato nos três blocos

Estado: projeto 18 CONCLUÍDO neste remix — ondas 1–3 (F0·F5·F6, F1–F4, F7)
e fechamento (F8) com gates verdes: vitest 771/771 · tsgo limpo · build OK
(sw b131hmc4) · lint 0/0 · E2E proj18_f24.py 17/17 + proj18_f8.py 67/67 (exit 0)
+ smoke da F7 7/7. A varredura E2E expôs e fechou 3 defeitos reais de UI:
overflow 15px em /progress (min-content do grid — `min-w-0` nos cartões e
`min-w-0 truncate` na linha de tentativas) e contraste AA dos selos verde
(`text-success-ink`, novo token light+dark) e âmbar do essay
(`text-warning-ink` — WriteEssayPractice). Monitor permanece indisponível
(obs. do Plan.md); próximo project{19} aguarda a diretriz do usuário.
