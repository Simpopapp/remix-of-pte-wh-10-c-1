// Projeto 16 · Fase 0 — captura do recorte PELA UI (D16-0a).
// O gesto real (tap na palavra em PlusWordText) grava a frase EN onde a palavra
// estava — a MESMA que o componente envia à IA como contexto (D16-0a).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { PlusWordText } from "@/components/plus/PlusWordText";
import { getStateSnapshot, emptyState, replaceState } from "@/lib/storage";

beforeEach(() => {
  window.localStorage.clear();
  replaceState(emptyState());
});

afterEach(() => {
  cleanup();
});

describe("PlusWordText — recorte entra na captura", () => {
  it("tap na palavra (dicionário) grava snippet = frase do gesto", async () => {
    render(
      <PlusWordText
        text="The rigorous study of nature. Later work expanded it."
        enabled
        source={{ type: "read_aloud", qid: "ra:016" }}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Traduzir rigorous" }));
    await waitFor(() => {
      expect(getStateSnapshot().vocabulary.words["rigorous"]).toBeDefined();
    });
    const w = getStateSnapshot().vocabulary.words["rigorous"]!;
    expect(w.snippet).toBe("The rigorous study of nature.");
    expect(w.snippetInContext).toBeUndefined(); // dicionário: tradução in-contexto é demanda
  });

  it("captura exige tradução ativa + source (gesto só de áudio não grava recorte)", async () => {
    render(<PlusWordText text="The rigorous study of nature." enabled={false} audioEnabled />);
    fireEvent.click(await screen.findByRole("button", { name: "Ouvir pronúncia de rigorous" }));
    await waitFor(() => {
      expect(getStateSnapshot().vocabulary.words["rigorous"]).toBeUndefined();
    });
  });
});
