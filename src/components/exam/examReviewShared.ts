import { tokenize, type UnifiedQuestion } from "@/lib/pte";
import type { ExamResultCause } from "@/lib/pte/exam";

export const CAUSE_LABEL: Record<ExamResultCause, string> = {
  graded: "Avaliada automaticamente",
  skipped: "Pulada por você",
  expired: "Tempo esgotado",
  technical: "Falha técnica (microfone/rede)",
  empty: "Sem resposta",
  not_gradable: "Não avaliável",
};

export interface ReviewRow {
  qid: string;
  cause: ExamResultCause;
  prompt: string;
  answer: string;
  reference: string;
  /** Dados para a análise IA sob demanda (essay/SWT — D14-1e). */
  ai?: { kind: "essay" | "swt"; questionText: string; sample?: string };
  score: number | null;
}

/** Gabarito em texto plano para a revisão pós-exame (§1.6). */
export function referenceFor(q: UnifiedQuestion): string {
  switch (q.taskType) {
    case "read_aloud":
    case "describe_image":
    case "retell_lecture":
    case "summarize_group_discussion":
    case "respond_to_situation":
      return q.transcript || q.text;
    case "repeat_sentence":
      return q.answer || q.transcript;
    case "answer_short":
    case "wfd":
      return q.answer;
    case "swt":
    case "summarize_spoken_text":
    case "lst_summary":
      return q.sample || q.text;
    case "lst_fib":
      return q.answers.join(" · ");
    case "lst_hiw": {
      const tokens = tokenize(q.text);
      return q.errorIndexes
        .map((i) => tokens[i] ?? "")
        .filter(Boolean)
        .join(", ");
    }
    case "mcq_single":
    case "mcq_multi":
    case "lst_mcq":
    case "lst_mcq_multi":
    case "lst_hcs":
    case "lst_smw":
      return q.answer.map((i) => String.fromCharCode(65 + i)).join(", ") || "—";
    case "reorder_paragraphs":
      return q.correctOrder.map((i) => q.items[i] ?? "").join(" → ");
    case "read_fib":
      return q.blanks.map((b) => b.answer).join(" · ");
    // D18-4: referência real para o essay (resposta modelo do item) e para o
    // FIB com banco (gabarito das lacunas, em ordem).
    case "write_essay":
      return q.sample || "—";
    case "read_fib_bank":
      return q.blanks.join(" · ");
    default:
      return "—";
  }
}
