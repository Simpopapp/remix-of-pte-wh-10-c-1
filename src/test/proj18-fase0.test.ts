// Projeto 18 · Fase 0 — D18-0b: o adaptador de fala do exame retorna o veredito
// COMPLETO do gradador (incl. `gradable`), e a política oral única (oralPolicy)
// classifica fala insuficiente como not_gradable — score null, nunca 0 injusto.
import { describe, expect, it } from "vitest";

import {
  causeOfVerdict,
  classifyOralFailure,
  decideOralVerdict,
  type OralInput,
} from "@/lib/pte/oralPolicy";
import { gradeSpeechQuestion, type SpeechQuestion } from "@/lib/pte/examSpeech";

const base = {
  id: "x",
  section: "speaking" as const,
  prompt: "p",
  audioText: "",
  transcript: "",
  gradingNotes: "",
  wordCount: 10,
  topic: "t",
  source: "s",
};

const retellQuestion = {
  ...base,
  taskType: "retell_lecture" as const,
  text: "",
  transcript:
    "The lecture discusses how urban trees reduce city heat and improve air quality for residents.",
};

const input = (transcript: string): OralInput => ({
  supported: true,
  error: null,
  transcript,
  durationMs: 20_000,
  pauses: 0,
});

describe("D18-0b — gradador de fala do exame respeita gradable", () => {
  it("fala insuficiente no retell → veredito not_gradable (score null, causa rotulada)", () => {
    const grade = gradeSpeechQuestion(retellQuestion, "trees good", 4_000, 0);
    expect(grade.gradable).toBe(false);
    const verdict = decideOralVerdict(input("trees good"), () => grade);
    expect(verdict.score).toBeNull();
    expect(verdict.gradable).toBe(false);
    expect(verdict.failure).toBe("not_gradable");
    expect(causeOfVerdict(verdict)).toBe("not_gradable");
  });

  it("fala suficiente no retell → score avaliável e entra no registro", () => {
    const said =
      "The lecture discusses urban trees reducing city heat and improving air quality for residents today.";
    const grade = gradeSpeechQuestion(retellQuestion, said, 20_000, 0);
    expect(grade.gradable).not.toBe(false);
    const verdict = decideOralVerdict(input(said), () => grade);
    expect(verdict.score).not.toBeNull();
    expect(verdict.gradable).toBe(true);
    expect(verdict.failure).toBeNull();
  });

  it("transcrição vazia continua classificada como empty ANTES de gradar", () => {
    expect(classifyOralFailure(input("   "))).toBe("empty");
  });

  it("answer_short mapeia para o gradador de alternativas (score 0 ou 100)", () => {
    const q: SpeechQuestion = {
      ...base,
      taskType: "answer_short",
      text: "What season comes after summer?",
      answer: "autumn or fall",
    };
    expect(gradeSpeechQuestion(q, "autumn", 2_000, 0).score).toBe(100);
    expect(gradeSpeechQuestion(q, "winter", 2_000, 0).score).toBe(0);
  });

  it("repeat_sentence mapeia para o gradador de alinhamento contra a frase", () => {
    const q: SpeechQuestion = {
      ...base,
      taskType: "repeat_sentence",
      text: "",
      answer: "The city council approved the new park plan yesterday.",
    };
    const ok = gradeSpeechQuestion(
      q,
      "The city council approved the new park plan yesterday.",
      5_000,
      0,
    );
    expect(ok.score).toBeGreaterThan(80);
  });
});
