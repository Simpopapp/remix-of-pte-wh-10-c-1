import { useEffect, useRef, useState } from "react";

import { weakDimensionKeys } from "@/lib/plus/aiGradeSchemas";
import { aiGradeFailReason, runAiGrade } from "@/lib/plus/aiGradeRun";
import { recordAiDiagnosis } from "@/lib/storage";
import type { AiGradeState } from "./AiGradeFeedback";

const OFF: AiGradeState = { status: "off" };
const LOADING: AiGradeState = { status: "loading" };

/**
 * Solicita a análise IA do grader linguístico (projeto 14, D14-1a) quando uma
 * resposta é submetida. Cache v3 primeiro (mesma resposta na mesma questão não
 * gasta chamada); falha → `unavailable` com rótulo honesto (o cliente mantém a
 * avaliação básica determinística).
 */
export function useAiGrade(input: {
  kind: "essay" | "swt" | "sst";
  taskType: string;
  questionText: string;
  /** Resposta submetida ou null (ainda não submeteu). */
  response: string | null;
  sample?: string | undefined;
}): { state: AiGradeState; retry: () => void } {
  const [state, setState] = useState<AiGradeState>(OFF);
  const runRef = useRef(0);
  // D18-0c: retry honesto — reexecuta a MESMA análise (cache v3 primeiro, então
  // o retry só gasta chamada quando a anterior não foi cacheada com sucesso).
  const [retryNonce, setRetryNonce] = useState(0);
  const retry = () => setRetryNonce((n) => n + 1);

  useEffect(() => {
    if (!input.response) {
      runRef.current += 1;
      setState(OFF);
      return;
    }
    const run = ++runRef.current;
    setState(LOADING);
    runAiGrade({
      kind: input.kind,
      taskType: input.taskType,
      questionText: input.questionText,
      response: input.response,
      ...(input.sample ? { sample: input.sample } : {}),
    })
      .then((res) => {
        if (run !== runRef.current) return; // resposta atrasada de outra submissão
        if (res.ok) {
          setState({ status: "ready", result: res.result });
        } else {
          setState({ status: "unavailable", reason: aiGradeFailReason(res.code, res.message) });
        }
      })
      .catch(() => {
        if (run !== runRef.current) return;
        setState({ status: "unavailable", reason: "Falha temporária na análise." });
      });
    // input.response muda por submissão; retryNonce só muda no retry explícito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.response, retryNonce]);

  return { state, retry };
}

/**
 * D15-1a: registra as dimensões fracas da análise IA no snapshot da questão
 * (correção pendente + categorias visíveis no progresso). Lista vazia limpa.
 */
export function useAiDiagnosis(qid: string, state: AiGradeState) {
  useEffect(() => {
    if (state.status !== "ready") return;
    recordAiDiagnosis(qid, weakDimensionKeys(state.result));
  }, [qid, state]);
}
