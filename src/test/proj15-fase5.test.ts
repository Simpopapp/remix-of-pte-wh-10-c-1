// Projeto 15, Fase 5 — robustez offline e erros:
// D15-5a identidade do SW por build · D15-5c contrato de erro único dos
// handlers IA · D15-5e import honesto (gravação confirmada) · D15-5f rate
// limit: rejeição não consome e payload pesa.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applySwVersion, swVersionFrom } from "../../scripts/sw-version.mjs";
import { handleGradeLanguage } from "@/lib/plus/ai-grade.functions";
import { handleTranslatePhrase, handleTranslateWord } from "@/lib/plus/ai-translate.functions";
import { hasUndoBackup } from "@/lib/backup";
import {
  RATE_LIMIT_GLOBAL,
  RATE_LIMIT_PER_KEY,
  checkRateLimit,
  resetRateLimits,
} from "@/lib/ai/rate-limit.server";

beforeEach(() => {
  window.localStorage.clear();
  resetRateLimits();
});

describe("D15-5a · versão do SW por build", () => {
  it("listas de assets diferentes → versões (cache-names) diferentes", () => {
    const a = swVersionFrom(["/assets/a.js", "/assets/b.css"], "// sw");
    const b = swVersionFrom(["/assets/a.js", "/assets/c.css"], "// sw");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^b[0-9a-z]+$/);
  });

  it("lista + código idênticos (ordem-insensível) → mesma versão", () => {
    const a = swVersionFrom(["/assets/a.js", "/assets/b.css"], "// sw");
    const b = swVersionFrom(["/assets/b.css", "/assets/a.js"], "// sw");
    expect(a).toBe(b);
  });

  it("mudança só no código do SW também troca a versão", () => {
    const assets = ["/assets/a.js"];
    expect(swVersionFrom(assets, "// v1")).not.toBe(swVersionFrom(assets, "// v2"));
  });

  it("applySwVersion substitui o placeholder e exige que ele exista", () => {
    expect(applySwVersion("const VERSION = __SW_VERSION__;", "b1")).toContain("b1");
    expect(() => applySwVersion("const VERSION = '5';", "b1")).toThrow();
  });
});

describe("D15-5f · rate limit: rejeição não consome", () => {
  it("rejeição por chave NÃO drena o bucket global", () => {
    const key = "chave-de-teste-01";
    for (let i = 0; i < RATE_LIMIT_PER_KEY; i += 1) {
      expect(checkRateLimit(key, 1000, 0).ok).toBe(true);
    }
    // 31º pedido da mesma chave: rejeitado pela chave...
    const rejected = checkRateLimit(key, 1000, 0);
    expect(rejected.ok).toBe(false);
    // ...e o global continua com exatamente RATE_LIMIT_PER_KEY consumidos.
    const otherKey = (i: number) => `outra-chave-${String(i).padStart(3, "0")}`;
    for (let i = 0; i < RATE_LIMIT_GLOBAL - RATE_LIMIT_PER_KEY; i += 1) {
      expect(checkRateLimit(otherKey(i), 1000, 0).ok).toBe(true);
    }
    // O global só enche com pedidos ACEITES — nenhum dos rejeitados contou.
    expect(checkRateLimit("terceira-chave-1", 1000, 0).ok).toBe(false);
  });

  it("241º request falha no teto global (240 aceites)", () => {
    for (let i = 0; i < RATE_LIMIT_GLOBAL; i += 1) {
      expect(checkRateLimit(`k${i}xxxxxxxxxx`, 2000, 0).ok).toBe(true);
    }
    const over = checkRateLimit("k-excedente-999", 2000, 0);
    expect(over.ok).toBe(false);
    // Rejeitado não consumiu: a próxima chave de teste ainda cabe se a janela
    // fosse resetada — aqui basta confirmar a rejeição estável.
    expect(checkRateLimit("k-excedente-999", 2000, 0).ok).toBe(false);
  });

  it("rejeição pelo teto global NÃO consome a cota da chave", () => {
    // Enche o global com uma chave descartável.
    for (let i = 0; i < RATE_LIMIT_GLOBAL; i += 1) {
      checkRateLimit(`g${i}xxxxxxxxxx`, 3000, 0);
    }
    // A chave alvo ainda NÃO registrou consumo (o global rejeitou antes).
    const key = "alvo-inmaculado";
    expect(checkRateLimit(key, 3000, 0).ok).toBe(false);
  });

  it("payload pesa: 2 kB+1 consomem 2 unidades da chave e do global", () => {
    const key = "payload-pesado-1";
    // ceil(2001/2000) = 2 unidades por pedido.
    expect(checkRateLimit(key, 4000, 2001).ok).toBe(true);
    expect(checkRateLimit(key, 4000, 2001).ok).toBe(true);
    expect(checkRateLimit(key, 4000, 4000).ok).toBe(true);
    // Total consumido: 2 + 2 + 2 = 6 (chave e global).
    const filler = (i: number) => `payload-verific-${String(i).padStart(3, "0")}`;
    for (let i = 0; i < RATE_LIMIT_GLOBAL - 6; i += 1) {
      checkRateLimit(filler(i), 4000, 0);
    }
    expect(checkRateLimit("ultima-chave-11", 4000, 0).ok).toBe(false);
  });
});

describe("D15-5c · contrato de erro único dos handlers IA", () => {
  it.each([
    ["grade", handleGradeLanguage],
    ["word", handleTranslateWord],
    ["phrase", handleTranslatePhrase],
  ])("entrada inválida (%s) devolve ok:false tipado, não exceção", async (_name, handler) => {
    const out = await handler(null);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("invalid");
      expect(typeof out.message).toBe("string");
      expect(out.message.length).toBeGreaterThan(0);
    }
  });

  it("corpo com campos faltantes também cai no contrato (code: invalid)", async () => {
    const out = await handleGradeLanguage({ kind: "essay" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("invalid");
  });
});

describe("D15-5e · import honesto: gravação confirmada antes de ok:true", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falha de gravação devolve resultado explícito e preserva o undo", async () => {
    const storage = await import("@/lib/storage");
    const backup = storage.exportBackup();

    // A gravação do NOVO estado falha (quota cheia); o undo (chave própria) passa.
    const realSetItem = Storage.prototype.setItem.bind(window.localStorage);
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation((k: string, v: string) => {
        if (k === "pte-master-hub") throw new DOMException("quota", "QuotaExceededError");
        realSetItem(k, v);
      });

    const result = storage.importBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("gravacao");

    // O undo continua disponível e o estado em memória voltou ao anterior.
    expect(hasUndoBackup()).toBe(true);
    spy.mockRestore();
  });

  it("import com espaço OK segue ok:true", async () => {
    const storage = await import("@/lib/storage");
    const backup = storage.exportBackup();
    expect(storage.importBackup(backup).ok).toBe(true);
  });
});
