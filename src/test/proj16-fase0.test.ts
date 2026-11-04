// Projeto 16 · Fase 0 — contratos do recorte (D16-0a..0d).
// O recorte é a frase EN onde a palavra foi usada: capturado no gesto (a MESMA
// frase enviada à IA), truncado na captura, sobrevive a merge de backup e é
// derivável (leitura) para itens antigos.
import { beforeEach, describe, expect, it } from "vitest";

import { mergeStates } from "@/lib/backup";
import {
  MAX_VOCAB_SNIPPET,
  deriveVocabSnippet,
  flattenVocab,
  normalizeVocabStore,
  saveVocabWord,
  vocabPhraseKey,
  type VocabStore,
} from "@/lib/plus/vocab";
import { emptyVocabStore } from "@/lib/plus/vocab";
import { migrateLegacyState } from "@/lib/storage";

const T0 = 1_700_000_000_000;
const DAY = 86_400_000;

describe("D16-0a — captura do recorte (saveVocabWord)", () => {
  it("item novo (IA): grava snippet, tradução in-contexto e porquê", () => {
    const store = saveVocabWord(emptyVocabStore(), {
      word: "rigorous",
      literal: "rigoroso",
      contextual: "Aqui, “rigorous” significa: rigoroso",
      snippet: "The rigorous study of nature changed science.",
      snippetInContext: "O estudo rigoroso da natureza mudou a ciência.",
      snippetWhy: "“rigorous” qualifica o estudo: meticuloso e exigente.",
      engine: "ai",
      ts: T0,
    });
    const w = store.words["rigorous"]!;
    expect(w.snippet).toBe("The rigorous study of nature changed science.");
    expect(w.snippetInContext).toBe("O estudo rigoroso da natureza mudou a ciência.");
    expect(w.snippetWhy).toBe("“rigorous” qualifica o estudo: meticuloso e exigente.");
    expect(w.contextual).toBe("Aqui, “rigorous” significa: rigoroso"); // compatível
  });

  it("item novo (dicionário): grava só o snippet (tradução in-contexto é demanda)", () => {
    const store = saveVocabWord(emptyVocabStore(), {
      word: "rigorous",
      literal: "rigoroso",
      snippet: "The rigorous study of nature changed science.",
      engine: "glossary",
      ts: T0,
    });
    const w = store.words["rigorous"]!;
    expect(w.snippet).toBe("The rigorous study of nature changed science.");
    expect(w.snippetInContext).toBeUndefined();
    expect(w.snippetWhy).toBeUndefined();
  });

  it("recorte longo trunca na CAPTURA (teto MAX_VOCAB_SNIPPET); vazio nunca grava", () => {
    const long = "a".repeat(600);
    const store = saveVocabWord(emptyVocabStore(), {
      word: "w",
      literal: "x",
      snippet: long,
      ts: T0,
    });
    expect(store.words["w"]!.snippet).toHaveLength(MAX_VOCAB_SNIPPET);
    const none = saveVocabWord(emptyVocabStore(), {
      word: "w",
      literal: "x",
      snippet: "   ",
      ts: T0,
    });
    expect(none.words["w"]!.snippet).toBeUndefined();
  });

  it("re-gesto com o MESMO recorte: tradução in-contexto atualiza; dicionário mantém a antiga", () => {
    const base = saveVocabWord(emptyVocabStore(), {
      word: "w",
      literal: "v1",
      snippet: "Mesma frase.",
      snippetInContext: "Tradução A.",
      snippetWhy: "Porquê A.",
      engine: "ai",
      ts: T0,
    });
    const aiAgain = saveVocabWord(base, {
      word: "w",
      literal: "v2",
      snippet: "Mesma frase.",
      snippetInContext: "Tradução B.",
      snippetWhy: "Porquê B.",
      engine: "ai",
      ts: T0 + 1,
    });
    expect(aiAgain.words["w"]!.snippetInContext).toBe("Tradução B.");
    // Dicionário no mesmo recorte: a tradução IA anterior continua coerente.
    const dict = saveVocabWord(aiAgain, {
      word: "w",
      literal: "v2",
      snippet: "Mesma frase.",
      engine: "glossary",
      ts: T0 + 2,
    });
    expect(dict.words["w"]!.snippetInContext).toBe("Tradução B.");
    expect(dict.words["w"]!.snippetWhy).toBe("Porquê B.");
  });

  it("re-gesto com recorte DIFERENTE sem tradução nova: limpa in-contexto/porquê (nunca mente)", () => {
    const base = saveVocabWord(emptyVocabStore(), {
      word: "w",
      literal: "v1",
      snippet: "Frase antiga.",
      snippetInContext: "Tradução A.",
      snippetWhy: "Porquê A.",
      engine: "ai",
      ts: T0,
    });
    const next = saveVocabWord(base, {
      word: "w",
      literal: "v2",
      snippet: "Frase nova.",
      engine: "glossary",
      ts: T0 + 1,
    });
    const w = next.words["w"]!;
    expect(w.snippet).toBe("Frase nova.");
    expect(w.snippetInContext).toBeUndefined();
    expect(w.snippetWhy).toBeUndefined();
    // Regra do projeto 13 intocada: a tradução anterior vira sentido acumulado.
    expect(w.senses?.[0]?.literal).toBe("v1");
  });

  it("gesto sem recorte: mantém o recorte anterior", () => {
    const base = saveVocabWord(emptyVocabStore(), {
      word: "w",
      literal: "v1",
      snippet: "Frase antiga.",
      ts: T0,
    });
    const next = saveVocabWord(base, { word: "w", literal: "v1", ts: T0 + 1 });
    expect(next.words["w"]!.snippet).toBe("Frase antiga.");
  });
});

describe("D16-0c — derivação de recorte (deriveVocabSnippet)", () => {
  it("encontra a frase que contém a palavra (case-insensitive)", () => {
    const out = deriveVocabSnippet(
      "rigorous",
      "The rigorous study of nature changed science. Later work expanded it.",
    );
    expect(out).toBe("The rigorous study of nature changed science.");
  });

  it("fronteira lexical: “cat” não casa com “category”", () => {
    const out = deriveVocabSnippet("cat", "The category matters. A cat slept well.");
    expect(out).toBe("A cat slept well.");
  });

  it("sem hit → undefined (nunca inventa); texto vazio → undefined", () => {
    expect(deriveVocabSnippet("rigorous", "Nothing here at all.")).toBeUndefined();
    expect(deriveVocabSnippet("rigorous", "")).toBeUndefined();
    expect(deriveVocabSnippet("", "The rigorous study.")).toBeUndefined();
  });

  it("derivado também trunca ao teto do recorte", () => {
    const sentence = `Mark ${"x".repeat(450)} end.`;
    const out = deriveVocabSnippet("mark", sentence);
    expect(out).toHaveLength(MAX_VOCAB_SNIPPET);
  });
});

describe("D16-0a/b — normalização (normalizeVocabStore)", () => {
  it("preserva snippet/in-contexto/porquê válidos e descarta malformados", () => {
    const raw = {
      words: {
        w: {
          word: "w",
          literal: "x",
          snippet: "  Frase válida.  ",
          snippetInContext: "Tradução.",
          snippetWhy: 42,
          savedAt: T0,
          lastSeenAt: T0,
          seenCount: 1,
          sources: [],
          box: 0,
          dueAt: 0,
        },
      },
      phrases: {},
    };
    const store = normalizeVocabStore(raw);
    const w = store.words["w"]!;
    expect(w.snippet).toBe("Frase válida.");
    expect(w.snippetInContext).toBe("Tradução.");
    expect(w.snippetWhy).toBeUndefined();
  });

  it("item sem snippet continua normalizando igual ao contrato anterior", () => {
    const store = normalizeVocabStore({
      words: { w: { word: "w", literal: "x", savedAt: T0, lastSeenAt: T0, seenCount: 1 } },
      phrases: {},
    });
    expect(store.words["w"]!.literal).toBe("x");
    expect("snippet" in store.words["w"]!).toBe(false);
  });
});

describe("D16-0a — flattenVocab expõe o recorte à lista", () => {
  it("VocabListItem carrega snippet/in-contexto/porquê (só palavras)", () => {
    const store: VocabStore = {
      words: {
        w: {
          word: "w",
          literal: "x",
          snippet: "Frase.",
          snippetInContext: "Tradução.",
          snippetWhy: "Porquê.",
          savedAt: T0,
          lastSeenAt: T0,
          seenCount: 1,
          sources: [],
          box: 0,
          dueAt: 0,
        },
      },
      phrases: {
        [vocabPhraseKey("ra", "q1", 0)]: {
          type: "ra",
          qid: "q1",
          index: 0,
          en: "Frase completa.",
          literal: "Tradução.",
          savedAt: T0,
          lastSeenAt: T0,
          seenCount: 1,
          box: 0,
          dueAt: 0,
        },
      },
    };
    const list = flattenVocab(store);
    const word = list.find((i) => i.kind === "word")!;
    expect(word.snippet).toBe("Frase.");
    expect(word.snippetInContext).toBe("Tradução.");
    expect(word.snippetWhy).toBe("Porquê.");
    const phrase = list.find((i) => i.kind === "phrase")!;
    expect(phrase.snippet).toBeUndefined(); // a frase É o próprio recorte (en)
  });
});

describe("D16-0d — merge de backup preserva o recorte", () => {
  const base = () => migrateLegacyState({ version: 6, srsRules: 2, settings: {} });

  it("recorte do lado MAIS ANTIGO sobrevive quando o vencedor não tem", () => {
    const cur = {
      ...base(),
      vocabulary: {
        words: {
          w: {
            word: "w",
            literal: "antigo",
            snippet: "Frase do lado antigo.",
            savedAt: T0,
            lastSeenAt: T0,
            seenCount: 1,
            sources: [],
            box: 0,
            dueAt: 0,
          },
        },
        phrases: {},
      },
    };
    const inc = {
      ...base(),
      vocabulary: {
        words: {
          w: {
            word: "w",
            literal: "novo",
            savedAt: T0 + DAY,
            lastSeenAt: T0 + DAY,
            seenCount: 2,
            sources: [],
            box: 0,
            dueAt: 0,
          },
        },
        phrases: {},
      },
    };
    const merged = mergeStates(cur, inc);
    expect(merged.vocabulary.words["w"]!.literal).toBe("novo");
    expect(merged.vocabulary.words["w"]!.snippet).toBe("Frase do lado antigo.");
  });

  it("recorte do lado VENCEDOR prevalece quando ambos têm; merge é idempotente", () => {
    const cur = {
      ...base(),
      vocabulary: {
        words: {
          w: {
            word: "w",
            literal: "a",
            snippet: "Frase A.",
            snippetInContext: "Ctx A.",
            savedAt: T0,
            lastSeenAt: T0,
            seenCount: 1,
            sources: [],
            box: 0,
            dueAt: 0,
          },
        },
        phrases: {},
      },
    };
    const inc = {
      ...base(),
      vocabulary: {
        words: {
          w: {
            word: "w",
            literal: "b",
            snippet: "Frase B.",
            snippetWhy: "Why B.",
            savedAt: T0 + DAY,
            lastSeenAt: T0 + DAY,
            seenCount: 2,
            sources: [],
            box: 0,
            dueAt: 0,
          },
        },
        phrases: {},
      },
    };
    const m1 = mergeStates(cur, inc);
    const w1 = m1.vocabulary.words["w"]!;
    expect(w1.snippet).toBe("Frase B.");
    expect(w1.snippetWhy).toBe("Why B.");
    expect(w1.snippetInContext).toBe("Ctx A."); // sobrevive do outro lado
    const m2 = mergeStates(m1, inc);
    expect(m2.vocabulary.words["w"]!.snippet).toBe("Frase B.");
    expect(m2.vocabulary.words["w"]!.snippetInContext).toBe("Ctx A.");
  });
});
