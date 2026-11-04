// Projeto 16 · Fase 1 — versão SIMPLES na lista, COMPLETA no sheet (D16-1a/1b).
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

import { routeTree } from "@/routeTree.gen";
import { emptyVocabStore, saveVocabPhrase, saveVocabWord, type VocabStore } from "@/lib/plus/vocab";
import { emptyState, replaceState } from "@/lib/storage";

const T0 = 1_700_000_000_000;

function seedStore(): VocabStore {
  let store = emptyVocabStore();
  // 1º gesto IA: recorte + tradução in-contexto + porquê
  store = saveVocabWord(store, {
    word: "rigorous",
    literal: "rigoroso",
    contextual: "nota geral do item",
    snippet: "The rigorous study of nature changed science.",
    snippetInContext: "O estudo rigoroso da natureza mudou a ciência.",
    snippetWhy: "“rigorous” qualifica o estudo.",
    engine: "ai",
    source: { type: "read_aloud", qid: "ra:012" },
    ts: T0,
  });
  // 2º gesto no MESMO recorte: literal anterior vira sentido acumulado
  store = saveVocabWord(store, {
    word: "rigorous",
    literal: "meticuloso",
    engine: "glossary",
    source: { type: "swt", qid: "swt:001" },
    ts: T0 + 1000,
  });
  // frase: o próprio en é o recorte
  store = saveVocabPhrase(store, {
    type: "read_aloud",
    qid: "ra:012",
    index: 0,
    en: "The passage describes how nature works.",
    literal: "O trecho descreve como a natureza funciona.",
    ts: T0 + 2000,
  });
  // palavra SEM recorte e com qid inexistente (derivação impossível)
  store = saveVocabWord(store, {
    word: "dangling",
    literal: "pendente",
    source: { type: "read_aloud", qid: "ra:nao-existe" },
    ts: T0 + 3000,
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
});

/**
 * O TranslationSheet faz portal para `document.body`, que o React 19 trata como
 * singleton quando a rota raiz renderiza <html>. Reusar o mesmo document do jsdom
 * entre roots deixava o clique seguinte em loop síncrono (getClosestInstanceFromNode).
 * No teste o portal vira render inline: o foco aqui é o CONTEÚDO do sheet, não o
 * destino do portal (coberto em proj12-sheet.test.tsx). Artefato do harness.
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

describe("lista = versão SIMPLES (D16-1a)", () => {
  it("o card NÃO exibe a nota contextual; a lista é um índice", async () => {
    renderRoute("/vocabulary");
    await screen.findByText("meticuloso");
    expect(screen.queryByText("nota geral do item")).toBeNull();
  });

  it("a frase NÃO expande inline: o toque abre o sheet completo (D16-D)", async () => {
    renderRoute("/vocabulary");
    await screen.findByText(/The passage describes how nature works/);
    // D16-D: sem expansão inline — nenhum marcador "▼ frase" na lista
    expect(screen.queryByText("▼ frase")).toBeNull();
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver detalhe completo de The passage/i }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    // O literal também aparece no card (versão simples) — a asserção é DENTRO do sheet.
    expect(within(dialog).getByText("O trecho descreve como a natureza funciona.")).toBeTruthy();
  });
});

describe("sheet = versão COMPLETA (D16-1b)", () => {
  it("palavra: recorte com tradução in-contexto, porquê, sentidos e nota", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver detalhe completo de rigorous" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("No contexto");
    expect(dialog.textContent).toContain("The rigorous study of nature changed science.");
    expect(dialog.textContent).toContain("O estudo rigoroso da natureza mudou a ciência.");
    expect(dialog.textContent).toContain("“rigorous” qualifica o estudo.");
    expect(dialog.textContent).toContain("Outros sentidos vistos");
    expect(dialog.textContent).toContain("rigoroso");
    expect(dialog.textContent).toContain("nota geral do item");
  });

  it("frase: recorte é a própria frase e NÃO há seção de sentidos", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver detalhe completo de The passage/i }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("The passage describes how nature works.");
    expect(dialog.textContent).not.toContain("Outros sentidos vistos");
  });

  it("item sem recorte e sem derivação possível: a seção 'No contexto' não aparece", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver detalhe completo de dangling" }),
    );
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      // o skeleton é identificado por aria-label (não entra no textContent)
      expect(within(dialog).queryByLabelText(/Buscando o contexto/)).toBeNull();
    });
    expect(dialog.textContent).not.toContain("No contexto");
    expect(dialog.textContent).toContain("pendente"); // tradução continua lá
  });

  it("Esc fecha o sheet e devolve a lista", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver detalhe completo de rigorous" }),
    );
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("favoritar DENTRO do sheet reflete na lista (item vivo do store)", async () => {
    renderRoute("/vocabulary");
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver detalhe completo de rigorous" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Favoritar" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Nos favoritos" })).toBeTruthy();
    });
    // fecha e confirma a estrela na lista
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole("button", { name: "Remover dos favoritos" })).toBeTruthy();
  });
});
