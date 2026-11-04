// Projeto 15 (D15-2c/D15-2d): classificação de tentativas e evidência de
// revisão — módulo FOLHA (só depende de storage). A classificação reusa a
// ÚNICA regra do SRS (applyAttemptToSnapshot) em replay cronológico: uma
// tentativa é "revisão vencida" quando feita com a caixa já vencida no
// momento da tentativa, "antecipada" quando repete um item ainda não vencido
// e "primeira" quando é o primeiro contato com a questão. Tentativas de
// exame são marcadas pela tag "exam" (mesma marca do ExamRunner).
import {
  applyAttemptToSnapshot,
  passScoreFor,
  type Attempt,
  type QuestionSnapshot,
} from "./storage";

/** Marca comum das tentativas de exame (espelha ExamRunner.EXAM_TAG). */
export const EXAM_TAG = "exam";

export type AttemptReview = "primeira" | "vencida" | "antecipada";

export interface ClassifiedAttempt {
  attempt: Attempt;
  /** score ?? contentScore (null = sem score). */
  score: number | null;
  /** true = a questão já tinha tentativa com score antes desta. */
  repeat: boolean;
  /** Revisão vencida, antecipada ou primeiro contato (primeira nunca é revisão). */
  review: AttemptReview;
  /** Tentativa de exame (tag "exam"). */
  exam: boolean;
}

/** Classifica cada tentativa em ordem cronológica (puro, sem efeito colateral). */
export function classifyAttempts(attempts: Attempt[]): ClassifiedAttempt[] {
  const ordered = [...attempts].sort((a, b) => a.ts - b.ts);
  const snaps = new Map<string, QuestionSnapshot>();
  const out: ClassifiedAttempt[] = [];
  for (const a of ordered) {
    const snap = snaps.get(a.qid);
    const seen = (snap?.attempts ?? 0) > 0;
    const wasDue = seen && (snap?.dueAt ?? 0) <= a.ts;
    const score = a.score ?? a.contentScore;
    const review: AttemptReview = !seen ? "primeira" : wasDue ? "vencida" : "antecipada";
    out.push({
      attempt: a,
      score,
      repeat: seen,
      review,
      exam: a.tags?.includes(EXAM_TAG) ?? false,
    });
    // Só tentativas COM score movem o SRS (semântica do snapshot preservada).
    if (score !== null) snaps.set(a.qid, applyAttemptToSnapshot(snap, a));
  }
  return out;
}

export interface AttemptMix {
  /** Primeiras tentativas (itens novos) com score. */
  nova: number;
  /** Repetições com score. */
  repetida: number;
  /** Repetições feitas com o item vencido (revisão de verdade). */
  vencida: number;
  /** Tentativas de exame com score. */
  exam: number;
  /** Total com score na janela. */
  scored: number;
}

export const emptyMix = (): AttemptMix => ({
  nova: 0,
  repetida: 0,
  vencida: 0,
  exam: 0,
  scored: 0,
});

/** Rótulo de mistura (D15-2c): diz de que a média do período é feita. */
export function describeMix(mix: AttemptMix): string {
  if (mix.scored === 0) return "sem tentativas com score";
  const parts: string[] = [];
  if (mix.nova > 0) parts.push(`${mix.nova} nova${mix.nova === 1 ? "" : "s"}`);
  if (mix.repetida > 0) parts.push(`${mix.repetida} repetida${mix.repetida === 1 ? "" : "s"}`);
  if (mix.vencida > 0)
    parts.push(
      `${mix.vencida} revisão${mix.vencida === 1 ? "" : "ões"} vencida${mix.vencida === 1 ? "" : "s"}`,
    );
  if (mix.exam > 0) parts.push(`${mix.exam} de exame`);
  const label = parts.join(" · ");
  // Honestidade: média que mistura itens novos e repetidos precisa dizer isso.
  if (mix.nova > 0 && mix.repetida > 0) return `${label} — mistura novos e repetidos`;
  return label;
}

export interface ReviewRate {
  /** Revisões contadas (com score). */
  n: number;
  /** % que atingiu o limiar de acerto do tipo (null sem amostra). */
  passRate: number | null;
}

export interface SpeakingEvidence {
  /** Tentativas de fala com wpm nos últimos 30 dias. */
  n: number;
  wpmAvg: number | null;
  pausesAvg: number | null;
  /** Ritmo no início e no fim da janela (trajetória). */
  wpmFirst: number | null;
  wpmLast: number | null;
}

export interface ReviewEvidence {
  /** Revisões feitas COM o item vencido — a revisão que o SRS pediu. */
  due: ReviewRate;
  /** Repetições antecipadas (treino extra, não revisão). */
  early: ReviewRate;
  /** Tentativas abaixo do limiar do tipo nos últimos 14 dias. */
  recentLapses: number;
  /** Componentes de fala (ritmo/pausas) — null sem amostra. */
  speaking: SpeakingEvidence | null;
}

const DAY = 86_400_000;
const LAPSE_WINDOW_DAYS = 14;
const SPEAKING_WINDOW_DAYS = 30;

function passRateOf(rows: ClassifiedAttempt[]): ReviewRate {
  const scored = rows.filter((r) => r.score !== null);
  const n = scored.length;
  if (n === 0) return { n: 0, passRate: null };
  const passed = scored.filter((r) => r.score! >= passScoreFor(r.attempt.taskType)).length;
  return { n, passRate: Math.round((passed / n) * 100) };
}

/**
 * Evidência de revisão (D15-2d): revisões vencidas vs. antecipadas, lapsos
 * recentes e trajetória dos componentes de fala. Puro — o cartão do /progress
 * consome isto para mostrar o que o treino repetido de fato verificou.
 */
export function buildReviewEvidence(attempts: Attempt[], now = Date.now()): ReviewEvidence {
  const rows = classifyAttempts(attempts);
  const due = passRateOf(rows.filter((r) => r.review === "vencida"));
  const early = passRateOf(rows.filter((r) => r.review === "antecipada"));
  const lapses = rows.filter(
    (r) =>
      r.score !== null &&
      r.attempt.ts >= now - LAPSE_WINDOW_DAYS * DAY &&
      r.score < passScoreFor(r.attempt.taskType),
  ).length;

  const speech = rows
    .filter(
      (r) =>
        r.attempt.mode === "speech" &&
        r.attempt.wpm !== null &&
        r.attempt.ts >= now - SPEAKING_WINDOW_DAYS * DAY,
    )
    .sort((a, b) => a.attempt.ts - b.attempt.ts);
  let speaking: SpeakingEvidence | null = null;
  if (speech.length > 0) {
    const wpms = speech.map((r) => r.attempt.wpm!);
    const pauses = speech
      .map((r) => r.attempt.metrics?.["pauses"])
      .filter((p): p is number => typeof p === "number");
    speaking = {
      n: speech.length,
      wpmAvg: Math.round(wpms.reduce((s, w) => s + w, 0) / wpms.length),
      pausesAvg:
        pauses.length > 0
          ? Math.round((pauses.reduce((s, p) => s + p, 0) / pauses.length) * 10) / 10
          : null,
      wpmFirst: wpms[0] ?? null,
      wpmLast: wpms[wpms.length - 1] ?? null,
    };
  }

  return { due, early, recentLapses: lapses, speaking };
}
