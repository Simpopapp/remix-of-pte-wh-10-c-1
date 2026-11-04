/**
 * Recorte do vocabulário (PRD projeto 16, D16-1b §4): a frase EN onde a palavra
 * foi usada, com a palavra destacada e a tradução in-contexto abaixo — o mesmo
 * padrão visual do sheet de tradução por frase (border-l + itálico). Só
 * conteúdo: o sheet que a hospeda decide quando a seção aparece (item sem
 * recorte → seção omitida, nunca placeholder vazio).
 */
import { useMemo, type ReactNode } from "react";

import { snippetParts } from "@/components/plus/vocabSnippetParts";
import { cn } from "@/lib/utils";

export function VocabSnippet({
  snippet,
  token,
  inContext,
  why,
  className,
}: {
  /** A frase EN (recorte). */
  snippet: string;
  /** Palavra a destacar dentro do recorte (opcional — a frase completa não destaca). */
  token?: string;
  /** Tradução in-contexto para o recorte (IA da captura ou demanda — Fase 2). */
  inContext?: string;
  /** Porquê da tradução in-contexto (opcional). */
  why?: string;
  className?: string;
}) {
  const parts = useMemo<[string, string?, string?]>(
    () => snippetParts(snippet, token),
    [snippet, token],
  );
  const render = (text: string, key: string): ReactNode => (
    <span key={key} className="whitespace-pre-wrap">
      {text}
    </span>
  );
  const [before, hit, after] = parts;
  return (
    <div className={cn("border-l-2 border-primary/30 pl-3", className)}>
      <p className="font-serif text-sm italic leading-relaxed text-foreground/80">
        {before ? render(before, "b") : null}
        {hit ? (
          <mark
            className="rounded-sm bg-secondary px-0.5 font-medium not-italic text-foreground"
            aria-label={`“${hit}” neste contexto`}
          >
            {hit}
          </mark>
        ) : null}
        {after ? render(after, "a") : null}
      </p>
      {inContext ? (
        <div className="mt-2">
          <p className="text-sm leading-relaxed text-foreground">{inContext}</p>
          {why ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{why}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Skeleton do recorte enquanto a derivação (D16-0c) roda — nunca conteúdo falso. */
export function VocabSnippetSkeleton() {
  return (
    <div
      aria-label="Buscando o contexto original"
      aria-busy="true"
      className="border-l-2 border-primary/30 pl-3"
    >
      <div className="h-4 w-full animate-pulse rounded bg-secondary" />
      <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-secondary" />
    </div>
  );
}
