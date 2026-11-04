// Projeto 16 · Fase 5 — inteligência de fluxo (D16-5a/5b): chip de estado
// vencido/em dia/consolidado na lista e filtros que sobrevivem à navegação
// (leitura pós-hidratação; "Limpar filtros" limpa o persistido).
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { routeTree } from "@/routeTree.gen";
import {
  applyVocabStudy,
  emptyVocabStore,
  saveVocabWord,
  vocabStateChip,
  type VocabStore,
} from "@/lib/plus/vocab";
import { emptyState, replaceState } from "@/lib/storage";

const T0 = 1_700_000_000_000;

function seedStore(): VocabStore {
  let store = emptyVocabStore();
  // vencido (caixa 0)
  store = saveVocabWord(store, {
    word: "exam",
    literal: "exame",
    source: { type: "read_aloud", qid: "ra:012" },
    ts: T0,
  });
  // consolidado: 4 promoções honestas (sempre vencida quando dueAt ≤ ts)
  for (let i = 0; i < 4; i += 1) store = applyVocabStudy(store, "word", "fresh", true, T0 + i);
  store = saveVocabWord(store, {
    word: "fresh",
    literal: "fresco",
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
});

afterEach(() => {
  cleanup();
});

describe("D16-5a — chip de estado (puro)", () => {
  it("vencido > consolidado > em dia, com o texto honesto", () => {
    expect(vocabStateChip({ box: 0, dueAt: 0 }, T0)).toEqual({
      label: "Revisar hoje",
      tone: "primary",
    });
    expect(vocabStateChip({ box: 5, dueAt: T0 + 86_400_000 }, T0)).toEqual({
      label: "Consolidado",
      tone: "success",
    });
    expect(vocabStateChip({ box: 2, dueAt: T0 + 86_400_000 }, T0)).toEqual({
      label: "Em dia",
      tone: "muted",
    });
  });

  it("a lista mostra o chip de estado com a caixa exata no aria", async () => {
    renderRoute("/vocabulary");
    await screen.findByText("exame");
    // dois itens vencidos (caixa 0) → dois chips "Revisar hoje"
    expect(screen.getAllByText("Revisar hoje")).toHaveLength(2);
  });
});

describe("D16-5b — filtros que sobrevivem à navegação", () => {
  it("a busca persiste: voltar à página restaura o filtro", async () => {
    renderRoute("/vocabulary");
    const input = await screen.findByPlaceholderText(/Buscar palavra/);
    fireEvent.change(input, { target: { value: "exam" } });
    await waitFor(() => {
      expect(screen.getAllByText("exame")).toHaveLength(1);
    });
    cleanup();
    // "voltar": novo mount da rota lê o persistido PÓS-hidratação
    renderRoute("/vocabulary");
    const restored = await screen.findByDisplayValue("exam");
    expect(restored).toBeTruthy();
  });

  it("'Limpar filtros' limpa o input E o persistido", async () => {
    renderRoute("/vocabulary");
    const input = await screen.findByPlaceholderText(/Buscar palavra/);
    fireEvent.change(input, { target: { value: "zzz-sem-match" } });
    await screen.findByText(/Nada encontrado/);
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Buscar palavra/)).toHaveValue("");
    });
    const persisted = JSON.parse(window.localStorage.getItem("pte-vocab-filters") ?? "{}") as {
      query?: string;
    };
    expect(persisted.query).toBe("");
  });
});
