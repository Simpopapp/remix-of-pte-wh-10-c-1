import { aiCacheStore, gradeCacheKey } from "@/lib/plus/aiCache";
import { gradeLanguageResponse } from "@/lib/plus/ai-grade.functions";
import { aiSessionId } from "@/lib/plus/aiStatus";
import type { AiGradeResult } from "@/lib/plus/aiGradeSchemas";

export type AiGradeErrorCode = "credits" | "rate" | "server" | "network" | "invalid";

export interface AiGradeRunInput {
  kind: "essay" | "swt" | "sst";
  taskType: string;
  questionText: string;
  /** Resposta submetida (a orquestração só roda com resposta). */
  response: string;
  sample?: string | undefined;
}

export type AiGradeRunResult =
  | { ok: true; result: AiGradeResult; cached: boolean }
  | { ok: false; code: AiGradeErrorCode; message: string };

/** Rótulo honesto por código de falha (D14-1b) — compartilhado por prática e exame. */
export function aiGradeFailReason(code: AiGradeErrorCode, message: string): string {
  if (code === "rate") return "Muitas correções seguidas — aguarde um instante e tente de novo.";
  if (code === "credits") return "Créditos de IA esgotados no momento.";
  if (code === "server") return "A IA está instável neste momento.";
  return message || "Falha temporária na análise.";
}

/**
 * D15-6a: ÚNICA orquestração de correção IA (cache → request → cache write → erro
 * tipado). Consumida pela prática (useAiGrade) e pelo exame (revisão pós-exame);
 * nunca duplique cache/request — novas superfícies chamam daqui.
 */
export async function runAiGrade(input: AiGradeRunInput): Promise<AiGradeRunResult> {
  const key = gradeCacheKey(input.kind, input.taskType, input.questionText, input.response);
  const cached = aiCacheStore.getGrade(key);
  if (cached) return { ok: true, result: cached, cached: true };
  const res = await gradeLanguageResponse({
    data: {
      kind: input.kind,
      taskType: input.taskType,
      questionText: input.questionText,
      response: input.response,
      ...(input.sample ? { sample: input.sample } : {}),
      sessionId: aiSessionId(),
    },
  });
  if (res.ok) {
    aiCacheStore.putGrade(key, res.result);
    return { ok: true, result: res.result, cached: false };
  }
  return { ok: false, code: res.code, message: res.message };
}
