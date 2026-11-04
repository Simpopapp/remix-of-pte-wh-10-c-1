# PRD — Project 17 · Refinamento visual AAA (aparência + fluxo, mobile-first)

Status: vigente · Fonte: `project17.md` (diretriz) · Evidência: 3 auditorias paralelas
read-only (design system · fluxo mobile · infraestrutura técnica), concluídas antes
deste documento. Precedência de escopo: project17 > este PRD > roadmap.

---

## 0. Sumário executivo

O app já tem um design system maduro (projeto 12): tokens oklch claro/escuro,
Fraunces+Inter, sombras card/pop/sheet, PageHeader/EmptyState/StatHero, TabBar com
safe area. O problema não é ausência de sistema — é **adesão parcial**: cada rota
deriva do sistema com pequenas liberdades que, somadas, produzem páginas que parecem
de apps diferentes e um fluxo mobile que gasta a dobra com controles em vez de
conteúdo. Este projeto NÃO adiciona features: é uma varredura de apresentação e
layout pelas 11 rotas + shells, com três entregas de fundação (tokens/componentes
compartilhados) e aplicação por grupos de rotas, sempre verificada em 390×844 antes
do desktop.

## 1. Problemas (síntese das auditorias, com evidência)

### 1.1 Consistência visual (auditoria 1)
- **Gutters desalinhados**: TopNav usa `px-4` fixo (`TopNav.tsx:27`) enquanto mains
  usam `px-4 sm:px-6` (`index.tsx:338`, `SectionPage.tsx:128`) — no desktop o header
  e o conteúdo não compartilham a mesma margem.
- **Regra de larguras violada em 3 rotas** (regra documentada em `PageHeader.tsx:20-26`):
  `settings.tsx:595` usa 4xl (regra diz 3xl); `progress.tsx:119` usa 5xl (reservado à
  Home); `session.tsx:199,348,428` usa 3xl/2xl/5xl em estados da MESMA página,
  nenhum deles casando com a categoria documentada (estudo = 3xl, foco = 2xl).
- **Alturas de controle divididas**: Button padrão/sm/lg/ícone = 36/32/40/36px
  (`ui/button.tsx:21-24`), abaixo dos 44px que a navegação já usa
  (`TopNav.tsx:28,88`, `SectionPage.tsx:229` min-h-11). Botões primários de CTA
  ficam menores que links secundários.
- **Foco divergente**: coexistem `ring-1`, `ring-2` com offset e `outline-2`
  (`ui/button.tsx:8`, `__root.tsx:37`, `SectionPage.tsx:229`).
- **Scrim fora do sistema**: `bg-black/80` em dialog/alert-dialog/drawer
  (`ui/dialog.tsx:24`) vs `bg-foreground/45` no TranslationSheet
  (`TranslationSheet.tsx:157`) — o modal não acompanha o tema escuro.
- **Sombras paralelas**: primitives usam `shadow`/`shadow-sm`/`shadow-md`/`shadow-lg`
  (`ui/button.tsx:12-16`, `ui/popover.tsx:22`, `ui/dropdown-menu.tsx:49,66`) fora da
  escala card/pop/sheet; dialog usa `shadow-lg rounded-lg` vs sheet desktop
  `shadow-pop rounded-3xl` (`ui/dialog.tsx:41`, `TranslationSheet.tsx:169`).
- **Raios de botão sem receita**: `rounded-md` (button), `rounded-xl` (__root),
  `rounded-full` (VocabDetailSheet) para a mesma função de ação.
- **Microtipografia subdimensionada**: labels de 10px (`MechanismChip.tsx:24`,
  `AiWordCard.tsx:25,55`, `progress.tsx:400,425`, chips `text-[10px]` em
  `SectionPage.tsx:160,170`) — pequenos demais no mobile.
- **Tipografia de corpo improvisada**: estímulos com 15px/17px/26→30px e
  entrelinhas 1.75/2.2/2.4 espalhados (`FibPractice.tsx:122`,
  `FibDropdownPractice.tsx:188`, `ReadAloudPractice.tsx:391`, `ExamRunner.tsx:493,581`)
  sem papéis nomeados.
- **Densidade inconsistente**: cartões equivalentes mudam p-6→p-8 em breakpoints
  diferentes (`ExamRunner.tsx:216,327`, `session.tsx:354`).

### 1.2 Fluxo e layout mobile (auditoria 2)
- **Sobreposição real em risco**: footer sticky de prática usa offset 56px
  (`PracticeShell.tsx:441`) enquanto a TabBar ocupa 52px+margens = 60px
  (`TabBar.tsx:22`) — ~4px de sobreposição latente; e o footer quebra em várias
  linhas consumindo altura do estímulo.
- **Alvos pequenos confirmados**: prev/next do runner com `size="sm"` (32px)
  (`PracticeShell.tsx:319-335`); CTAs de progresso, retomada do simulado e
  descarte com botões de 36px (`progress.tsx:127,139`, `exam.tsx:193-198`).
- **Pré-exercício carregado**: header + navegação + detalhes + nota + banners +
  avisos antes do estímulo (`PracticeShell.tsx:277-432`) — empurra o conteúdo para
  fora da dobra.
- **Filtros de vocabulário expandidos antes da lista** (`vocabulary.tsx:429-529`):
  escopo, limites, busca, tipo, seção, favoritas e ordenação visíveis de uma vez.
- **Progresso denso**: 9+ seções verticais empilhadas (`progress.tsx:211-839`).
- **CTA com rótulo concatenado + whitespace-nowrap** (`session.tsx:279-280`) — risco
  de estouro em 390px.
- **Home gasta a dobra**: herói 36px + contagens + duas ações antes de qualquer
  escolha de habilidade no primeiro uso (`index.tsx:399-455`).
- **Foco/scroll pós-conclusão ausentes**: mudança de estado do simulado/sessão
  renderiza novo cabeçalho sem foco nem rolagem (`session.tsx:199-200`,
  `ScorePanel.tsx:19-68`).
- **Navegação por `page.goto` nos E2E** (`fluxos_criticos.py`) — descobribilidade de
  links não é provada pela suíte.

### 1.3 Infraestrutura e riscos (auditoria 3)
- **Shells duplicados por estado**: session (3 estados) e exam (5 shells) repetem
  TopNav+container; reformar só o estado inicial deixa divergência nos demais.
- **Contratos de a11y que não podem quebrar**: `id="page-title"` + ref de foco
  (`PageHeader.tsx:30-42`), skip link e landmarks (`__root.tsx:199-205`), ARIA de
  progresso (`SectionPage.tsx:186-189`), `.scrim-anim` acoplado a testes
  (`proj12-sheet.test.tsx:93`), labels/`aria-label` acoplados a testes
  (`proj16-fase5.test.tsx:104`).
- **Cores significativas**: ScorePanel e PassageText codificam faixas de nota e
  status de palavra — nunca uniformizar por aparência.
- **`text-info` sem token `info`** registrado no tema (`PassageText.tsx:18`,
  `ScorePanel.tsx:78`) — classe sem definição no styles.css (verificar/gerar).
- **matchMedia 1024px controla comportamento** (`session.tsx:76-80`) — mudanças de
  breakpoint CSS precisam considerar a parte JS.
- **jsdom não prova layout**: `app-routing.test.tsx` só verifica que `/` resolve;
  responsividade/contraste/alvos só são provados via Playwright.
- **Componentes ui não usados**: card/input/select/textarea/tabs/progress etc. sem
  consumidores — candidatos a ADOTAR (não duplicar) quando um papel novo pedir.

## 2. Objetivos e não-objetivos

**Objetivos**
1. Toda interação primária ≥44px no mobile (botões, links de navegação, campos).
2. Uma receita única por função visual: foco, scrim, sombra, raio de ação, gutter,
   largura de página, altura de barra fixa — expressa em tokens/utilitários, não
   copiada de rota em rota.
3. O conteúdo de estudo (estímulo + resposta) entra na primeira dobra em 390×844.
4. Hierarquia clara pós-ação: resultado ganha foco/scroll e um próximo passo óbvio.
5. Estados (vazio/carregando/erro) com uma única linguagem visual em todo o app.
6. Nenhuma regressão de a11y (axe 0) e nenhum overflow em 390×844 nas rotas tocadas.

**Não-objetivos**
- Novas features, novas rotas, mudança de lógica de negócio, dados, rotas de IA.
- Redesenho de identidade (papel/tinta/índigo/âmbar, Fraunces+Inter permanecem).
- Refatoração do store/backup; mudanças de comportamento em SRS/simulado.
- Dark mode novo (tokens escuros existentes são mantidos e estendidos onde faltar).

## 3. Decisões de design (D17)

A numeração D17-* é a referência dos itens de roadmap. "Mobile-first" significa:
a classe base (sem prefixo) é a versão 390px; sm:/md: adicionam, nunca removem.

- **D17-1 · Larguras vigentes (regra reconciliada, fonte única no PageHeader)**
  Home 5xl · índices (4 seções, exam config, progress, settings) 4xl ·
  superfícies de estudo (practice runner/entry, session em andamento e config,
  vocabulary, exam pré-início/runner) 3xl · foco pós-conclusão (resultado de
  simulado e de sessão) 2xl. Mudanças: `settings.tsx:595` 4xl→**3xl**;
  `progress.tsx:119` 5xl→**4xl**; `session.tsx:428` config 5xl→**3xl**;
  `session.tsx:348` em andamento 2xl→**3xl**; conclusão (199) fica 2xl.
  O comentário do PageHeader passa a refletir exatamente esta tabela (decisão
  registrada; a regra continua comentário-documento, sem API nova).
- **D17-2 · Gutter único**: `px-4 sm:px-6` em TODOS os mains e no conteúdo do
  TopNav (`TopNav.tsx:27` passa a `px-4 sm:px-6`); nada de px-3/px-5 soltos em
  contêineres de página. Registrado como regra no PageHeader (mesma fonte).
- **D17-3 · Botão mobile-first**: variantes do Button passam a `min-h-11` (44px) no
  base — default, sm, lg e icon; alturas menores (40px) só onde o espaço é
  comprovadamente crítico e NÃO é ação primária (ex.: chips dentro de cards), e
  sempre via `sm:` (desktop). Consumidores com `size="sm"` em navegação de runner
  (prev/next) herdam 44px automaticamente. Assinaturas e `whitespace-nowrap`
  irrelevantes permanecem.
- **D17-4 · Receita única de foco**: utilitário `@utility focus-ring` em styles.css
  (`outline-2 outline-offset-2 outline-ring` — outline, não ring: sem custo de
  layout e sem depender de offset de fundo). Aplicado a Button, inputs nativos,
  selects, links de navegação que hoje usam receitas próprias; Radix continua com
  `focus-visible:` prefixado. Testes de foco existentes (por papel/nome) não mudam.
- **D17-5 · Scrim token**: `--scrim` (light `oklch(0.15 0.02 262 / 55%)`, dark
  `oklch(0.08 0.015 262 / 65%)`) registrado no @theme como `--color-scrim`;
  dialog/alert-dialog/drawer/TranslationSheet usam `bg-scrim`. A classe
  `scrim-anim` e o teste que a referencia são preservados.
- **D17-6 · Sombras mapeadas à escala**: dropdown/popover/hover-card → `shadow-pop`;
  dialog → `shadow-pop rounded-2xl`; sheet desktop mantém `shadow-pop rounded-3xl`;
  Button perde `shadow`/`shadow-sm` (ação não é cartão).
- **D17-7 · Raio de ação**: ações (botões, inputs, selects) = `rounded-xl`; cartões
  = `rounded-2xl`; overlays grandes = `rounded-3xl` no desktop; pills/chips =
  `rounded-full`. Mudança principal: `ui/button.tsx` `rounded-md`→`rounded-xl`.
- **D17-8 · Altura de barras fixas tokenizada**: `--tabbar-h: 3.75rem` (60px = 52px
  de item + 2×4px de margem) e body reserva `calc(var(--tabbar-h) + safe-area)`;
  PracticeShell footer usa `bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))]`
  — elimina a divergência 56 vs 60px.
- **D17-9 · Papéis tipográficos** (documentados no styles.css, sem variante nova de
  framework): micro-label ≥11px (`text-[11px]`) — 10px é proibido; kicker PageHeader
  11-12px tracking 0.18em; estímulos de leitura mantêm tamanhos específicos por
  tarefa (são conteúdo, não UI) mas ganham papel nomeado por tarefa em comentário;
  título de página 3xl→4xl (PageHeader inalterado); herói da Home desce para
  `text-3xl sm:text-5xl`.
- **D17-10 · Densidade de cartão**: cartões de página usam `p-4 sm:p-5` (base
  mobile); `p-6 sm:p-8` só em overlays/heróis. Ajustes pontuais onde `ExamRunner`
  e `session` mudam padding em breakpoints diferentes (640–767px ganha densidade
  única).
- **D17-11 · Disclosure de filtros**: vocabulary e SectionPage ganham padrão
  "filtros avançados recolhíveis" no mobile (details/summary ou botão + painel;
  busca permanece visível). Aberto por padrão quando um filtro não-default está
  ativo (estado derivado, sem persistência nova).
- **D17-12 · Pré-exercício compacto**: em 390px, detalhes/nota/avisos do runner
  colapsam atrás de um disclosure (resumo de 1 linha visível); estímulo e resposta
  sobem para a dobra. Desktop mantém expansão atual.
- **D17-13 · Foco pós-ação**: ScorePanel e resumo de sessão/simulado recebem
  `tabIndex={-1}` + foco programático (reuso do padrão `usePageFocusTarget`) e
  scroll-into-view; labels/ARIA existentes preservados.
- **D17-14 · Estado compartilhado**: `StatePanel` (layout/) estende EmptyState com
  `variant="empty|loading|error"`; loading usa skeleton base compartilhado
  (`Skeleton` + receita min-h), erro usa tom destructive com honestidade atual.
  Adotado onde hoje há improvisos: session "sem questões", settings erros inline,
  practice loading, exam loading. Páginas mantêm vazios locais contextuais APENAS
  via StatePanel (progress blocos → variante compacta).
- **D17-15 · Home acima da dobra**: herói compacto (título menor no mobile, contagens
  em linha), e no primeiro uso a grade "Escolha uma habilidade" sobe antes da rotina;
  no retorno, retomada continua primeiro (hierarquia contextual atual está correta).
- **D17-16 · Sessão CTA legível**: rótulos de conclusão quebram linha
  (`whitespace-normal`) e ações empilham em 390px; nenhum rótulo truncado.
- **D17-17 · `text-info` resolvido**: verificar se a classe existe; se não, registrar
  `--info`/`--color-info` (azul informativo AA claro/escuro) e padronizar os usos em
  PassageText/ScorePanel SEM alterar o significado por nota/status.
- **D17-18 · Chips/selos**: borda `border/60` consistente com superfícies,
  micro-label 11px, altura mínima de toque 44px quando o chip é clicável.

## 4. Escopo por fase (com critérios de aceite)

### Fase 0 — Fundação do design system (tokens + primitivos)
Escopo: D17-4 (focus-ring), D17-5 (scrim token + aplicação nos 4 overlays), D17-6
(sombras dos primitives), D17-7 (raios), D17-3 (alturas do Button), D17-8 (tokens de
barra fixa + reserva do body), D17-9 (papel micro ≥11px + proibição 10px no styles.css),
D17-17 (token info). Não toca páginas ainda — só styles.css e src/components/ui/* +
TabBar/PracticeShell offsets.
Aceite: vitest verde (nenhum teste de markup quebra; `.scrim-anim` intacto) · tsgo
limpo · build OK · lint 0/0 · Playwright fumaçada: dialog/alert-dialog/sheet com
scrim do tema (screenshot light+dark), botões ≥44px medidos no DOM em 390px.

### Fase 1 — Containers, gutters e larguras (D17-1, D17-2)
Escopo: TopNav gutter; settings 4xl→3xl; progress 5xl→4xl; session config/in-progress
→3xl; unificar `px-4 sm:px-6` em todos os mains e shells (session ×3, exam ×5,
practice loading/entry/runner); PracticeShell footer offset via token (D17-8 completo).
Aceite: grep não encontra `max-w-5xl` fora de Home, nem `px-4` sem `sm:px-6` em main;
footer de prática sem sobreposição com a TabBar (medição Playwright em 390px);
vitest/tsgo/build/lint verdes.

### Fase 2 — Estados e feedback (D17-14, D17-13)
Escopo: StatePanel com variantes; adoção em session (sem questões), settings (erros
inline), practice loading (skeleton + rótulo visível), exam loading; foco/scroll no
ScorePanel e nos resumos de session/exam; estado compacto nos blocos do progress.
Aceite: Playwright — ao concluir uma questão, o painel de resultado recebe foco
(document.activeElement) e fica visível na viewport; cada estado vazio das 11 rotas
renderiza via StatePanel (ou EmptyState direto onde já é correto); gates padrão verdes.

### Fase 3 — Home e navegação (D17-15)
Escopo: herói compacto; primeira dobra do primeiro uso com habilidades acessíveis;
contagens em linha; hierarquia de retorno preservada (retomada primeiro).
Aceite: 390×844 — título e primeira ação de habilidade visíveis sem scroll (ou ≤1
toque de scroll); axe 0; gates padrão.

### Fase 4 — Superfícies de estudo (D17-12, D17-16 + densidades)
Escopo: PracticeShell (disclosure do pré-exercício, footer com quebra segura,
prev/next 44px herdados), ScorePanel denso porém focado, session (CTAs quebráveis,
conclusão 2xl mantida, config 3xl), exam (padding de cartões D17-10, retomada 44px).
Aceite: 390×844 — estímulo visível na dobra em ≥3 tipos de prática (read_aloud,
fib, sst); nenhum CTA estoura largura; gates padrão + axe 0 nas rotas tocadas.

### Fase 5 — Índices e listas (D17-11, D17-18, D17-10)
Escopo: SectionPage (chips 11px, cartões p-4 sm:p-5, filtros recolhíveis quando
não-default), vocabulary (filtros recolhíveis, densidade da lista preservada —
nenhum item do projeto 16 perde função), progress (agrupamento visual, blocos com
StatePanel compacto).
Aceite: filtros do vocabulário cobrem os mesmos campos (`filterVocab` intacto);
tests de vocab/proj16 verdes sem mudança de expectativa; gates padrão.

### Fase 6 — Fechamento AAA
Escopo: E2E versionado `scripts/e2e/proj17_f0.py` (varredura 390×844 das 11 rotas:
overflow 0, axe 0, alvos ≥44px em ações primárias, sem sobreposição TabBar×footer,
screenshots light+dark de 5 rotas-chave + estados vazio/carregando/concluído); gates
completos; AGENTS.md atualizado (regra de larguras vigente + receitas de foco/scrim/
botão); memória do projeto quando houver preferência registrada.
Aceite: E2E exit 0 · vitest completo · tsgo · build · lint · varredura final.

## 5. Modelo de execução

Decisão registrada (como nos projetos 13/15): nesta plataforma os subagentes
(`spawn_agent`) são somente-leitura — investigam, planejam e verificam; TODA edição
de código é do agente principal, que roda os gates e marca o roadmap. Os 3 estudos
da fundação já foram feitos (§1). Fases 0–1 são sequenciais (fundação primeiro);
Fases 2–5 podem ser feitas em qualquer ordem após F1, mas serão executadas em
sequência pelo agente principal para evitar conflitos de arquivo em shells
compartilhados (session/exam/practice). Verificação de subagente por fase: relatório
de conformidade contra os critérios de aceite da fase (evidência arquivo:linha),
usado como checklist antes de marcar `[x]`.

## 6. Riscos e mitigações

1. **Quebrar contratos de teste de markup** (`.scrim-anim`, `page-title`, labels):
   mitigação — mudanças de classe/tags são preservadas; quando inevitável, o teste é
   atualizado no MESMO commit e registrado no relato da fase.
2. **Sobreposição de barras fixas** ao mexer em alturas: D17-8 tokeniza as medidas —
   um único lugar define 60px; Playwright mede a interseção real.
3. **Perder significado de cores de nota/status** (ScorePanel/PassageText): fases
   não uniformizam cores de feedback; D17-17 só registra o token, mapeamentos ficam.
4. **Reforma parcial em shells duplicados**: checklists por fase incluem TODOS os
   estados (config/retomada/execução/conclusão/lazy/inválido).
5. **jsdom não detecta regressão de layout**: cada fase com UI roda Playwright 390px
   com medição (alvos/overlap/overflow), não só screenshots.
6. **`matchMedia` JS vs breakpoints CSS** (session.tsx:76-80): mudanças de largura
   não alteram o breakpoint 1024px sem avaliar o comportamento acoplado.

## 7. Gates (todos os fases)

vitest (`bunx vitest run`) · tsgo limpo · `bun run build` (precache/sw regeneram) ·
lint 0 erros 0 warnings · Playwright quando a fase toca UI (console limpo, axe 0,
390×844 sem overflow) · E2E versionado no fechamento. Números reais na linha de
Gates do roadmap; `[x]` só após verificação.

## 8. Especificação de implementação (nível arquivo)

### 8.1 Tokens em `src/styles.css` (Fase 0)
- `@theme inline`: `--color-scrim: var(--scrim)`; `:root` define `--scrim:
  oklch(0.15 0.02 262 / 55%)`, `.dark` define `--scrim: oklch(0.08 0.015 262 / 65%)`.
- `@theme`: `--tabbar-h: 3.75rem` NÃO vai em @theme (não é utilitário de cor/sombra);
  fica em `:root` como `--tabbar-h: 3.75rem` e o body mobile passa a
  `padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom))`.
- `@utility focus-ring { outline: 2px solid var(--color-ring); outline-offset: 2px; }`
  e uma variante `focus-ring-inset` quando offset externo cortaria (overlays).
- `@utility text-micro { font-size: 11px; line-height: 1.45; }` — papel único de
  micro-label; comentário no topo do bloco proíbe tamanhos < 11px para texto de UI.
- Se `text-info` não estiver definido: `--info: oklch(0.52 0.11 240)` (light) /
  `oklch(0.78 0.09 240)` (dark) + `--color-info` no @theme inline.
- Header de comentário do styles.css ganha a tabela vigente de larguras (D17-1) e as
  receitas (foco, scrim, sombra, raio, altura de controle) — a "fonte única" das
  receitas passa a ser este bloco de comentário + os utilitários.

### 8.2 `src/components/ui/*` (Fase 0)
- `button.tsx`: base passa a `min-h-11 rounded-xl focus-visible:[utilitário]`;
  `shadow`/`shadow-sm` removidos; `sm` mantém uso interno denso mas com min-h-11.
  Variantes visuais (default/outline/ghost/destructive/link) inalteradas.
- `dialog.tsx` + `alert-dialog.tsx` + `drawer.tsx`: scrim `bg-scrim`; dialog
  `rounded-2xl shadow-pop` e `max-h-[85dvh] overflow-y-auto`; alert-dialog idem
  (comportamento Radix intacto).
- `popover.tsx`/`hover-card.tsx`/`dropdown-menu.tsx`: `shadow-pop` no lugar de
  shadow-md/lg (dropdown mantém as duas variantes side/top → `shadow-pop`).
- `sheet.tsx`/`input.tsx`/`select.tsx`/`label.tsx`: `rounded-xl`, `min-h-11` em
  controles de formulário; nada de consumidores novos (não adotar tabs/card aqui).
- `skeleton.tsx`: mantém; receita de skeleton de página (min-h-[22rem] repetido em
  `practice.tsx:125`, `exam.tsx:518`) vira `<SkeletonPage />` em `layout/`.

### 8.3 Barras fixas (Fase 0/1)
- `TabBar.tsx`: sem mudança visual; continua `h` implícita por conteúdo (52px item +
  m-1) — o token `--tabbar-h` documenta 60px e o body consome o token.
- `PracticeShell.tsx:441`: footer `sticky` vira `fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] md:bottom-0`
  (desktop sem TabBar) com padding de segurança no main
  (`pb-[calc(var(--tabbar-h)+5rem+env(safe-area-inset-bottom))]` mobile) — a reserva
  exata é medida no Playwright da fase (sem sobreposição, sem buraco > 16px).

### 8.4 Shells por rota (Fase 1)
Arquivos que declaram container e recebem a unificação:
- `routes/index.tsx:338` (5xl, mantém), `routes/settings.tsx:595` (4xl→3xl),
  `routes/progress.tsx:119` (5xl→4xl), `routes/session.tsx:199,348,428`
  (2xl→2xl conclusão; 2xl→3xl em andamento; 5xl→3xl config),
  `routes/exam.tsx:171,419,512` + `exam/ExamRunner.tsx:1302,1494` (mantém 4xl/3xl/2xl),
  `routes/practice.tsx:118` + `practice/PracticeEntry.tsx:52` +
  `practice/PracticeShell.tsx:275` (3xl mantém; runner ganha `sm:px-6`),
  `components/SectionPage.tsx:128` (4xl mantém), `routes/vocabulary.tsx:357,964`
  (3xl mantém), `components/TopNav.tsx:27` (px-4 sm:px-6).
- Verificação por grep: `rg -n "max-w-(5xl|4xl|3xl|2xl)" src/routes src/components`
  — cada ocorrência casa com a tabela D17-1 ou é cartão interno (2xl de estudo do
  vocabulário `vocabulary.tsx:964` permanece: é cartão, não página).

### 8.5 StatePanel (Fase 2) — contrato
```tsx
interface StatePanelProps {
  variant?: "empty" | "loading" | "error";
  icon?: LucideIcon;            // obrigatório em empty, ignorado em loading
  title: string;
  description?: string;
  action?: ReactNode;           // CTA primário (44px)
  compact?: boolean;            // para blocos internos (progress)
}
```
- `empty` = visual atual do EmptyState (border-dashed, ícone em 12, título serif).
- `loading` = skeleton base (2 linhas + bloco) + `aria-live="polite"` com o título.
- `error` = borda destructive/40, ícone AlertTriangle, tom honesto atual.
- `EmptyState` permanece como API pública (importada por 4 consumidores) e passa a
  ser o caso `variant="empty"` de dentro — nenhum consumidor é obrigado a migrar
  nesta fase; os migrados por D17-14 são: `session.tsx:579-585`,
  `settings.tsx:128,537,567`, `practice.tsx:119-126`, `exam.tsx:508-519`,
  blocos do `progress.tsx` (compact).

### 8.6 Foco pós-ação (Fase 2)
- Padrão: container do resultado recebe `ref` + `tabIndex={-1}` +
  `focus:outline-none`; `useEffect` na mudança de estado chama `ref.current?.focus()`
  (o navegador rola até ele; `scrollIntoView({ block: "start" })` como fallback).
- Aplicado a: `ScorePanel.tsx` (raiz do painel), `session.tsx:199` (resumo),
  `exam.tsx:511` (resultado). O `page-title` do PageHeader não é reusado aqui (foco
  pós-ação ≠ foco pós-navegação).
- Respeita `prefers-reduced-motion` (sem scroll suave — comportamento default).

### 8.7 Disclosure de filtros / pré-exercício (Fases 4–5)
- Componente novo `layout/Disclosure.tsx` (button + região acessível,
  `aria-expanded`, animação curta respeitando reduced-motion); usado em:
  vocabulário (`vocabulary.tsx:465-529` — escopo/limite/seção/ordenação recolhem;
  busca e chips de estado permanecem visíveis), SectionPage (busca visível; tipo/
  status recolhem se não-default), PracticeShell (detalhes/nota/avisos).
- Aberto por padrão quando há filtro não-default ativo (derivação de estado, sem
  persistência — leitura pós-hidratação quando depender do store).

### 8.8 Medição Playwright por fase (protocolo)
Script único `/tmp/browser/proj17_check.py` reusável: viewport 390×844 (+ desktop
1280 quando a fase altera desktop), coleta console, roda axe (via injectão do axe
playground UMD em localhost), mede:
1. overflow horizontal (scrollWidth ≤ 390 em cada rota);
2. alvos: todo `a`/`button` visível nas 11 rotas tem bounding box ≥ 44×44 OU é
   ação inline de texto (link de texto corrido) — infrações reportadas por rota;
3. interseção footer×TabBar (PracticeRunner em /practice?q=...) = 0px;
4. screenshots: 5 rotas-chave light+dark nas fases que alteram visual.
Saída JSON no stdout; qualquer falha = exit 1. O E2E final (Fase 6) versiona este
protocolo em `scripts/e2e/proj17_f0.py`.

### 8.9 Cópias e microcopy
- Nenhuma cópia nova de produto; rótulos existentes preservados (testes acoplados).
- Únicos textos novos permitidos: rótulos de disclosure ("Mais filtros" / "Menos
  filtros", "Detalhes da questão"), aria-labels correspondentes, e honestidade dos
  estados de erro (seguem o tom dos existentes, PT-BR).

### 8.10 Checklist de fase (aplicado a F0–F6)
- [ ] Todos os estados do(s) shell(s) tocado(s) cobertos (config/retomada/execução/
      conclusão/lazy/inválido) — não só o estado inicial.
- [ ] Nenhum `text-[10px]` restante nas rotas tocadas.
- [ ] Nenhuma classe de cor fora de token introduzida (scrim/info são tokens).
- [ ] `.scrim-anim`, `id="page-title"`, labels/ARIA testados intactos.
- [ ] Playwright do protocolo §8.8 verde (ou falha justificada + registro).
- [ ] Gates: vitest · tsgo · build · lint 0/0.
- [ ] Roadmap marcado com números reais na linha de Gates.

## 9. Desdobramento fino por fase (arquivo por arquivo)

### Fase 0 (fundação) — ordem interna de trabalho
1. styles.css: tokens `--scrim`, `--info` (se faltar), `--tabbar-h`, `@utility
   focus-ring`, `@utility text-micro`, tabela de receitas no comentário de topo.
2. ui/button.tsx: min-h-11 + rounded-xl + sem shadow + focus-ring.
3. ui/dialog, alert-dialog, drawer: bg-scrim + max-h/scroll + rounded-2xl/shadow-pop.
4. ui/popover, hover-card, dropdown-menu: shadow-pop.
5. ui/sheet, input, select, label: rounded-xl + min-h-11 nos controles.
6. layout/TabBar + styles.css body: consumo do token --tabbar-h.
7. layout/SkeletonPage.tsx (novo): skeleton de página (topo PageHeader-fantasma +
   bloco min-h-[22rem]) — adotado em practice.tsx:125 e exam.tsx:518.
8. PassageText.tsx / ScorePanel.tsx: só se `text-info` não existir — registar token
   e substituir a classe, sem alterar mapeamentos de cor por nota/status.
Gates: vitest completo (projetos 12–16 verdes sem mudança de expectativa) · tsgo ·
build · lint · Playwright §8.8 (fumaçada dos overlays + alvos ≥44px).

### Fase 1 (containers) — ordem interna
1. TopNav.tsx:27 gutter unificado.
2. settings.tsx:595 4xl→3xl (pt-8 mantém; revisar seções longas continuam legíveis).
3. progress.tsx:119 5xl→4xl.
4. session.tsx:428 5xl→3xl; :348 2xl→3xl; :199 2xl mantém (conclusão).
5. PracticeShell.tsx:275,442: runner `sm:px-6` + footer via token (8.3).
6. Grep de conformidade §8.4.
Gates: vitest · tsgo · build · lint · Playwright: sobreposição footer×TabBar = 0px
em /practice?q=... e nas 11 rotas (overflow 0).

### Fase 2 (estados/foco) — ordem interna
1. layout/StatePanel.tsx (novo, contrato §8.5) + EmptyState delega.
2. Migrações: session.tsx:579-585 · settings.tsx:128,537,567 · practice.tsx:119-126 ·
   exam.tsx:508-519 · blocos progress.tsx (compact).
3. Foco pós-ação §8.6: ScorePanel, session resumo, exam resultado.
Gates: vitest · tsgo · build · lint · Playwright: foco no resultado (activeElement)
+ estados vazio/erro renderizados via StatePanel.

### Fase 3 (home/navegação)
1. index.tsx herói: título `text-3xl sm:text-5xl`, contagens em linha (flex wrap),
   ações lado a lado no mobile se couberem.
2. Ordem de blocos no primeiro uso: habilidades antes da rotina (retorno preservado
   pela condição existente de retomada).
3. TopNav mobile: garantir sem estouro com fonte ampliada (teste com 200% zoom text).
Gates: vitest · tsgo · build · lint · Playwright §8.8 + dobra: primeira ação de
habilidade visível em 390×844 sem scroll no primeiro uso.

### Fase 4 (superfícies de estudo)
1. layout/Disclosure.tsx (§8.7).
2. PracticeShell: disclosure do pré-exercício (mobile), footer seguro, prev/next
   (herdam 44px da Fase 0), hierarquia "Próxima do banco" vs "ação do motor".
3. ScorePanel: denso porém focado (resumo colapsável de transcrição longa).
4. session: CTAs whitespace-normal, conclusão focada (2xl), config 3xl.
5. exam: p-4 sm:p-6 nos cartões (D17-10), retomada/descartar 44px, resultado focado.
Gates: vitest · tsgo · build · lint · Playwright: estímulo na dobra (read_aloud,
fib, sst), nenhum CTA estoura 390px, axe 0.

### Fase 5 (índices/listas)
1. SectionPage: chips text-micro, cartões p-4 sm:p-5, disclosure tipo/status.
2. vocabulary: disclosure de escopo/limite/seção/ordenação (busca e estado fora),
   densidade da lista preservada, selos com warning-ink intactos (D14-6b).
3. progress: agrupamento visual em blocos (cartões p-4 sm:p-5), StatePanel compacto.
Gates: vitest · tsgo · build · lint · Playwright §8.8 nas 3 rotas + testes do
projeto 16 verdes sem mudança de expectativa.

## 10. Dark mode e contraste
- Todo token novo tem par em `.dark` (scrim, info). Nenhum literal novo de cor.
- Contraste AA verificado nas combinações novas: focus-ring sobre card/background
  (ring oklch 0.6/0.6 — AA para foco não-textual ≥3:1, confirmar em dark),
  micro-label 11px usa muted-foreground (AA garantido pelo token), scrim sobre
  conteúdo claro/escuro mantém leitura do texto do modal.
- Playwright light+dark nas fases 0, 3 e 6 (screenshots comparativos).

## 11. Verificação por subagente (relato → prova)
Ao fim de cada fase, um subagente read-only recebe: PRD (este arquivo) + roadmap +
o diff da fase (`git diff` — leitura apenas) e devolve relato de conformidade:
cada critério de aceite → OK/FALHA com evidência arquivo:linha. `[x]` no roadmap só
depois de: gates verdes + relato de conformidade sem FALHA não resolvida + números
reais na linha de Gates. Falha de subagente = refazer o item (não negociar critério).

## 12. Registro de decisões durante a execução
Toda decisão tomada durante a execução que não esteja neste PRD é acrescentada
aqui (append com data) — nunca decidida só no roadmap. Divergência entre PRD e
planejamento → PRD vence no "como"; planejamento vence no "quê".

---
Registro de execução:
- [2026-11-03] PRD criado a partir de project17.md + 3 auditorias paralelas
  (design · fluxo mobile · infraestrutura). Nenhuma divergência do planejamento.
- [2026-11-03] Fases 0–2 concluídas. DESVIOS de escopo decididos (§3 prevalece):
  (a) as notas `aria-describedby` dos botões desabilitados da sessão
  (`sessao-sem-due`/`sessao-sem-err`) NÃO migram para StatePanel — são descrição
  de controle, não estado de página; (b) feedback de IA (`AiGradeFeedback`
  loading/unavailable) permanece cartão contextual do componente — já segue o
  padrão visual e migrar perderia contexto; (c) skeletons de prática/simulado
  adotam `SkeletonPage` (cobre o loading de página de D17-0c); (d) footer da
  prática ancora em `--tabbar-h + 1px` (borda da TabBar medida: total 61px).
- [2026-11-03] Fase 3 (D17-15) concluída. DESVIOS decididos (§3 prevalece):
  (a) a ordem dos blocos da Home usa a MESMA condição `resume` do herói — retorno
  sem retomada concreta (ex.: só tentativas antigas de questão inexistente) mostra
  herói genérico + habilidades primeiro, coerente com o hero condicional existente;
  (b) chip "N tipos de tarefa" do TopNav sobe 10px→11px (D17-9: rota tocada na fase);
  (c) a 200% de fonte, o estouro do TopNav foi corrigido com `flex-wrap` (container
  + atalhos mobile; headerOverflow 0); o overflow residual da PÁGINA a 200%
  (botões `whitespace-nowrap` do herói e min-content dos cartões da rotina,
  ~65px) é pré-existente a esta fase e registrado como justificado — em 100%
  (390×844) o overflow é 0; dedicação plena fica para a varredura da Fase 6.
- [2026-11-03] Fase 4 (D17-12/D17-16/D17-10) concluída. DESVIOS decididos:
  (a) `Disclosure` renderiza a região condicionalmente (sem animação de altura);
  `.disclosure-anim` é a entrada curta (140ms) coberta pela guarda global de
  reduced-motion; (b) o modo controlado mantém `contentId="questao-nota"` — o
  contrato de aria-controls existente não mudou; (c) a transcrição do ScorePanel
  abre por padrão até 240 caracteres (curta = comportamento anterior); (d) a
  hierarquia "Próxima do banco" vs "ação do motor" foi conferida e NÃO mudou:
  header mantém prev/next outline (navegação secundária) e o footer mantém a
  ação primária do motor — competição visual não observada; (e) os cartões
  role=alert do ExamRunner ficaram em p-6 (estados de erro, fora do recorte
  D17-10 de cartões de estudo); (f) densidade do cabeçalho da questão foi a
  p-4 sm:p-5 da regra D17-10 (não p-4 sm:p-6 como o cartão de estudo do exam).
- [2026-11-03] Fase 5 (D17-11/D17-18/D17-10) concluída. DESVIOS decididos:
  (a) o disclosure de filtros (SectionPage e vocabulary) colapsa em TODOS os
  viewports — desktop ganha um toque para reach dos filtros avançados; evitou-se
  um matchMedia novo (risco registrado em §1.3) e mantida a receita única do
  Disclosure; (b) no vocabulary, busca e chips de Tipo permanecem visíveis
  (filtro primário de estado); Seção/Favoritas/Ordenar recolhem — leitura de
  §8.7; (c) abertura derivada usa `extraOpen ?? (não-default)` com null antes do
  primeiro gesto: no vocabulary a derivação só é confiável PÓS-hidratação
  (D16-5b), então a `open` controlada segue a derivação até o usuário interagir;
  (d) TabBar e chips plus subiram 10px→11px (D17-9/D17-18) — altura do item da
  TabBar preservada (token --tabbar-h); (e) grupo Seção do vocabulário continua
  condicional a sectionsAvailable (comportamento existente); (f) 1 falha
  intermitente de vitest em rodada paralela (verde em 2 reruns isolados) — flake
  registrado, sem mudança de expectativa nos testes do 16.


- [2026-11-03] Fase 6 concluída (D17-F6a/F6b). E2E versionado
  `scripts/e2e/proj17_f0.py` verde (exit 0): 11 rotas 390×844 com overflow 0,
  alvos ≥44px (isento: skip-link sr-only "Pular para o conteúdo"), axe 0,
  footer×TabBar 0px no runner, console limpo; estados concluído (draft de sessão
  semeado + /session?done=1), vazio (store zerado → vocabulário) e carregando
  (rota de dados da questão atrasada em navegação client-side → SkeletonPage)
  capturados com screenshot; screenshots light+dark de 5 rotas-chave. Gates:
  vitest 703/703 · tsgo limpo · build OK (precache 129, sw br72xmu) · lint 0/0.
  Relato de conformidade da F5 (pendente da fase anterior): subagente devolveu
  3/6 OK; os 3 pontos em aberto foram resolvidos por evidência direta —
  (a) herói do progress preserva `p-5 sm:p-8` CONFORME o PRD (só os blocos
  migravam para `p-4 sm:p-5`); (b) EmptyState em progress é o caso `empty` do
  StatePanel (D17-14, delegação); (c) `aria-expanded`/`aria-controls` em
  Disclosure.tsx:55-56 e altura da TabBar via token em TabBar.tsx:19
  (`h-[var(--tabbar-h)]`); `text-[10px]` só no comentário de proibição
  (styles.css:30). AGENTS.md atualizado com as larguras vigentes (tabela
  D17-1) e as receitas de botão/foco/scrim/micro-texto/altura de footer.
