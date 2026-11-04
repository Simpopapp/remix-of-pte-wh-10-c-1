/**
 * Server functions de tradução IA (PRD projeto 11, §2.2/§8). O módulo entra no
 * grafo do cliente, mas só o corpo dos handlers é retirado do bundle: as
 * importações de servidor (`@/lib/ai/gateway.server`) são dinâmicas, dentro do handler.
 *
 * Projeto 13 (D9): entrada COM TETOS (strings e arrays limitados), rate limit
 * próprio por sessão anônima — o handler é público e CSRF não contém custo.
 *
 * D15-5c: contrato de erro ÚNICO — validação da entrada e imports dinâmicos
 * acontecem DENTRO do try/catch do handler; qualquer falha vira `ok:false`
 * tipado (nunca exceção crua atravessando a fronteira de rede).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildPhrasePrompt, buildWordPrompt } from "@/lib/plus/aiPrompts";
import { phraseResultSchema, wordResultSchema } from "@/lib/plus/aiSchemas";

export type AiTranslationError = {
  ok: false;
  code: "credits" | "rate" | "server" | "network" | "invalid";
  message: string;
};
export type AiWordResponse =
  { ok: true; result: import("zod").infer<typeof wordResultSchema> } | AiTranslationError;
export type AiPhraseResponse =
  { ok: true; result: import("zod").infer<typeof phraseResultSchema> } | AiTranslationError;

/** Tetos de entrada (D9): limitam custo, parsing e superfície de prompt injection. */
export const aiWordInputSchema = z.object({
  word: z.string().min(1).max(120),
  sentence: z.string().min(1).max(2000),
  questionText: z.string().max(6000).optional(),
  taskType: z.string().min(1).max(80),
  /** Sessão anônima do cliente (chave do rate limit) — não é identidade. */
  sessionId: z.string().min(8).max(64).optional(),
});

export const aiPhraseInputSchema = z.object({
  sentence: z.string().min(1).max(2000),
  taskType: z.string().min(1).max(80),
  questionText: z.string().max(6000).optional(),
  options: z.array(z.string().max(300)).max(16).optional(),
  neighbors: z.array(z.string().max(800)).max(16).optional(),
  sessionId: z.string().min(8).max(64).optional(),
});

const RATE_MESSAGE = "Muitas traduções seguidas — aguarde alguns instantes.";
const INVALID_MESSAGE = "Não foi possível ler o texto enviado — tente novamente.";
const SERVER_MESSAGE = "Tradução indisponível agora — o dicionário continua valendo.";

/** D15-5f: o peso do rate limit considera o tamanho do pedido (barato, sem backend). */
function payloadSize(data: unknown): number {
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
}

/** Corpo do handler da palavra, exportado para teste (D15-5c). */
export async function handleTranslateWord(input: unknown): Promise<AiWordResponse> {
  const parsed = aiWordInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: INVALID_MESSAGE };
  const data = parsed.data;
  try {
    const { checkRateLimit } = await import("@/lib/ai/rate-limit.server");
    if (!checkRateLimit(data.sessionId, undefined, payloadSize(data)).ok) {
      return { ok: false, code: "rate", message: RATE_MESSAGE };
    }
    const { callGatewayObject } = await import("@/lib/ai/gateway.server");
    const prompt = buildWordPrompt(data);
    const result = await callGatewayObject({
      instructions: prompt.instructions,
      messages: prompt.messages,
      schema: wordResultSchema,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    return { ok: true, result: result.data };
  } catch {
    return { ok: false, code: "server", message: SERVER_MESSAGE };
  }
}

/** Corpo do handler da frase, exportado para teste (D15-5c). */
export async function handleTranslatePhrase(input: unknown): Promise<AiPhraseResponse> {
  const parsed = aiPhraseInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid", message: INVALID_MESSAGE };
  const data = parsed.data;
  try {
    const { checkRateLimit } = await import("@/lib/ai/rate-limit.server");
    if (!checkRateLimit(data.sessionId, undefined, payloadSize(data)).ok) {
      return { ok: false, code: "rate", message: RATE_MESSAGE };
    }
    const { callGatewayObject } = await import("@/lib/ai/gateway.server");
    const prompt = buildPhrasePrompt(data);
    const result = await callGatewayObject({
      instructions: prompt.instructions,
      messages: prompt.messages,
      schema: phraseResultSchema,
    });
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    return { ok: true, result: result.data };
  } catch {
    return { ok: false, code: "server", message: SERVER_MESSAGE };
  }
}

// D15-5c: a validação REAL acontece dentro do handler (contrato ok:false);
// o inputValidator aqui só carrega a tipagem do transporte (nunca lança).
export const translateAiWord = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input)
  .handler(({ data }) => handleTranslateWord(data));

export const translateAiPhrase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input)
  .handler(({ data }) => handleTranslatePhrase(data));
