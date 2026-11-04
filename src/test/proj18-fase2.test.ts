// Projeto 18, Fase 2 — next-action v2 (D18-2):
// meta do usuário define o alvo de fraqueza (escala oficial → % interna),
// janela de exame (≤ 14 dias) prioriza cobertura (diagnóstico rotulado) e
// simulado, e correção pendente (needsCorrection/aiWeak) vence tudo.
import { describe, expect, it, beforeEach } from "vitest";

import { TYPE_META, allMeta, type TaskType } from "@/lib/pte";
import { internalTargetFor, buildNextAction } from "@/lib/next-action";
import { emptyState, type AppState, type Attempt, type QuestionSnapshot } from "@/lib/storage";
import type { VocabWord } from "@/lib/plus/vocab";

const NOW = Date.UTC(2026, 11, 4, 12, 0, 0); // 2026-12-04T12:00Z
const DAY = 86_400_000;

const idsOfType = (t: TaskType): string[] =>
  allMeta.filter((m) => m.taskType === t).map((m) => m.id);
const READY_TYPES = [
  ...new Set(allMeta.filter((m) => TYPE_META[m.taskType].ready).map((m) => m.taskType)),
];
const TYPE_A = READY_TYPES[0]!;
const TYPE_B = READY_TYPES[1]!;

function attempt(qid: string, ts: number, score: number, taskType: TaskType = "wfd"): Attempt {
  return {
    qid,
    ts,
    taskType,
    mode: "manual",
    contentScore: score,
    score,
    wpm: null,
    durationMs: 1000,
  };
}

function snapshot(lastAttemptAt: number, patch: Partial<QuestionSnapshot> = {}): QuestionSnapshot {
  return {
    attempts: 1,
    bestScore: null,
    bestWpm: null,
    lastScore: null,
    lastAttemptAt,
    strongAttempts: 0,
    dueStrongAttempts: 0,
    prevStrong: false,
    lastAttemptDue: false,
    box: 0,
    dueAt: 0,
    ...patch,
  };
}

function app(patch: Partial<AppState> = {}): AppState {
  return { ...emptyState(), ...patch };
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

const examDate = (days: number): string => new Date(NOW + days * DAY).toISOString().slice(0, 10);

beforeEach(() => {
  window.localStorage.clear();
});

describe("meta do usuário define o alvo de fraqueza (D18-2)", () => {
  it("conversão da escala oficial 10–90 para a % interna (inverso de estimateSkill, teto 90)", () => {
    expect(internalTargetFor(65)).toBe(69); // (65−10)/0,8
    expect(internalTargetFor(50)).toBe(50);
    expect(internalTargetFor(79)).toBe(86); // (79−10)/0,8 = 86,25
    expect(internalTargetFor(90)).toBe(90); // teto: nunca exige > 90 interno
  });

  it("com targetScore 79, última 75 é fraqueza; com targetScore 65, 75 não é", () => {
    const a = idsOfType(TYPE_A)[0]!;
    const forte = app({
      attempts: [attempt(a, NOW - 1 * DAY, 75, TYPE_A)],
      settings: { ...emptyState().settings, targetScore: 79 },
    });
    const nextForte = buildNextAction(forte, NOW);
    expect(nextForte?.kind).toBe("practice");
    expect(nextForte?.title).toContain(TYPE_META[TYPE_A].label);

    // Alvo 69: 75 ≥ 69 → sem fraqueza, sem vocabulário → null.
    const modesto = app({
      attempts: [attempt(a, NOW - 1 * DAY, 75, TYPE_A)],
      settings: { ...emptyState().settings, targetScore: 65 },
    });
    expect(buildNextAction(modesto, NOW)).toBeNull();
  });
});

describe("janela do exame (≤ 14 dias) prioriza cobertura e simulado (D18-2)", () => {
  it("tipo nunca tentado vira AÇÃO DE DIAGNÓSTICO rotulada e vence fraqueza leve já medida", () => {
    const a = idsOfType(TYPE_A)[0]!;
    const state = app({
      attempts: [attempt(a, NOW - 1 * DAY, 65, TYPE_A)], // fraqueza leve (alvo 69 → 4 pts)
      settings: { ...emptyState().settings, examDate: examDate(7) },
    });
    const next = buildNextAction(state, NOW);
    expect(next?.kind).toBe("practice");
    expect(next?.title).toMatch(/^Diagnosticar /);
    expect(next?.detail).toContain("Ação de diagnóstico");
  });

  it("fora da janela, a mesma fraqueza leve volta a ser 'Treinar'", () => {
    const a = idsOfType(TYPE_A)[0]!;
    const state = app({
      attempts: [attempt(a, NOW - 1 * DAY, 65, TYPE_A)],
      settings: { ...emptyState().settings, examDate: examDate(30) },
    });
    const next = buildNextAction(state, NOW);
    expect(next?.kind).toBe("practice");
    expect(next?.title).toMatch(/^Treinar /);
  });

  it("janela com tudo medido e sem fraqueza → SIMULADO; sem data → null", () => {
    const attempts = READY_TYPES.map((t, i) =>
      attempt(idsOfType(t)[0]!, NOW - (i + 1) * DAY, 95, t),
    );
    const janela = app({
      attempts,
      settings: { ...emptyState().settings, examDate: examDate(5) },
    });
    const next = buildNextAction(janela, NOW);
    expect(next?.kind).toBe("exam");
    expect(next?.title).toContain("simulado");

    const semData = app({ attempts });
    expect(buildNextAction(semData, NOW)).toBeNull();
  });
});

describe("correção pendente vence tudo (D18-2)", () => {
  it("needsCorrection vence vocabulário vencido, lapso severo e janela de exame", () => {
    const a = idsOfType(TYPE_A)[0]!;
    const b = idsOfType(TYPE_B)[0]!;
    const state = app({
      attempts: [
        attempt(b, NOW - 30 * DAY, 95, TYPE_B),
        attempt(b, NOW - 1 * DAY, 30, TYPE_B), // lapso severo
      ],
      questions: { [a]: snapshot(NOW - 2 * DAY, { needsCorrection: true }) },
      vocabulary: dueVocab(9),
      settings: { ...emptyState().settings, examDate: examDate(3) },
    });
    const next = buildNextAction(state, NOW);
    expect(next?.kind).toBe("practice");
    expect(next?.qid).toBe(a);
    expect(next?.title).toContain("Corrigir");
    expect(next?.detail).toContain("abaixo do critério de passe");
  });

  it("aiWeak vira correção pendente com as dimensões apontadas pela IA", () => {
    const a = idsOfType(TYPE_A)[0]!;
    const state = app({
      questions: { [a]: snapshot(NOW - 1 * DAY, { aiWeak: ["Ortografia"] }) },
    });
    const next = buildNextAction(state, NOW);
    expect(next?.kind).toBe("practice");
    expect(next?.qid).toBe(a);
    expect(next?.detail).toContain("IA apontou: Ortografia");
  });

  it("pendência em tipo sem estatística NÃO vira recomendação normal — e fora dela nada aponta tipo nunca tentado", () => {
    // Sem janela de exame, sem pendências: ação aponta tipo JÁ medido.
    const a = idsOfType(TYPE_A)[0]!;
    const b = idsOfType(TYPE_B)[0]!;
    const state = app({
      attempts: [attempt(a, NOW - 1 * DAY, 40, TYPE_A)],
      questions: { [b]: snapshot(NOW - 1 * DAY, { needsCorrection: true, lastAttemptAt: 0 }) },
    });
    // needsCorrection com lastAttemptAt 0 continua pendência (vence tudo)…
    const next = buildNextAction(state, NOW);
    expect(next?.title).toContain("Corrigir");
    // …mas sem pendência a ação aponta o tipo medido.
    const semPendencia = app({ attempts: [attempt(a, NOW - 1 * DAY, 40, TYPE_A)] });
    const next2 = buildNextAction(semPendencia, NOW);
    expect(next2?.kind).toBe("practice");
    expect(next2?.qid).toBe(a);
  });
});
