// Projeto 18 · Fase 7 (D18-7): pisos de banco, contratos de conteúdo novo,
// dedupe sem novas duplicatas canônicas e samples nos bancos de fala.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadTypeQuestions } from "@/lib/pte/catalog";
import { metaByType } from "@/lib/pte/manifest";
import { canonicalIdOf, isDuplicateId } from "@/lib/pte/manifest";
import { DESCRIBE_IMAGE_ASSETS } from "@/lib/pte/describeImageAssets";
import type { TaskType } from "@/lib/pte/types";
import type { DescribeImageQuestion, HiwQuestion, SgdQuestion } from "@/lib/pte/types";

const DIR = join(fileURLToPath(import.meta.url), "..", "..", "data", "pte");
const raw = (file: string) => {
  const json = JSON.parse(readFileSync(join(DIR, file), "utf8")) as
    Record<string, unknown>[] | { questions: Record<string, unknown>[] };
  return Array.isArray(json) ? json : json.questions;
};

// Pisos do D18-7a (mínimos verificáveis por tipo).
const FLOORS: Record<string, number> = {
  "describe_image.json": 20,
  "lst_hcs.json": 10,
  "lst_hiw.json": 10,
  "lst_smw.json": 10,
  "lst_mcq_multi.json": 10,
  "lst_mcq.json": 12,
  "mcq_multi.json": 30,
  "summarize_group_discussion.json": 20,
  "read_fib_bank.json": 8,
};

describe("D18-7a — pisos de banco", () => {
  for (const [file, floor] of Object.entries(FLOORS)) {
    it(`${file} tem ≥ ${floor} itens`, () => {
      expect(raw(file).length).toBeGreaterThanOrEqual(floor);
      expect(metaByType(file.replace(".json", "") as TaskType).length).toBe(raw(file).length);
    });
  }
});

describe("D18-7a — contratos do conteúdo novo", () => {
  it("describe_image: todo slug de imagem existe no mapa de assets e alt não vazio", async () => {
    for (const q of (await loadTypeQuestions("describe_image")) as DescribeImageQuestion[]) {
      expect(DESCRIBE_IMAGE_ASSETS[q.image], `${q.id}: slug ${q.image} sem asset`).toBeDefined();
      expect(q.alt.trim().length, q.id).toBeGreaterThan(20);
      // Procedência honesta: itens novos NUNCA fingem verificação.
      if (q.id.startsWith("di-ai-")) expect(q.source, q.id).toBe("ai-generated-prediction");
    }
  });

  it("lst_hiw: transcript distinto com divergências alinhadas ao gabarito (contrato D18-0a reutilizado)", () => {
    for (const r of raw("lst_hiw.json")) {
      const text = String(r["text"]).split(/\s+/);
      const transcript = String(r["transcript"]).split(/\s+/);
      expect(transcript.length, String(r["id"])).toBe(text.length);
      const diff = text.map((t, i) => (t !== transcript[i] ? i : -1)).filter((i) => i >= 0);
      const errors = r["errors"] as number[];
      expect(diff.length, String(r["id"])).toBe(errors.length);
      expect(
        errors.every((i, k) => diff[k] === i),
        String(r["id"]),
      ).toBe(true);
    }
  });

  it("summarize_group_discussion: 3+ turnos multi-voz com sample de resumo", () => {
    for (const r of raw("summarize_group_discussion.json")) {
      const turns = r["turns"] as { speaker: string; text: string }[];
      expect(turns.length, String(r["id"])).toBeGreaterThanOrEqual(3);
      expect(new Set(turns.map((t) => t.speaker)).size, String(r["id"])).toBeGreaterThanOrEqual(3);
      expect(String(r["sample"]).trim().length, String(r["id"])).toBeGreaterThan(100);
    }
  });

  it("escolha (listening/reading): gabarito no range e distratores distintos", () => {
    for (const file of [
      "lst_hcs.json",
      "lst_smw.json",
      "lst_mcq.json",
      "lst_mcq_multi.json",
      "mcq_multi.json",
    ]) {
      for (const r of raw(file)) {
        const options = r["options"] as string[];
        expect(new Set(options).size, `${file} ${r["id"]}`).toBe(options.length);
        const answer = r["answer"] as number | number[];
        const idx = Array.isArray(answer) ? answer : [answer];
        expect(
          idx.every((i) => i >= 0 && i < options.length),
          `${file} ${r["id"]}`,
        ).toBe(true);
        // Itens novos (fonte ia) exigem explanation; seeds antigos podem não ter.
        if (r["source"] === "ai-generated-prediction")
          expect(
            String(r["explanation"]).trim().length,
            `${file} ${r["id"]} sem explanation`,
          ).toBeGreaterThan(30);
      }
    }
  });
});

describe("D18-7b — samples nos bancos de fala", () => {
  it("retell_lecture: ≥ 30 itens com sample de recontagem", () => {
    const withSample = raw("retell_lecture.json").filter(
      (r) => String(r["sample"] ?? "").trim().length > 100,
    );
    expect(withSample.length).toBeGreaterThanOrEqual(30);
  });

  it("summarize_spoken_text: ≥ 30 itens com sample de 50–70 palavras", () => {
    const withSample = raw("summarize_spoken_text.json").filter((r) => {
      const s = String(r["sample"] ?? "").trim();
      return s.length > 0;
    });
    expect(withSample.length).toBeGreaterThanOrEqual(30);
    for (const r of withSample) {
      const words = String(r["sample"]).trim().split(/\s+/).length;
      // Faixa do SST: 50–70 palavras (amostras 45–75 para tolerar hífens/datas).
      expect(words, String(r["id"])).toBeGreaterThanOrEqual(45);
      expect(words, String(r["id"])).toBeLessThanOrEqual(75);
    }
  });
});

describe("D18-7 — dedupe: conteúdo novo não cria duplicata canônica", () => {
  it("nenhum item dos tipos expandidos é marcado como repetido", async () => {
    const files = [
      "describe_image",
      "lst_hcs",
      "lst_hiw",
      "lst_smw",
      "lst_mcq_multi",
      "lst_mcq",
      "mcq_multi",
      "summarize_group_discussion",
      "read_fib_bank",
    ];
    const offenders: string[] = [];
    for (const t of files) {
      for (const q of (await loadTypeQuestions(t as TaskType)) as { id: string }[]) {
        if (isDuplicateId(q.id)) offenders.push(q.id);
        expect(canonicalIdOf(q.id), q.id).toBe(q.id);
      }
    }
    expect(offenders).toEqual([]);
  });
});
