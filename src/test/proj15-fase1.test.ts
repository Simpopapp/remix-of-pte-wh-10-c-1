// Projeto 15, Fase 1 — ciclo de aprendizado fechado (D15-1a..1e):
// lapso abre correção pendente no snapshot (puro), passar fecha; diagnóstico
// IA persiste dimensões fracas e sobrevive a backup/merge; fila de erros
// ganha verificação de transferência (questão nunca vista do mesmo tipo).
import { describe, expect, it, beforeEach } from "vitest";

import { TYPE_META, allMeta, getMeta, type TaskType } from "@/lib/pte";
import { weakDimensionKeys, type AiGradeResult } from "@/lib/plus/aiGradeSchemas";
import {
  applyAttemptToSnapshot,
  computeStats,
  emptyState,
  exportBackup,
  getStateSnapshot,
  importBackup,
  recordAiDiagnosis,
  recordAttempt,
  replaceState,
  type Attempt,
  type QuestionStat,
  type QuestionSnapshot,
} from "@/lib/storage";
import { mergeStates } from "@/lib/backup";
import {
  completeSessionItem,
  countEarlyReviews,
  endSession,
  sessionFinished,
  sessionNextId,
  startSession,
  transferCandidateId,
} from "@/lib/session";

const TS = 1_700_000_000_000;

function attempt(partial: Partial<Attempt> & { qid: string; ts: number; score: number }): Attempt {
  return {
    taskType: "read_aloud",
    mode: "speech",
    contentScore: null,
    wpm: null,
    durationMs: 0,
    ...partial,
  };
}

function snapWith(score: number): QuestionSnapshot {
  return applyAttemptToSnapshot(undefined, attempt({ qid: "qA", ts: TS, score }));
}

/** Primeiro task type do banco com ao menos 2 questões com motor de prática. */
function readyTypeWithTwo(): { type: TaskType; a: string; b: string } {
  const byType = new Map<TaskType, string[]>();
  for (const m of allMeta) {
    if (!TYPE_META[m.taskType].ready) continue;
    const list = byType.get(m.taskType) ?? [];
    list.push(m.id);
    byType.set(m.taskType, list);
  }
  for (const [type, ids] of byType) {
    if (ids.length >= 2) return { type, a: ids[0]!, b: ids[1]! };
  }
  throw new Error("banco sem tipo com 2 questões");
}

beforeEach(() => {
  window.localStorage.clear();
  replaceState(emptyState());
  endSession();
});

describe("Correção pendente no SRS (D15-1b)", () => {
  it("lapso abre needsCorrection; tentativa que passa fecha", () => {
    const afterFail = snapWith(40);
    expect(afterFail.needsCorrection).toBe(true);
    const afterPass = applyAttemptToSnapshot(
      afterFail,
      attempt({ qid: "qA", ts: TS + 1_000, score: 90 }),
    );
    // Fechada = campo ausente (só existe quando pendente).
    expect(afterPass.needsCorrection).toBeUndefined();
  });
});

describe("Diagnóstico IA no snapshot (D15-1a)", () => {
  it("recordAiDiagnosis grava e lista vazia limpa", () => {
    recordAttempt({ qid: "qA", ts: TS, score: 55 });
    recordAiDiagnosis("qA", ["grammar", "cohesion"]);
    expect(getStateSnapshot().questions["qA"]?.aiWeak).toEqual(["grammar", "cohesion"]);

    recordAiDiagnosis("qA", []);
    expect(getStateSnapshot().questions["qA"]?.aiWeak).toBeUndefined();
  });

  it("sem tentativa registrada, o diagnóstico é ignorado", () => {
    recordAiDiagnosis("qDesconhecida", ["grammar"]);
    expect(getStateSnapshot().questions["qDesconhecida"]).toBeUndefined();
  });

  it("diagnóstico sobrevive a export/import e ao merge (lado mais recente vence)", () => {
    recordAttempt({ qid: "qA", ts: TS, score: 55 });
    recordAiDiagnosis("qA", ["grammar"]);
    const json = exportBackup();

    replaceState(emptyState());
    expect(importBackup(json).ok).toBe(true);
    expect(getStateSnapshot().questions["qA"]?.aiWeak).toEqual(["grammar"]);

    // Merge: backup antigo sem diagnóstico + local com diagnóstico → mantém.
    const local = getStateSnapshot();
    const old = JSON.parse(JSON.stringify(local)) as ReturnType<typeof emptyState>;
    delete (old.questions["qA"] as QuestionSnapshot).aiWeak;
    const merged = mergeStates(old, local);
    expect(merged.questions["qA"]?.aiWeak).toEqual(["grammar"]);
  });
});

describe("Fila de erros com verificação de transferência (D15-1c)", () => {
  function statFor(score: number): QuestionStat {
    return {
      attempts: 1,
      bestContent: score,
      lastScore: score,
      lastAttemptAt: TS,
      box: 0,
      dueAt: 0,
      bestWpm: null,
      strongAttempts: 0,
      dueStrongAttempts: 0,
      prevStrong: false,
      lastAttemptDue: false,
    };
  }

  it("transferCandidateId devolve questão nunca vista do tipo", () => {
    const { type, a } = readyTypeWithTwo();
    const stats = new Map<string, QuestionStat>([[a, statFor(40)]]);
    const transfer = transferCandidateId(stats, type, false);
    expect(transfer).toBeDefined();
    expect(transfer).not.toBe(a);
    expect(getMeta(transfer!)!.taskType).toBe(type);
    expect(stats.has(transfer!)).toBe(false);
  });

  it("sessão de erros inclui a questão de transferência no fim da fila", () => {
    const { type, a } = readyTypeWithTwo();
    recordAttempt({ qid: a, ts: TS, score: 40 });
    const stats = computeStats(getStateSnapshot());
    const expected = transferCandidateId(stats, type, false);
    expect(expected).toBeDefined();

    startSession(3, stats, { mode: "errors" });
    const walked: string[] = [];
    while (!sessionFinished()) {
      const id = sessionNextId();
      if (!id) break;
      walked.push(id);
      completeSessionItem({ qid: id, score: null, wpm: null });
    }
    endSession();
    expect(walked[0]).toBe(a);
    expect(walked[walked.length - 1]).toBe(expected); // verificação no fim
  });

  it("sem questão não vista do tipo, a transferência fica para depois (honesto)", () => {
    const { type, a } = readyTypeWithTwo();
    recordAttempt({ qid: a, ts: TS, score: 40 });
    for (const m of allMeta) {
      if (m.taskType === type && m.id !== a) recordAttempt({ qid: m.id, ts: TS + 1, score: 50 });
    }
    const stats = computeStats(getStateSnapshot());
    expect(transferCandidateId(stats, type, false)).toBeUndefined();
  });
});

describe("Treino extra rotulado (D15-1d)", () => {
  it("countEarlyReviews conta só revisões antecipadas em questões já vistas", () => {
    const stats = new Map<string, QuestionStat>();
    stats.set("qEarly", { attempts: 2, lastAttemptDue: false } as QuestionStat);
    stats.set("qDue", { attempts: 2, lastAttemptDue: true } as QuestionStat);
    stats.set("qFirst", { attempts: 1, lastAttemptDue: false } as QuestionStat);
    const results = [
      { qid: "qEarly", score: 80, wpm: null },
      { qid: "qDue", score: 80, wpm: null },
      { qid: "qFirst", score: 80, wpm: null },
      { qid: "qSkip", score: null, wpm: null },
    ];
    expect(countEarlyReviews(results, stats)).toBe(1);
  });
});

describe("Dimensões fracas do grader (D15-1a)", () => {
  it("lista só dimensões abaixo do limiar", () => {
    const g = {
      overall: 60,
      dimensions: { content: 80, form: 80, grammar: 40, vocabulary: 69, cohesion: 70 },
      summary: "",
      errors: [],
      nextAction: "",
    } as unknown as AiGradeResult;
    expect(weakDimensionKeys(g)).toEqual(["grammar", "vocabulary"]);
  });
});
