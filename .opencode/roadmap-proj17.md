# Roadmap — Project 17 (Refinamento visual AAA, mobile-first)

Fonte: `project17.md` · `prd-project17.md` (como). Dependências: F0 fundação;
F1 depende de F0; F2–F5 dependem de F1 (execução sequencial, shells compartilhados);
F6 fecha. Gates por fase conforme §19 do Plan.md; revisor: agente principal
(subagentes read-only verificam conformidade — PRD §11).

## Fase 0 · Fundação do design system (tokens + primitivos)
- [x] D17-0a tokens: `--scrim` (+dark), `--tabbar-h`, `--info` (text-info estava
      sem token em 4 usos: PassageText/MicNotice/ScorePanel), `@utility
      focus-ring` (+ `focus-ring-inset`), `@utility text-micro` (≥11px,
      10px proibido) + tabela de receitas no comentário do styles.css
- [x] D17-0b ui/*: button (min-h-11 em TODAS as variantes, rounded-xl, sem
      shadow, focus-ring), dialog/alert-dialog (bg-scrim, max-h-[85dvh]+scroll,
      rounded-2xl/shadow-pop), drawer (bg-scrim), popover/hover-card/dropdown
      (shadow-pop, rounded-xl), input/select (min-h-11, rounded-xl, focus-ring);
      `.scrim-anim` intacto; TranslationSheet migra para bg-scrim
- [x] D17-0c barras: body reserva `--tabbar-h`+0.75rem+safe-area;
      layout/SkeletonPage adotado em practice.tsx e exam.tsx (markup equivalente)
- Gates: vitest 692/692 · tsgo limpo · build OK (precache 126, sw b1j513c7) ·
  lint 0/0 · Playwright: 11 rotas 390×844 com overflow 0, 0 botões <44px,
  raios consistentes (20px ações / 24px cartões), console limpo, screenshots
  light+dark da home verificados

## Fase 1 · Containers, gutters e larguras
- [x] D17-1 TopNav `px-4 sm:px-6`; settings 4xl→3xl; progress 5xl→4xl; session
      config 5xl→3xl, em-andamento 2xl→3xl e conclusão 3xl→2xl (foco pós-
      conclusão); grep de conformidade com a tabela D17-1 (só Home 5xl; cartões
      internos preservados); regra atualizada no comentário do PageHeader
- [x] D17-8 PracticeShell: footer ancorado em `--tabbar-h + 1px` (borda da
      TabBar medida: total 61px) e runner com `sm:px-6`; TabBar com grid na
      altura exata do token — sobreposição footer×TabBar = 0px (medido)
- Gates: vitest 692/692 · tsgo limpo · build OK (precache 126, sw b1mtkqwv) ·
  lint 0/0 · Playwright: 11 rotas 390×844 overflow 0 · footer×TabBar 0px no
  runner (/practice?q=pte-ra-01ef7205) · console limpo

## Fase 2 · Estados e foco pós-ação
- [x] D17-14 `layout/StatePanel` (empty→EmptyState · loading · error role=alert
      · compact) + adoção honesta: erros de Ajustes (o.error) em painel compacto.
      DESVIO registrado no PRD: notas aria-describedby dos botões desabilitados
      da sessão (sessao-sem-due/err) permanecem texto — são descrição de botão,
      não estado de página
- [x] D17-13 `useResultFocus(fireKey)` (re-dispara com a virada de estado, pois
      o store hidrata DEPOIS do mount): ScorePanel, resumo da sessão, resumo do
      simulado (fase "summary") — ref+tabIndex=-1+aria-label
- Gates: vitest 697/697 (5 novos em proj17-fase2) · tsgo limpo · build OK
  (precache 128, sw b1i1lcu8) · lint 0/0 · Playwright: foco REAL verificado —
  sessão iniciada por UI, /session?done=1 → section "Resumo da sessão" com
  activeElement + inViewport true · 11 rotas overflow 0 · console limpo

## Fase 3 · Home e navegação
- [x] D17-15 herói compacto (text-3xl sm:text-5xl, contagens em linha) e
      habilidades na primeira dobra do 1º uso; retorno com retomada preservada.
      Heroi 1º uso: p-6→p-5, título 4xl/6xl→3xl/5xl, ações em `flex flex-wrap`
      (lado a lado quando couberem — em 390px cada par excede 358px e empilha,
      conforme critério "se couberem"). Ordem condicionada à MESMA condição
      `resume` do herói: 1º uso = SkillsGrid → RoutineGrid → TargetStrip;
      retorno = RoutineGrid → TargetStrip → SkillsGrid (SkillsGrid/RoutineGrid
      extraídos como componentes; markup/ARIA intactos). TopNav: chip 10px→11px
      (D17-9, rota tocada) e `flex-wrap` no container + atalhos mobile
- Gates: vitest 697/697 · tsgo limpo · build OK (precache 128, sw b40f780) ·
  lint 0/0 · Playwright 390×844: overflow 0 · 1ª ação de habilidade visível sem
  scroll no 1º uso (top ≈ 676px < 844) · axe 0 (light, dark e retorno) · retorno
  real (attempt injetado, qid válido): herói "Continuar de onde parei" → rotina →
  estimativa → habilidades · fonte ampliada 200%: headerOverflow 0 (console
  limpo). Relato de conformidade do subagente: 6/6 OK

## Fase 4 · Superfícies de estudo
- [x] D17-12 `layout/Disclosure` novo (gatilho ≥44px + aria-expanded/controls,
      `.disclosure-anim` curta sob guarda de reduced-motion; modo controlado
      preserva `id="questao-nota"`) adotado em PracticeShell (Detalhes da
      questão + Nota controlada) e ScorePanel (transcrição longa colapsada,
      ≤240 caracteres abre). Cabeçalho da questão p-5→p-4/sm:p-6→sm:p-5
      (D17-10); prev/next 44px herdados (F0); footer seguro (F1); hierarquia
      "Próxima →" (banco, outline no header) vs ação do motor (footer
      primário) conferida — sem mudança necessária
- [x] D17-10/D17-16 session: CTAs de conclusão/em-andamento `whitespace-normal`
      (conclusão focada já entregue na F2) · exam/ExamRunner: 10 cartões de
      estudo `p-6 md:p-8`→`p-4 sm:p-6` (herói/resultado `p-6 sm:p-8` mantido);
      retomada/descartar 44px já verdes; resultado focado (F2)
- Gates: vitest 703/703 (6 novos em proj17-fase4) · tsgo limpo · build OK
  (precache 128, sw beg4knc) · lint 0/0 · Playwright 390×844: estímulo na dobra
  (read_aloud/fib/sst, top 371px) · disclosure detalhes/nota funcionais
  (aria-expanded + região + textarea toggle) · /session?done=1 via UI: CTAs 44px,
  overflow 0 · /exam config: 0 alvos <44px, overflow 0 · axe 0 nas rotas tocadas ·
  console limpo

## Fase 5 · Índices e listas
- [x] D17-11/D17-18 SectionPage (chips 11px, cartões p-4 sm:p-5, Tipo/Status
      recolhíveis atrás de `Disclosure` — aberto quando filtro não-default
      ativo; busca visível) e vocabulary (Seção/Favoritas/Ordenar recolhem;
      busca e chips de Tipo visíveis; derivação pós-hidratação via
      `extraOpen ?? derivado`; persistência D16-5b intacta; warning-ink intacto)
- [x] D17-10 progress: 12 blocos `p-5`→`p-4 sm:p-5` (herói bg-glow e destaque
      preservados); StatePanel compacto já adotado na F2
- [x] D17-9/D17-18 complemento: TabBar + chips plus (MechanismChip/AiWordCard/
      PlusPhraseCard) 10px→11px — nenhum `text-[10px]` restante no app
- Gates: vitest 703/703 (2 rodadas; 1 falha intermitente em rodada paralela,
      verde em reruns isolados — flake registrado) · tsgo limpo · build OK
      (precache 129, sw br72xmu) · lint 0/0 · Playwright 390×844: /speaking,
      /vocabulary (com itens reais injetados) e /progress overflow 0 · axe 0 ·
      chip 10px ausente (computed 10px = false) · disclosure: Mais filtros abre
      (tipo/status e seção/favoritas/ordenação visíveis), ordenação persiste e
      reabre derivada · TabBar 11px (item h token preservado) · console limpo.
      Relato de conformidade do subagente: pendente → executar na F6

## Fase 6 · Fechamento
- [x] D17-F6a E2E versionado `scripts/e2e/proj17_f0.py` (11 rotas 390×844:
      overflow 0, axe 0, alvos ≥44px, footer×TabBar 0px, screenshots light+dark
      e estados vazio/carregando/concluído) — JSON no stdout, exit 1 em falha
- [x] D17-F6b gates completos + varredura final + AGENTS.md atualizado (larguras
      vigentes, receitas foco/scrim/botão/altura) + memória do projeto
- Gates: vitest 703/703 · tsgo limpo · build OK (precache 129, sw br72xmu) ·
  lint 0/0 · E2E proj17_f0.py: exit 0 — 11 rotas overflow 0, alvos ≥44px (skip-
  link sr-only isento), axe 0, footer×TabBar 0px, console limpo; estados
  concluído/vazio/carregando capturados; screenshots light+dark de 5 rotas-chave

Próximo remix: projeto 17 CONCLUÍDO (F0–F6 todos [x]) — o {N} vigente passa a ser
o project18 (null); sem diretriz do usuário para o 18, o remix fica aguardando a
mensagem que definirá "project18".
