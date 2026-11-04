import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { TopNav } from "@/components/TopNav";
import { EmptyState } from "@/components/layout/EmptyState";
import { Disclosure } from "@/components/layout/Disclosure";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { VocabSnippet } from "@/components/plus/VocabSnippet";
import { SourceChip, VocabDetailSheet } from "@/components/plus/VocabDetailSheet";
import { Button } from "@/components/ui/button";
import { SECTION_META, SECTION_ORDER, type TaskType } from "@/lib/pte";
import {
  filterVocab,
  flattenVocab,
  sectionOfType,
  sliceVocabPage,
  vocabCounts,
  vocabDueCount,
  VOCAB_PAGE_SIZE,
  type VocabKind,
  type VocabKindFilter,
  type VocabListItem,
  type VocabSort,
  vocabStudyIncludedDue,
  deriveVocabSnippet,
  vocabStateChip,
} from "@/lib/plus/vocab";
import {
  buildStudyQueue,
  recallTargets,
  requeueCard,
  rotateTarget,
  senseMatches,
  type VocabStudyCard,
} from "@/lib/plus/vocabStudy";
import {
  applyVocabStudy,
  clearVocabDraft,
  getVocabDraft,
  removeVocabItem,
  restoreVocabItem,
  saveVocabDraft,
  toggleVocabStar,
  useAppState,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vocabulary")({
  head: () => ({
    meta: [
      { title: "Vocabulário — Studie Plus" },
      {
        name: "description",
        content:
          "Todas as palavras e frases que você já traduziu no Studie Plus, reunidas em um único lugar para buscar, revisitar a questão de origem e estudar.",
      },
      { property: "og:title", content: "Vocabulário — Studie Plus" },
      {
        property: "og:description",
        content:
          "Reúna tudo que você traduziu na prática e estude em um único lugar — material extra do Studie Plus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VocabularyPage,
});

/** Placar/fase retomável da revisão (projeto 13, §4.3). */
interface VocabResume {
  index: number;
  sim: number;
  nao: number;
  /** Chaves já reagendadas (uma repetição por item por sessão). */
  requeued: string[];
  /** D15-3c: sentidos errados nesta sessão — chaves `kind:key:sentido`. */
  missed: string[];
}

const SORTS: { key: VocabSort; label: string }[] = [
  { key: "recentes", label: "Recentes" },
  { key: "mais-traduzidas", label: "Mais traduzidas" },
  { key: "a-z", label: "A–Z" },
  { key: "para-revisar", label: "Para revisar" },
];

type Raw = Record<string, unknown>;
const PTE_TEXT_MODULES = import.meta.glob<Raw>("@/data/pte/*.json");
/** D16-5b: chave própria dos filtros do vocabulário (sobrevivem à navegação). */
const VOCAB_FILTERS_KEY = "pte-vocab-filters";
const questionTextCache = new Map<string, Promise<string | undefined>>();

/** D16-0c: texto da questão de origem para derivar o recorte de itens antigos.
 * Leitura determinística do catálogo local (offline); sem módulo/questão →
 * undefined (a seção de recorte simplesmente não aparece). */
function questionTextFor(type: string, qid: string): Promise<string | undefined> {
  const cacheKey = `${type}:${qid}`;
  const cached = questionTextCache.get(cacheKey);
  if (cached) return cached;
  const loader = PTE_TEXT_MODULES[`/src/data/pte/${type}.json`];
  const p = (loader ? loader() : Promise.reject(new Error("sem dados")))
    .then((mod) => {
      const questions = ((mod as Raw)["questions"] ?? []) as Raw[];
      const q = questions.find((x) => x["id"] === qid);
      if (!q) return undefined;
      for (const field of ["text", "transcript", "prompt", "answer"]) {
        const v = q[field];
        if (typeof v === "string" && v.trim()) return v;
      }
      return undefined;
    })
    .catch(() => undefined);
  questionTextCache.set(cacheKey, p);
  return p;
}

function VocabularyPage() {
  const app = useAppState();
  const vocab = app.vocabulary;
  const audioOn = app.settings.plus.plusAudio === true;
  // D15-3b: checagem de retrieval opcional (configurações de estudo).
  const typedRecall = app.settings.plus.typedRecall === true;

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<VocabKindFilter>("todas");
  const [section, setSection] = useState<string>("todas");
  const [starredOnly, setStarredOnly] = useState(false);
  const [sort, setSort] = useState<VocabSort>("recentes");
  // D17-11: null = ainda sem gesto do usuário (segue a derivação pós-hidratação).
  const [extraOpen, setExtraOpen] = useState<boolean | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  // D16-1b: item aberto na versão completa (chave `kind:key`; null = fechado).
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [studyScope, setStudyScope] = useState<"visiveis" | "todos">("visiveis");
  const [studyLimit, setStudyLimit] = useState<number | undefined>(20);

  // D16-5b: filtros que sobrevivem à navegação — leitura PÓS-HIDRATAÇÃO
  // (nunca em initializer de estado; padrão D15-5d) e gravação a cada mudança.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(VOCAB_FILTERS_KEY);
      if (!raw) return;
      const f = JSON.parse(raw) as {
        query?: unknown;
        kind?: unknown;
        section?: unknown;
        starredOnly?: unknown;
        sort?: unknown;
      };
      if (typeof f.query === "string") setQuery(f.query);
      if (f.kind === "todas" || f.kind === "word" || f.kind === "phrase") setKind(f.kind);
      if (typeof f.section === "string") setSection(f.section);
      if (f.starredOnly === true) setStarredOnly(true);
      if (
        f.sort === "recentes" ||
        f.sort === "mais-traduzidas" ||
        f.sort === "a-z" ||
        f.sort === "para-revisar"
      ) {
        setSort(f.sort);
      }
    } catch {
      // filtros são descartáveis
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        VOCAB_FILTERS_KEY,
        JSON.stringify({ query, kind, section, starredOnly, sort }),
      );
    } catch {
      // quota/privacidade: filtros são descartáveis
    }
  }, [query, kind, section, starredOnly, sort]);

  const items = useMemo(() => flattenVocab(vocab), [vocab]);
  // Relógio vivo (§4.3): itens que vencem passam a contar sem recarregar a página.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(iv);
  }, []);
  const counts = useMemo(() => vocabCounts(vocab), [vocab]);
  const due = useMemo(() => vocabDueCount(vocab, now), [vocab, now]);

  // União de fontes (§4.3): um item pertence a TODAS as seções das suas fontes
  // (palavra: fontes; frase: o tipo da própria frase).
  const sectionsOf = useMemo(() => {
    return (it: VocabListItem): string[] => {
      // D14-4c: além das fontes vivas (teto 6), a origem registrada na 1ª
      // tradução (originType) conta para a seção do item.
      const types =
        it.kind === "phrase"
          ? it.type
            ? [it.type]
            : []
          : [
              ...new Set([
                ...it.sources.map((s) => s.type),
                ...(it.originType !== undefined ? [it.originType] : []),
              ]),
            ];
      const out: string[] = [];
      for (const t of types) {
        const sec = sectionOfType(t);
        if (sec && !out.includes(sec)) out.push(sec);
      }
      return out;
    };
  }, []);

  const visible = useMemo(
    () =>
      filterVocab(items, {
        query,
        kind,
        section,
        starredOnly,
        sort,
        now,
        sectionsOf,
      }),
    [items, query, kind, section, starredOnly, sort, now, sectionsOf],
  );

  // Fase 5 (§4.5): listas longas rendem em páginas de 300 — "Mostrar mais" incrementa.
  const [shown, setShown] = useState(VOCAB_PAGE_SIZE);
  useEffect(() => {
    // Filtro mudou: volta para a primeira página.
    setShown(VOCAB_PAGE_SIZE);
  }, [query, kind, section, starredOnly, sort]);
  const listed = useMemo(() => sliceVocabPage(visible, shown), [visible, shown]);

  // Seções que realmente têm itens (chips limpos quando o vocabulário é novo).
  const sectionsAvailable = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      for (const s of sectionsOf(it)) set.add(s);
    }
    return SECTION_ORDER.filter((s) => set.has(s));
  }, [items, sectionsOf]);

  const hasAny = counts.total > 0;

  // D16-1b: item em detalhe — sempre o item VIVO do store (favorito/estado frescos).
  const detailItem = useMemo(() => {
    if (detailKey === null) return null;
    return items.find((it) => `${it.kind}:${it.key}` === detailKey) ?? null;
  }, [items, detailKey]);

  // D16-0c/D16-B: derivação do recorte para itens antigos — leitura POR item,
  // pós-mount (nunca em initializer de estado), e nunca gravação no store.
  const [derived, setDerived] = useState<{
    key: string;
    snippet?: string;
    loading: boolean;
  } | null>(null);
  useEffect(() => {
    if (!detailItem || detailItem.kind !== "word" || detailItem.snippet !== undefined) {
      setDerived(null);
      return;
    }
    let active = true;
    setDerived({ key: detailItem.key, loading: true });
    void (async () => {
      const src = detailItem.sources[detailItem.sources.length - 1];
      const text = src ? await questionTextFor(src.type, src.qid) : undefined;
      const snippet = text ? deriveVocabSnippet(detailItem.en, text) : undefined;
      if (active) {
        setDerived(
          snippet !== undefined
            ? { key: detailItem.key, snippet, loading: false }
            : { key: detailItem.key, loading: false },
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [detailItem]);

  const detailSnippet =
    detailItem === null
      ? undefined
      : detailItem.kind === "phrase"
        ? detailItem.en
        : (detailItem.snippet ?? derived?.snippet);
  const detailSnippetLoading =
    detailItem !== null &&
    detailItem.kind === "word" &&
    detailItem.snippet === undefined &&
    derived?.loading === true;

  // Escopo da revisão (§4.3): com filtro ativo, revisa os itens VISÍVEIS;
  // "todos" é uma opção explícita. Limite configurável por sessão.
  const studyPool = studyScope === "todos" ? items : visible;
  const studySize =
    studyLimit !== undefined ? Math.min(studyLimit, studyPool.length) : studyPool.length;
  // D14-4b: fila limitada rotula quantos vencidos entraram (vencidos vão primeiro).
  const studyDue = useMemo(
    () => studyPool.reduce((n, it) => (it.dueAt <= now ? n + 1 : n), 0),
    [studyPool, now],
  );
  const studyDueIncluded = vocabStudyIncludedDue(studyDue, studySize);
  const studyCapped = studyLimit !== undefined && studyPool.length > studyLimit;
  const filtersActive =
    query.trim() !== "" || kind !== "todas" || section !== "todas" || starredOnly;

  // Retomada (§4.3): draft leve da revisão — lido UMA vez no mount (puro, sem
  // depender do store) e a fila reconstruída por chave quando os itens existem.
  // O initializer não pode depender de `items`: na render de hidratação
  // useSyncExternalStore ainda serve o snapshot do servidor (itens vazios).
  const [resumedDraft, setResumedDraft] = useState(() => getVocabDraft());
  const resumedSession = useMemo(() => {
    if (!resumedDraft) return null;
    const byKey = new Map(items.map((it) => [`${it.kind}:${it.key}`, it]));
    const cards = resumedDraft.queue
      .map((c) => {
        const it = byKey.get(`${c.kind}:${c.key}`);
        return it ? { ...it, box: it.box, dueAt: it.dueAt } : null;
      })
      .filter((c): c is VocabStudyCard => c !== null);
    if (cards.length === 0) return null;
    return {
      cards,
      resume: {
        index: Math.min(resumedDraft.index, cards.length),
        sim: resumedDraft.sim,
        nao: resumedDraft.nao,
        requeued: resumedDraft.requeued,
        missed: resumedDraft.missed,
      },
    };
  }, [resumedDraft, items]);
  const [startedSession, setStartedSession] = useState<{
    cards: VocabStudyCard[];
    resume: VocabResume;
  } | null>(null);
  const study = startedSession ?? resumedSession;

  function startStudy() {
    setResumedDraft(null);
    setStartedSession({
      cards: buildStudyQueue(
        studyPool,
        studyLimit !== undefined ? { now: Date.now(), limit: studyLimit } : { now: Date.now() },
      ),
      resume: { index: 0, sim: 0, nao: 0, requeued: [], missed: [] },
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-16 pt-8 sm:px-6">
        <PageHeader
          kicker="Studie Plus"
          title="Vocabulário"
          subtitle="Material de estudo do Studie Plus — não faz parte do PTE. Tudo que você traduziu na prática fica aqui, com a questão de origem a um toque de distância."
        />

        {!hasAny ? (
          <EmptyState
            icon={Sparkles}
            className="mt-8"
            title="Seu vocabulário começa quando você traduz"
            description={
              app.settings.plus.vocabCapture &&
              (app.settings.plus.wordTranslation || app.settings.plus.phraseTranslation)
                ? // Onboarding real (§4.3): tradução já ativa — orienta o GESTO, não a ativação.
                  "Toque em palavras e frases durante a prática — tudo que você traduzir aparece aqui automaticamente."
                : "Ative a tradução por palavra e por frase em Ajustes e toque nas palavras e frases durante a prática. Tudo que você traduzir aparece aqui automaticamente."
            }
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild size="sm" className="min-h-11 sm:min-h-10">
                  <Link to="/practice">Ir praticar</Link>
                </Button>
                {!(
                  app.settings.plus.vocabCapture &&
                  (app.settings.plus.wordTranslation || app.settings.plus.phraseTranslation)
                ) ? (
                  <Button asChild size="sm" variant="outline" className="min-h-11 sm:min-h-10">
                    <Link to="/settings">Abrir Ajustes</Link>
                  </Button>
                ) : null}
              </div>
            }
          />
        ) : study ? (
          <StudySession
            cards={study.cards}
            resume={study.resume}
            audioOn={audioOn}
            typedRecall={typedRecall}
            onExit={() => {
              setStartedSession(null);
              setResumedDraft(null);
              clearVocabDraft();
            }}
          />
        ) : (
          <>
            {/* Protagonista da exploração: o convite para revisar hoje */}
            <section className="mt-6 rounded-2xl border border-border/60 bg-card bg-glow p-5 shadow-card ring-1 ring-inset ring-primary/10 sm:p-6">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <p className="text-sm font-medium text-foreground">
                  {counts.words} {counts.words === 1 ? "palavra" : "palavras"} · {counts.phrases}{" "}
                  {counts.phrases === 1 ? "frase" : "frases"}
                  {due > 0 ? (
                    <>
                      {" · "}
                      <span className="text-primary">{due} para revisar hoje</span>
                    </>
                  ) : null}
                </p>
                <Button size="sm" className="min-h-11 sm:min-h-10" onClick={startStudy}>
                  {due > 0
                    ? studyCapped
                      ? `Revisar hoje — ${studyDueIncluded} ${studyDueIncluded === 1 ? "vencido" : "vencidos"} de ${studySize}`
                      : `Revisar hoje (${studySize})`
                    : `Estudar (${studySize})`}
                </Button>
              </div>
              {/* Escopo e limite da sessão (§4.3): com filtro ativo, revisa os
                  visíveis; "todos" é opção explícita; limite configurável. */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <span className="font-medium">Sessão:</span>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip
                    active={studyScope === "visiveis"}
                    onClick={() => setStudyScope("visiveis")}
                  >
                    Visíveis ({visible.length})
                  </FilterChip>
                  <FilterChip
                    active={studyScope === "todos"}
                    onClick={() => setStudyScope("todos")}
                  >
                    Todos ({counts.total})
                  </FilterChip>
                </div>
                <span className="font-medium">Limite:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[10, 20, 40].map((n) => (
                    <FilterChip key={n} active={studyLimit === n} onClick={() => setStudyLimit(n)}>
                      {n}
                    </FilterChip>
                  ))}
                  <FilterChip
                    active={studyLimit === undefined}
                    onClick={() => setStudyLimit(undefined)}
                  >
                    Sem limite
                  </FilterChip>
                </div>
                {filtersActive && studyScope === "visiveis" ? (
                  <span>revisando os itens do filtro ativo</span>
                ) : null}
              </div>
            </section>

            {/* Barra de ferramentas: busca + filtros + ordenação */}
            <div className="mt-6 space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-card">
              <label className="block">
                <span className="sr-only">Buscar no vocabulário</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar palavra, frase ou tradução…"
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Tipo
                </p>
                <div className="flex flex-wrap gap-2 text-sm">
                  {(
                    [
                      ["todas", "Todas"],
                      ["word", "Palavras"],
                      ["phrase", "Frases"],
                    ] as const
                  ).map(([key, label]) => (
                    <FilterChip key={key} active={kind === key} onClick={() => setKind(key)}>
                      {label}
                    </FilterChip>
                  ))}
                </div>
              </div>
              {/* D17-11: seção/favoritas/ordenação recolhem; busca e tipo ficam
                  visíveis. Aberto quando um filtro não-default está ativo
                  (derivação pós-hidratação; sem persistência nova). */}
              <Disclosure
                trigger="Mais filtros"
                openTrigger="Menos filtros"
                open={extraOpen ?? (section !== "todas" || starredOnly || sort !== "recentes")}
                onOpenChange={setExtraOpen}
              >
                {sectionsAvailable.length > 0 ? (
                  <div className="space-y-2 pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Seção
                    </p>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <FilterChip active={section === "todas"} onClick={() => setSection("todas")}>
                        Todas as seções
                      </FilterChip>
                      {sectionsAvailable.map((s) => (
                        <FilterChip key={s} active={section === s} onClick={() => setSection(s)}>
                          {SECTION_META[s].label}
                        </FilterChip>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <FilterChip active={starredOnly} onClick={() => setStarredOnly((v) => !v)}>
                    ★ Favoritas
                  </FilterChip>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Ordenar</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as VocabSort)}
                      className="min-h-11 rounded-xl border border-border bg-background px-2 text-sm text-foreground sm:min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Ordenar vocabulário"
                    >
                      {SORTS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </Disclosure>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                className="mt-8"
                title={`Nada encontrado${query ? ` para “${query}”` : ""}`}
                description="Tente outra busca ou limpe os filtros."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 sm:min-h-10"
                    onClick={() => {
                      window.localStorage.removeItem(VOCAB_FILTERS_KEY);
                      setQuery("");
                      setKind("todas");
                      setSection("todas");
                      setStarredOnly(false);
                    }}
                  >
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <ul className="mt-6 space-y-3">
                {listed.page.map((item) => (
                  <VocabCard
                    key={`${item.kind}:${item.key}`}
                    item={item}
                    now={now}
                    audioOn={audioOn}
                    onOpen={() => setDetailKey(`${item.kind}:${item.key}`)}
                    confirming={confirmRemove === `${item.kind}:${item.key}`}
                    onAskRemove={() => setConfirmRemove(`${item.kind}:${item.key}`)}
                    onRemove={() => {
                      // D15-4c: snapshot fiel do item ANTES da remoção — o Desfazer
                      // reinserção o item exatamente como estava (box/dueAt/sentidos).
                      const entry =
                        item.kind === "word" ? vocab.words[item.key] : vocab.phrases[item.key];
                      removeVocabItem(item.kind, item.key);
                      setConfirmRemove(null);
                      if (entry) {
                        toast(`“${item.en}” removido do vocabulário`, {
                          description: "Você pode desfazer por 10 segundos.",
                          duration: 10_000,
                          action: {
                            label: "Desfazer",
                            onClick: () => restoreVocabItem(item.kind, item.key, entry),
                          },
                        });
                      }
                    }}
                    onCancelRemove={() => setConfirmRemove(null)}
                    onStar={() => toggleVocabStar(item.kind, item.key)}
                  />
                ))}
              </ul>
            )}
            {listed.remaining > 0 ? (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setShown((n) => n + VOCAB_PAGE_SIZE)}
                >
                  Mostrar mais ({listed.remaining} restantes)
                </Button>
              </div>
            ) : null}

            {/* D16-1b: versão COMPLETA em sheet — TranslationSheet do pack
                (portal, focus trap, bottom sheet mobile / painel desktop). */}
            <VocabDetailSheet
              item={detailItem}
              aiEnabled={app.settings.plus.aiTranslation === true}
              audioOn={audioOn}
              {...(detailSnippet !== undefined ? { snippet: detailSnippet } : {})}
              snippetLoading={detailSnippetLoading}
              onClose={() => setDetailKey(null)}
              onStar={() => {
                if (detailItem) toggleVocabStar(detailItem.kind, detailItem.key);
              }}
              onRemove={() => {
                if (!detailItem || !vocab) return;
                const entry =
                  detailItem.kind === "word"
                    ? vocab.words[detailItem.key]
                    : vocab.phrases[detailItem.key];
                removeVocabItem(detailItem.kind, detailItem.key);
                setDetailKey(null);
                if (entry) {
                  toast(`“${detailItem.en}” removido do vocabulário`, {
                    description: "Você pode desfazer por 10 segundos.",
                    duration: 10_000,
                    action: {
                      label: "Desfazer",
                      onClick: () => restoreVocabItem(detailItem.kind, detailItem.key, entry),
                    },
                  });
                }
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "border-primary bg-primary/10 font-semibold text-primary"
          : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** (SourceChip movido para VocabDetailSheet — compartilhado pela lista e pelo sheet.) */

/** D16-1a: card da lista = versão SIMPLES (índice ágil). O toque abre a versão
 * completa em sheet (VocabDetailSheet) — sem nota contextual na lista. */
function VocabCard({
  item,
  now,
  audioOn,
  confirming,
  onOpen,
  onAskRemove,
  onRemove,
  onCancelRemove,
  onStar,
}: {
  item: VocabListItem;
  /** Relógio vivo da rota — o chip de estado acompanha o vencimento (D16-5a). */
  now: number;
  audioOn: boolean;
  confirming: boolean;
  onOpen: () => void;
  onAskRemove: () => void;
  onRemove: () => void;
  onCancelRemove: () => void;
  onStar: () => void;
}) {
  const isPhrase = item.kind === "phrase";
  // D16-5a: UM chip discreto de estado — vencido/em dia/consolidado (tokens).
  const state = vocabStateChip(item, now);

  return (
    <li className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
      {/* D16-D: um comportamento só de abrir detalhe — o card inteiro é o gatilho. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver detalhe completo de ${item.en}`}
        className="block min-h-11 w-full text-left"
      >
        {isPhrase ? (
          <span className="block line-clamp-2 font-serif text-lg leading-relaxed text-foreground">
            {item.en}
          </span>
        ) : (
          <span className="block font-serif text-2xl font-semibold tracking-tight text-foreground">
            {item.en}
          </span>
        )}
        <span className="mt-1 block text-sm font-medium text-foreground">{item.literal}</span>
      </button>

      {/* Ações em faixa própria: nunca comprimem o conteúdo */}
      <div className="mt-3 flex items-center justify-end gap-1">
        <PlusSpeakButton text={item.en} enabled={audioOn} label={`Ouvir pronúncia`} compact />
        {/* D16-3a: 🔊 do recorte — a palavra no contexto onde ela viveu */}
        {!isPhrase && item.snippet ? (
          <PlusSpeakButton
            text={item.snippet}
            enabled={audioOn}
            label="Ouvir frase em contexto"
            compact
          />
        ) : null}
        <button
          type="button"
          aria-pressed={item.starred === true}
          aria-label={item.starred ? "Remover dos favoritos" : "Marcar como favorito"}
          onClick={onStar}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-sm transition-colors hover:bg-secondary",
            item.starred ? "text-primary" : "text-muted-foreground",
          )}
        >
          {item.starred ? "★" : "☆"}
        </button>
        {confirming ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRemove}
              aria-label="Confirmar remoção"
              className="flex h-11 items-center rounded-full px-3 text-xs font-medium text-foreground hover:bg-secondary"
            >
              Remover mesmo?
            </button>
            <button
              type="button"
              onClick={onCancelRemove}
              aria-label="Cancelar remoção"
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label="Remover do vocabulário"
            onClick={onAskRemove}
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            🗑
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span
          aria-label={`Estado: ${state.label} (caixa ${item.box})`}
          title={`Caixa ${item.box} · ${state.label}`}
          className={cn(
            "rounded-full border px-2 py-0.5 font-medium",
            state.tone === "primary" && "border-primary/40 bg-primary/10 text-primary",
            state.tone === "success" && "border-success/40 bg-success/10 text-success-ink",
            state.tone === "muted" && "border-border text-muted-foreground",
          )}
        >
          {state.label}
        </span>
        <span>
          traduzida {item.seenCount} {item.seenCount === 1 ? "vez" : "vezes"}
        </span>
        {isPhrase && item.type ? (
          <SourceChip
            type={item.type}
            {...(item.qid !== undefined ? { qid: item.qid } : {})}
            extra={` · frase ${(item.index ?? 0) + 1}`}
          />
        ) : (
          item.sources.map((s) => (
            <SourceChip key={`${s.type}:${s.qid}`} type={s.type} qid={s.qid} />
          ))
        )}
      </div>
    </li>
  );
}

/** Modo de estudo: flashcards com virada e auto-avaliação honesta (lembro / não lembro). */
function StudySession({
  cards: initialCards,
  resume,
  audioOn,
  typedRecall,
  onExit,
}: {
  cards: VocabStudyCard[];
  resume: VocabResume;
  audioOn: boolean;
  typedRecall: boolean;
  onExit: () => void;
}) {
  const [cards, setCards] = useState(initialCards);
  const [idx, setIdx] = useState(resume.index);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState({ sim: resume.sim, nao: resume.nao });
  const requeuedRef = useRef<Set<string>>(new Set(resume.requeued));
  const [startedAt] = useState(() => getVocabDraft()?.startedAt ?? Date.now());
  const card = cards[idx];

  // D15-3b/D15-3c: checagem de retrieval (opcional) — só palavras; o sentido
  // pedido roda entre os acumulados a cada aparição do cartão na fila.
  const typedRecallActive = typedRecall && card?.kind === "word";
  const typedTargets = card ? recallTargets(card) : [];
  // D18-5a: o cursor de rotação PERSISTE por entrada (snapshot da fila) e as
  // aparições dentro desta fila somam por cima — a 2ª fila pede o próximo
  // sentido em vez de repetir o primeiro.
  const typedAskCount = card
    ? (card.senseAskCount ?? 0) +
      cards.slice(0, idx).filter((c) => c.key === card.key && c.kind === card.kind).length
    : 0;
  const typedExpected = rotateTarget(typedTargets, typedAskCount);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState(false);
  const [missed, setMissed] = useState<Set<string>>(new Set(resume.missed));

  // Novo cartão: limpa a digitação e a falha revelada da checagem anterior.
  useEffect(() => {
    setTyped("");
    setTypedError(false);
  }, [idx]);

  function submitTyped() {
    if (!card) return;
    if (senseMatches(typed, typedExpected)) {
      grade(true);
      return;
    }
    setMissed((prev) => new Set(prev).add(`${card.kind}:${card.key}:${typedExpected}`));
    setTypedError(true);
    setFlipped(true);
  }

  function grade(remembered: boolean) {
    if (!card) return;
    // D18-5a: checagem de retrieval avança o cursor de sentidos persistido.
    applyVocabStudy(card.kind, card.key, remembered, Date.now(), {
      advanceSense: typedRecallActive,
    });
    setScore((s) => ({ sim: s.sim + (remembered ? 1 : 0), nao: s.nao + (remembered ? 0 : 1) }));
    if (!remembered) {
      // Reaprendizado na sessão (§4.3): volta ao FIM da fila, UMA vez por item.
      const next = requeueCard(cards, card);
      if (next !== cards) requeuedRef.current.add(`${card.kind}:${card.key}`);
      setCards(next);
    }
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  // Draft leve (§4.3): cada passo persiste; ao concluir, o draft sai.
  useEffect(() => {
    if (idx >= cards.length) {
      clearVocabDraft();
      return;
    }
    saveVocabDraft({
      startedAt,
      queue: cards.map((c) => ({ kind: c.kind, key: c.key })),
      index: idx,
      sim: score.sim,
      nao: score.nao,
      requeued: [...requeuedRef.current],
      missed: [...missed],
    });
  }, [cards, idx, score, missed, startedAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      // Checagem de retrieval: Enter é do campo de digitação; espaço não vira.
      if (typedRecallActive && !flipped) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && (e.key === "1" || e.key === "2")) {
        grade(e.key === "2");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    return (
      <section className="mt-8 flex flex-col items-center rounded-2xl border border-border/60 bg-card p-8 text-center shadow-card">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success"
        >
          <CircleCheck className="size-7" strokeWidth={2} />
        </span>
        <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">Sessão concluída</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {score.sim} {score.sim === 1 ? "lembrei" : "lembrei"} · {score.nao}{" "}
          {score.nao === 1 ? "voltará em breve" : "voltarão em breve"} · {score.sim + score.nao}{" "}
          avaliações no total
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          As avaliações atualizam a caixa de revisão de cada item — “não lembrei” traz o cartão de
          volta mais cedo.
        </p>
        <Button size="sm" className="mt-4" onClick={onExit}>
          Voltar à lista
        </Button>
      </section>
    );
  }

  const isPhrase = card.kind === "phrase";
  return (
    <section className="mt-6">
      {/* Anúncio acessível (§4.3): troca de cartão e revelação chegam ao leitor de tela. */}
      <p aria-live="polite" className="sr-only">
        {flipped
          ? `Resposta revelada: ${card.literal}`
          : `Cartão ${idx + 1} de ${cards.length}: ${card.en}`}
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Modo revisão · Cartão {idx + 1} de {cards.length} · {score.sim} ✓ · {score.nao} ✗
        </p>
        <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-10" onClick={onExit}>
          Encerrar
        </Button>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso da revisão"
        aria-valuemin={0}
        aria-valuemax={cards.length}
        aria-valuenow={Math.min(idx, cards.length)}
        aria-valuetext={`${idx} de ${cards.length} cartões avaliados`}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-200"
          style={{ width: `${(idx / cards.length) * 100}%` }}
        />
      </div>
      <div
        aria-label="Cartão de estudo"
        className="mx-auto mt-4 max-w-2xl rounded-2xl bg-card p-6 shadow-pop sm:p-8"
      >
        <button
          type="button"
          aria-expanded={flipped}
          onClick={typedRecallActive ? undefined : () => setFlipped((f) => !f)}
          className="block w-full text-center"
        >
          <span
            className={cn(
              "mx-auto block font-serif text-foreground",
              isPhrase ? "text-base leading-relaxed" : "text-3xl font-semibold tracking-tight",
            )}
          >
            {card.en}
          </span>
          <span aria-hidden className="mt-3 block text-[11px] text-muted-foreground">
            {flipped
              ? "▲ resposta"
              : typedRecallActive
                ? "digite o sentido para ver a resposta"
                : "▼ toque para virar"}
          </span>
        </button>

        {flipped ? (
          <>
            <div className="mt-4 border-t border-border pt-4 text-center">
              <p className="text-lg font-semibold text-foreground">
                {card.literal}
                {missed.has(`${card.kind}:${card.key}:${card.literal}`) ? (
                  <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 align-middle text-[11px] font-normal text-destructive">
                    errou nesta sessão
                  </span>
                ) : null}
              </p>
              {card.contextual ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {card.contextual}
                </p>
              ) : null}
              {/* D16-4a: o recorte no lado de TRÁS — estudar no contexto. A
                  frente fica intocada (revelaria a resposta pela ordem das
                  palavras); typedRecall e a rotação de sentidos (D15-3c)
                  permanecem intactos. */}
              {!isPhrase && card.snippet ? (
                <div className="mt-3 border-t border-border/60 pt-3 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    No contexto
                  </p>
                  <div className="mt-2">
                    <VocabSnippet
                      snippet={card.snippet}
                      token={card.en}
                      {...(card.snippetInContext !== undefined
                        ? { inContext: card.snippetInContext }
                        : {})}
                      {...(card.snippetWhy !== undefined ? { why: card.snippetWhy } : {})}
                    />
                  </div>
                  {/* D16-4b: áudio pós-virada — palavra e recorte (D16-3a) */}
                  {audioOn ? (
                    <div className="mt-2 flex items-center gap-2">
                      <PlusSpeakButton text={card.en} enabled label="Ouvir palavra" compact />
                      <PlusSpeakButton
                        text={card.snippet}
                        enabled
                        label="Ouvir frase em contexto"
                        compact
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {/* Sentidos acumulados (§4.3): re-traduções anteriores continuam visíveis. */}
              {!isPhrase && card.senses && card.senses.length > 0 ? (
                <div className="mt-3 border-t border-border/60 pt-3 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Outros sentidos vistos
                  </p>
                  <ul className="mt-2 space-y-1">
                    {card.senses.map((s) => (
                      <li key={`${s.literal}:${s.ts}`} className="text-sm text-foreground/85">
                        {s.literal}
                        {s.contextual ? (
                          <span className="text-xs text-muted-foreground"> — {s.contextual}</span>
                        ) : null}
                        {missed.has(`${card.kind}:${card.key}:${s.literal}`) ? (
                          <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
                            errou nesta sessão
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                {isPhrase && card.type ? (
                  <SourceChip
                    type={card.type}
                    {...(card.qid !== undefined ? { qid: card.qid } : {})}
                    extra={` · frase ${(card.index ?? 0) + 1}`}
                  />
                ) : (
                  card.sources.map((s) => (
                    <SourceChip key={`${s.type}:${s.qid}`} type={s.type} qid={s.qid} />
                  ))
                )}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                {typedError ? (
                  // Falha na checagem já demoveu: continuar registra "não lembrei".
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => grade(false)}
                  >
                    Continuar
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => grade(false)}
                    >
                      ✗ Não lembrei
                    </Button>
                    <Button size="sm" className="min-h-[44px]" onClick={() => grade(true)}>
                      ✓ Lembrei
                    </Button>
                  </>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Teclado: espaço vira o cartão · 1 = não lembrei · 2 = lembrei
              </p>
            </div>
          </>
        ) : typedRecallActive ? (
          <form
            className="mt-4 flex flex-col items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitTyped();
            }}
          >
            <label htmlFor="typed-recall" className="text-xs text-muted-foreground">
              Digite o sentido em português (o sentido pedido roda entre os acumulados)
            </label>
            <input
              id="typed-recall"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="w-full max-w-xs rounded-xl border border-border bg-background px-3 py-2 text-center text-sm"
              placeholder="sentido em português"
            />
            <Button size="sm" type="submit" className="min-h-[44px]">
              Verificar
            </Button>
          </form>
        ) : (
          <div className="mt-4 flex items-center justify-center">
            <PlusSpeakButton text={card.en} enabled={audioOn} label="Ouvir pronúncia" />
          </div>
        )}
      </div>
    </section>
  );
}
