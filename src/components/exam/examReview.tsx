import { useEffect, useState } from "react";

import { AiGradeFeedback, type AiGradeState } from "@/components/practice/AiGradeFeedback";
import { Button } from "@/components/ui/button";
import { weakDimensionKeys } from "@/lib/plus/aiGradeSchemas";
import { aiGradeFailReason, runAiGrade } from "@/lib/plus/aiGradeRun";
import type { ExamResultCause } from "@/lib/pte/exam";
import { recordAiDiagnosis } from "@/lib/storage";
import { CAUSE_LABEL, type ReviewRow } from "@/components/exam/examReviewShared";

/** Análise IA sob demanda na revisão pós-exame (D14-1e): nunca no fluxo
 * cronometrado — o aluno clica; falha de IA mantém o rótulo honesto.
 * D15-6a: a orquestração (cache → request → cache write) vem do serviço
 * compartilhado `runAiGrade` — aqui fica só o estado do componente. */
function ExamAiAnalysis({
  ai,
  answer,
  score,
  qid,
}: {
  ai: ReviewRow["ai"];
  answer: string;
  score: number | null;
  qid: string;
}) {
  const [state, setState] = useState<AiGradeState>({ status: "off" });

  // D15-1e (paridade prática/exame): a análise do exame também registra as
  // dimensões fracas no snapshot — a correção pendente vale nos dois caminhos.
  useEffect(() => {
    if (state.status !== "ready") return;
    recordAiDiagnosis(qid, weakDimensionKeys(state.result));
  }, [qid, state]);

  if (!ai || !answer.trim()) return null;

  const request = () => {
    setState({ status: "loading" });
    runAiGrade({
      kind: ai.kind,
      taskType: ai.kind === "essay" ? "write_essay" : "swt",
      questionText: ai.questionText,
      response: answer,
      ...(ai.sample ? { sample: ai.sample } : {}),
    })
      .then((res) => {
        if (res.ok) {
          setState({ status: "ready", result: res.result });
        } else {
          setState({
            status: "unavailable",
            reason:
              res.code === "rate" ? "Muitas análises seguidas — aguarde um instante." : res.message,
          });
        }
      })
      .catch(() => setState({ status: "unavailable", reason: "Falha temporária na análise." }));
  };

  if (state.status === "off") {
    return (
      <Button variant="outline" size="sm" className="mt-2" onClick={request}>
        Analisar com IA
      </Button>
    );
  }
  return (
    <div className="mt-3">
      <AiGradeFeedback state={state} recordedScore={score} onRetry={request} />
    </div>
  );
}

export function ExamReviewRow({
  cause,
  prompt,
  answer,
  reference,
  ai,
  score,
  qid,
}: {
  cause: ExamResultCause;
  prompt: string;
  answer: string;
  reference: string;
  ai: ReviewRow["ai"];
  score: number | null;
  qid: string;
}) {
  return (
    <li className="space-y-1 py-3 first:pt-0">
      <p className="text-sm text-foreground">{prompt}</p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">Sua resposta:</span>{" "}
        <span className="italic">{answer || "—"}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">Referência:</span>{" "}
        <span className="italic">{reference}</span>
      </p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {CAUSE_LABEL[cause]}
      </p>
      <ExamAiAnalysis qid={qid} ai={ai} answer={answer} score={score} />
    </li>
  );
}
