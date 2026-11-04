# PRD — Project 18 · Melhorias de alto impacto alinhadas ao propósito central

Status: vigente · Fonte: `project18.md` (diretriz) · Evidência: 3 auditorias
paralelas read-only (conteúdo/Tipos de tarefa · motor de prática/feedback ·
progresso/SRS/dados) concluídas antes deste documento, com verificação direta dos
achados críticos no código e nos dados. Precedência de escopo: project18 >
este PRD > roadmap.

---

## 0. Sumário executivo

O propósito central do app é **preparar o usuário para a nota-alvo no PTE
Academic** com prática por tipo de tarefa, feedback honesto e simulado. O app já
tem uma base sólida: 2.618 questões em 22 categorias internas, motores de prática
para todos os tipos marcados `ready`, correção IA (essay/SWT), SRS de questões e
de vocabulário, estimativas de preparação e backup/merge robustos (projetos 9–17).

As auditorias mostram que o gargalo de valor NÃO é mais aparência (projeto 17
fechou a varredura visual) — é a **integridade e a profundidade do ciclo de
estudo**: um tipo de tarefa quebrado por construção (HIW), uma paridade prática/
exame faltando no veredito de fala, IA ausente no tipo de escrita mais cobrado
fora do essay (SST), recomendação que ignora a meta e a cobertura do usuário,
readiness que aceita repetição de itens conhecidos como "pronto", revisão do
simulado que perde o que o usuário escreveu/falou, recuperação de vocabulário
que testa sempre o mesmo sentido, e lacunas de conteúdo nos tipos oficiais mais
recentes. Este projeto corrige a integridade primeiro, aprofunda o feedback
depois, alinha a inteligência de progresso com a meta, e fecha as lacunas de
conteúdo de maior impacto — sempre com os gates do Plan.md §19.

---

## 1. Problemas (síntese das auditorias, com evidência)

### 1.1 Conteúdo e integridade (auditoria 1)

- **HIW quebrado por construção (crítico, verificado no disco)**: os 3 itens de
  `lst_hiw` (`src/data/pte/lst_hiw.json`, objeto com `questions[3]`) têm `text`
  mas NÃO têm `transcript`; o normalizador faz fallback `transcript/audioText →
  text` (`src/lib/pte/catalog.ts:118-120`), o TTS lê exatamente o texto exibido,
  e o gradador cobra "erros" (`errors`) que não existem no áudio — a tarefa é
  impossível como concebida. A explicação do 1º item afirma discrepâncias
  ("gaining" vs "losing", "1980s" vs "1990s") que só existem no texto exibido.
- **Tipo oficial ausente**: o Reading "Fill in the Blanks" oficial é drag-and-
  drop com banco compartilhado de palavras; o app só tem `read_fib` dropdown
  (`src/lib/pte/types.ts:109-112`) e o blueprint full do simulado omite o tipo
  explicitamente por causa disso (`src/lib/pte/exam.ts:125-131`).
- **Bancos finos nos tipos oficiais**: `describe_image` 6 · `lst_hcs` 3 ·
  `lst_hiw` 3 · `lst_smw` 3 · `lst_mcq_multi` 3 · `lst_mcq` 6 ·
  `summarize_group_discussion` 13 · `mcq_multi` 18. WFD+RS concentram 58% do
  banco (1.520/2.618) — a prática fica desbalanceada em relação ao exame.
- **Sem modelos de resposta nos tipos de fala/áudio**: 115 itens de
  `summarize_spoken_text` e 81 de `retell_lecture` não têm `sample`
  preenchido; o gradador de RTS usa `question.sample || question.text`
  (`ExamRunner.tsx:134-139`) — sem `sample`, o julgamento fica mais fraco.
- **Contagem de tipos enganosa**: `lst_summary` é categoria interna extra
  (50–70 palavras, ~10 min), não tipo oficial — a paridade "22 tipos" inclui
  uma categoria que sobrepõe o SST. Não é bug, mas a UI deve continuar honesta.
- **Procedência**: 1.728 itens são de fontes de predição/IA contra 543
  verificados; a UI já rotula (C2) — o projeto NÃO remove itens, apenas não
  amplifica fontes não verificadas em novos conteúdos sem rotulagem honesta.

### 1.2 Motor de prática e feedback (auditoria 2)

- **Correção IA só cobre essay e SWT**: o contrato de `runAiGrade` aceita só
  `kind: "essay" | "swt"` (`src/lib/plus/aiGradeRun.ts:8-15`); SST — resumo de
  50–70 palavras sobre áudio, altamente cobrado no exame — fica só com cobertura
  de palavras-chave e contagem de palavras (`SstPractice.tsx:81-86,234-289`).
- **Paridade oral prática×exame quebrada no exame (verificado)**: o gradador de
  retell retorna `gradable: false` para fala insuficiente (`speaking.ts:97-108`),
  e o `decideOralVerdict` respeita isso (`oralPolicy.ts:71-80`), MAS o adaptador
  do exame `gradeSpeechQuestion` retorna só `{ score }`
  (`ExamRunner.tsx:115-145`), descartando `gradable` — fala insuficiente vira
  nota numérica (0) no simulado quando a prática registra "não avaliável".
- **Recuperação de falha de IA é só informativa**: o estado "indisponível" do
  `AiGradeFeedback` mostra mensagem sem botão de retry
  (`AiGradeFeedback.tsx:55-65`); no exame o botão inicial desaparece após a
  falha (`examReview.tsx:60-70`). O usuário perde a análise sem caminho de volta.
- **Heurística declarada**: fluência é "proxy" (`scoring.ts:252-263`,
  `speaking.ts:71-110`) e o score de essay é forma 30 + cobertura 45 +
  estrutura 25 (`essay.ts:71-80`). O PRD NÃO promete reescrever graders
  determinísticos — a IA é a camada semântica onde existir.

### 1.3 Simulado e revisão (auditoria 2)

- **Revisão perde dados**: respostas orais truncadas em 500 caracteres e
  referências em 300 (`ExamRunner.tsx:1191-1198,1264-1272`); `referenceFor` não
  tem caso para essay → exibe "—" (`examReviewShared.ts:25-64`); o registro
  persistido do simulado guarda só qid/score/WPM — a revisão rica não é
  reconstrutível depois de recarregar a página.
- **Fidelidade declarada como aproximada**: tempos "oficiais aproximados"
  (`exam.ts:13-18`) e prazos por questão em vez de orçamento por seção. O PRD
  NÃO promete cronometragem oficial perfeita — mantém o modelo atual, documentado.

### 1.4 Progresso, SRS e dados (auditoria 3)

- **Recomendação ignora a meta**: `buildNextAction` usa alvo fixo de 90% e não
  lê `settings.targetScore`, `examDate`, cobertura de tipos/habilidades nem a
  fila de vencidos/correção pendente (`next-action.ts:17-26,51-83,87-148`);
  usuários treinam tipos familiares enquanto tipos inteiros ficam sem medição.
- **Readiness aceita repetição como prova**: confiança por contagem de
  tentativas vitalícias e penalidade pequena de cobertura (`readiness.ts:178-224,
  246-260`) — repetir itens conhecidos sustenta rótulo "Quase pronto/Pronto"
  sem evidência de transferência para itens inéditos.
- **Recuperação de vocabulário rasa**: recall digitado compara igualdade
  normalizada exata (`vocabStudy.ts:101-114`), ativa para todas as palavras
  (não só vencidas) e nunca para frases; o cursor de rotação de sentidos não
  persiste entre filas (`vocabStudy.ts:87-98`) — a 1ª passada continua testando
  o sentido inicial das palavras que acertam de primeira.
- **Mescla de backup pode desfazer lapsos**: o merge do vocabulário escolhe a
  caixa mais avançada/deadline mais distante (`backup.ts:353-357,381-422`) —
  restaurar um backup antigo cancela uma demotação recente, atrasando revisão
  necessária.
- **Schema real é AppState v8** (`storage.ts:216-250`), não v7; retenção de 2.000
  tentativas classifica repetições antigas como "primeiro contato" quando o log
  trunca (`progress-evidence.ts:33-53`).

---

## 2. Objetivo central e critério de priorização

Toda melhoria deste projeto responde "isso deixa o usuário mais perto da nota-
alvo no PTE?". Filtro aplicado às 3 auditorias:

1. **Corrigir o que quebra valor** (HIW impossível, paridade oral, retry IA) —
   antes de qualquer coisa nova.
2. **Profundizar o feedback onde o exame mais cobra** (IA no SST; revisão fiel
   do simulado como material de correção).
3. **Alinhar a orientação com a meta** (recomendação e readiness honestos).
4. **Fechar lacunas de conteúdo de alto impacto** (tipo oficial ausente e
   bancos finos nos tipos 2025/listening).

Fora do escopo (não-objetivos): cronometragem oficial por seção, gravação de
áudio real, grader semântico local offline, substituição do `lst_summary`,
reescrita visual (projeto 17 fechou), validação empírica contra notas reais.

---

## 3. Decisões técnicas

- **D18-0a · HIW volta a ser possível**: cada item de `lst_hiw` ganha
  `transcript` com a versão FALADA que difere do texto exibido exatamente nas
  posições de `errors` (substituições plausíveis, 1 palavra por posição,
  coerentes com a `explanation` existente). O normalizador DEIXA de fazer
  fallback `transcript→text` para `lst_hiw`: item sem `transcript` distinto não
  entra em fila de treino (exposto como "em breve"/excluído) — defeito de dados
  nunca mais silencioso. Teste de contrato: para TODO item de lst_hiw,
  `transcript != text` e as posições de erro divergem.
- **D18-0b · Paridade oral no exame**: `gradeSpeechQuestion` passa a retornar o
  resultado completo do gradador (incl. `gradable`) e o widget de fala do
  simulado aplica `decideOralVerdict` — fala insuficiente → `score: null`,
  causa `not_gradable` (mesma semântica da prática). Nenhuma duplicação da
  política: `oralPolicy.ts` continua ÚNICO ponto de verdade (regra do AGENTS.md).
- **D18-0c · Retry de IA universal**: `AiGradeFeedback` ganha ação de retry no
  estado indisponível (chama `runAiGrade` de novo — cache-first preservado) e o
  botão de análise do exame sobrevive à falha. Erros tipados do gateway
  continuam únicos via `aiGradeRun` (regra do AGENTS.md).
- **D18-1 · IA no SST**: `kind: "sst"` entra no contrato de `runAiGrade`
  (schemas Zod próprios: content/form/grammar/vocabulary/spelling + resumo do
  examinador + nextAction), prompt dedicado em `aiGradePrompts.ts`, handler
  server-only aceita o novo kind (payload cap igual), `SstPractice` consome via
  `runAiGrade` + `AiGradeFeedback`. O score de progresso continua o local
  (separação "básica vs IA" preservada, D15).
- **D18-2 · next-action v2**: continua puro e testado; passa a ler
  `settings.targetScore` (meta ≤ 90 ajusta o alvo de fraqueza por tipo),
  `examDate` (janela ≤ 14 dias prioriza cobertura de tipos/habilidades em
  falta e simulado), a fila de correção pendente (prioridade máxima) e tipos
  nunca tentados (ação de diagnóstico abre a 1ª questão do tipo). Desempate e
  pesos documentados no próprio módulo; testes com valores concretos.
- **D18-3 · Readiness honesto**: confiança passa a exigir DIVERSIDADE
  (itens únicos distintos) e EVIDÊNCIA DE TRANSFERÊNCIA (contato com itens
  inéditos do tipo); repetição do mesmo item não sobe confiança; rótulos
  mantêm os thresholds atuais; aviso de frescor quando a tentativa mais recente
  do tipo for > 14 dias. Estimativa continua rotulada "treino".
- **D18-4 · Revisão fiel do simulado**: o resultado de cada questão do
  simulado persiste a resposta submetida (texto integral até cap 2.000; fala
  idem) e a causa; a revisão reconstrói a tela a partir do registro persistido
  quando o estado vivo não existe (reload/retomada); `referenceFor` ganha caso
  essay (resposta modelo do item, com fallback honesto); caps de referência
  300→600. Sem inflar o store além do necessário (cap por questão documentado).
- **D18-5 · Vocabulário produtivo e mescla justa**: `VocabWord`/`VocabPhrase`
  ganham `lastReviewTs` opcional (atualizado a cada nota de estudo) e a rotação
  de sentidos persiste um cursor por entrada; o merge de backup passa a
  reconciliar por EVIDÊNCIA DE REVISÃO (vence o registro com `lastReviewTs`
  mais recente; sem timestamp, regra antiga como fallback) — lapsos recentes
  não são mais desfeitos por restauração antiga. AppState permanece v8 (campo
  opcional, backward-compatible); migração/documentação no storage.
- **D18-6 · Reading FIB drag-and-drop (novo tipo oficial)**: novo `TaskType`
  `read_fib_bank` ("Reading FIB · banco de palavras", section reading, ready),
  schema próprio (texto com lacunas + banco compartilhado de palavras +
  gabarito), motor `FibBankPractice` (arrastar/tocar para atribuir palavra a
  lacuna; teclado acessível como alternativa), loader/catálogo/manifest
  regenerados (`scripts/build-manifest.mjs`), SectionPage e contagens derivam
  automaticamente (nunca hardcode), blueprint do simulado inclui o tipo no
  bloco reading (contagens encolhem para o inventário). Conteúdo inicial
  honesto (fonte registrada em AI_SOURCES — sem fingir procedência verificada).
- **D18-7 · Conteúdo de alto impacto**: bancos finos sobem para pisos
  verificáveis: `describe_image` ≥ 20 · `lst_hcs`/`lst_hiw`/`lst_smw`/
  `lst_mcq_multi` ≥ 10 cada · `lst_mcq` ≥ 12 · `mcq_multi` ≥ 30 ·
  `summarize_group_discussion` ≥ 20 · `read_fib_bank` ≥ 8 (D18-6); `sample`
  preenchido para `retell_lecture` e `summarize_spoken_text` (1 modelo por
  item, ou no mínimo nos 30 primeiros de cada banco se o custo de qualidade
  exigir recorte — decidir por qualidade, não por número). Dedupe roda sobre
  o conteúdo novo (canonical-map regenerado) e o manifesto é regenerado.
- **D18-F8 · Fechamento**: E2E versionado `scripts/e2e/proj18_f8.py` cobrindo
  os fluxos deste projeto + varredura 390×844 + axe nas rotas tocadas; gates
  finais; AGENTS.md raiz atualizado (uma regra por decisão estrutural nova) e
  memória do projeto; roadmap central com estado exato.

---

## 4. Escopo por fase (ordem de dependência)

- **F0 Integridade crítica** (D18-0a/b/c): HIW usável; paridade oral no exame;
  retry de IA. Nenhuma feature nova depende disto, TODAS dependem de não
  mentir ao usuário. Testes: contrato HIW, veredito not_gradable no exame,
  retry renderizado e acionável.
- **F1 IA no SST** (D18-1): depende de F0c (mesmo componente de feedback).
- **F2 Recomendação v2** (D18-2): depende de nada de F0/F1 no código, mas fica
  depois por prioridade de valor.
- **F3 Readiness honesto** (D18-3): independente de F2 em código; mesma onda
  possível (arquivos distintos: readiness.ts vs next-action.ts).
- **F4 Revisão fiel do simulado** (D18-4): toca `ExamRunner`/`examReview` —
  SEMPRE depois de F0b (mesmo arquivo, dono exclusivo por onda).
- **F5 Vocabulário** (D18-5): arquivos independentes (vocab.ts/vocabStudy.ts/
  backup.ts) — onda própria.
- **F6 Novo tipo read_fib_bank** (D18-6): toca tipos/catálogo/manifest/exam —
  depois de F4 (evita conflito com exam.ts).
- **F7 Conteúdo** (D18-7): depois de F6 (o novo tipo entra no mesmo passe de
  dedupe/manifest) e de F0a (HIW novo conteúdo só com transcript).
- **F8 Fechamento** (D18-F8): E2E + gates finais + AGENTS.md/memória.

### Critérios de aceite por fase

- **F0**: (1) todo item de lst_hiw tem transcript distinto com divergência nas
  posições de errors e o teste de contrato falha se algum item não tiver;
  (2) simulado com fala insuficiente registra score null + causa not_gradable
  (teste de unidade do veredito); (3) estado indisponível de IA exibe botão
  "Tentar novamente" que dispara runAiGrade (teste de componente); (4) gates
  §19 verdes.
- **F1**: (1) runAiGrade aceita kind sst com schema Zod dedicado (teste); (2)
  handler server-only valida payload e responde erro tipado (teste); (3)
  SstPractice renderiza AiGradeFeedback com o resultado e grava dimensões
  fracas (<70) no diagnóstico (teste); (4) cache v2 consultado ANTES de rede
  (teste reutilizado/adaptado); (5) gates §19 verdes + Playwright no SST.
- **F2**: (1) com targetScore 65, o alvo de fraqueza por tipo usa a meta
  (teste com valores concretos); (2) com examDate ≤ 14 dias, cobertura de tipo
  nunca-tentado vence fraqueza leve já medida (teste); (3) correção pendente
  vence tudo (teste); (4) nenhuma ação aponta para tipo sem estatística exceto
  diagnóstico rotulado (teste); (5) gates §19 verdes + Playwright home/progress.
- **F3**: (1) repetir o mesmo item N vezes não sobe confiança (teste); (2)
  contato com itens inéditos do tipo é requisito do rótulo "Quase pronto/Pronto"
  (teste); (3) rótulo abaixo de 65 não muda sem evidência (teste de não-
  regressão); (4) gates §19 verdes.
- **F4**: (1) registro persistido do simulado contém resposta submetida +
  causa por questão (teste); (2) revisão após reload reconstrói da forma
  persistida (teste); (3) essay exibe referência real quando o item tem
  `sample` (teste); (4) truncamentos 500→2.000/300→600 aplicados (teste); (5)
  gates §19 verdes + Playwright no fluxo de revisão.
- **F5**: (1) rotação de sentidos persiste entre filas (2a fila testa sentido
  diferente — teste); (2) merge: registro com lastReviewTs mais recente vence
  mesmo com caixa menor (teste do caso do lapso); (3) fallback sem timestamp
  mantém comportamento antigo (teste); (4) gates §19 verdes + Playwright no
  estudo de vocab.
- **F6**: (1) TaskType read_fib_bank presente em types/manifest/catálogo com
  contagem derivada correta (teste); (2) motor completo: atribuir/limpar/
  verificar lacunas com gabarito, teclado acessível (teste + Playwright);
  (3) blueprint do simulado inclui o bloco (teste); (4) gates §19 verdes.
- **F7**: (1) pisos de banco respeitados por teste de contrato; (2) novo
  conteúdo passa no dedupe (canonical-map regenerado, sem nova duplicata
  canônica); (3) itens HIW novos têm transcript distinto (teste reutilizado);
  (4) manifest regenerado e build OK com precache atualizado; (5) gates §19.
- **F8**: E2E `proj18_f8.py` exit 0 (fluxos: HIW corrigido end-to-end; retry
  IA; SST com IA mock; revisão de simulado pós-reload; rotação de sentidos;
  read_fib_bank em prática e simulado) + varredura 390×844 + axe 0 + console
  limpo nas rotas tocadas; gates finais; AGENTS.md/memória atualizados.

---

## 5. Restrições e não-objetivos

- Comportamento existente não pode regredir: vitest 703/703 é a linha de base
  (confirmada neste remix); E2Es versionados anteriores continuam válidos.
- Regras do AGENTS.md raiz intocáveis: orquestração IA única (`aiGradeRun`);
  server-only em `*.server.ts` fora de `src/server/`; cache IA consultado
  antes de rede/créditos; política oral única em `oralPolicy.ts`; integridade
  de backup idempotente; larguras/receitas UI do projeto 17; `text-micro` ≥
  11px; `warning-ink` em selos âmbar; ícones só lucide-react.
- Novos conteúdos NUNCA fingem procedência: fontes novas entram em AI_SOURCES
  ou comunitárias, nunca em VERIFIED_SOURCES.
- Mobile-first 390×844 é a referência de verificação de toda UI nova/mudança.
- Nada de App.tsx, react-router-dom, ou arquivos legacy do template.

## 6. Gates (Plan.md §19)

Por fase: `bunx vitest run` · `tsgo` limpo · `bun run build` (precache/sw
regenerados quando o shell muda) · `eslint .` 0 erros · Playwright quando a
fase toca UI (console limpo, axe 0 nas rotas tocadas, 390×844 sem overflow).
Fechamento: E2E versionado exit 0 + relato dos três blocos.

---

## 7. Enxame de subagentes (ondas)

- **Onda 1** (após pilares centrais): s1 = F0 (integridade crítica) ·
  s2 = F5 (vocabulário) · s3 = F6 (read_fib_bank). Recortes de arquivo sem
  interseção: s1 (lst_hiw.json, catalog.ts, oralPolicy/exam adapter,
  AiGradeFeedback) · s2 (vocab.ts, vocabStudy.ts, backup.ts, vocabulary.tsx) ·
  s3 (types.ts, catalog.ts loader novo + FibBankPractice + exam.ts blueprint).
  ATENÇÃO: s1 e s3 AMBOS tocam catalog.ts/types.ts/exam.ts — contratos
  compartilhados (TaskType novo, loader map) são fixados pelo agente principal
  ANTES da onda; s3 fica com types/catalog/exam, s1 fica FORA desses arquivos
  (usa só dados + HiwPractice + AiGradeFeedback + adaptador de fala do exame
  que vive em ExamRunner — UNICIDADE: ExamRunner é do s1 na onda 1; s3 só cria
  arquivos novos e o bloco do blueprint fica na onda 2 com o agente principal).
- **Onda 2** (após integração da 1): s4 = F1+F2 (IA SST + next-action v2) ·
  s5 = F3 (readiness honesto) · s6 = F4 (revisão fiel do simulado; ExamRunner/
  examReview livres após s1) + bloco do blueprint de read_fib_bank no exam.ts.
- **Onda 3**: s7 = F7 (conteúdo: pisos de banco + samples + dedupe/manifest) —
  dado puro + build-manifest; revisão do agente principal nas amostras.
- **Fechamento (F8)**: agente principal (E2E, gates finais, AGENTS.md/memória).
- Cada subagente recebe os 3 pilares centrais + seus 3 pilares (project18-sK,
  prd-…, roadmap-…) na íntegra no system prompt, com regras do Plan.md
  (nunca pergunta ao usuário; só escreve nos arquivos seus; relato no formato
  feito · evidências · decisões · pendências · arquivos).

## 8. Riscos e mitigação

- **Conflito de arquivo no catálogo/manifest** (s1×s3, F6×F7): contratos
  fixados antes da onda; quem toca types.ts/catalog.ts/exam.ts é dono exclusivo
  da onda; regeneração do manifesto é passo de integração do agente principal.
- **Conteúdo gerado com qualidade duvidosa**: samples/bancos novos passam por
  revisão direta do agente principal em amostra (≥ 20%) + teste de contrato
  (transcript≠text para HIW; gabarito consistente para read_fib_bank).
- **Store crescer com respostas de exame**: caps por questão (2.000) e teste
  de tamanho total do registro; sem cap, o último commit volta.
- **Migração do vocabulário**: campo opcional; sem version bump; testes de
  merge cobrem com e sem `lastReviewTs`.
- **Flake de vitest em rodadas paralelas** (registrado no projeto 17): rodadas
  finais sempre isoladas, em sequência.

## 9. Registro de desvios

- D18-dev1 (registrado no início da execução): a tool `spawn_agent` desta
  sandbox é READ-ONLY — não edita arquivos. A produção das fases é feita pelo
  agente principal (como no projeto 17); subagentes read-only continuam sendo
  usados para investigação e verificação de conformidade. Os recortes sK do
  PRD §7 passam a delimitar donos de arquivo por onda de trabalho do agente
  principal, não agentes de produção.

## 10. Estado esperado do roadmap ao fim deste remix

Fases concluídas marcadas `[x]` com linha de Gates com números reais; se o
remix terminar antes de todas as fases, o roadmap central deixa a linha
"Próximo remix: …" apontando a primeira fase pendente e o estado de cada
pacote em andamento.
