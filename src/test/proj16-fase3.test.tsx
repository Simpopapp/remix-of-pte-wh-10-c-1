// Projeto 16 · Fase 3 — áudio de estudo (D16-3a/3b): 🔊 palavra + 🔊 recorte no
// card e no sheet; sequência palavra→recorte cancelável (pausa 300 ms nomeada);
// regra do pack: só inglês, plusAudio off desliga tudo.
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

import { routeTree } from "@/routeTree.gen";
import { emptyVocabStore, saveVocabPhrase, saveVocabWord, type VocabStore } from "@/lib/plus/vocab";
import { emptyState, replaceState } from "@/lib/storage";
import { SNIPPET_PAUSE_MS } from "@/components/plus/VocabAudio";

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

afterEach(async () => {
  if (screen.queryByRole("dialog")) {
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  }
  cleanup();
});

describe("D16-3a — 🔊 palavra + 🔊 recorte no card da lista", () => {
  it("palavra com recorte: dois áudios (palavra e frase em contexto)", async () => {
    renderRoute("/vocabulary");
    await screen.findByText("exame");
    // palavra + frase têm cada uma o 🔊 do próprio texto
    expect(screen.getAllByRole("button", { name: "Ouvir pronúncia" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Ouvir frase em contexto" })).toBeTruthy();
  });

  it("plusAudio desligado: NENHUM áudio no card (regra do pack)", async () => {
    replaceState({ ...emptyState(), vocabulary: seedStore() });
    renderRoute("/vocabulary");
    await screen.findByText("exame");
    expect(screen.queryByRole("button", { name: "Ouvir pronúncia" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ouvir frase em contexto" })).toBeNull();
  });
});

describe("D16-3a/3b — bloco de áudio e sequência no sheet completo", () => {
  it("sheet da palavra: 'Ouvir palavra', 'Ouvir frase em contexto' e sequência", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Ouvir palavra" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Ouvir frase em contexto" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Ouvir palavra e recorte" })).toBeTruthy();
  });

  it("sheet da frase: só 'Ouvir frase' (o recorte É a frase)", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(
      await screen.findByRole("button", { name: `Ver detalhe completo de ${PHRASE_EN}` }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Ouvir frase" })).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Ouvir palavra e recorte" })).toBeNull();
  });

  it("sequência: palavra → pausa de 300 ms → recorte; nunca idioma de tradução", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ouvir palavra e recorte" }));
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0]![0]).toBe("exam");
    // regra do pack: nenhum idioma de tradução é passado (3º argumento)
    expect(speakMock.mock.calls[0]![2]).toBeUndefined();
    // a palavra termina → pausa nomeada → o recorte
    speakMock.mock.calls[0]![3]!.onend!();
    await waitFor(
      () => {
        expect(speakMock).toHaveBeenCalledTimes(2);
      },
      { timeout: SNIPPET_PAUSE_MS + 500 },
    );
    expect(speakMock.mock.calls[1]![0]).toBe(SNIPPET);
    expect(speakMock.mock.calls[1]![2]).toBeUndefined();
  });

  it("sequência cancelável: toque durante a pausa PARA — o recorte não toca", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe completo de exam" }));
    const dialog = await screen.findByRole("dialog");
    const seq = within(dialog).getByRole("button", { name: "Ouvir palavra e recorte" });
    fireEvent.click(seq);
    speakMock.mock.calls[0]![3]!.onend!(); // palavra terminou, pausa agendada
    fireEvent.click(within(dialog).getByRole("button", { name: "parar sequência" }));
    expect(cancelMock).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, SNIPPET_PAUSE_MS + 250));
    expect(speakMock).toHaveBeenCalledTimes(1); // o recorte NUNCA toca após o stop
  });
});
