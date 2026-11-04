// D18-6: correção pura de Reading FIB (banco de palavras compartilhado).
// Cada lacuna correta vale 1 ponto; score = acertos / total de lacunas.

import type { FibBankQuestion } from "./types";

export interface BankGrade {
  /** Palavra atribuída por lacuna (null = em branco). */
  assignments: (string | null)[];
  /** Índices das lacunas corretas. */
  correctIndexes: number[];
  correct: number;
  total: number;
  score: number;
}

export function gradeBank(
  assignments: (string | null)[],
  answers: FibBankQuestion["blanks"],
): BankGrade {
  const correctIndexes: number[] = [];
  for (let i = 0; i < answers.length; i += 1) {
    if (assignments[i] !== null && assignments[i] === answers[i]) correctIndexes.push(i);
  }
  const total = answers.length;
  return {
    assignments: [...assignments],
    correctIndexes,
    correct: correctIndexes.length,
    total,
    score: total === 0 ? 0 : Math.round((correctIndexes.length / total) * 100),
  };
}
