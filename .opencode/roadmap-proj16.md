# Roadmap — Project 16 (Vocabulário: inteligência de fluxo de aprendizado)

Fonte: `project16.md` (diretriz) · `prd-project16.md` (como). Dependências: F0
é fundação; F1/F2/F3 dependem de F0; F4 depende de F1+F3; F5 depende de F1;
F6 fecha. Gates por fase conforme §19 do Plan.md; revisor: agente principal
(subagentes read-only). Monitor indisponível — aviso fica pendente (D16-E).

## Fase 0 · Contratos de recorte
- [x] D16-0a `snippet` em VocabWord (cap 400) + `SaveVocabWordInput.snippet*`
      (`snippet`, `snippetInContext`, `snippetWhy`) — captura em PlusWordText
      grava a frase real do gesto (a mesma enviada à IA) e o inContext/why da IA
- [x] D16-0b normalização defensiva (`normSnippet*`) na entrada do store; sem
      bump de versão (v8 mantida)
- [x] D16-0c `deriveVocabSnippet(item, questionText)` pura em vocab.ts
- [x] D16-0d merge de backup preserva `snippet*` de qualquer lado
      (backup.ts) — idempotência re-testada
- Gates: vitest 662/662 (17 novos em proj16-fase0 + fase0-ui) · tsgo limpo ·
  build OK (precache 122, sw b19cqeq8) · lint 0 erros 0 warnings

## Fase 1 · Versão simples vs completa
- [x] D16-1a card da lista enxuto (sem contextual; palavra sem expandir; frase
      colapsada) + toque abre o sheet completo (D16-D: expansão inline some)
- [x] D16-1b `VocabDetailSheet` em TranslationSheet com seções Recorte →
      Tradução → Sentidos → Fontes → Ações; recorte com token destacado
      (VocabSnippet). Áudio fica na Fase 3 (D16-3a) por dependência declarada.
- [x] D16-1c estados: sem recorte → seção omitida; derivação → skeleton;
      sentidos na navegação (A18 do projeto 14 fechado)
- Gates: vitest 669/669 (7 novos em proj16-fase1) · tsc --noEmit limpo (tsgo
  indisponível no sandbox) · lint 0/0 · `vite build` compila. PENDENTES por
  limitação do sandbox (sem navegador/Playwright e sem preset Cloudflare →
  `dist/client`): Playwright (sheet/a11y/390×844) e precache do sw — ficam
  cobertos pelo E2E da Fase 6 (D16-F6a) e pelo build do ambiente Lovable.
- Nota de harness: teste de rota completa com o sheet em portal travava em loop
  síncrono (singleton <body> do React 19 reaproveitado entre roots no jsdom).
  `proj16-fase1.test.tsx` renderiza o portal inline (mock de createPortal) e
  fecha o sheet por Esc no afterEach; o portal real segue coberto por
  proj12-sheet.test.tsx. Testes futuros de rota com sheet: usar o mesmo padrão.

## Fase 2 · Tradução do recorte
- [x] D16-2a inContext da IA exibido de graça; dicionário mostra gesto
      "Traduzir este recorte"
- [x] D16-2b demanda via `translateAiPhrase` (cache ANTES da disponibilidade
      D7/D8, caps/fallback honestos, chip honesto, sem gravação no store D16-C)
- [x] D16-2c `filterVocab` cobre `snippet` + `senses[].literal`
- Gates: vitest 679/679 (10 novos em proj16-fase2) · tsgo limpo · build OK
  (precache 126, sw b3kfapm) · lint 0 erros 0 warnings · Playwright (estados de
  falha): estado honesto + retry + IA desligada explicada + 390×844 overflow 0 +
  console limpo (único erro = abort deliberado da simulação de rede)

## Fase 3 · Áudio de estudo
- [x] D16-3a 🔊 palavra + 🔊 recorte no card e no sheet (PlusSpeakButton;
      plusAudio off desliga tudo; nunca áudio de PT)
- [x] D16-3b sequência palavra→recorte cancelável (mesma Web Speech API,
      pausa constante nomeada — SNIPPET_PAUSE_MS em VocabAudio.tsx)
- Gates: vitest 685/685 (6 novos em proj16-fase3) · tsgo limpo · build OK
  (precache 126, sw b1r83uuk) · lint 0 erros 0 warnings

## Fase 4 · Sessão no contexto
- [x] D16-4a recorte + inContext no lado de TRÁS do cartão (frente intocada);
      typedRecall/regra D15-3a/3c intactos (testes existentes sem mudança)
- [x] D16-4b áudio pós-virada (recorte)
- Gates: vitest 688/688 (3 novos em proj16-fase4; suite de typedRecall/SRS
  existente verde sem mudança de expectativa) · tsgo limpo · build OK
  (precache 126, sw b1k2r3lg) · lint 0 erros 0 warnings

## Fase 5 · Fluxo e AAA
- [x] D16-5a chip de estado (vencido/em dia/consolidado) na lista — tokens,
      aria/title com a caixa exata (vocabStateChip em vocab.ts)
- [x] D16-5b filtros persistentes (leitura pós-hidratação; "Limpar filtros"
      limpa o persistido)
- [x] D16-5c/d copys PT, aria-labels, ≥44px, contraste (D14-6b), varredura
      390×844 + axe 0 + console limpo nas rotas tocadas
- Gates: vitest 692/692 (4 novos em proj16-fase5) · tsgo limpo · build OK
  (precache 126, sw b4ghk3j) · lint 0/0 · axe 0 (lista+sheet, desktop+390×844;
  1ª rodada flagou contraste durante a animação do sheet — 2ª rodada com
  settle verde) · overflow 0 · console limpo

## Fase 6 · Fechamento
- [x] D16-F6a E2E versionado `scripts/e2e/proj16_f0.py` (captura com recorte →
      vocabulário → sheet completo → tradução do recorte → áudio → sessão com
      recorte; 11 rotas 390×844) — JSON no stdout, exit 1 em falha
- [x] D16-F6b gates completos + varredura final + AGENTS.md atualizado
- [ ] D16-F6c aviso ao monitor registrado em `.opencode/monitor-notice-proj16.md`
      (envio pendente — monitor indisponível)
- Gates: todos os anteriores + E2E 38/38 verde (exit 0; captura real em
  pte-ra-feeb6ba5 com recorte; demanda via cache IA honesta; axe 0 e overflow 0
  nas 11 rotas; console limpo)

Próximo remix: projeto 16 CONCLUÍDO (F0–F6, F6c fica pendente do monitor).
Próximo remix: projeto 17 — aguarda a diretriz do usuário (os 3 pilares de 17
não existem; conforme Plan.md, cole a próxima mensagem em project17).
