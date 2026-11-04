/**
 * Gradador por tipo de fala no SIMULADO (D18-0b): prática e exame usam a MESMA
 * política (oralPolicy) sobre o mesmo OralInput — o gradador é o único ponto
 * variável. D18-0b: o adaptador retorna o resultado COMPLETO do gradador
 * (incl. `gradable`) para que o `decideOralVerdict` possa classificar fala
 * insuficiente como `not_gradable` (score null) — nunca mais um 0 injusto
 * no simulado quando a prática registraria "não avaliável".
 */
import type {
  AnswerShortQuestion,
  DescribeImageQuestion,
  ReadAloudQuestion,
  RepeatSentenceQuestion,
  RespondSituationQuestion,
  RetellLectureQuestion,
  SgdQuestion,
} from "./types";
import { gradeAnswerShort, gradeRepeatSentence, gradeRetell } from "./speaking";

export type SpeechQuestion =
  | ReadAloudQuestion
  | RepeatSentenceQuestion
  | RetellLectureQuestion
  | AnswerShortQuestion
  // Fase 7: os 3 tipos novos também são fala (DI mostra a imagem no lugar do texto).
  | SgdQuestion
  | RespondSituationQuestion
  | DescribeImageQuestion;

/** Qualquer gradador de fala: score obrigatório, `gradable` opcional (D6). */
export type SpeechGrade = { score: number; gradable?: boolean };

export function gradeSpeechQuestion(
  question: SpeechQuestion,
  transcript: string,
  durationMs: number,
  pauses: number,
): SpeechGrade {
  if (question.taskType === "retell_lecture") {
    return gradeRetell(question.transcript, transcript, durationMs, pauses);
  }
  if (question.taskType === "answer_short") {
    return gradeAnswerShort(question.answer, transcript);
  }
  if (question.taskType === "summarize_group_discussion") {
    // SGD: correção contra a transcrição completa da discussão.
    return gradeRetell(question.text, transcript, durationMs, pauses);
  }
  if (question.taskType === "respond_to_situation") {
    // RTS: correção contra as keywords da resposta modelo.
    return gradeRetell(question.sample || question.text, transcript, durationMs, pauses);
  }
  if (question.taskType === "describe_image") {
    // DI: correção contra a descrição de referência verificada.
    return gradeRetell(question.text, transcript, durationMs, pauses);
  }
  const reference =
    question.taskType === "repeat_sentence"
      ? question.answer || question.transcript
      : question.text;
  return gradeRepeatSentence(reference, transcript, durationMs, pauses);
}
