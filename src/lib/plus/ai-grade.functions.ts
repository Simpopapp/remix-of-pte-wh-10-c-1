/**
 * Server function do grader linguístico IA (projeto 14, D14-1a). O módulo entra
 * no grafo do cliente, mas só o corpo dos handlers é retirado do bundle: as
 * importações de servidor (`@/lib/ai/gateway.server`) são dinâmicas, dentro do handler
 * — mesmo padrão de `ai-translate.functions.ts`; nada de IA no bundle do cliente.
 *
 * Contrato com o cliente (D14-1b): falha de IA devolve `ok:false` e o cliente
 * mantém a avaliação básica determinística, com rótulo honesto — nunca nota
 * inventada, nunca tela quebrada.
 *
 * D15-5c: contrato de erro ÚNICO — validação da entrada e imports dinâmicos
 * acontecem DENTRO do try/catch do handler; qualquer falha vira `ok:false`
 * tipado (nunca exceção crua atravessando a fronteira de rede).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildGradePrompt, type GradeKind } from "@/lib/plus/aiGradePrompts";
import { gradeResultSchema, sstGradeResultSchema } from "@/lib/plus/aiGradeSchemas";

export type AiGradeError = {
  ok: false;
  code: "credits" | "rate" | "server" | "network" | "invalid";
  message: string;
};
export type AiGradeResponse =
  { ok: true; result: import("zod").infer<typeof gradeResultSchema>; source: "ai" } | AiGradeError;

/** Tetos de entrada: limitam custo, parsing e superfície de prompt injection. */
export const gradeLanguageInputSchema = z.object({
  kind: z.enum(["essay", "swt", "sst"]),
  taskType: z.string().min(1).max(80),
  /** Enunciado da questão (prompt/texto-fonte). */
  questionText: z.string().min(1).max(6000),
  /** Resposta do aluno (essay até ~800 palavras; SWT até ~75). */
  response: z.string().min(1).max(8000),
  /** Resposta modelo do banco, referência de conteúdo (opcional). */
  sample: z.string().max(8000).optional(),
  /** Sessão anônima do cliente (chave do rate limit) — não é identidade. */
  sessionId: z.string().min(8).max(64).optional(),
});

const RATE_MESSAGE = "Muitas correções seguidas — aguarde alguns instantes.";
const INVALID_MESSAGE = "Não foi possível ler a resposta enviada — tente novamente.";
const SERVER_MESSAGE = "Correção indisponível agora — a avaliação básica continua valendo.";

/** D15-5f: o peso do rate limit considera o tamanho do pedido (barato, sem backend). */
function payloadSize(data: unknown): number {
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
}

/**
 * Corpo do handler, exportado para teste: entrada inválida e falha de
 * transporte/servidor retornam `ok:false` tipado — nunca exceção crua.
 */
export async function handleGradeLanguage(input: unknown): Promise<AiGradeResponse> {
  const parsed = gradeLanguageInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: INVALID_MESSAGE };
  const data = parsed.data;
  try {
    const { checkRateLimit } = await import("@/lib/ai/rate-limit.server");
    if (!checkRateLimit(data.sessionId, undefined, payloadSize(data)).ok) {
      return { ok: false, code: "rate", message: RATE_MESSAGE };
    }
    const { callGatewayObject } = await import("@/lib/ai/gateway.server");
    const prompt = buildGradePrompt({
      kind: data.kind as GradeKind,
      taskType: data.taskType,
      questionText: data.questionText,
      response: data.response,
      sample: data.sample,
    });
    // D18-1: schema dedicado do SST — spelling obrigatório no lugar de coesão.
    // O shape compartilhado tolera ambas as formas (coesão/spelling opcionais).
    const result = await callGatewayObject({
      instructions: prompt.instructions,
      messages: prompt.messages,
      schema: data.kind === "sst" ? sstGradeResultSchema : gradeResultSchema,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    return { ok: true, result: result.data, source: "ai" };
  } catch {
    // D15-5c: import/transporte/parse inesperado vira contrato, não exceção.
    return { ok: false, code: "server", message: SERVER_MESSAGE };
  }
}

// D15-5c: a validação REAL acontece dentro do handler (contrato ok:false);
// o inputValidator aqui só carrega a tipagem do transporte (nunca lança).
export const gradeLanguageResponse = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input)
  .handler(({ data }) => handleGradeLanguage(data));
