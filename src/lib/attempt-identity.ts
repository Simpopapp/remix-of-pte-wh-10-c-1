// Projeto 15 (D15-0a): identidade de tentativa em módulo folha — storage.ts
// (recordAttempt) e backup.ts (merge) precisam dela sem ciclo de import.
// Projeto 13 (D2): identidade DETERMINÍSTICA de uma tentativa (hash lógico,
// sem criptografia). Projeto 15: a chave usa apenas os campos ESTÁVEIS do
// evento (qid · ts · taskType · mode). Score/wpm/metrics/tags são RESULTADO e
// podem mudar num re-julgamento — nunca entram na identidade: a mesma
// tentativa regravada com nota diferente continua sendo o MESMO evento (o
// merge deduplica e mantém a evidência retida), e eventos distintos com
// resultados iguais NÃO colapsam.
import type { Attempt } from "@/lib/storage";

export function attemptKey(a: Attempt): string {
  return [a.qid, a.ts, a.taskType, a.mode].join("§");
}

/** Chave de dedupe do merge: id explícito quando existe, senão a chave estável. */
export function attemptIdentity(a: Attempt): string {
  return a.id ?? attemptKey(a);
}
