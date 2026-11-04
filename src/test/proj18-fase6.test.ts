// Projeto 18 · Fase 6 (D18-6): novo tipo read_fib_bank — tipo, catálogo,
// contagem derivada, gabarito consistente e correção pura.
import { describe, expect, it } from "vitest";

import { loadTypeQuestions } from "@/lib/pte/catalog";
import { getMeta, metaByType, TYPE_META } from "@/lib/pte/manifest";
import { gradeBank } from "@/lib/pte/fibBank";
import type { FibBankQuestion } from "@/lib/pte/types";

const all = (await loadTypeQuestions("read_fib_bank")) as FibBankQuestion[];

describe("D18-6a — tipo no catálogo/manifesto", () => {
  it("TYPE_META marca ready na seção reading", () => {
    expect(TYPE_META["read_fib_bank"]).toEqual({
      label: "Reading FIB · banco de palavras",
      section: "reading",
      ready: true,
    });
  });

  it("contagem derivada do manifesto ≥ 8 e casa com o catálogo carregado", () => {
    const metas = metaByType("read_fib_bank");
    expect(metas.length).toBeGreaterThanOrEqual(8);
    expect(all.length).toBe(metas.length);
    for (const m of metas) {
      const q = all.find((x) => x.id === m.id);
      expect(q, `meta ${m.id} sem questão no catálogo`).toBeDefined();
    }
    expect(getMeta(metas[0]!.id)?.taskType).toBe("read_fib_bank");
  });

  it("cada item: lacunas contíguas 1..k, respostas dentro do banco e distratores", () => {
    for (const q of all) {
      const marks = [...q.text.matchAll(/_{5,}\((\d+)\)/g)].map((m) => Number(m[1]));
      expect(marks, q.id).toEqual(Array.from({ length: marks.length }, (_, i) => i + 1));
      expect(q.blanks.length, q.id).toBe(marks.length);
      expect(q.blanks.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.bank.length, q.id).toBeGreaterThan(q.blanks.length); // há distratores
      for (const a of q.blanks) expect(q.bank, q.id).toContain(a);
      expect(new Set(q.bank).size, q.id).toBe(q.bank.length); // banco sem duplicata
      expect(new Set(q.blanks).size, q.id).toBe(q.blanks.length);
      expect(q.source, q.id).toBe("ai-generated-prediction"); // procedência honesta
    }
  });
});

describe("D18-6b — correção pura (gradeBank)", () => {
  const q = all[0]!;
  it("tudo correto → 100", () => {
    const g = gradeBank(q.blanks, q.blanks);
    expect(g.score).toBe(100);
    expect(g.correct).toBe(g.total);
  });
  it("uma errada e uma em branco → contagem parcial", () => {
    const assignments = q.blanks.map((a, i) => (i === 0 ? a : i === 1 ? null : "zzz-wrong"));
    const g = gradeBank(assignments, q.blanks);
    expect(g.correct).toBe(1);
    expect(g.correctIndexes).toEqual([0]);
    expect(g.score).toBe(Math.round((1 / q.blanks.length) * 100));
  });
});
