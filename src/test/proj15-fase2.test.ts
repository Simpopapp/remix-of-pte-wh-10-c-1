// Projeto 15, Fase 2 — recomendação e métricas honestas (D15-2a..2e):
// próxima ação por necessidade atual (recência + lapso), vocabulário
// ponderado, semântica única de "fraco" (latest em tipos e tópicos),
// composição dos períodos, evidência de revisão e confiança de repetidos.
import { describe, expect, it, beforeEach } from "vitest";

import { TYPE_META, allMeta, getMeta, type TaskType } from "@/lib/pte";
import { periodComparison } from "@/lib/progress-analytics";
import { buildReviewEvidence, classifyAttempts } from "@/lib/progress-evidence";
import { buildNextAction } from "@/lib/next-action";
import { buildProgressOverview } from "@/lib/progress-overview";
import { readinessBySection } from "@/lib/pte/readiness";
import { emptyState, type AppState, type Attempt } from "@/lib/storage";
import type { VocabWord } from "@/lib/plus/vocab";

const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);
const DAY = 86_400_000;

const idsOfType = (t: TaskType): string[] =>
  allMeta.filter((m) => m.taskType === t).map((m) => m.id);
/** Primeiros tipos prontos do banco (recomendação depende de getMeta real). */
const READY_TYPES = [
  ...new Set(allMeta.filter((m) => TYPE_META[m.taskType].ready).map((m) => m.taskType)),
];
const TYPE_A = READY_TYPES[0]!;
const TYPE_B = READY_TYPES[1]!;

function attempt(
  qid: string,
  ts: number,
  score: number,
  taskType: TaskType = "wfd",
  mode: "speech" | "manual" = "manual",
  opts: { wpm?: number | null; tags?: string[] } = {},
): Attempt {
  return {
    qid,
    ts,
    taskType,
    mode,
    contentScore: score,
    score,
    wpm: opts.wpm ?? null,
    durationMs: 1000,
    ...(opts.tags ? { tags: opts.tags } : {}),
  };
}

function app(attempts: Attempt[], patch: Partial<AppState> = {}): AppState {
  return { ...emptyState(), attempts, ...patch };
}

const dueWord = (word: string): VocabWord => ({
  word,
  literal: "tradução",
  savedAt: NOW,
  lastSeenAt: NOW,
  seenCount: 1,
  sources: [],
  box: 0,
  dueAt: 0,
});

const dueVocab = (n: number): AppState["vocabulary"] => ({
  words: Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`vencido${i}`, dueWord(`vencido${i}`)]),
  ),
  phrases: {},
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("buildNextAction por necessidade atual (D15-2a)", () => {
  it("piora recente bate best histórico pior com última boa (recência + lapso)", () => {
    const a = idsOfType(TYPE_A)[0]!;
    const b = idsOfType(TYPE_B)[0]!;
    const state = app([
      attempt(a, NOW - 30 * DAY, 95, TYPE_A), // best alto, mas…
      attempt(a, NOW - 1 * DAY, 40, TYPE_A), // …lapso severo ontem
      attempt(b, NOW - 10 * DAY, 40, TYPE_B), // best histórico pior…
      attempt(b, NOW - 1 * DAY, 85, TYPE_B), // …mas última boa
    ]);
    const next = buildNextAction(state, NOW);
    expect(next?.kind).toBe("practice");
    expect(next?.title).toContain(TYPE_META[TYPE_A].label);
    expect(next?.qid).toBe(a); // ação aponta a fraqueza ATUAL
  });

  it("1 item de vocabulário vencido não esmaga a recomendação de prática", () => {
    const wfd = idsOfType("wfd")[0]!;
    const state = app([attempt(wfd, NOW - 1 * DAY, 60, "wfd")], {
      vocabulary: dueVocab(1),
    });
    const next = buildNextAction(state, NOW);
    expect(next?.kind).toBe("practice");
  });

  it("vocabulário pondera por item: 4 vencidos vencem fraqueza leve", () => {
    const wfd = idsOfType("wfd")[0]!;
    const state = app([attempt(wfd, NOW - 1 * DAY, 60, "wfd")], {
      vocabulary: dueVocab(4),
    });
    const next = buildNextAction(state, NOW);
    expect(next?.kind).toBe("vocab");
    expect(next?.count).toBe(4);
  });

  it("tudo forte (última ≥ 90) e sem vocabulário → nenhuma recomendação", () => {
    const wfd = idsOfType("wfd");
    const state = app([
      attempt(wfd[0]!, NOW - 1 * DAY, 95, "wfd"),
      attempt(wfd[1]!, NOW - 2 * DAY, 95, "wfd"),
      attempt(wfd[2]!, NOW - 3 * DAY, 95, "wfd"),
    ]);
    expect(buildNextAction(state, NOW)).toBeNull();
  });
});

describe("Semântica única de fraco — latest com best rotulado (D15-2b)", () => {
  function twoQuestionsSameTopic(): { topic: string; q1: string; q2: string } {
    const byTopic = new Map<string, string[]>();
    for (const m of allMeta) {
      if (!m.topic || m.topic === "sem tópico") continue;
      const list = byTopic.get(m.topic) ?? [];
      list.push(m.id);
      byTopic.set(m.topic, list);
    }
    for (const [topic, ids] of byTopic) {
      if (ids.length >= 2) return { topic, q1: ids[0]!, q2: ids[1]! };
    }
    throw new Error("banco sem tópico com 2 questões");
  }

  it("topicScores usa a ÚLTIMA nota; best fica como contexto rotulado", () => {
    const { topic, q1, q2 } = twoQuestionsSameTopic();
    const t1 = getMeta(q1)!.taskType;
    const t2 = getMeta(q2)!.taskType;
    const state = app([
      attempt(q1, NOW - 2 * DAY, 90, t1), // best alto…
      attempt(q1, NOW - 1 * DAY, 50, t1), // …mas piorou
      attempt(q2, NOW - 1 * DAY, 60, t2),
    ]);
    const overview = buildProgressOverview(state, NOW);
    const row = overview.topicScores.find((t) => t.topic === topic);
    expect(row).toBeDefined();
    // (50 + 60) / 2 = 55 — NÃO (90 + 60) / 2 = 75 (semântica antiga)
    expect(row?.avg).toBe(55);
    expect(row?.best).toBe(90);
    expect(row?.n).toBe(2);
  });

  it("lista 'precisam de treino' pela última nota e mostra o best como contexto", () => {
    const { q1 } = twoQuestionsSameTopic();
    const t1 = getMeta(q1)!.taskType;
    const state = app([attempt(q1, NOW - 2 * DAY, 90, t1), attempt(q1, NOW - 1 * DAY, 50, t1)]);
    const overview = buildProgressOverview(state, NOW);
    const item = overview.weak.find((w) => w.meta.id === q1);
    // best histórico 90 já não esconde a fraqueza atual (last 50)
    expect(item?.last).toBe(50);
    expect(item?.best).toBe(90);
  });
});

describe("Composição dos períodos (D15-2c)", () => {
  it("janela separa nova, repetida e revisão vencida, com rótulo de mistura", () => {
    const wfd = idsOfType("wfd")[0]!;
    // 1ª tentativa falha → caixa 0 → dueAt = ts (vencida imediatamente);
    // a repetição 2 dias depois é revisão VENCIDA de verdade.
    const c = periodComparison(
      [attempt(wfd, NOW - 3 * DAY, 40, "wfd"), attempt(wfd, NOW - 1 * DAY, 80, "wfd")],
      NOW,
    );
    expect(c.currentMix.nova).toBe(1);
    expect(c.currentMix.repetida).toBe(1);
    expect(c.currentMix.vencida).toBe(1);
    expect(c.currentMixLabel).toContain("1 nova");
    expect(c.currentMixLabel).toContain("1 repetida");
    expect(c.currentMixLabel).toContain("revisão vencida");
    expect(c.currentMixLabel).toContain("mistura novos e repetidos");
    expect(c.previousMix.scored).toBe(0);
  });

  it("exame entra na composição (tag 'exam')", () => {
    const wfd = idsOfType("wfd")[0]!;
    const c = periodComparison(
      [attempt(wfd, NOW - 2 * DAY, 80, "wfd", "manual", { tags: ["exam"] })],
      NOW,
    );
    expect(c.currentMix.exam).toBe(1);
    expect(c.currentMixLabel).toContain("1 de exame");
  });
});

describe("Confiança de repetidos e itens não vistos (D15-2e)", () => {
  it("readiness expõe não vistas, repetições e a fatia de repetidas", () => {
    const wfd = idsOfType("wfd")[0]!;
    const rows = readinessBySection(
      {
        attempts: [
          attempt(wfd, NOW - 3 * DAY, 80, "wfd"),
          attempt(wfd, NOW - 1 * DAY, 90, "wfd"), // repetição do mesmo item
        ],
        questions: {},
      },
      NOW,
    );
    const row = rows.find((r) => r.section === TYPE_META["wfd"].section)!;
    expect(row.unseen).toBe(row.total); // snapshot vazio → nada coberto
    expect(row.scoredN).toBe(2);
    expect(row.repeats).toBe(1);
    expect(row.repeatShare).toBe(50);
  });
});

describe("Evidência de revisão (D15-2d)", () => {
  const wfdIds = idsOfType("wfd");
  const ra = idsOfType("read_aloud")[0]!;

  function evidenceFixture(): Attempt[] {
    const qA = wfdIds[0]!;
    const qB = wfdIds[1]!;
    return [
      // qA: falha (nova) → caixa 0, dueAt = ts → repetição é VENCIDA e passa.
      attempt(qA, NOW - 3 * DAY, 40, "wfd"),
      attempt(qA, NOW - 1 * DAY, 85, "wfd"),
      // qB: passa na 1ª (caixa 1, dueAt = ts + 1d) → repetição ANTECIPADA.
      attempt(qB, NOW - 3 * DAY, 90, "wfd"),
      attempt(qB, NOW - 3 * DAY + 23 * 3_600_000, 90, "wfd"),
      // fala: ritmo medido, 12 h de intervalo (antecipada também).
      attempt(ra, NOW - 18 * 3_600_000, 100, "read_aloud", "speech", { wpm: 120 }),
      attempt(ra, NOW - 6 * 3_600_000, 100, "read_aloud", "speech", { wpm: 150 }),
    ];
  }

  it("separa taxa de acerto em revisões vencidas vs. antecipadas", () => {
    const ev = buildReviewEvidence(evidenceFixture(), NOW);
    expect(ev.due.n).toBe(1); // só a repetição de qA
    expect(ev.due.passRate).toBe(100); // 85 ≥ limiar do wfd (85)
    expect(ev.early.n).toBe(2); // qB repetida + 2ª tentativa de fala
    expect(ev.early.passRate).toBe(100);
    expect(ev.recentLapses).toBe(1); // 40 do wfd dentro de 14 dias
  });

  it("trajetória dos componentes de fala (ritmo), com pausas quando existem", () => {
    const ev = buildReviewEvidence(evidenceFixture(), NOW);
    expect(ev.speaking).not.toBeNull();
    expect(ev.speaking?.n).toBe(2);
    expect(ev.speaking?.wpmAvg).toBe(135);
    expect(ev.speaking?.wpmFirst).toBe(120);
    expect(ev.speaking?.wpmLast).toBe(150);
    expect(ev.speaking?.pausesAvg).toBeNull();
  });

  it("classifyAttempts marca exame pela tag 'exam' e primeira tentativa nunca é revisão", () => {
    const rows = classifyAttempts([
      attempt(wfdIds[0]!, NOW - 4 * DAY, 80, "wfd", "manual", { tags: ["exam"] }),
    ]);
    expect(rows[0]?.exam).toBe(true);
    expect(rows[0]?.review).toBe("primeira");
    expect(rows[0]?.repeat).toBe(false);
  });

  it("sem dados → taxas null e speaking null (honesto)", () => {
    const ev = buildReviewEvidence([], NOW);
    expect(ev.due.passRate).toBeNull();
    expect(ev.early.passRate).toBeNull();
    expect(ev.recentLapses).toBe(0);
    expect(ev.speaking).toBeNull();
  });
});
