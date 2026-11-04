// Projeto 18, Fase 4 — revisão fiel do simulado (D18-4):
// o registro arquivado guarda a RESPOSTA SUBMETIDA (cap 2.000) e a CAUSA por
// questão; a revisão reconstrói do registro persistido após reload;
// referenceFor ganha essay e read_fib_bank; blueprint inclui o novo tipo.
import { describe, expect, it, beforeEach, vi } from "vitest";

import { CAUSE_LABEL, referenceFor } from "@/components/exam/examReviewShared";
import { BLUEPRINT_OMISSIONS, EXAM_PLAN, type ExamBlock } from "@/lib/pte/exam";
import { allMeta } from "@/lib/pte/manifest";
import { loadQuestion } from "@/lib/pte";

const LONG = "x".repeat(2500);
const essayId = allMeta.find((m) => m.taskType === "write_essay")!.id;
const bankId = allMeta.find((m) => m.taskType === "read_fib_bank")!.id;

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

async function loadStorage() {
  return import("@/lib/storage");
}

describe("registro persistido guarda resposta + causa (D18-4)", () => {
  it("addSessionRecord preserva cause e answer por questão, com cap de 2.000", async () => {
    const storage = await loadStorage();
    storage.addSessionRecord({
      startedAt: 1000,
      finishedAt: 2000,
      kind: "exam",
      label: "Simulado completo",
      results: [
        { qid: "q1", score: 80, wpm: null, cause: "graded", answer: LONG },
        { qid: "q2", score: null, wpm: null, cause: "skipped" },
        { qid: "q3", score: 70, wpm: null },
      ],
    });
    const state = storage.getStateSnapshot();
    const rec = state.sessions[0]!;
    expect(rec.kind).toBe("exam");
    expect(rec.results[0]?.cause).toBe("graded");
    expect(rec.results[0]?.answer).toHaveLength(2000); // cap 2.000
    expect(rec.results[1]?.cause).toBe("skipped");
    expect(rec.results[1]?.answer).toBeUndefined();
    expect(rec.results[2]?.cause).toBeUndefined();
  });

  it("causa inválida não entra no registro; resposta em branco é descartada", async () => {
    const storage = await loadStorage();
    storage.addSessionRecord({
      startedAt: 1000,
      finishedAt: 2000,
      kind: "exam",
      label: "Mini-simulado",
      results: [{ qid: "q1", score: 80, wpm: null, cause: "inventada" as never, answer: "   " }],
    });
    const rec = storage.getStateSnapshot().sessions[0]!;
    expect(rec.results[0]?.cause).toBeUndefined();
    expect(rec.results[0]?.answer).toBeUndefined();
  });

  it("RELOAD: registro reconstrói a revisão após reset de módulos (forma persistida)", async () => {
    const storage = await loadStorage();
    storage.addSessionRecord({
      startedAt: 1000,
      finishedAt: 2000,
      kind: "exam",
      label: "Simulado completo",
      results: [
        { qid: "q1", score: 80, wpm: null, cause: "graded", answer: "minha resposta integral" },
      ],
    });

    vi.resetModules();
    const reloaded = await loadStorage();
    const rec = reloaded.getStateSnapshot().sessions[0]!;
    expect(rec.label).toBe("Simulado completo");
    expect(rec.results[0]?.cause).toBe("graded");
    expect(rec.results[0]?.answer).toBe("minha resposta integral");
  });

  it("sessões antigas sem cause/answer continuam legíveis (compatibilidade)", async () => {
    const storage = await loadStorage();
    // Linha no formato antigo (só qid/score/wpm).
    storage.addSessionRecord({
      startedAt: 1000,
      finishedAt: 2000,
      kind: "exam",
      label: "Simulado completo",
      results: [{ qid: "q1", score: 60, wpm: null }],
    });
    const rec = storage.getStateSnapshot().sessions[0]!;
    expect(rec.results[0]).toEqual({ qid: "q1", score: 60, wpm: null });
    expect(CAUSE_LABEL.graded).toBe("Avaliada automaticamente");
  });
});

describe("referenceFor — casos essay e read_fib_bank (D18-4)", () => {
  it("essay exibe a resposta MODELO do item quando existe", async () => {
    const q = await loadQuestion(essayId);
    expect(q).not.toBeNull();
    expect(referenceFor(q!)).toBe((q as { sample: string }).sample);
  });

  it("read_fib_bank exibe o gabarito das lacunas em ordem", async () => {
    const q = await loadQuestion(bankId);
    expect(q).not.toBeNull();
    const bank = q as unknown as { blanks: string[] };
    expect(referenceFor(q!)).toBe(bank.blanks.join(" · "));
  });
});

describe("blueprint do simulado completo inclui read_fib_bank (D18-6/D18-4)", () => {
  it("bloco Reading tem o tipo com tempo oficial; nenhuma omissão declarada", () => {
    const reading = EXAM_PLAN.full.filter((b: ExamBlock) => b.taskType === "read_fib_bank");
    expect(reading).toHaveLength(1);
    expect(reading[0]?.count).toBeGreaterThan(0);
    expect(reading[0]?.seconds).toBe(120);
    expect(BLUEPRINT_OMISSIONS).toEqual([]);
    // O plano encurtado (mini) não muda — o bloco é do blueprint completo.
    const miniReading = EXAM_PLAN.mini.filter((b) => b.taskType === "read_fib_bank");
    expect(miniReading).toHaveLength(0);
  });
});
