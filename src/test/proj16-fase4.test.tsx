// Projeto 16 · Fase 4 — sessão de estudo no contexto (D16-4a/4b): o recorte só
// existe no lado de TRÁS do cartão (frente intocada); áudio pós-virada;
// typedRecall e a regra D15-3a/3c intocados.
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { routeTree } from "@/routeTree.gen";
import { emptyVocabStore, saveVocabPhrase, saveVocabWord, type VocabStore } from "@/lib/plus/vocab";
import { emptyState, replaceState } from "@/lib/storage";

const speakMock = vi.hoisted(() => vi.fn());
const cancelMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/useSpeechSynthesis", () => ({
  useSpeechSynthesis: () => ({
    supported: true,
    speaking: false,
    speak: speakMock,
    cancel: cancelMock,
  }),
}));

const T0 = 1_700_000_000_000;
const SNIPPET = "The committee conducted a thorough exam of the records.";
const PHRASE_EN = "The passage describes how nature works.";

function seedStore(): VocabStore {
  let store = emptyVocabStore();
  store = saveVocabWord(store, {
    word: "exam",
    literal: "exame",
    snippet: SNIPPET,
    snippetInContext: "A comissão conduziu um exame minucioso dos registros.",
    engine: "glossary",
    source: { type: "read_aloud", qid: "ra:012" },
    ts: T0,
  });
  store = saveVocabPhrase(store, {
    type: "read_aloud",
    qid: "ra:012",
    index: 0,
    en: PHRASE_EN,
    literal: "O trecho descreve como a natureza funciona.",
    ts: T0 + 1000,
  });
  return store;
}

const withAudio = () => ({
  ...emptyState(),
  vocabulary: seedStore(),
  settings: {
    ...emptyState().settings,
    plus: { ...emptyState().settings.plus, plusAudio: true },
  },
});

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
  replaceState(withAudio());
  speakMock.mockReset();
  cancelMock.mockReset();
});

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, createPortal: (children: unknown) => children };
});

afterEach(() => {
  cleanup();
});

describe("D16-4a/4b — recorte no lado de trás da sessão", () => {
  it("a FRENTE não revela o recorte; o verso mostra recorte + tradução + áudio", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: /Revisar hoje/ }));
    // frente: palavra pura, sem recorte e sem áudio do recorte
    expect(screen.getByText("exam")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ouvir frase em contexto" })).toBeNull();
    await waitFor(() => {
      expect(screen.queryByText("No contexto")).toBeNull();
    });
    // virar (o botão de virada expõe só o texto do cartão — a dica é aria-hidden)
    fireEvent.click(screen.getByRole("button", { name: "exam" }));
    await screen.findByText("No contexto");
    expect(document.body.textContent).toContain(SNIPPET);
    expect(document.body.textContent).toContain("A comissão conduziu um exame minucioso");
    expect(screen.getByRole("button", { name: "Ouvir palavra" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ouvir frase em contexto" })).toBeTruthy();
  });

  it("frase NÃO ganha bloco de recorte (o próprio en é o recorte)", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: /Revisar hoje/ }));
    fireEvent.click(screen.getByRole("button", { name: "exam" }));
    fireEvent.click(await screen.findByRole("button", { name: "✓ Lembrei" }));
    // cartão 2: frase
    await screen.findByText(PHRASE_EN);
    fireEvent.click(screen.getByRole("button", { name: PHRASE_EN }));
    await screen.findByText("O trecho descreve como a natureza funciona.");
    expect(screen.queryByText("No contexto")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ouvir frase em contexto" })).toBeNull();
  });

  it("plusAudio off: o verso tem o recorte mas NENHUM áudio", async () => {
    replaceState({ ...emptyState(), vocabulary: seedStore() });
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: /Revisar hoje/ }));
    fireEvent.click(await screen.findByRole("button", { name: "exam" }));
    await screen.findByText("No contexto");
    expect(screen.queryByRole("button", { name: "Ouvir palavra" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ouvir frase em contexto" })).toBeNull();
  });
});
