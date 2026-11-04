// Projeto 18 · Fase 5 (D18-5a/b): evidência de revisão + rotação de sentidos
// persistida; mescla de backup decide caixa/prazo pela evidência mais recente.
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyVocabStudy,
  flattenVocab,
  normalizeVocabStore,
  type VocabStore,
} from "@/lib/plus/vocab";
import { recallTargets, rotateTarget } from "@/lib/plus/vocabStudy";

vi.setConfig({ testTimeout: 30_000 });

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

const storeWithSenses = (): VocabStore => ({
  words: {
    rigorous: {
      word: "rigorous",
      literal: "rigoroso",
      savedAt: T0,
      lastSeenAt: T0,
      seenCount: 1,
      sources: [],
      box: 0,
      dueAt: 0,
      senses: [{ literal: "exigente", ts: T0 }],
    },
  },
  phrases: {},
});

describe("D18-5a — evidência de revisão e cursor de rotação", () => {
  it("toda nota de estudo grava lastReviewTs — inclusive o lembrei antecipado", () => {
    const store = storeWithSenses();
    const late = applyVocabStudy(store, "word", "rigorous", true, T0 + DAY);
    expect(late.words["rigorous"]!.lastReviewTs).toBe(T0 + DAY);
    // Antecipado: item VENCIDO ainda não (dueAt no futuro) — caixa/prazo
    // intactos, mas a evidência fica.
    const ahead: VocabStore = {
      words: {
        ...store.words,
        calm: {
          ...store.words["rigorous"]!,
          word: "calm",
          literal: "calmo",
          box: 2,
          dueAt: T0 + 10 * DAY,
        },
      },
      phrases: {},
    };
    const early = applyVocabStudy(ahead, "word", "calm", true, T0 + DAY);
    expect(early.words["calm"]!.box).toBe(2);
    expect(early.words["calm"]!.dueAt).toBe(T0 + 10 * DAY);
    expect(early.words["calm"]!.lastReviewTs).toBe(T0 + DAY);
  });

  it("checagem de retrieval avança o cursor de sentidos persistido", () => {
    const after1 = applyVocabStudy(storeWithSenses(), "word", "rigorous", true, T0 + DAY, {
      advanceSense: true,
    });
    expect(after1.words["rigorous"]!.senseAskCount).toBe(1);
    const after2 = applyVocabStudy(after1, "word", "rigorous", false, T0 + 2 * DAY, {
      advanceSense: true,
    });
    expect(after2.words["rigorous"]!.senseAskCount).toBe(2);
  });

  it("2ª fila pede o SENTIDO DIFERENTE: o cursor sobrevive entre filas", () => {
    const after1 = applyVocabStudy(storeWithSenses(), "word", "rigorous", true, T0 + DAY, {
      advanceSense: true,
    });
    const card = flattenVocab(after1).find((i) => i.key === "rigorous")!;
    const targets = recallTargets(card);
    expect(targets).toEqual(["rigoroso", "exigente"]);
    // 1ª fila (cursor 0): pedia o literal…
    expect(rotateTarget(targets, 0)).toBe("rigoroso");
    // …a 2ª fila parte do cursor persistido (1) e pede o sentido acumulado.
    const typedAskCount = (card.senseAskCount ?? 0) + 0;
    expect(rotateTarget(targets, typedAskCount)).toBe("exigente");
  });

  it("normalização preserva lastReviewTs/senseAskCount válidos e descarta inválidos", () => {
    const norm = normalizeVocabStore({
      words: {
        rigorous: {
          word: "rigorous",
          literal: "rigoroso",
          savedAt: T0,
          lastSeenAt: T0,
          seenCount: 1,
          sources: [],
          box: 0,
          dueAt: 0,
          lastReviewTs: T0 + DAY,
          senseAskCount: 3.7,
        },
        broken: {
          word: "broken",
          literal: "quebrado",
          savedAt: T0,
          lastSeenAt: T0,
          seenCount: 1,
          sources: [],
          box: 0,
          dueAt: 0,
          lastReviewTs: -5,
          senseAskCount: -1,
        },
      },
      phrases: {},
    });
    expect(norm.words["rigorous"]!.lastReviewTs).toBe(T0 + DAY);
    expect(norm.words["rigorous"]!.senseAskCount).toBe(4);
    expect(norm.words["broken"]!.lastReviewTs).toBeUndefined();
    expect(norm.words["broken"]!.senseAskCount).toBeUndefined();
  });
});

describe("D18-5b — mescla por evidência de revisão", () => {
  it("o registro com lastReviewTs mais recente vence mesmo com caixa MENOR (lapso sobrevive)", async () => {
    const storage = await import("@/lib/storage");
    const backup = await import("@/lib/backup");
    const base = storage.migrateLegacyState({ version: 6, srsRules: 2, settings: {} });
    const mk = (box: number, dueAt: number, lastReviewTs: number | undefined) => ({
      ...base,
      vocabulary: {
        words: {
          rigorous: {
            word: "rigorous",
            literal: "qualquer",
            savedAt: T0,
            lastSeenAt: T0,
            seenCount: 1,
            sources: [],
            box,
            dueAt,
            ...(lastReviewTs !== undefined ? { lastReviewTs } : {}),
          },
        },
        phrases: {},
      },
    });
    // Atual = demotação recente (lapso); backup antigo = caixa avançada.
    const cur = mk(0, 0, T0 + 3 * DAY);
    const inc = mk(3, T0 + 30 * DAY, T0 + DAY);
    const merged = backup.mergeStates(cur, inc);
    const w = merged.vocabulary.words["rigorous"]!;
    expect(w.box).toBe(0); // evidência recente vence; Math.max desfaria o lapso
    expect(w.dueAt).toBe(0);
    expect(w.lastReviewTs).toBe(T0 + 3 * DAY);

    // Idempotência: mesclar de novo não muda nada.
    const again = backup.mergeStates(merged, inc);
    expect(again.vocabulary.words["rigorous"]!.box).toBe(0);
    expect(again.vocabulary.words["rigorous"]!.dueAt).toBe(0);
  });

  it("fallback sem evidência mantém a regra antiga (caixa mais avançada vence)", async () => {
    const storage = await import("@/lib/storage");
    const backup = await import("@/lib/backup");
    const base = storage.migrateLegacyState({ version: 6, srsRules: 2, settings: {} });
    const mk = (box: number, dueAt: number) => ({
      ...base,
      vocabulary: {
        words: {
          rigorous: {
            word: "rigorous",
            literal: "qualquer",
            savedAt: T0,
            lastSeenAt: T0,
            seenCount: 1,
            sources: [],
            box,
            dueAt,
          },
        },
        phrases: {},
      },
    });
    const merged = backup.mergeStates(mk(1, T0 + DAY), mk(0, 0));
    const w = merged.vocabulary.words["rigorous"]!;
    expect(w.box).toBe(1);
    expect(w.dueAt).toBe(T0 + DAY);
    expect(w.lastReviewTs).toBeUndefined();
  });

  it("frase: a evidência de revisão também decide caixa/prazo", async () => {
    const storage = await import("@/lib/storage");
    const backup = await import("@/lib/backup");
    const base = storage.migrateLegacyState({ version: 6, srsRules: 2, settings: {} });
    const key = "ra:q1#0";
    const mk = (box: number, dueAt: number, lastReviewTs: number | undefined) => ({
      ...base,
      vocabulary: {
        words: {},
        phrases: {
          [key]: {
            type: "ra",
            qid: "q1",
            index: 0,
            en: "a",
            literal: "b",
            savedAt: T0,
            lastSeenAt: T0,
            seenCount: 1,
            box,
            dueAt,
            ...(lastReviewTs !== undefined ? { lastReviewTs } : {}),
          },
        },
      },
    });
    const merged = backup.mergeStates(mk(0, 0, T0 + 5 * DAY), mk(2, T0 + 10 * DAY, T0 + DAY));
    const p = merged.vocabulary.phrases[key]!;
    expect(p.box).toBe(0);
    expect(p.dueAt).toBe(0);
    expect(p.lastReviewTs).toBe(T0 + 5 * DAY);
  });
});
