// Projeto 15, Fase 3 — SRS de vocabulário com rigor (D15-3a..3c):
// promoção de caixa só com item vencido, checagem de retrieval opcional
// (config; falha demove; desligado = comportamento anterior) e sentido
// pedido rodando entre os acumulados com erro recorrente visível.
import { describe, expect, it, beforeEach } from "vitest";

import {
  applyVocabStudy,
  VOCAB_INTERVAL_DAYS,
  type VocabStore,
  type VocabWord,
} from "@/lib/plus/vocab";
import { recallTargets, rotateTarget, senseMatches } from "@/lib/plus/vocabStudy";
import { DEFAULT_PLUS, getVocabDraft, normalizePlusSettings, saveVocabDraft } from "@/lib/storage";

const TS = Date.UTC(2026, 10, 3, 12, 0, 0);
const DAY = 86_400_000;

function word(patch: Partial<VocabWord> = {}): VocabWord {
  return {
    word: "eloquent",
    literal: "eloquente",
    savedAt: TS,
    lastSeenAt: TS,
    seenCount: 1,
    sources: [],
    box: 2,
    dueAt: TS + 3 * DAY, // não vencido em TS
    ...patch,
  };
}

function store(w: VocabWord): VocabStore {
  return { words: { eloquent: w }, phrases: {} };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("Promoção só com item vencido (D15-3a)", () => {
  it("'lembrei' em item NÃO vencido não promove (e não demove)", () => {
    const out = applyVocabStudy(store(word()), "word", "eloquent", true, TS);
    const item = out.words["eloquent"]!;
    expect(item.box).toBe(2);
    expect(item.dueAt).toBe(TS + 3 * DAY); // prazo intacto
  });

  it("'lembrei' em item VENCIDO promove uma caixa e reagenda", () => {
    const w = word({ dueAt: TS - DAY }); // vencido
    const out = applyVocabStudy(store(w), "word", "eloquent", true, TS);
    const item = out.words["eloquent"]!;
    expect(item.box).toBe(3);
    expect(item.dueAt).toBe(TS + VOCAB_INTERVAL_DAYS[3]! * DAY);
  });

  it("caixa 0 é sempre vencida: 'lembrei' promove", () => {
    const w = word({ box: 0, dueAt: 0 });
    const out = applyVocabStudy(store(w), "word", "eloquent", true, TS);
    expect(out.words["eloquent"]!.box).toBe(1);
  });

  it("'não lembrei' demove uma caixa (vencido ou não) e volta ao intervalo novo", () => {
    const due = applyVocabStudy(store(word({ dueAt: TS - DAY })), "word", "eloquent", false, TS);
    expect(due.words["eloquent"]!.box).toBe(1);
    expect(due.words["eloquent"]!.dueAt).toBe(TS + VOCAB_INTERVAL_DAYS[1]! * DAY);

    const early = applyVocabStudy(store(word()), "word", "eloquent", false, TS);
    expect(early.words["eloquent"]!.box).toBe(1);
    expect(early.words["eloquent"]!.dueAt).toBe(TS + VOCAB_INTERVAL_DAYS[1]! * DAY);
  });

  it("teto de caixa 5: 'lembrei' vencido não passa de 5", () => {
    const w = word({ box: 5, dueAt: TS - DAY });
    const out = applyVocabStudy(store(w), "word", "eloquent", true, TS);
    expect(out.words["eloquent"]!.box).toBe(5);
  });
});

describe("Checagem de retrieval opcional (D15-3b)", () => {
  it("config: desligada por padrão; ligada só com true explícito", () => {
    expect(DEFAULT_PLUS.typedRecall).toBe(false);
    expect(normalizePlusSettings({}).typedRecall).toBe(false);
    expect(normalizePlusSettings({ typedRecall: true }).typedRecall).toBe(true);
    // Estados migrados sem o campo continuam desligados (comportamento atual).
    expect(normalizePlusSettings({ vocabCapture: true }).typedRecall).toBe(false);
  });

  it("frases não participam da checagem digitada (só palavras têm sentidos acumulados)", () => {
    expect(recallTargets({ kind: "phrase", literal: "correr", senses: [] })).toEqual(["correr"]);
  });
});

describe("Sentido pedido roda entre os acumulados (D15-3c)", () => {
  const card = {
    kind: "word" as const,
    literal: "run",
    senses: [
      { literal: "correr", ts: 1 },
      { literal: "gerenciar", ts: 2 },
    ],
  };

  it("recallTargets junta literal e sentidos acumulados", () => {
    expect(recallTargets(card)).toEqual(["run", "correr", "gerenciar"]);
  });

  it("rotateTarget percorre os sentidos e volta ao primeiro (ciclo)", () => {
    const targets = recallTargets(card);
    expect(rotateTarget(targets, 0)).toBe("run");
    expect(rotateTarget(targets, 1)).toBe("correr");
    expect(rotateTarget(targets, 2)).toBe("gerenciar");
    expect(rotateTarget(targets, 3)).toBe("run"); // wrap
  });

  it("senseMatches tolera maiúsculas, acentos e pontuação; rejeita sentido errado", () => {
    expect(senseMatches("Correr!", "correr")).toBe(true);
    expect(senseMatches("  córrer  ", "correr")).toBe(true);
    expect(senseMatches("gerenciar", "correr")).toBe(false);
    expect(senseMatches("", "correr")).toBe(false);
  });
});

describe("Sentidos errados ficam visíveis (D15-3c, draft da sessão)", () => {
  it("missed persiste no draft e volta na retomada", () => {
    saveVocabDraft({
      startedAt: TS,
      queue: [{ kind: "word", key: "eloquent" }],
      index: 0,
      sim: 0,
      nao: 0,
      requeued: [],
      missed: ["word:eloquent:eloquente"],
    });
    expect(getVocabDraft()?.missed).toEqual(["word:eloquent:eloquente"]);
  });

  it("missed vazio/ausente normaliza para lista vazia", () => {
    saveVocabDraft({
      startedAt: TS,
      queue: [{ kind: "word", key: "eloquent" }],
      index: 0,
      sim: 0,
      nao: 0,
      requeued: [],
      missed: [],
    });
    expect(getVocabDraft()?.missed).toEqual([]);
  });
});
