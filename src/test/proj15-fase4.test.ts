// Projeto 15, Fase 4 — D15-4c: exclusão de vocabulário com Desfazer.
// O snapshot do item é capturado ANTES da remoção; o restore reinserção o item
// exatamente como estava (box, dueAt, sentidos, favorito) — nada de recriar
// com caixa 0 ou recontar o gesto.
import { describe, expect, it, beforeEach } from "vitest";

import {
  removeVocabItem as removeVocabItemPure,
  restoreVocabItem as restoreVocabItemPure,
  type VocabPhrase,
  type VocabStore,
  type VocabWord,
} from "@/lib/plus/vocab";
import { getStateSnapshot, removeVocabItem, restoreVocabItem, saveVocabWord } from "@/lib/storage";

const TS = Date.UTC(2026, 10, 3, 12, 0, 0);
const DAY = 86_400_000;
const WORD_KEY = "eloquent";
const PHRASE_KEY = "summarize_spoken_text:q-2#0";

function word(): VocabWord {
  return {
    word: "eloquent",
    literal: "eloquente",
    savedAt: TS,
    lastSeenAt: TS,
    seenCount: 3,
    sources: [{ type: "read_aloud", qid: "q-1" }],
    box: 2,
    dueAt: TS + 3 * DAY,
    starred: true,
    senses: [{ literal: "expressivo", ts: TS - DAY }],
  };
}

function phrase(): VocabPhrase {
  return {
    type: "summarize_spoken_text",
    qid: "q-2",
    index: 0,
    en: "the findings suggest",
    literal: "as descobertas sugerem",
    savedAt: TS,
    lastSeenAt: TS,
    seenCount: 2,
    box: 1,
    dueAt: TS + DAY,
    starred: true,
  };
}

function store(): VocabStore {
  return { words: { [WORD_KEY]: word() }, phrases: { [PHRASE_KEY]: phrase() } };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("D15-4c · restoreVocabItem (undo de remoção)", () => {
  it("restaura a palavra exatamente como estava (box, dueAt, sentidos, favorito)", () => {
    const removed = removeVocabItemPure(store(), "word", WORD_KEY);
    expect(removed.words[WORD_KEY]).toBeUndefined();

    const restored = restoreVocabItemPure(removed, "word", WORD_KEY, word());
    const item = restored.words[WORD_KEY]!;
    expect(item).toEqual(word());
    expect(item.box).toBe(2);
    expect(item.dueAt).toBe(TS + 3 * DAY);
    expect(item.seenCount).toBe(3);
    expect(item.starred).toBe(true);
    expect(item.senses).toHaveLength(1);
  });

  it("restaura a frase exatamente como estava", () => {
    const removed = removeVocabItemPure(store(), "phrase", PHRASE_KEY);
    expect(removed.phrases[PHRASE_KEY]).toBeUndefined();

    const restored = restoreVocabItemPure(removed, "phrase", PHRASE_KEY, phrase());
    expect(restored.phrases[PHRASE_KEY]).toEqual(phrase());
  });

  it("desfazer após remoção via storage reinserção o item no estado do app", () => {
    saveVocabWord({ word: "eloquent", literal: "eloquente", ts: TS });
    expect(getStateSnapshot().vocabulary.words[WORD_KEY]).toBeDefined();

    removeVocabItem("word", WORD_KEY);
    expect(getStateSnapshot().vocabulary.words[WORD_KEY]).toBeUndefined();

    const snapshot = word();
    restoreVocabItem("word", WORD_KEY, snapshot);
    const restored = getStateSnapshot().vocabulary.words[WORD_KEY]!;
    expect(restored.literal).toBe("eloquente");
    expect(restored.box).toBe(2);
    expect(restored.senses).toHaveLength(1);
  });

  it("restaurar por cima de uma chave reocupada vence com o snapshot anterior", () => {
    const removed = removeVocabItemPure(store(), "word", WORD_KEY);
    const reoccupied = restoreVocabItemPure(removed, "word", WORD_KEY, {
      ...word(),
      literal: "reocupada",
    });
    // O snapshot restaurado vence: é o estado anterior conhecido.
    const out = restoreVocabItemPure(reoccupied, "word", WORD_KEY, word());
    expect(out.words[WORD_KEY]!.literal).toBe("eloquente");
  });
});
