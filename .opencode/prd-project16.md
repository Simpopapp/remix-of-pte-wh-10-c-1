# PRD — Project 16 · Vocabulário: inteligência de fluxo de aprendizado (Studie Plus)

Data: 2026-11-03 · Origem: diretriz do usuário registrada em `project16.md`
Auditoria: leitura integral do fluxo de tradução e captura (PlusWordText,
PlusPhraseCard, TranslationSheet, AiWordCard, vocab.ts, vocabStudy.ts,
vocabulary.tsx) + varredura de call sites e testes. Monitor temporariamente
indisponível — execução direta conforme Obs do Plan.md.

---

## 0. Sumário executivo

A área de vocabulário é funcional (captura honesta, caixa Leitner própria,
checagem de retrieval opcional, undo, fontes com volta à questão) mas é **a
menos inteligente do app**: ela guarda a tradução e esquece o lugar onde a
palavra vivia. O aluno que revisa "rigorous → rigoroso" tem que confiar na
memória; a prática original mostra a palavra DENTRO da frase e a IA explica o
sentido no contexto — o vocabulário entrega menos que o momento da tradução.

Quatro eixos fecham a diretriz do usuário (project16.md):

1. **Recorte (snippet)** — guardar e exibir a FRASE onde a palavra foi usada
   (não o texto inteiro), para ver a aplicação prática como na tradução original.
2. **Versão simples vs completa** — o card da lista fica objetivo (menos texto
   do que hoje); o toque no card abre a versão COMPLETA em sheet, que é a versão
   atual melhorada: tradução + recorte + tradução no recorte + sentidos + fontes.
3. **Áudio de estudo** — ouvir a palavra E o recorte com ela dentro, na lista e
   na sessão de estudo (o app já fala inglês em todo lugar; o vocabulário não).
4. **Inteligência de fluxo** — o estado de aprendizado visível (caixa/prazo),
   busca que cobre o recorte, filtros que sobrevivem à navegação, sessão de
   estudo que estuda no contexto, mobile/a11y AAA.

Nada disso reescreve o que funciona: TranslationSheet, caixa Leitner (D15-3a),
sentidos acumulados, undo (D15-4c) e honestidade de mecanismo são PRESERVADOS.

## 1. Diretriz e princípios de decisão

- **O vocabulário não pode entregar menos que o momento da tradução.** Hoje
  entrega menos: a tradução in-contexto da IA não sobrevive à captura completa
  (só `inSentence.translation` vira `contextual`; o recorte EN e o `why` se
  perdem) e o item de dicionário não guarda frase nenhuma.
- **Simples por padrão, completo por demanda.** A lista é um índice ágil; a
  profundidade mora no sheet da versão completa. Nenhuma linha de texto sobra na
  lista; nenhuma informação útil falta no sheet.
- **Nada é inventado.** O recorte só entra se foi de fato exibido no gesto
  (mesma regra D2 da captura). Item antigo sem recorte deriva do catálogo
  (determinístico, offline) ou não mostra a seção — nunca chuta.
- **IA é demanda, nunca obrigação.** A tradução do recorte para itens de
  dicionário é um gesto explícito, com cache antes da checagem de
  disponibilidade (D7/D8), caps Zod e rate limit já existentes.
- **Áudio ensina inglês, nunca português** (regra do pack desde o projeto 10).
- **Offline e hidratação**: nenhuma leitura de localStorage/browser API em
  initializer de estado; recorte derivado e filtro persistido idem (padrão
  D15-5d / leitura pós-mount).
- Dúvidas: decidir e registrar aqui (nunca perguntar ao usuário).

## 2. Evidência da auditoria (achados que ancoram as fases)

Formato: achado → evidência → impacto → fase.

### 2.1 O recorte que se perde
- **A1.** `VocabWord` não guarda frase: campos são literal/contextual/senses/
  sources — nenhum recorte do texto de origem. `src/lib/plus/vocab.ts:40-69`.
  Impacto: o aluno revisa a palavra fora do contexto onde a encontrou. → F0.
- **A2.** O momento da tradução TEM o recorte: `PlusWordText` deriva a frase do
  token (`sentenceFor(text, core)`, `PlusWordText.tsx:53-56`) e a IA recebe essa
  frase como contexto — mas `captureAiWord` só persiste
  `contextual: result.inSentence.translation` (`PlusWordText.tsx:161-168`);
  `captureStaticWord` persiste a nota genérica do dicionário
  (`PlusWordText.tsx:148-158`). O recorte EN e o `why` da IA são jogados fora. → F0/F1.
- **A3.** Frases não têm o problema: `VocabPhrase.en` É o recorte (a frase
  completa), e o sheet de tradução já o exibe em destaque
  (`PlusPhraseCard.tsx:388-391`). O padrão visual de recorte já existe no app —
  falta só no vocabulário e nas palavras. → F1.
- **A4.** Itens antigos (sem recorte) são recuperáveis: `sources[].type+qid`
  identifica a questão e o catálogo local (import dinâmico já usado por
  `PlusPhraseCard` via `import.meta.glob`) tem o texto — a derivação é
  determinística e offline. → F0.

### 2.2 Versão simples vs completa (hoje: uma mistura confusa)
- **A5.** O card da lista exibe literal + contextual sempre que expandido
  (`vocabulary.tsx:586-594`) — palavra mostra tudo amassado, sem hierarquia;
  frase colapsa com `line-clamp-2` mas palavra nunca colapsa. → F1.
- **A6.** Não existe visualização de detalhe do item na área de vocabulário:
  o máximo que se vê é a expansão inline do card; não há sheet, não há "versão
  completa" com sentidos, fontes, recorte e áudio organizados. OTranslationSheet
  do app (portal, focus trap, bottom sheet mobile) é o container pronto. → F1.
- **A7.** A tradução completa de uma IA word (3 seções: literal, "na frase",
  "por que não o sinônimo?") só existe no card de tradução durante a prática
  (`AiWordCard.tsx`) — no vocabulário nada disso sobrevive (só literal +
  `inSentence.translation`). → F1/F2.

### 2.3 Áudio ausente no estudo
- **A8.** A lista tem 🔊 da palavra isolada (`vocabulary.tsx:599`) e a sessão
  de estudo tem 🔊 apenas na FRENTE do cartão (`vocabulary.tsx:956-958`) —
  nenhuma das duas fala o recorte, e depois de virar o cartão não há mais áudio.
  A infraestrutura existe (`PlusSpeakButton` em todo o app). → F3/F4.

### 2.4 Inteligência de fluxo
- **A9.** O estado de aprendizado (caixa Leitner, vencido/não vencido) é
  INVISÍVEL na lista — só a ordenação "Para revisar" o entrega indiretamente.
  O aluno não vê o que está consolidado vs fresco. `vocabulary.tsx:540-560`. → F5.
- **A10.** A busca cobre en/literal/contextual mas NÃO os sentidos acumulados
  nem (futuramente) o recorte — item traduzido com sentido B não aparece
  buscando B. `src/lib/plus/vocab.ts` (filterVocab). → F2/F5.
- **A11.** Filtros (busca/tipo/seção/favorita/ordem) morrem ao sair da página:
  voltar da prática é refiltrar tudo. Sem persistência. → F5.
- **A12.** A sessão de estudo mostra literal + contextual + sentidos, mas sem
  recorte e sem áudio pós-virada — estuda-se FORA do contexto (mesmo defeito
  raiz de A1). `vocabulary.tsx:846-895`. → F4.
- **A13.** Não há atalho do card para o recorte na questão original (o
  SourceChip leva à questão, mas o trecho exato onde a palavra estava não é
  destacado). Fora de escopo para não inflar — o recorte no sheet já resolve o
  valor prático (decisão registrada, §8).
- **A14.** Nenhuma regressão conhecida nos gates atuais: projeto 15 fechou com
  vitest 645/645, tsgo limpo, lint 0/0, build OK (precache 122) e E2E 54/54 —
  baseline verde para construir em cima. → todas as fases.

## 3. Modelo de dados (decisões D16-0)

### D16-0a — Recorte persistido na captura (`snippet`)
- `VocabWord` ganha `snippet?: string` — a frase EN onde a palavra foi usada
  (≤ `MAX_VOCAB_SNIPPET = 400` chars, truncada na captura, nunca no render,
  mesmo contrato de `MAX_VOCAB_PHRASE_EN`).
- Fonte do recorte em `PlusWordText`: a frase real do gesto = prop `sentence`
  (quando o chamador passa contexto) OU `sentenceFor(text, core)` — a MESMA
  frase enviada à IA como contexto e usada na chave de cache. Sem divergência
  entre o que a IA viu e o que é guardado.
- Frases: SEM campo novo — `VocabPhrase.en` já é o recorte (A3). Nada duplicado.
- Semântica de re-gesto: como literal/contextual, o recorte da ÚLTIMA tradução
  vence (o mais recente é o mais fiel ao uso atual); re-traduções não apagam
  sentidos (regra do projeto 13 intocada).

### D16-0b — Enriquecimento da captura IA (sem reescrever o contrato)
- `SaveVocabWordInput` ganha `snippetInContext?: string` (a tradução in-contexto
  da IA — hoje `inSentence.translation`) e `snippetWhy?: string` (o "porquê",
  cap 240 — espelho de `AI_LIMITS.inSentenceWhy`). Na captura IA:
  `literal`, `snippet`, `snippetInContext`, `snippetWhy` e `contextual` (que
  CONTINUA recebendo `inSentence.translation` para não quebrar nada existente).
- `VocabWord` ganha `snippetInContext?: string` e `snippetWhy?: string`.
  `contextual` permanece intocado (compatibilidade de backup/testes/UX).
- Itens de dicionário (glossary): `snippet` preenchido, `snippetInContext`/
  `snippetWhy` ausentes — a tradução do recorte é DEMANDA (D16-2b).

### D16-0c — Derivação para itens antigos (recorte retroativo, honesto)
- Função pura `deriveVocabSnippet(item, questionText)` em `vocab.ts`: encontra a
  frase do catálogo que contém a palavra (mesma normalização de
  `vocabWordKey`, `splitSentences` do módulo existente); sem hit → undefined.
- O consumidor (rota /vocabulary) resolve o texto da questão por
  `type+qid` a partir das fontes (mais recente primeiro), com import dinâmico do
  catálogo — o resultado NÃO é gravado no store (derivação é leitura; a gravação
  só acontece no gesto real, regra "nada é inventado").
- Custo controlado: memo por item-chave; itens sem fontes válidas nem tentam.

### D16-0d — Migração e integridade
- Campo OPCIONAL + normalização defensiva no módulo (`normSnippet` — string
  trim, cap 400, nunca inventa): NÃO há bump de versão do AppState (v8
  permanece; `migrateLegacyState` já normaliza o vocabulary em v6–v8,
  `storage.ts:961-1019`); o contrato de normalização do vocab.ts cobre entradas
  antigas e futuras.
- Backup/merge (src/lib/backup.ts:353-411): hoje o lado com `lastSeenAt` maior
  prevalece, `seenCount` soma, fontes deduplicam com teto, box/dueAt ficam com
  o maior e starred é OR. Regra nova: `snippet*` presente em QUALQUER lado
  sobrevive na mescla (preferindo o lado vencedor quando ambos têm) — idem
  `snippetInContext`/`snippetWhy`. Idempotência do merge re-testada (projeto
  13/15 já cobrem vocab).
- Quota: 3 campos novos de ≤240/400 chars por palavra — teto global de 4000
  itens já limita; nenhum item excede ~1,2 kB com os novos campos.

## 4. Versão simples vs completa (F1 — a experiência central)

### D16-1a — Card de lista = versão SIMPLES (menos texto que hoje)
- Palavra: palavra EN (título) + literal em uma linha + faixa de ações
  (🔊 · ★ · 🗑) + linha de metadados (traduzida N vezes + chips de fonte).
  `contextual` SAI do card da lista — mora no sheet completo (o card de hoje
  vira o "índice"; o texto de nota em 2 linhas sob cada card é o excesso que a
  diretriz pede para cortar).
- Frase: frase EN colapsada (`line-clamp-2`, hoje) + literal uma linha quando
  expandida + ações. Sem `contextual` na lista (mesma regra).
- Caixa/vencimento vira UM chip discreto de estado (D16-5a) — o único acréscimo.
- Toque no card (palavra ou frase) ABRIRÁ O SHEET COMPLETO (deixa de expandir
  inline — a expansão inline da frase some em favor do sheet, mesma decisão do
  projeto 12 que matou o balão ancorado).

### D16-1b — Sheet completo via TranslationSheet (container universal)
- A rota /vocabulary abre o `TranslationSheet` existente (portal, focus trap,
  inert, bottom sheet mobile / painel central desktop — zero infraestrutura
  nova). Título = palavra/frase; kicker "Studie Plus · Vocabulário".
- Seções da versão COMPLETA (ordem fixa):
  1. **Recorte** — a frase EN em destaque (padrão visual do sheet de frase:
     `border-l-2 border-primary/30 pl-3 italic`), com o token da palavra
     destacado (`<mark>` estilizado com token secundário — sem cor hardcoded);
     abaixo, a tradução in-contexto (`snippetInContext` ou demanda — D16-2b) e
     o `why` quando existir.
  2. **Tradução** — literal + contextual (a nota atual do item).
  3. **Outros sentidos** — lista de `senses` (o que hoje só aparece na sessão,
     A18 do projeto 14 — finalmente também na navegação).
  4. **Fontes** — SourceChips existentes (volta à questão de origem).
  5. **Áudio** — 🔊 palavra + 🔊 recorte (D16-3a).
  6. **Ações** — favorito, remover (com undo D15-4c preservado).
- Frases: mesmas seções com recorte = `en` (o item é a própria frase) e sem
  seção de sentidos.

### D16-1c — Hierarquia de conteúdo simples/completa é uma função, não copy-paste
- Componente `VocabDetailSheet` (novo, `src/components/plus/`) consome o
  `VocabListItem` + textos derivados; a lista NÃO duplica layout de sheet.
- Estados: item sem recorte → seção 1 omitida (nunca placeholder vazio); item
  sem sentidos → seção 3 omitida; derivação em curso → skeleton de recorte
  (padrão `AiWordSkeleton`), nunca conteúdo falso.

## 5. Tradução do recorte (F2 — inteligência com honestidade)

### D16-2a — O que já veio da IA é exibido sem custo
- Item com `snippetInContext` (IA): a seção Recorte mostra tradução + `why`
  imediatamente, com chip de mecanismo honesto ("IA").
- Item de dicionário sem tradução do recorte: a seção mostra só o recorte EN e
  um gesto claro: "Traduzir este recorte" (botão explícito).

### D16-2b — Tradução sob demanda do recorte (server-only, cache, caps)
- Reuso DIRETO de `translateAiPhrase` (server function existente, handler com
  caps Zod + rate limit + erro único do contrato D15-5c) com
  `sentence = snippet`. Nada de endpoint novo; nada de IA no bundle do cliente.
- Cache ANTES da checagem de disponibilidade (`aiCacheStore.getPhrase` com a
  mesma `phraseCacheKey(type, snippet, contextCacheKey)` — o recorte traduzido
  uma vez volta offline, regra D7/D8).
- Fallback honesto: falha → estado "Tradução não disponível agora" com botão
  para tentar de novo; NUNCA conteúdo inventado; cooldown/créditos usam o
  `aiStatus` existente e o chip de mecanismo (MechanismChip) permanece verídico.
- O resultado sob demanda é EXIBIDO, não gravado no store (a captura continua
  sendo o gesto original; traduzir o recorte não reescreve o item — decisão
  deliberada para não misturar mecanismos num mesmo campo).

### D16-2c — Busca cobre o recorte e os sentidos
- `filterVocab` passa a considerar `snippet` e `senses[].literal` no match
  (lowercase inclui, mesma estratégia atual). Buscar "exame" encontra a palavra
  traduzida como "prova" cuja frase contém "exame".

## 6. Áudio de estudo (F3)

### D16-3a — 🔊 palavra + 🔊 recorte no card e no sheet
- Card da lista (palavra): 🔊 da palavra (hoje) + 🔊 do recorte quando existir
  (compactos, na faixa de ações — `PlusSpeakButton` existente, herda sotaque).
- Sheet completo: bloco de áudio com os dois (rótulos "Ouvir palavra" /
  "Ouvir frase em contexto").
- Regra de áudio do pack respeitada: só inglês; `plusAudio === false` desliga
  tudo (como hoje); áudio NUNCA depende da tradução estar ativa.

### D16-3b — Sequência palavra→recorte (um toque)
- Botão único no sheet: fala a palavra, pausa curta (300 ms), fala o recorte —
  cancelável (novo toque para/reinicia). Implementação local em cima do mesmo
  mecanismo do `PlusSpeakButton` (Web Speech API; sem serviço novo). A pausa é
  constante nomeada no módulo, não mágica.

## 7. Sessão de estudo no contexto (F4)

### D16-4a — Recorte no lado de trás do cartão
- Cartão virado mostra, entre literal e sentidos: o recorte (destaque do token)
  + tradução in-contexto quando existir + 🔊 do recorte. Estudar passa a ser
  "lembrei o sentido no contexto", não "lembrei um par isolado".
- Frente do cartão: sem recorte (revelaria a resposta pela ordem das palavras
  em itens curtos) — a frente continua palavra/frase pura.
- Checagem de retrieval (typedRecall) intocada: o recorte só existe no lado de
  trás; digitação e rotação de sentidos (D15-3c) não mudam.

### D16-4b — Áudio pós-virada
- O 🔊 da frente permanece; após virar, o bloco de áudio do recorte está
  disponível (mesmos componentes de D16-3a — nenhum mecanismo novo).

## 8. Inteligência de fluxo e UX AAA (F5)

### D16-5a — Estado de aprendizado visível (chip de caixa)
- Chip discreto por item: vencido ("Revisar hoje"), caixa alta ("Consolidado",
  caixa ≥4), intermediário ("Em dia") — texto PT honesto, cor por token
  (`primary`/`success`/`muted`, sem cor hardcoded), `title`/aria com a caixa
  exata. Clique no chip = ordenar "Para revisar" não; é só estado (ação
  permanece na sessão).

### D16-5b — Filtros que sobrevivem à navegação
- Estado de filtros persistido pós-mount (padrão de leitura pós-hidratação) em
  chave própria do vocabulário; volta da prática restaura busca/tipo/seção/
  favorita/ordem. "Limpar filtros" limpa o persistido também.

### D16-5c — Copys e acessibilidade
- Todos os rótulos novos em PT-BR do tom do app ("No contexto", "Ouvir frase
  em contexto", "Traduzir este recorte"); `aria-label` em todo botão de ícone;
  sheet herda o focus trap D10/D14-5c; alvos ≥44px; `aria-live` nos estados de
  tradução sob demanda.
- Contraste: nada de âmbar sobre âmbar (regra D14-6b/D15-4a); marcar token no
  recorte usa token secundário legível light+dark.

### D16-5d — Mobile é cidadão de primeira
- Sheet completo já responsivo (TranslationSheet); validação 390×844 nas
  varreduras; lista sem overflow horizontal com chip de estado + ações;
  recorte com quebra de linha e sem `line-clamp` agressivo no sheet.

### D16-5e — Fora de escopo (decisões registradas)
- Sem gamificação nova (streak de vocabulário), sem estatística nova de
  vocabulário no /progress (D15-2a já o mede), sem highlight do trecho na
  questão original (A13), sem modo "lista de estudo" separado, sem mudança no
  SRS de questões ou nos gatilhos de captura na prática.

## 9. Fases (ordem de dependência; ver `roadmap-proj16.md`)

- **F0 · Contratos de recorte** — vocab.ts (campos + norm + derivação),
  SaveVocabWordInput, captura em PlusWordText, backup/merge preservando
  snippet*, testes de fundação.
- **F1 · Simples vs completa** — card enxuto, VocabDetailSheet no
  TranslationSheet, seções 1-6, estados de skeleton/vazio, testes de UI.
- **F2 · Tradução do recorte** — demanda IA com cache/caps/fallback, chip
  honesto, busca cobrindo recorte+sentidos, testes (incl. cache antes da
  checagem e fallback).
- **F3 · Áudio** — palavra+recorte no card/sheet, sequência cancelável, testes.
- **F4 · Sessão no contexto** — recorte pós-virada + áudio, typedRecall
  intocado, testes.
- **F5 · Fluxo e AAA** — chip de estado, filtros persistentes, copys/a11y,
  varredura mobile/axe/console, testes.
- **F6 · Fechamento** — E2E versionado `scripts/e2e/proj16_f0.py` (captura com
  recorte → vocabulário → sheet completo → áudio → sessão com recorte; 11 rotas
  390×844), gates completos, AGENTS.md atualizado (monitor: aviso quando
  voltar).

## 10. Critérios de aceite (por eixo)

- **Recorte**: palavra traduzida em questão com texto → item no vocabulário tem
  snippet da frase real; item antigo sem snippet deriva do catálogo na rota
  (quando derivável); nada é gravado pela derivação.
- **Simples/completa**: lista sem `contextual`; toque abre sheet completo com
  recorte, tradução, sentidos, fontes, áudio, ações; Esc/✕/scrim fecham com
  foco devolvido.
- **Tradução do recorte**: dicionário + botão → tradução com chip; cache
  servível offline; falha → estado honesto, sem inventar.
- **Áudio**: 🔊 palavra e 🔊 recorte no card/sheet/sessão; desligado com
  plusAudio off; sequência cancelável.
- **Sessão**: recorte no lado de trás; typedRecall e regra D15-3a/3c intactos
  (testes existentes continuam verdes sem mudança de expectativa).
- **Gates**: vitest (novos + 645 base) · tsgo limpo · build OK · lint 0/0 ·
  axe 0 nas rotas tocadas · 390×844 sem overflow · console limpo · E2E verde.

## 11. Riscos e mitigação

- **R1. Recorte não encontrado na derivação** (word em transcript/prompt em vez
  de text): derivação tenta os textos disponíveis do catálogo; sem hit → sem
  seção (honesto). Captura futura sempre grava o recorte real do gesto.
- **R2. Crescimento de quota** (3 campos novos): caps aplicados na captura;
  teto global 4000 intacto; backup idempotente re-testado.
- **R3. Regressão no fluxo de tradução da prática**: PlusWordText muda só os
  call sites de captura (+args), não o fluxo IA/cache/fallback — testes do
  projeto 11/12/13 (fase2-captura, fase3-ai-palavra, proj12-sheet,
  plus-integration) são a rede e NÃO devem mudar de expectativa.
- **R4. Áudio em iOS/Safari**: mesmo mecanismo já usado em produção pelo app;
  sequência usa o mesmo objeto de fala (sem API nova).
- **R5. Scope creep da "completa"**: seções são fechadas (§4/D16-1b); qualquer
  ideia nova entra como D16-x nova no PRD, nunca como ad-hoc no código.
- **R6. Ocorrência errada do recorte em palavra repetida**: `sentenceFor` pega
  a primeira frase que contém a substring (`PlusWordText.tsx:50-55`) — a mesma
  limitação da IA hoje; aceitável porque o recorte é EXATAMENTE o contexto que
  a IA viu (consistência > precisão de ocorrência). Correção estrutural
  (índice do token → frase) fica registrada como melhoria futura, não nesta
  execução.

## 12. Matriz de arquivos

| Área | Arquivos |
|---|---|
| Contratos | `src/lib/plus/vocab.ts` (campos, norm, derivação), `src/lib/backup.ts` (merge), `src/lib/storage.ts` (mutator saveVocabWord) |
| Captura | `src/components/plus/PlusWordText.tsx` (snippet + inContext/why na captura) |
| UI vocabulário | `src/routes/vocabulary.tsx` (card simples, chip de estado, filtros), NOVO `src/components/plus/VocabDetailSheet.tsx`, `src/components/plus/VocabSnippet.tsx` (recorte + token destacado + tradução) |
| Áudio | `src/components/plus/PlusSpeakButton.tsx` (uso, não reescrita), sequência em `VocabSnippet.tsx`/sheet |
| Sessão | `src/routes/vocabulary.tsx` (StudySession — lado de trás) |
| IA sob demanda | `src/lib/plus/ai-translate.functions.ts` (consumo, sem handler novo), `aiCache.ts`/`aiStatus.ts` (uso) |
| Testes | NOVO `src/test/proj16-fase{0..5}*.test.tsx` |
| E2E | NOVO `scripts/e2e/proj16_f0.py` |

## 13. Decisões rápidas (registro único)

- D16-A: `snippet` opcional e sem bump de versão — normalização cobre.
- D16-B: derivação é leitura pós-mount por item visível (memo), nunca
  passada em initializer de estado.
- D16-C: tradução sob demanda do recorte NÃO grava no store (mecanismo IA não
  reescreve o item capturado).
- D16-D: a expansão inline do card de FRASE na lista é substituída pelo sheet
  (toque único, um comportamento só de abrir detalhe).
- D16-E: monitor permanece fora desta execução (indisponível); aviso
  `monitor-notice-proj16.md` fica pendente para quando retornar.
- D16-F2 (execução da Fase 2, registro de decisões):
  (1) `taskType` da demanda = type da fonte MAIS RECENTE (`sources[last]`),
  fallback `originType`; sem fonte alguma → estado honesto "não disponível" (o
  recorte veio de algum lugar, mas o contrato do handler exige um tipo);
  (2) a demanda existe só para PALAVRAS — a frase é o próprio recorte e já tem
  tradução própria;
  (3) a tradução capturada (`snippetInContext`) só é exibida quando o snippet
  efetivo === snippet capturado (nunca tradução de outra frase);
  (4) o chip do mecanismo só aparece quando há tradução em exibição ou chegando
  — falha não exibe tradução, logo não exibe chip;
  (5) a demanda reaproveita o dedupe de chamadas em voo (D10) e o skeleton de
  carregamento é próprio (linha pulsada), não o do recorte em derivação.
- D16-F3 (execução da Fase 3, registro de decisões): a sequência palavra→recorte
  e o bloco de áudio do sheet vivem em `src/components/plus/VocabAudio.tsx`
  (novo; a matriz §12 apontava VocabSnippet/sheet — separado para manter
  VocabSnippet "só conteúdo"); `SectionLabel` passou a ser exportado do
  `VocabDetailSheet` (um único estilo de rótulo). Card da lista: 🔊 do recorte
  só para palavras com snippet (frases já são o recorte).
