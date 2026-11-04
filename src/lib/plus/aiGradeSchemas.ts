/**
 * Schemas de saída do grader linguístico IA (projeto 14, D14-1a).
 * Regra D3 (herdada do projeto 11): o schema enviado ao modelo é estrito e SEM
 * bounds — os limites vivem no prompt e são aplicados aqui, em código.
 */
import { z } from "zod";

/** Dimensões avaliadas em respostas escritas (essay / SWT). */
export const GRADE_DIMENSIONS = ["content", "form", "grammar", "vocabulary", "cohesion"] as const;
export type GradeDimension = (typeof GRADE_DIMENSIONS)[number];

/**
 * D18-1: dimensões do SST — o PTE cobra ortografia (spelling) e NÃO cobra
 * coesão como dimensão própria neste tipo. `spelling` é opcional no shape
 * compartilhado: essay/SWT não avaliam ortografia como dimensão separada
 * (herda nada — ausente = não avaliada).
 */
export const SST_DIMENSIONS = ["content", "form", "grammar", "vocabulary", "spelling"] as const;

export const gradeResultSchema = z.object({
  /** Nota geral 0–100, calibrada com os critérios de escrita do PTE. */
  overall: z.number(),
  dimensions: z.object({
    content: z.number(),
    form: z.number(),
    grammar: z.number(),
    vocabulary: z.number(),
    // D18-1: coesão e spelling são opcionais no shape compartilhado — cada
    // tipo avalia o que o PTE cobra (essay/SWT: coesão; SST: spelling).
    cohesion: z.number().optional(),
    spelling: z.number().optional(),
  }),
  /** Resumo do examinador (o que pesou na nota). */
  summary: z.string(),
  /** Erros específicos com trecho EXATO da resposta do aluno. */
  errors: z.array(z.object({ quote: z.string(), issue: z.string(), fix: z.string() })),
  /** UMA ação de treino concreta para a próxima tentativa. */
  nextAction: z.string(),
});
export type AiGradeResult = z.infer<typeof gradeResultSchema>;

/** D18-1: schema dedicado do SST — spelling obrigatório no lugar de coesão. */
export const sstGradeResultSchema = gradeResultSchema.extend({
  dimensions: z.object({
    content: z.number(),
    form: z.number(),
    grammar: z.number(),
    vocabulary: z.number(),
    spelling: z.number(),
  }),
});

/**
 * D15-1a: dimensões fracas (abaixo do limiar de correção, 70 = ERROR_SCORE de
 * session.ts — literal para evitar ciclo de import). Alimentam o snapshot
 * (`aiWeak`) e a fila de correção. `spelling` entra só quando avaliada.
 */
export function weakDimensionKeys(g: AiGradeResult, threshold = 70): string[] {
  const keys = [...GRADE_DIMENSIONS, "spelling" as const];
  return keys.filter((k) => {
    const v = g.dimensions[k];
    return typeof v === "number" && v < threshold;
  });
}

export const AI_GRADE_LIMITS = {
  summary: 400,
  maxErrors: 4,
  errorQuote: 200,
  errorIssue: 160,
  errorFix: 200,
  nextAction: 200,
} as const;

const clampScore = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : null;

const clampText = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const pick = (obj: unknown, key: string): unknown =>
  obj != null && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined;

/**
 * Valida e corta a saída do grader. Nota geral ausente/inválida invalida o
 * resultado (o cliente mantém a avaliação básica determinística — D14-1b:
 * nenhuma nota inventada).
 */
export function clampGradeResult(raw: unknown): AiGradeResult | null {
  const overall = clampScore(pick(raw, "overall"));
  if (overall === null) return null;

  const rawDims = pick(raw, "dimensions");
  const dim = (name: GradeDimension): number => clampScore(pick(rawDims, name)) ?? overall;
  // D18-1: spelling só existe quando o modelo o avaliou (SST) — ausente não
  // herda o overall (essay/SWT não avaliam ortografia como dimensão).
  const spelling = clampScore(pick(rawDims, "spelling"));

  const errors: AiGradeResult["errors"] = [];
  const rawErrors = pick(raw, "errors");
  if (Array.isArray(rawErrors)) {
    for (const e of rawErrors) {
      if (errors.length >= AI_GRADE_LIMITS.maxErrors) break;
      const quote = clampText(pick(e, "quote"), AI_GRADE_LIMITS.errorQuote);
      const issue = clampText(pick(e, "issue"), AI_GRADE_LIMITS.errorIssue);
      const fix = clampText(pick(e, "fix"), AI_GRADE_LIMITS.errorFix);
      if (quote && issue && fix) errors.push({ quote, issue, fix });
    }
  }

  return {
    overall,
    dimensions: {
      content: dim("content"),
      form: dim("form"),
      grammar: dim("grammar"),
      vocabulary: dim("vocabulary"),
      cohesion: dim("cohesion"),
      // clampScore devolve null quando ausente — só incluir quando avaliado.
      ...(spelling !== null ? { spelling } : {}),
    },
    summary: clampText(pick(raw, "summary"), AI_GRADE_LIMITS.summary),
    errors,
    nextAction: clampText(pick(raw, "nextAction"), AI_GRADE_LIMITS.nextAction),
  };
}
