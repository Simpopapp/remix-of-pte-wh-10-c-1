# PRD — Project 15 (estudo profundo → melhorias substanciais)

Origem: `.opencode/project15.md` — "Estudar profundamente o projeto e entender profundamente os
propósitos dele bem como cada pagina e recurso individualmente, pra planejar de forma muito bem
elaborada as proximas melhorias de forma significativa e substancial em tudo que puder e fizer
sentido ser melhorado".

Status do estudo: **concluído**. Quatro investigações paralelas read-only (`spawn_agent`,
pilares por subagente em `.opencode/work/sub/15/s{K}/`), consolidadas aqui:

| Recorte | Agent ID | Entrega |
|---|---|---|
| s2 · mapeamento funcional (11 rotas + fluxos) | sub_90n4smvw | inventário factual por rota |
| s3 · auditoria técnica (integridade/perf/robustez/testes/smells) | sub_rdw9ab1c | 5 seções priorizadas |
| s4 · UX/design (consistência, interação, IA, a11y, copy) | sub_jcd5bx35 | top 3 por seção |
| s5 · loop de aprendizado (prática/SRS/exame/progresso/IA) | sub_73wezwa9 | gaps + ranking ≤8 |

**Decisão de execução (registrada, repetindo o precedente dos projetos 13–14):** nesta plataforma
os subagentes `spawn_agent` são somente-leitura — eles investigam; TODA edição de código é do
agente principal, que também verifica contra os critérios de aceite e roda os gates (Plan.md §50
fluxo 7–8). Relato de subagente é alegação, nunca prova: cada achado listado abaixo só vira fase
após confirmação direta no código.

## Síntese do estudo (o que o projeto é hoje)

- **Produto:** Studie Plus — estudo para o PTE, local-first (AppState v8 em localStorage),
  11 rotas (Home, practice, session, exam, progress, 4 seções, vocabulary, settings),
  graders IA server-only (essay/SWT), cache IA central, SRS Leitner duplo (questões e vocab),
  backup/merge idempotente, PWA offline com precache gerado pelo build.
- **Estado de saúde:** baseline verde neste remix — vitest 584/584 · tsgo limpo · build OK com
  precache (122 assets) · lint 0 erros (12 warnings) · E2E versionados do projeto 13/14 no lugar.
- **Falha central do loop (s5):** o sistema registra scores mas não fecha o ciclo
  **erro → revisão direcionada → retry → transferência verificada**. O learner pode "melhorar"
  por repetição sem nunca demonstrar a correção; e a recomendação prioriza vocabulário
  incondicionalmente e usa *historical best* (pode apontar para a pergunta errada).
- **Falha de integridade (s3):** identidade de `Attempt` prometida mas não implementada (id
  opcional, merge por campos mutáveis), `mergeDaily` inflama reimportações com histórico
  truncado, cross-tab pula invalidação de derivados, validação de backup quebra em `null`.
- **Falha de robustez (s3):** SW com versão fixa "5" (deploy novo não reinstala shell),
  fallback offline só em exceção de rede, contrato de erro de server function incompleto,
  `navigator.onLine` em initializer de estado (risco de hidratação).
- **Falhas de UX (s4):** contrastes de âmbar usando token errado no dark (`text-warning-foreground`
  em fundo translúcido), copy PT misturada com EN ("task types"), pluralização estilo
  implementação ("questão(ões)"), cópia de relatório que relata sucesso não verificado,
  sem desfazer na exclusão de vocabulário, ícones de Sessão/Simulado sem rótulo no mobile.
- **Custo de manutenção (s3):** ExamRunner 1.808 linhas duplica a orquestração IA da prática;
  validação de backup duplicada em dois módulos; documentação de migração defasada (v7 vs v8).

## Prioridade do project15 (derivada do ranking do s5 + s3)

1. Fechar o ciclo de aprendizado (erro → revisão → retry → transferência não vista).
2. Integridade primeiro: identidade de tentativas e idempotência real do merge (sem isso,
   qualquer feature nova herda a fragilidade).
3. Métricas honestas e recomendação por necessidade atual.
4. SRS de vocabulário com rigor (promoção por vencimento, checagem de retrieval).
5. UX/acessibilidade/copy (AAA) + robustez offline/erros.
6. Manutenção: desduplicação das orquestrações IA e alinhamento de docs.
7. Fechamento AAA com E2E versionado e varredura final.

## Princípios deste project15

- **Otimizar, não acumular** (continuidade do projeto 14): melhorias que fecham ciclos > features novas.
- **Honestidade como requisito:** todo rótulo/métrica diz o que de fato mede; agregados com
  amostra insuficiente se rotulam.
- **Dados primeiro:** nada de feature nova anda sobre identidade/idempotência frágeis.
- **Local-first preservado:** sem login, sem backend de estado de usuário; IA continua server-only.
- **Contraste e a11y não são opcional:** âmbar só via `--warning-ink` em texto; axe 0 nas rotas tocadas.

---

# Escopo por fase

## F0 · Contratos de integridade (fundação)

**Problemas confirmados (evidência s3, a verificar linha a linha antes de editar):**
- `Attempt.id` é opcional e `recordAttempt` não gera id; normalização descarta id;
  merge usa composição de campos de score mutáveis → mesma tentativa regravada com nota
  diferente duplica; tentativas distintas idênticas colapsam. (src/lib/storage.ts:39–49,
  614–636, 1255–1270; src/lib/backup.ts:127–145, 263–269)
- `mergeDaily` soma agregados dos dois lados quando nenhum cobre o dia → reimportar o mesmo
  backup com histórico truncado infla attempts/scored/sum; quando só um lado cobre, reconstruir
  da união pode descartar totais do outro. (src/lib/backup.ts:215–250)
- Listener de cross-tab troca `state` sem `invalidateDerived` → cache de estatísticas fica
  velho; troca de estado inteira permite last-writer-wins entre abas. (src/lib/storage.ts:1150–1178, 1207–1224)
- Validação de backup faz cast e acessa campos de `parsed` sem checar objeto não-nulo →
  importar `null` lança exceção em vez de erro de validação. (src/lib/backup.ts:59–77; src/lib/storage.ts:1468–1486)
- Documentação defasada: comentário de `Attempt` promete identidade estável que não existe;
  migração comenta v1–v7 sem v8. (src/lib/storage.ts:45–49, 900–908)

**Decisões técnicas:**
- D15-0a Gerar `id` determinístico na criação de toda tentativa (mesma função determinística
  já contratada no projeto 13), preservá-lo na normalização/migração; no merge, dedupe por `id`
  com fallback ao comparador legado para dados antigos sem id.
- D15-0b Política declarada para `mergeDaily` com histórico truncado: manter a união de
  evidências (tentativas retidas) e usar *checkpoints* por dia (maior evidência de cobertura
  vence; nunca somar dois agregados que podem descrever o mesmo dia duas vezes).
- D15-0c Listener de StorageEvent passa pelo mesmo caminho de `setState` (invalidação de
  derivados incluída).
- D15-0d Um único parser/validador de envelope de backup (null-root, version, arrays) usado
  por preview e import.
- D15-0e Docs alinhadas ao comportamento real (id + v8).

**Critérios de aceite:**
- Teste novo: round-trip id (criar → exportar → importar → id preservado); mesmo id com nota
  alterada NÃO duplica; ids distintos com payloads idênticos NÃO colapsam.
- Teste novo: reimportar 3× backup com histórico truncado não infla daily aggregates.
- Teste novo: evento StorageEvent após aquecer caches de stats recalcula derivados.
- Teste novo: `null` como raiz de backup retorna erro de validação, não exceção.
- Gates: vitest 100% · tsgo · build · lint 0 erros.

## F1 · Ciclo de aprendizado fechado (o maior gap do s5)

**Problema:** erros corrigidos não geram verificação. Score baixo só muda data de revisão
(src/lib/storage.ts:421–446; src/lib/session.ts:531–541); feedback IA (gramática/coesão) não
cria revisão obrigatória nem checagem de recorrência (AiGradeFeedback.tsx:89–116;
next-action.ts:33–48); sessão de erro reusa as MESMAS questões sem verificação de transferência
em item novo comparável (src/lib/session.ts:468–484); preenchimento de sessão com revisões
antecipadas acontece silenciosamente (src/lib/session.ts:263–279).

**Decisões técnicas:**
- D15-1a **Erros IA persistidos por questão:** categorias de erro do grader IA (gramática,
  coesão, conteúdo…) entram no `Attempt`/snapshot como lista rotulada, com merge idempotente.
- D15-1b **Fila de correção:** após feedback de erro (básico ou IA), a questão entra numa fila
  de "correção pendente": retry direto da mesma questão com foco no erro citado
  (o próprio feedback aponta "Próximo passo" = tentar de novo / ver o erro).
- D15-1c **Verificação de transferência:** quando o retry da correção passa, o construtor da
  sessão de erro agenda 1 questão NÃO vista e comparável do mesmo tipo (se houver banco
  disponível); é a prova de que a habilidade transferiu.
- D15-1d **Rotulagem honesta do preenchimento:** quando a sessão usa revisões antecipadas
  (não vencidas), o resumo/rótulo da sessão marca "treino extra" explicitamente.
- D15-1e Paridade prática/exame: mesmo contrato de erros para os dois caminhos.

**Critérios de aceite:**
- Teste: tentativa reprovada → fila de correção registrada; retry aprovado → sessão de erro
  passa a incluir questão não vista do mesmo tipo quando existir.
- Teste: categorias IA sobrevivem a export/import/merge sem duplicar.
- Teste: sessão com revisão antecipada carrega rótulo "treino extra" no resumo.
- Gates: vitest · tsgo · build · lint · E2E essay com IA real/fallback mostra o passo seguinte.

## F2 · Recomendação e métricas honestas

**Problemas:** recomendação prioriza vocabulário vencido incondicionalmente e usa *historical
best* para escolher a questão (src/lib/next-action.ts:22–56); agregados misturam semântica
(best histórico nos tópicos, latest nos tipos) e deterioração pode sumir da lista de fracos
(src/lib/progress-overview.ts:36–79); média de período não separa repetições de itens já vistos
(src/lib/progress-analytics.ts:28–55); readiness mistura prática e exame sem distinguir
item não visto (src/lib/pte/readiness.ts:50–74); sinais existentes (atraso vs antecipado,
lapses, métricas de fala) não aparecem em progresso (src/lib/storage.ts:424–434;
src/lib/pte/speaking.ts:53–65).

**Decisões técnicas:**
- D15-2a `buildNextAction` ranqueia por necessidade atual: recência da fraqueza (última
  tentativa), severidade do lapse (queda entre tentativas), vencimento de vocab ponderado
  (não mais incondicional); critério de desempate registrado e testado.
- D15-2b Semântica única para "fraco": latest score em tipos E tópicos, com best disponível
  como contexto secundário rotulado.
- D15-2c Progresso separa resultados: prática nova vs repetição de item vs revisão vencida vs
  exame; a comparação de períodos rotula a mistura e o n de itens não repetidos.
- D15-2d Cartão de evidência em /progress: taxa de sucesso em revisões VENCIDAS vs antecipadas,
  lapses recentes e (quando houver) trajetória de componentes de fala (ritmo/pausas).
- D15-2e Readiness distingue cobertura de itens não vistos e rotula confiança de repetidos.

**Critérios de aceite:**
- Teste: questão que piorou recentemente bate questão com best histórico pior mas última boa.
- Teste: vocab vencido não esmaga recomendação de prática quando há lapse severo recente
  (regra registrada no PRD/teste).
- Teste: revisões vencidas vs antecipadas contadas separadamente; n<3 rotulado.
- Gates: vitest · tsgo · build · lint.

**Decisões registradas na execução (F2 concluída):** modelo de necessidade =
`(fraquezaAtual + 2·lapso) · recência` (meia-vida 7 dias; fraqueza = 90 − última nota;
lapso = queda entre as duas últimas tentativas com score); vocabulário = 8 pts por item
vencido, teto 15; desempate: tentativa mais recente → ordem alfabética do tipo. Ação de
prática aponta a questão com pior ÚLTIMA nota (desempate: pior best). Nova classificação
de tentativas em `progress-evidence.ts` (folha): primeira/vencida/antecipada via replay do
SRS (applyAttemptToSnapshot) + tag "exam" do ExamRunner; `passScoreFor` define o acerto.

## F3 · SRS de vocabulário com rigor

**Problemas:** promoção de vocab não checa vencimento (src/lib/plus/vocab.ts:389–399),
autorrelato binário sem retrieval (vocabulary.tsx:648–665), mastery única mascara sentidos
não dominados (src/lib/plus/vocab.ts:57–66).

**Decisões técnicas:**
- D15-3a Promoção de caixa só quando o item está vencido (paridade com o SRS de questões,
  regra central em vocab.ts, única fonte).
- D15-3b Checagem de retrieval opcional mas real: no estudo de flashcards, "lembrei" em item
  vencido pode pedir a digitação do termo (modo escolhido nas configurações de estudo);
  falha no typed recall demove uma caixa (honestidade do autorrelato).
- D15-3c Sentido por contexto: quando a checagem pede digitação em item multi-sentido, o
  sentido pedido roda entre os acumulados; sentidos errados recorrentes ficam visíveis no
  cartão (sem novo schema de mastery por sentido — decisão: simplicidade, rótulo no cartão).

**Critérios de aceite:**
- Teste: "lembrei" em item não vencido NÃO promove caixa (e não demove).
- Teste: typed recall errado demove uma caixa; certo promove (vencido).
- Teste: modo digitado pode ser desligado; comportamento atual preservado quando desligado.
- Gates: vitest · tsgo · build · lint.

**Decisões registradas na execução (F3 concluída):** `applyVocabStudy` — "lembro" só promove
com `dueAt ≤ ts` (caixa/prazo intactos no treino antecipado); "não lembro" sempre demove.
Typed recall (`typedRecall` em PlusSettings, default OFF) aplica-se só a PALAVRAS; falha
revela a resposta, demove via "não lembrei" (Continuar) e registra o sentido no draft
(`missed`, chaves `kind:key:sentido`), exibido como selo "errou nesta sessão" no cartão.
Rotação do sentido pedido = nº de aparições do cartão na fila mod k (determinística,
sobrevive à retomada). Comparação tolerante (minúsculas/acentos/pontuação) em vocabStudy.ts.

## F4 · UX AAA (consistência, contraste, copy, IA)

**Problemas confirmados (s4, verificáveis no código):**
- Contraste: `text-warning-foreground` sobre `bg-warning/10` em QuestionRow (dark quase-preto
  sobre âmbar translúcido) — trocar por `text-warning-ink` (QuestionRow.tsx:54,62);
  `text-warning` informativo em PassageText.tsx:16 e TemplateWarning.tsx:11.
- Copy: "{TYPE_COUNT} task types" → "tipos de tarefa" (TopNav.tsx:31–32,55);
  "questão(ões) exibidas" (SectionPage.tsx:276–277); pluralização correta.
- Honestidade: cópia de relatório ignora resultado do fallback (progress.tsx:71–85) —
  mensagem de falha explícita; previews falhos indistinguíveis de ausentes (SectionPage.tsx:31–49).
- Destrutivo sem desfazer: exclusão de vocab direto (vocabulary.tsx:432) — confirmar + desfazer
  (snapshot do item) com snackbar de desfazer.
- IA de informação: Sessão/Simulado sem rótulo visível no header mobile (TopNav.tsx:70–92);
  Habilidades sem estado ativo/aria-current no link ativo (TopNav.tsx:44–47,54–64).
- Headings: settings usa h2 para categoria e para card (settings.tsx:421–429,661) — h3 nos cards.
- Elevation: shadow-sm em primitives vs escala shadow-card/pop/sheet (textarea.tsx:10,
  toggle.tsx:14, sonner.tsx:12) — alinhar à escala da marca.

**Decisões técnicas:**
- D15-4a Âmbar de texto SEMPRE `--warning-ink`; checagem nos dois temas (axe + inspeção).
- D15-4b Copy PT unificada (nomes oficiais de task types continuam em EN onde educacional).
- D15-4c Undo de exclusão via snapshot do item + toast com ação "Desfazer" (janela de 10s);
  padrão reutilizável (não só vocab).
- D15-4d Navegação: rótulos compactos no header mobile; `aria-current="page"` na habilidade
  ativa e destaque no trigger Habilidades.
- D15-4e Headings/elevation padronizados onde indicado, sem reestilizar tudo.

**Critérios de aceite:**
- Varredura: rotas tocadas com axe 0 violações; contraste dos selos âmbar AA nos 2 temas.
- Sem "questão(ões)"/"task types" no bundle; relatório de cópia tem caminho de falha.
- Exclusão de item de vocab tem Desfazer funcional (teste + E2E).
- Gates: vitest · tsgo · build · lint · Playwright nas rotas tocadas (390×844, console limpo).

## F5 · Robustez offline e erros

**Problemas:** SW fixo em "5" — deploy novo com chunks novos pode não reinstalar o shell
(public/sw.js:10–12,31–42; scripts/gen-sw-assets.mjs:38–40); fallback offline só em exceção de
rede (sw.js:114–127); contrato de erro de server function incompleto (parse/import dinâmico
fora do catch — ai-grade.functions.ts:41–48); `navigator.onLine` em initializer
(PlusWordText.tsx:99, PlusPhraseCard.tsx:87); import de backup pode relatar ok sem persistir
(storage.ts:1108–1131, 1488–1500); rate limit por chave client-supplied (rotável)
(src/server/rate-limit.ts:3–17,47–72).

**Decisões técnicas:**
- D15-5a `gen-sw-assets.mjs` escreve versão/cache-name derivada do build (hash do manifest)
  no sw.js de saída (VERSION por build; arquivo-fonte sem literal fixo).
- D15-5b Fallback do SW também para respostas de navegação 5xx com cache disponível.
- D15-5c Contrato de erro único: parse do body e imports dinâmicos dentro do catch do handler;
  clientes mantêm fallback de transporte; erro observável distinto.
- D15-5d `navigator.onLine` só pós-mount (estado `useSyncExternalStore`/useEffect) —
  nada de leitura browser-only em initializer.
- D15-5e Import: persistência confirmada antes de `ok:true`; falha de persistência vira
  resultado explícito (com undo preservado).
- D15-5f Rate limit: bucket global por processo mantido, mas rejeições por chave NÃO consomem
  o bucket global (contabilização só de pedidos aceites) e chave derivada também do tamanho
  do payload (anti-abuso barato, sem backend).

**Critérios de aceite:**
- Teste: duas builds diferentes → sw.js com cache-name diferentes (script testado).
- Teste: rejeição por chave não drena bucket global; 241º request no bucket falha.
- Teste: handler com body inválido retorna `ok:false` tipado (não exceção crua).
- Teste: import com undo-write falhando relata resultado honesto.
- Gates: vitest · tsgo · build (precache regenerado) · lint.

## F6 · Manutenção: desduplicação e higiene

**Problemas:** ExamRunner 1.808 linhas duplica orquestração IA da prática (cache lookup,
request, write, erro — useAiGrade.ts:44–74 vs ExamRunner.tsx:1086–1121); validação de backup
duplicada (fechada na F0); exports sem consumidores (keyToMidnight, isBeforeDayKey,
typesOfSection, flushAiCache, essayContentWords — dates.ts:12,38; offline.ts:120;
aiCache.ts:225; essay.ts:95).

**Decisões técnicas:**
- D15-6a Serviço IA compartilhado: um módulo único de orquestração (cache→request→cache
  write→erro tipado) consumido por prática e exame; proteção de stale-response da prática
  preservada no hook.
- D15-6b ExamRunner perde a orquestração IA e avaliação pura compartilhada (extração
  cirúrgica; SEM reescrever o timed-UX — diferenças intencionais ficam).
- D15-6c Exports não usados: restrinja visibilidade (não deletar consumidores externos);
  verificado por rg antes de cada mudança.
- D15-6d Warnings de lint (12) varridos: corrigir os baratos, documentar os deliberados.

**Critérios de aceite:**
- Uma única implementação de orquestração IA (rg confirma 1 consumidor interno comum).
- ExamRunner com < 1.700 linhas e sem lógica de cache/request própria.
- Gates: vitest · tsgo · build · lint · E2E essay (prática e exame) verde.

## F7 · Fechamento AAA

- E2E versionado novo `scripts/e2e/proj15_f7.py`: correção→retry→transferência (F1),
  recomendação por lapse (F2), undo de exclusão de vocab (F4), 11 rotas 390×844
  (overflow 0 · axe 0 · console limpo).
- Gates completos: vitest 100% · tsgo · build · lint 0 · E2E verde.
- AGENTS.md raiz atualizado (decisões estruturais novas); aviso ao monitor em
  `.opencode/monitor-notice-proj15.md` (monitor indisponível — registrar pendente).

## Não-objetivos deste project15

- Backend de estado do usuário / login (local-first é premissa do produto).
- Reavaliação acústica de pronúncia (proxy atual é rotulado e mantido).
- IndexedDB para AppState (persistence atual serve; medição não justificou).
- Reconstrução visual completa (melhorias cirúrgicas guiadas por evidência).

## Riscos

- Identidade de tentativa (F0) toca todo o histórico: migração deve PRESERVAR ids quando
  existirem e gerar quando faltarem, sem mudar semântica de merges legados (fallback).
- F1/F2 alteram comportamento visível de recomendação: testes do projeto 14 podem exigir
  atualização justificada (causa real, nunca mascarar).
- Split do ExamRunner (F6) é cirúrgico: extração sem reescrita; gates de E2E como rede.

## Gates globais (seção 19 do Plan.md, por fase)

vitest (`bunx vitest run`) · tsgo limpo · `bun run build` · lint 0 erros · Playwright/axe nas
rotas tocadas · E2E versionado no fechamento. Marcar `[x]` no roadmap apenas com gates verdes
e números reais.
