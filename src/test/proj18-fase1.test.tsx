// Projeto 18 · Fase 1 (D18-1): IA no SST — kind "sst" na orquestração única,
// schema Zod dedicado (spelling obrigatório), prompt próprio, cache-first e
// SstPractice consumindo AiGradeFeedback com o score local preservado.
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// SstPractice/PracticeShell/TopNav usam useNavigate/useRouterState/Link do router.
vi.mock(import("@tanstack/react-router"), async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: (() => () => {}) as unknown as typeof actual.useNavigate,
    useRouterState: (() => ({
      location: { pathname: "/practice" },
    })) as unknown as typeof actual.useRouterState,
    Link: (({ children }: { children?: ReactNode }) => (
      <a>{children}</a>
    )) as unknown as typeof actual.Link,
  };
});

const gatewayCalls: { instructions: string; schema: unknown; messages: unknown }[] = [];

vi.mock("@/lib/ai/gateway.server", () => ({
  callGatewayObject: vi.fn(
    async (input: { instructions: string; schema: unknown; messages: unknown }) => {
      gatewayCalls.push(input);
      return {
        ok: true,
        data: {
          overall: 72,
          dimensions: { content: 80, form: 75, grammar: 70, vocabulary: 65, spelling: 55 },
          summary: "Resumo cobre o essencial; ortografia pesou.",
          errors: [{ quote: "recieved", issue: "soletração", fix: "received" }],
          nextAction: "Revise a grafia de palavras recebidas do áudio.",
        },
        source: "ai",
      };
    },
  ),
}));

vi.mock("@/lib/ai/rate-limit.server", () => ({
  checkRateLimit: vi.fn(() => ({ ok: true, remaining: 10 })),
}));

const gradeFn = vi.hoisted(() => vi.fn());

vi.mock(import("@/lib/plus/ai-grade.functions"), async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/plus/ai-grade.functions")>();
  return {
    ...actual,
    gradeLanguageResponse: gradeFn as unknown as typeof actual.gradeLanguageResponse,
  };
});

import { handleGradeLanguage, gradeLanguageInputSchema } from "@/lib/plus/ai-grade.functions";
import {
  sstGradeResultSchema,
  gradeResultSchema,
  weakDimensionKeys,
} from "@/lib/plus/aiGradeSchemas";
import { buildGradePrompt } from "@/lib/plus/aiGradePrompts";
import { runAiGrade } from "@/lib/plus/aiGradeRun";
import { aiCacheStore, gradeCacheKey, emptyAiCache } from "@/lib/plus/aiCache";
import { SstPractice } from "@/components/practice/SstPractice";
import type { SstQuestion } from "@/lib/pte/types";

beforeEach(() => {
  window.localStorage.clear();
  gatewayCalls.length = 0;
  gradeFn.mockReset();
  aiCacheStore.reset();
});

const sstResult = {
  overall: 72,
  dimensions: { content: 80, form: 75, grammar: 70, vocabulary: 65, spelling: 55 },
  summary: "Resumo cobre o essencial; ortografia pesou.",
  errors: [{ quote: "recieved", issue: "soletração", fix: "received" }],
  nextAction: "Revise a grafia de palavras recebidas do áudio.",
};

describe("D18-1 · contrato de entrada e schemas", () => {
  it("gradeLanguageInputSchema aceita kind sst e rejeita kinds fora do contrato", () => {
    const base = { taskType: "summarize_spoken_text", questionText: "T", response: "R" };
    expect(gradeLanguageInputSchema.safeParse({ ...base, kind: "sst" }).success).toBe(true);
    expect(gradeLanguageInputSchema.safeParse({ ...base, kind: "mcq" }).success).toBe(false);
  });

  it("schema dedicado do SST exige spelling; o geral aceita sem spelling", () => {
    expect(sstGradeResultSchema.safeParse(sstResult).success).toBe(true);
    const semSpelling = {
      overall: 72,
      dimensions: { content: 80, form: 75, grammar: 70, vocabulary: 65, cohesion: 70 },
      summary: "",
      errors: [],
      nextAction: "",
    };
    expect(sstGradeResultSchema.safeParse(semSpelling).success).toBe(false);
    expect(gradeResultSchema.safeParse(semSpelling).success).toBe(true);
  });

  it("handleGradeLanguage usa o schema dedicado quando kind = sst", async () => {
    const out = await handleGradeLanguage({
      kind: "sst",
      taskType: "summarize_spoken_text",
      questionText: "Palestra sobre sono.",
      response: "Sono consolida memórias e limpa resíduos metabólicos.",
      sessionId: "sessao-teste-01",
    });
    expect(out.ok).toBe(true);
    expect(gatewayCalls).toHaveLength(1);
    expect(gatewayCalls[0]!.schema).toBe(sstGradeResultSchema);
  });

  it("handleGradeLanguage mantém o schema geral para essay/swt", async () => {
    await handleGradeLanguage({
      kind: "swt",
      taskType: "swt",
      questionText: "Texto.",
      response: "Uma frase.",
      sessionId: "sessao-teste-01",
    });
    expect(gatewayCalls[0]!.schema).toBe(gradeResultSchema);
  });
});

describe("D18-1 · prompt do SST", () => {
  it("inclui a forma de 50-70 palavras, a cobrança de spelling e o rótulo do tipo", () => {
    const p = buildGradePrompt({
      kind: "sst",
      taskType: "summarize_spoken_text",
      questionText: "TRANSCRIÇÃO DA PALESTRA",
      response: "Resumo do aluno.",
    });
    const content = String(p.messages[0]!.content);
    expect(content).toContain("Summarize Spoken Text");
    expect(content).toContain("50 a 70 palavras");
    expect(content).toContain("spelling");
    expect(content).toContain("TRANSCRIÇÃO DA PALESTRA");
    expect(content).toContain("Resumo do aluno.");
  });
});

describe("D18-1 · clamp e dimensões fracas com spelling", () => {
  it("clamp preserva spelling quando avaliado e omite quando ausente", async () => {
    const { clampGradeResult } = await import("@/lib/plus/aiGradeSchemas");
    const com = clampGradeResult(sstResult);
    expect(com!.dimensions.spelling).toBe(55);
    const sem = clampGradeResult({
      overall: 60,
      dimensions: { content: 60, form: 60, grammar: 60, vocabulary: 60, cohesion: 60 },
      summary: "",
      errors: [],
      nextAction: "",
    });
    expect(sem!.dimensions.spelling).toBeUndefined();
    expect(sem!.dimensions.cohesion).toBe(60);
  });

  it("weakDimensionKeys inclui spelling quando <70 e ignora quando ausente", () => {
    expect(weakDimensionKeys(sstResult as never)).toEqual(["vocabulary", "spelling"]);
    const sem = {
      overall: 60,
      dimensions: { content: 80, form: 80, grammar: 40, vocabulary: 69, cohesion: 70 },
      summary: "",
      errors: [],
      nextAction: "",
    } as never;
    expect(weakDimensionKeys(sem)).toEqual(["grammar", "vocabulary"]);
  });
});

describe("D18-1 · cache-first na orquestração única", () => {
  it("cache antes da rede: resposta cacheada não chama o grader", async () => {
    const key = gradeCacheKey("sst", "summarize_spoken_text", "Palestra", "Resumo");
    aiCacheStore.putGrade(key, sstResult as never);
    const out = await runAiGrade({
      kind: "sst",
      taskType: "summarize_spoken_text",
      questionText: "Palestra",
      response: "Resumo",
    });
    expect(out).toEqual({ ok: true, result: sstResult, cached: true });
    expect(gradeFn).not.toHaveBeenCalled();
  });

  it("sem cache, chama o grader com kind sst e grava no cache", async () => {
    gradeFn.mockResolvedValue({ ok: true, result: sstResult, source: "ai" });
    const out = await runAiGrade({
      kind: "sst",
      taskType: "summarize_spoken_text",
      questionText: "Palestra",
      response: "Resumo",
    });
    expect(out).toEqual({ ok: true, result: sstResult, cached: false });
    expect(gradeFn).toHaveBeenCalledTimes(1);
    expect(gradeFn.mock.calls[0]![0].data.kind).toBe("sst");
    // 2ª chamada da mesma resposta sai do cache (sem nova requisição).
    const again = await runAiGrade({
      kind: "sst",
      taskType: "summarize_spoken_text",
      questionText: "Palestra",
      response: "Resumo",
    });
    expect(again).toEqual({ ok: true, result: sstResult, cached: true });
    expect(gradeFn).toHaveBeenCalledTimes(1);
  });
});

describe("D18-1 · SstPractice consome a análise IA", () => {
  const question: SstQuestion = {
    id: "sst-teste-1",
    taskType: "summarize_spoken_text",
    section: "listening",
    prompt: "Listen to the lecture and write a summary of 50-70 words.",
    text: "Palestra sobre sono.",
    audioText: "Palestra sobre sono.",
    transcript: "Sleep research shows that deep sleep consolidates memories.",
    wordCount: 9,
    topic: "health",
    source: "pteracai-seed",
    gradingNotes: "",
    sample: "Deep sleep consolidates memories.",
  };

  it("resultado exibe a análise IA com o score local preservado", async () => {
    gradeFn.mockResolvedValue({ ok: true, result: sstResult, source: "ai" });
    render(<SstPractice question={question} />);
    fireEvent.click(screen.getByRole("button", { name: "Pular áudio" }));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, {
      target: { value: "Deep sleep consolidates memories and clears waste." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Corrigir" }));
    await waitFor(() => expect(screen.getByText(/Análise IA detalhada/)).toBeTruthy(), {
      timeout: 3000,
    });
    // Score local registrado continua visível como nota básica do progresso.
    expect(screen.getByText(/score registrado no progresso/)).toBeTruthy();
    // Dimensão de ortografia aparece; spelling 55 < 70 entra no diagnóstico.
    expect(screen.getByText("Ortografia")).toBeTruthy();
  });
});
