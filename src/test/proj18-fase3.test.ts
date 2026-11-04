// Projeto 18, Fase 3 — prontidão honesta (D18-3):
// confiança por DIVERSIDADE (itens únicos — repetir não sobe), evidência de
// TRANSFERÊNCIA (contato com itens inéditos na janela de 14 dias é requisito
// dos rótulos "Quase pronto"/"Pronto") e aviso de frescor (> 14 dias).
import { describe, expect, it } from "vitest";

import { emptyState, type AppState, type Attempt, type QuestionSnapshot } from "@/lib/storage";
import { allMeta } from "@/lib/pte/manifest";
import { TYPE_META } from "@/lib/pte/types";
import { readinessBySection } from "@/lib/pte/readiness";

const DAY = 86_400_000;
const TOTALS = { speaking: 100, writing: 50, reading: 50, listening: 100 };
const NOW = Date.UTC(2026, 10, 4, 12, 0, 0); // 2026-11-04T12:00Z

const SPEAKING_QIDS = allMeta
  .filter((m) => TYPE_META[m.taskType].section === "speaking")
  .map((m) => m.id);

function attempt(
  partial: Partial<Attempt> & { qid: string; taskType: Attempt["taskType"] },
): Attempt {
  return {
    ts: NOW,
    mode: "manual",
    contentScore: null,
    score: null,
    wpm: null,
    durationMs: 0,
    ...partial,
  };
}

function snapshot(attempts: number, lastAttemptAt = 0): QuestionSnapshot {
  return {
    attempts,
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
  };
}

function app(attempts: Attempt[], questions: Record<string, QuestionSnapshot> = {}): AppState {
  return { ...emptyState(), attempts, questions };
}

function speaking(rows: ReturnType<typeof readinessBySection>) {
  return rows.find((r) => r.section === "speaking")!;
}

describe("D18-3 · confiança por diversidade", () => {
  it("repetir o MESMO item N vezes não sobe a confiança (itens únicos decidem)", () => {
    const qid = SPEAKING_QIDS[0]!;
    const attempts = Array.from({ length: 30 }, (_, i) =>
      attempt({ qid, taskType: "read_aloud", ts: NOW - i * DAY, score: 85 }),
    );
    const rows = readinessBySection(app(attempts, { [qid]: snapshot(30, NOW) }), NOW, TOTALS);
    const sp = speaking(rows);
    expect(sp.uniqueItems).toBe(1);
    expect(sp.n).toBe(30);
    expect(sp.confidence).toBe("low");
  });

  it("10 itens únicos → média; 25 itens únicos → alta (via log, sem snapshot)", () => {
    const ids = SPEAKING_QIDS.slice(0, 25);
    const mk = (n: number) =>
      ids
        .slice(0, n)
        .map((qid, i) => attempt({ qid, taskType: "read_aloud", ts: NOW - i * DAY, score: 80 }));
    expect(speaking(readinessBySection(app(mk(9)), NOW, TOTALS)).confidence).toBe("low");
    expect(speaking(readinessBySection(app(mk(10)), NOW, TOTALS)).confidence).toBe("medium");
    expect(speaking(readinessBySection(app(mk(25)), NOW, TOTALS)).confidence).toBe("high");
  });
});

describe("D18-3 · transferência (itens inéditos) é requisito de 'Quase pronto'", () => {
  it("quase pronto sem contato inédito na janela satura em 64 ('Em progresso'); 1 contato inédito libera", () => {
    const [a, b, novo] = SPEAKING_QIDS;
    // Base: duas notas 85 há 20 dias (fora da janela de 14 dias); na janela,
    // só repetições dos mesmos itens → sem evidência de transferência.
    const base = app(
      [
        attempt({ qid: a!, taskType: "read_aloud", ts: NOW - 20 * DAY, score: 85 }),
        attempt({ qid: a!, taskType: "read_aloud", ts: NOW - 1 * DAY, score: 85 }),
        attempt({ qid: b!, taskType: "read_aloud", ts: NOW - 20 * DAY, score: 85 }),
        attempt({ qid: b!, taskType: "read_aloud", ts: NOW - 2 * DAY, score: 85 }),
      ],
      { [a!]: snapshot(2), [b!]: snapshot(2) },
    );
    const capped = speaking(readinessBySection(base, NOW, TOTALS));
    expect(capped.novelContacts).toBe(0);
    // 85 − 10 (cobertura 2% + variedade 14%) = 75 → satura em 64
    expect(capped.score).toBe(64);
    expect(capped.level).toBe("Em progresso");

    // Um contato INÉDITO (1ª tentativa em item novo) ontem devolve o rótulo.
    const withNovel = app(
      [
        ...base.attempts,
        attempt({ qid: novo!, taskType: "answer_short", ts: NOW - 1 * DAY, score: 85 }),
      ],
      base.questions,
    );
    const released = speaking(readinessBySection(withNovel, NOW, TOTALS));
    expect(released.novelContacts).toBe(1);
    expect(released.score).toBe(75);
    expect(released.level).toBe("Quase pronto");
  });

  it("não-regressão: rótulos abaixo de 65 não mudam sem evidência", () => {
    const qid = SPEAKING_QIDS[0]!;
    const fraco = app([attempt({ qid, taskType: "read_aloud", ts: NOW, score: 40 })]);
    const row = speaking(readinessBySection(fraco, NOW, TOTALS));
    expect(row.score).toBeLessThan(40);
    expect(row.level).toBe("Iniciando");

    const medio = app([attempt({ qid, taskType: "read_aloud", ts: NOW, score: 60 })]);
    const row2 = speaking(readinessBySection(medio, NOW, TOTALS));
    expect(row2.level).toBe("Em progresso");
  });
});

describe("D18-3 · aviso de frescor (> 14 dias)", () => {
  it("última tentativa com score há 20 dias → stale (do log E do snapshot)", () => {
    const qid = SPEAKING_QIDS[0]!;
    const viaLog = app([attempt({ qid, taskType: "read_aloud", ts: NOW - 20 * DAY, score: 80 })]);
    const rowLog = speaking(readinessBySection(viaLog, NOW, TOTALS));
    expect(rowLog.stale).toBe(true);
    expect(Math.round(rowLog.lastAttemptAgeDays!)).toBe(20);

    // Registro durável: log vazio, snapshot guarda lastAttemptAt (corte do log).
    const viaSnapshot = app([], { [qid]: snapshot(3, NOW - 20 * DAY) });
    const rowSnap = speaking(readinessBySection(viaSnapshot, NOW, TOTALS));
    expect(rowSnap.stale).toBe(true);
    expect(Math.round(rowSnap.lastAttemptAgeDays!)).toBe(20);
  });

  it("exatamente 14 dias NÃO é stale; ontem não é stale", () => {
    const qid = SPEAKING_QIDS[0]!;
    const exato = app([attempt({ qid, taskType: "read_aloud", ts: NOW - 14 * DAY, score: 80 })]);
    expect(speaking(readinessBySection(exato, NOW, TOTALS)).stale).toBe(false);
    const recente = app([attempt({ qid, taskType: "read_aloud", ts: NOW - 1 * DAY, score: 80 })]);
    expect(speaking(readinessBySection(recente, NOW, TOTALS)).stale).toBe(false);
  });

  it("contato inédito conta na janela: exatamente 14 dias ainda é janela", () => {
    const [a, b] = SPEAKING_QIDS;
    const rows = app([
      attempt({ qid: a!, taskType: "read_aloud", ts: NOW - 14 * DAY, score: 80 }),
      attempt({ qid: b!, taskType: "answer_short", ts: NOW - 14 * DAY, score: 80 }),
    ]);
    expect(speaking(readinessBySection(rows, NOW, TOTALS)).novelContacts).toBe(2);
  });
});
