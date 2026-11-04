// Projeto 16 · Fase 2 — tradução do recorte (D16-2a/2b/2c): demanda IA com
// cache ANTES da disponibilidade (D7/D8), chip honesto, fallback com retry,
// resultado EXIBIDO e nunca gravado no store (D16-C), busca cobrindo o recorte.
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

import { routeTree } from "@/routeTree.gen";
import { aiCacheStore, phraseCacheKey } from "@/lib/plus/aiCache";
import { AI_STATUS_KEY } from "@/lib/plus/aiStatus";
import {
  emptyVocabStore,
  filterVocab,
  flattenVocab,
  saveVocabWord,
  type VocabStore,
} from "@/lib/plus/vocab";
import { emptyState, getStateSnapshot, replaceState } from "@/lib/storage";

const mockTranslate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/plus/ai-translate.functions", () => ({
  translateAiPhrase: mockTranslate,
}));

const T0 = 1_700_000_000_000;
const SNIPPET = "The committee conducted a thorough exam of the records.";
const RESULT = {
  translation: "A comissão conduziu um exame minucioso dos registros.",
  tips: [],
};

function seedStore(): VocabStore {
  let store = emptyVocabStore();
  // palavra de DICIONÁRIO: recorte gravado, SEM tradução in-contexto (D16-2a)
  store = saveVocabWord(store, {
    word: "exam",
    literal: "exame",
    snippet: SNIPPET,
    engine: "glossary",
    source: { type: "read_aloud", qid: "ra:012" },
    ts: T0,
  });
  return store;
}

function renderRoute(path: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
  });
  void router.navigate({ href: path });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  window.localStorage.clear();
  replaceState({ ...emptyState(), vocabulary: seedStore() });
  aiCacheStore.reset();
  mockTranslate.mockReset();
});

/**
 * O TranslationSheet faz portal para `document.body` (singleton do React 19 no
 * jsdom entre roots) — no teste o portal vira render inline; o foco é o
 * CONTEÚDO do sheet (padrão da fase 1; portal real coberto em proj12-sheet).
 */
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, createPortal: (children: unknown) => children };
});

afterEach(async () => {
  if (screen.queryByRole("dialog")) {
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  }
  cleanup();
});

describe("D16-2c — a busca cobre o recorte", () => {
  it("termo presente só no snippet encontra a palavra", () => {
    const items = flattenVocab(seedStore());
    const hits = filterVocab(items, { query: "committee" });
    expect(hits.some((h) => h.kind === "word" && h.key === "exam")).toBe(true);
  });

  it("termo ausente não encontra nada (substring continua exata)", () => {
    const items = flattenVocab(seedStore());
    expect(filterVocab(items, { query: "zzz-inexistente" })).toHaveLength(0);
  });
});

describe("D16-2a — o que a IA já traduziu aparece de graça; dicionário pede o gesto", () => {
  it("palavra de dicionário com recorte: seção sem tradução + gesto explícito", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog = await screen.findByRole("dialog");
    // o recorte é renderizado com o token marcado (spans) — texto contido no dialog
    expect(dialog.textContent).toContain(SNIPPET);
    expect(within(dialog).queryByText(RESULT.translation)).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Traduzir este recorte" })).toBeTruthy();
  });
});

describe("D16-2b — demanda via translateAiPhrase (cache ANTES da disponibilidade)", () => {
  it("hit de cache: tradução servível SEM rede e com chip 'Cache IA'", async () => {
    aiCacheStore.putPhrase(phraseCacheKey("read_aloud", SNIPPET), RESULT);
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Traduzir este recorte" }));
    expect(await within(dialog).findByText(RESULT.translation)).toBeTruthy();
    expect(within(dialog).getByText("Cache IA")).toBeTruthy();
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  it("IA online: tradução exibida com chip 'IA' e NADA gravado no store (D16-C)", async () => {
    mockTranslate.mockResolvedValue({ ok: true, result: RESULT });
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Traduzir este recorte" }));
    expect(await within(dialog).findByText(RESULT.translation)).toBeTruthy();
    expect(within(dialog).getByText("IA")).toBeTruthy();
    expect(mockTranslate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sentence: SNIPPET,
        taskType: "read_aloud",
      }),
    });
    await waitFor(() => {
      const word = getStateSnapshot().vocabulary.words["exam"]!;
      expect(word.snippetInContext).toBeUndefined();
      expect(word.snippetWhy).toBeUndefined();
    });
  });

  it("segunda demanda usa o cache gravado pela primeira (sem segunda chamada)", async () => {
    mockTranslate.mockResolvedValue({ ok: true, result: RESULT });
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Traduzir este recorte" }));
    await within(dialog).findByText(RESULT.translation);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog2 = await screen.findByRole("dialog");
    fireEvent.click(within(dialog2).getByRole("button", { name: "Traduzir este recorte" }));
    expect(await within(dialog2).findByText(RESULT.translation)).toBeTruthy();
    expect(mockTranslate).toHaveBeenCalledTimes(1);
  });

  it("falha transitória (rate): estado honesto + retry e cooldown persistida", async () => {
    mockTranslate.mockResolvedValue({ ok: false, code: "rate", message: "rate limit" });
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Traduzir este recorte" }));
    expect(
      await within(dialog).findByText("Tradução não disponível agora — tente novamente."),
    ).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
    const status = JSON.parse(window.localStorage.getItem(AI_STATUS_KEY) ?? "{}");
    expect(status.cooldownUntil).toBeGreaterThan(Date.now());
  });

  it("402 (credits): pausa persistida e mensagem honesta de créditos", async () => {
    mockTranslate.mockResolvedValue({ ok: false, code: "credits", message: "sem créditos" });
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Traduzir este recorte" }));
    expect(await within(dialog).findByText(/Créditos de IA esgotados/)).toBeTruthy();
    const status = JSON.parse(window.localStorage.getItem(AI_STATUS_KEY) ?? "{}");
    expect(status.pausedAt).not.toBeNull();
  });

  it("offline sem cache: estado honesto e NENHUMA chamada de rede", async () => {
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false });
    try {
      renderRoute("/vocabulary");
      fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Traduzir este recorte" }));
      expect(
        await within(dialog).findByText("Tradução não disponível agora — tente novamente."),
      ).toBeTruthy();
      expect(mockTranslate).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(Navigator.prototype, "onLine", original);
    }
  });

  it("IA desligada nos Ajustes: o gesto explica o caminho, sem rede", async () => {
    replaceState({
      ...emptyState(),
      vocabulary: seedStore(),
      settings: {
        ...emptyState().settings,
        plus: { ...emptyState().settings.plus, aiTranslation: false },
      },
    });
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Traduzir este recorte" }));
    expect(await within(dialog).findByText(/IA está desligada nos Ajustes/)).toBeTruthy();
    expect(mockTranslate).not.toHaveBeenCalled();
  });
});
