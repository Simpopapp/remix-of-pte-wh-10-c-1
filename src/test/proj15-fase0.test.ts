// Projeto 15, Fase 0 — contratos de integridade (D15-0a..0e):
// identidade estável de tentativa (id gerado na criação, dedupe por evento),
// merge diário sem inflação em reimport com histórico truncado, restante
// truncado preservado quando um lado cobre o dia, StorageEvent invalidando
// derivados e envelope de backup que rejeita raízes não-objeto sem exceção.
import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { attemptIdentity, attemptKey } from "@/lib/attempt-identity";
import { mergeStates, previewBackup } from "@/lib/backup";
import {
  emptyState,
  exportBackup,
  getStateSnapshot,
  importBackup,
  recordAttempt,
  replaceState,
  useStats,
  type Attempt,
} from "@/lib/storage";

/** Chave do localStorage lida pelo listener de cross-tab (storage.ts, KEY). */
const STORAGE_KEY = "pte-master-hub";

function attempt(partial: Partial<Attempt> & { qid: string; ts: number }): Attempt {
  return {
    taskType: "read_aloud",
    mode: "speech",
    contentScore: null,
    score: null,
    wpm: null,
    durationMs: 0,
    ...partial,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  replaceState(emptyState());
});

describe("Identidade de tentativa (D15-0a)", () => {
  it("recordAttempt gera id determinístico que sobrevive a export/import", () => {
    recordAttempt({ qid: "qA", ts: 1_700_000_000_000, score: 70 });
    const id = getStateSnapshot().attempts[0]?.id;
    expect(id).toBe(attemptKey(getStateSnapshot().attempts[0] as Attempt));

    const json = exportBackup();
    replaceState(emptyState());
    expect(importBackup(json).ok).toBe(true);
    expect(getStateSnapshot().attempts[0]?.id).toBe(id);
  });

  it("mesmo evento regravado com nota diferente NÃO duplica (dedupe por evento)", () => {
    const cur = emptyState();
    cur.attempts = [attempt({ qid: "qA", ts: 1_700_000_000_000, score: 70 })];
    cur.daily = { "2023-11-14": { attempts: 1, scored: 1, sum: 70 } };
    const inc = emptyState();
    // Mesmo evento (qid·ts·tipo·modo idênticos), julgamento atualizado.
    inc.attempts = [attempt({ qid: "qA", ts: 1_700_000_000_000, score: 90 })];
    inc.daily = { "2023-11-14": { attempts: 1, scored: 1, sum: 90 } };

    const merged = mergeStates(cur, inc);
    expect(merged.attempts).toHaveLength(1);
    expect(merged.daily["2023-11-14"]?.attempts).toBe(1);
  });

  it("eventos distintos com payloads idênticos NÃO colapsam", () => {
    const cur = emptyState();
    cur.attempts = [attempt({ qid: "qA", ts: 1_700_000_000_000, score: 70 })];
    const inc = emptyState();
    // Outro evento real: 1 segundo depois, mesmo resultado.
    inc.attempts = [attempt({ qid: "qA", ts: 1_700_000_001_000, score: 70 })];

    const merged = mergeStates(cur, inc);
    expect(merged.attempts).toHaveLength(2);
  });

  it("id explícito vence no dedupe; fallback legado usa a chave estável", () => {
    const a = attempt({ qid: "qA", ts: 1_700_000_000_000, score: 70, id: "manual-1" });
    const b = attempt({ qid: "qA", ts: 1_700_000_000_000, score: 90, id: "manual-2" });
    expect(attemptIdentity(a)).toBe("manual-1");
    expect(attemptIdentity(b)).toBe("manual-2");
    const cur = emptyState();
    cur.attempts = [a];
    const inc = emptyState();
    inc.attempts = [b];
    expect(mergeStates(cur, inc).attempts).toHaveLength(2);
  });
});

describe("Merge diário sem inflação (D15-0b)", () => {
  it("reimportar o MESMO backup com histórico truncado não infla o dia", () => {
    const s = emptyState();
    s.daily = { "2026-11-03": { attempts: 5, scored: 5, sum: 450 } };
    // Log truncado: só 1 tentativa do dia sobreviveu.
    s.attempts = [attempt({ qid: "qA", ts: Date.UTC(2026, 10, 3, 12), score: 90 })];

    const merged = mergeStates(s, JSON.parse(JSON.stringify(s)));
    expect(merged.daily["2026-11-03"]).toEqual({ attempts: 5, scored: 5, sum: 450 });
    expect(merged.attempts).toHaveLength(1);
  });

  it("lado coberto preserva o restante truncado do outro lado", () => {
    const day = 1_762_156_800_000; // 2026-11-03T00:00Z (fuso local do teste usa o mesmo dia)
    const cur = emptyState();
    cur.attempts = [
      attempt({ qid: "qA", ts: day + 3_600_000, score: 70 }),
      attempt({ qid: "qB", ts: day + 7_200_000, score: 90 }),
    ];
    cur.daily = { "2026-11-03": { attempts: 2, scored: 2, sum: 160 } };

    const inc = emptyState();
    // Outro dispositivo: 3 tentativas no dia, log truncado — só 1 sobreviveu.
    inc.attempts = [attempt({ qid: "qC", ts: day + 10_800_000, score: 50 })];
    inc.daily = { "2026-11-03": { attempts: 3, scored: 2, sum: 150 } };

    const merged = mergeStates(cur, inc);
    // União retida = A + B + C (3 tentativas, 3 com nota, soma 210) + restante
    // de inc (3−1 tentativas, 2−1 com nota, 150−50 de soma).
    expect(merged.daily["2026-11-03"]).toEqual({ attempts: 5, scored: 4, sum: 310 });
  });

  it("restante truncado nunca fica negativo nem inflama com duplicatas representadas", () => {
    const day = 1_762_156_800_000;
    const cur = emptyState();
    cur.attempts = [attempt({ qid: "qA", ts: day + 3_600_000, score: 70 })];
    cur.daily = { "2026-11-03": { attempts: 1, scored: 1, sum: 70 } };

    const inc = emptyState();
    // O evento de inc é o MESMO de cur (dedupe) e o agregado é MENOR que o
    // representado — o restante tem que ser 0, não negativo nem duplicado.
    inc.attempts = [attempt({ qid: "qA", ts: day + 3_600_000, score: 70 })];
    inc.daily = { "2026-11-03": { attempts: 1, scored: 1, sum: 70 } };

    const merged = mergeStates(cur, inc);
    expect(merged.daily["2026-11-03"]).toEqual({ attempts: 1, scored: 1, sum: 70 });
  });
});

describe("Cross-tab invalida derivados (D15-0c)", () => {
  it("useStats recalcula após StorageEvent de outra aba", () => {
    const { result } = renderHook(() => useStats());
    expect(result.current.get("qX")).toBeUndefined();

    const other = JSON.parse(JSON.stringify(emptyState()));
    other.attempts = [attempt({ qid: "qX", ts: 1_700_000_000_000, score: 80 })];
    other.questions = {
      qX: {
        attempts: 1,
        bestScore: 80,
        bestWpm: null,
        lastScore: 80,
        lastAttemptAt: 1_700_000_000_000,
        strongAttempts: 0,
        dueStrongAttempts: 0,
        prevStrong: false,
        lastAttemptDue: false,
        box: 0,
        dueAt: 0,
      },
    };
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(other) }),
      );
    });

    expect(result.current.get("qX")).toBeDefined();
  });
});

describe("Envelope de backup (D15-0d)", () => {
  it("raiz não-objeto retorna erro de validação (sem exceção)", () => {
    expect(() => previewBackup("null")).not.toThrow();
    expect(previewBackup("null").ok).toBe(false);
    expect(previewBackup("[]").ok).toBe(false);
    expect(previewBackup('"texto"').ok).toBe(false);
    expect(importBackup("null").ok).toBe(false);
    expect(importBackup("[]").ok).toBe(false);
    expect(importBackup("lixo").ok).toBe(false);
  });
});
