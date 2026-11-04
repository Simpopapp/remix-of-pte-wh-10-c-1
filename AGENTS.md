<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

*Regras técnicas do protocolo de remix*

## regras de desenvolvimento do projeto

- /.opencode/Plan.md guia o remix através dos 3 pilares
- OC/monitor só é utilizado após a conclusão dos projetos existentes, ou sob pedido do usuário (não ativar antes disso)

## Arquitetura de monitoramento
- O proxy do OpenCode expõe o runtime OpenCode na rota `/oc`. oculta nas rotas do app, só utilizar o runtime OpenCode
## Verificação e ativação do protocolo
- instruções de remix: "/.opencode/plan.md"
- um remix é ativado quando se recebe o comando "I've successfully remixed this project. What would be a good next step?" ou "I've remixed this project, but there are still some steps required to get it up and running. 

Can you help me with the following actions:
1. Cleared the copied Drizzle migrations and rescaffolded an empty migration set for the new project's database". para iniciar um remix é obrigatorio usar o project monitor e seguir as regras do plan.md para evitar bugs e erros no projeto.
- Nunca use o opencode para fazer tarefas de um remix.
- Nunca confunda informar o monitor do projeto com fazer uma ask para o usuário (tem uma skill pra isso).
- Nunca pergunte qualquer coisa ao usuário antes de completar todas as etapas de produção dos 3 pilares (1- se algum pilar faltar é sua missão planejar os demais e seguir adiante. 2- Se todos os 3 pilares estiverem null o remix é cancelado. informe o usuário e cole a proxima mensagem dele em "project{n}.md" sem realizar mais ações).

## Arquitetura e Ambiente
- Correção IA tem UMA orquestração (`src/lib/plus/aiGradeRun.ts` — cache→request→cache write→erro tipado): prática (`useAiGrade`) e exame (`examReview.tsx`) só chamam `runAiGrade`; nunca duplique cache/request de IA. Kinds vigentes: `essay | swt | sst` (D18-1 — toda nova superfície de correção IA entra no contrato da orquestração, com schema Zod próprio em `aiGradeSchemas.ts`).
- Tradução IA é server-only: o provider/SDK de IA vive só em `src/lib/ai/gateway.server.ts` (com `rate-limit.server.ts` e `run-id.server.ts` ao lado) e a chave do gateway é lida dentro do handler (`src/lib/plus/ai-translate.functions.ts`); nada de IA entra no bundle do cliente — o cliente só chama as server functions `translateAiWord`/`translateAiPhrase`. Helpers server-only vivem SEMPRE em arquivos `*.server.ts` FORA de `src/server/` (o diretório inteiro é bloqueado do grafo do cliente pela proteção de import, mesmo via import dinâmico — D15-7).
- Vocabulário do Studie Plus é campo `vocabulary` do `AppState` (v7): entra na migração, no backup e na mescla (`src/lib/backup.ts`); mutadores públicos em `src/lib/storage.ts`, funções puras em `src/lib/plus/vocab.ts` (limpeza total = `clearVocabAll`).
- Cards de tradução (palavra e frase) usam um único container `TranslationSheet` (`src/components/plus/TranslationSheet.tsx`, portal em `document.body`; bottom sheet no mobile / painel central no desktop): `PlusWordText` e `PlusPhraseCard` são só conteúdo. Novos cards de tradução consomem o sheet; nunca ancorar card ao ponto de clique nem expandir inline (decisão do projeto 12, PRD D1/D2).
- Design system do projeto 12 vive em `src/styles.css` (tokens papel/tinta/índigo/âmbar light+dark, sombras `shadow-card/pop/sheet`, `bg-glow`, radius 1rem, `prefers-reduced-motion`); fontes Fraunces+Inter via `<link>` em `__root.tsx` (nunca `@import` remoto no CSS); ícones só via `lucide-react`; regra de larguras vigente (projeto 17, tabela no comentário do `PageHeader`): 5xl home/TopNav · 4xl índices (SectionPage, exam config, progress) · 3xl superfícies de estudo, settings e vocabulário · 2xl foco pós-conclusão.
- Receitas de UI do projeto 17 (D17-0/8/9/12): todo `button` tem `min-h-11` (44px) + `rounded-xl` + `focus-ring` (sem shadow); overlays usam `bg-scrim` (token light+dark); micro-texto é `text-micro` (11px — 10px proibido, inclui TabBar e chips); footers fixos ancoram em `--tabbar-h + 1px + env(safe-area-inset-bottom)` e o body reserva esse espaço (sobreposição footer×TabBar = 0px); estados de página usam `layout/StatePanel` e foco pós-ação usa `useResultFocus`; disclosures acessíveis via `layout/Disclosure` (aria-expanded/controls, reduced-motion).
- Selos âmbar sobre fundo âmbar translúcido (`bg-warning/10`) usam `text-warning-ink` (token em `src/styles.css`, light+dark — D14-6b); `text-warning` sobre esse fundo falha contraste AA. Idem para selos verdes: `bg-success/10` usa `text-success-ink` (D18-F8 — `text-success` sobre tinta verde translúcida falha AA). Exceção documentada de cor fora do design system: `src/lib/error-page.ts` (documento de erro standalone) e assets SVG de dados (`src/assets/describe-image/*`).
- Integridade de dados (projeto 13): todo `Attempt` tem `id` determinístico e o merge de backup é idempotente (`src/lib/backup.ts` — dedupe por id, snapshots SRS reconciliados por evidência, settings locais vencem no MERGE); estado do simulado vive em `examDraft` no AppState (retomada sobrevive a reload); política oral ÚNICA em `src/lib/pte/oralPolicy.ts` consumida por prática E exame — nunca duplique a lógica de ASR.
- Inteligência de progresso honesta (projeto 18): recomendação lê a meta do usuário — `targetScore`, `examDate`, correção pendente e tipos nunca tentados viram ações (`src/lib/next-action.ts`); prontidão exige DIVERSIDADE + TRANSFERÊNCIA (`src/lib/pte/readiness.ts` — repetir o mesmo item não sobe confiança, aviso de frescor > 14 dias); a revisão do simulado reconstrói do registro persistido (resposta integral cap 2.000, referência cap 600 — `ExamRunner`/`examReview`).
- Cache IA é v2 centralizado no módulo (`src/lib/plus/aiCache.ts`), consultado ANTES de checar rede/créditos; os handlers de tradução são server-only com caps de payload (Zod) e rate limit — nada de IA no bundle do cliente.
- Precache do service worker é GERADO PELO BUILD: `scripts/gen-sw-assets.mjs` escreve `dist/client/sw-assets.json` (roda no script `build`) e o `public/sw.js` (mude `VERSION` a cada mudança do arquivo) exige shell completo com `response.ok` e apaga caches antigos na ativação. Nunca mantenha lista manual de assets no sw.js.
- Store: superfícies que só precisam de settings/bookmarks/derivados usam os seletores finos (`useSettings`/`useBookmarks`/`useStats`/`useTypeStats`); as derivações do /progress passam por `buildProgressOverview` (`src/lib/progress-overview.ts`, UMA passada). NUNCA leia localStorage em initializer de `useState` nem em render (hidratação) — use `useSyncExternalStore` e leia pós-mount (ex.: `hasUndoBackup`).
- Recorte do vocabulário (projeto 16): `VocabWord` tem `snippet/snippetInContext/snippetWhy` (caps 400/240, normalizados em `normSnippet*`); a tradução sob demanda do recorte (`VocabDetailSheet` → `translateAiPhrase`, cache ANTES da disponibilidade D7/D8) é EXIBIDA e NUNCA gravada no store (D16-C); derivação (`deriveVocabSnippet`) é leitura pós-mount. Versão completa = `VocabDetailSheet` (seções fechadas); áudio de estudo = `VocabAudio.tsx` (sequência palavra→recorte cancelável, `SNIPPET_PAUSE_MS`); `filterVocab` cobre `snippet`; chip de estado via `vocabStateChip`; filtros da lista persistem em `pte-vocab-filters` com leitura pós-hidratação.

## Verificação e Qualidade
- Gates obrigatórios por fase: vitest (`bunx vitest run`) · tsgo limpo · `bun run build` · lint 0 erros · Playwright quando a fase toca UI (console limpo, axe 0 violações nas rotas tocadas, 390×844 sem overflow).
- E2E versionados vivem em `scripts/e2e/` e rodam contra o dev server: `fluxos_criticos.py` (projeto 13), `proj14_f6.py` (projeto 14 — essay com IA real/fallback, retomada de simulado com rascunho parcial, recomendação→treino, varredura 390×844 nas 11 rotas), `proj16_f0.py` (projeto 16 — captura com recorte → sheet completo → tradução do recorte via cache IA → sessão com recorte; varredura 390×844 + axe nas 11 rotas), `proj18_f24.py` (projeto 18 onda 2 — revisão fiel do simulado arquivado pós-reload, explicador honesto da prontidão, blueprint com read_fib_bank e prática do banco com gabarito) e `proj18_f8.py` (fechamento do 18 — HIW end-to-end, retry IA com rede bloqueada, SST com IA real/fallback, revisão pós-reload, rotação de sentidos, banco em prática, varredura + axe). Saída JSON no stdout; qualquer falha = exit 1.
