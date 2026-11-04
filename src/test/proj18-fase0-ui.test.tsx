// Projeto 18 · Fase 0 — D18-0c: retry honesto da análise IA. O estado
// "indisponível" ganha ação visível ("Tentar novamente") que reexecuta a
// análise; o consumidor do exame passa a mesma request como retry.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AiGradeFeedback } from "@/components/practice/AiGradeFeedback";

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  cleanup();
});

describe("AiGradeFeedback — retry no estado indisponível (D18-0c)", () => {
  it("estado indisponível com onRetry mostra 'Tentar novamente' e dispara o retry", () => {
    const onRetry = vi.fn();
    render(
      <AiGradeFeedback
        state={{ status: "unavailable", reason: "A IA está instável neste momento." }}
        recordedScore={72}
        onRetry={onRetry}
      />,
    );
    const btn = screen.getByRole("button", { name: "Tentar novamente" });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("estado indisponível sem onRetry NÃO mostra o botão (consumidores antigos intactos)", () => {
    render(
      <AiGradeFeedback
        state={{ status: "unavailable", reason: "Falha temporária na análise." }}
        recordedScore={72}
      />,
    );
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  });

  it("estado ready não exibe o botão de retry", () => {
    render(
      <AiGradeFeedback
        state={{
          status: "ready",
          result: {
            overall: 80,
            dimensions: { content: 85, form: 80, grammar: 78, vocabulary: 82, cohesion: 75 },
            summary: "Boa estrutura.",
            errors: [],
            nextAction: "Revise conectores.",
          },
        }}
        recordedScore={72}
        onRetry={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  });
});
