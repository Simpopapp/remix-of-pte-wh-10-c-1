/**
 * Versão COMPLETA de um item do vocabulário (PRD projeto 16, D16-1b/D16-1c):
 * TranslationSheet (container universal do pack — portal, focus trap, bottom
 * sheet mobile / painel central desktop) com as seções fechadas:
 * Recorte → Tradução → Outros sentidos → Fontes → Ações.
 * O card da LISTA é a versão simples (o índice); este sheet é a profundidade.
 *
 * Fase 2 (PRD §5):
 *  - D16-2a: tradução in-contexto que veio da IA na captura (`snippetInContext`)
 *    é exibida de graça, com chip honesto "IA"; item de dicionário mostra o
 *    gesto explícito "Traduzir este recorte".
 *  - D16-2b: tradução sob demanda via `translateAiPhrase` (server function
 *    existente — nenhum endpoint novo; nada de IA no bundle do cliente) com
 *    cache ANTES da checagem de disponibilidade (D7/D8), chip verídico,
 *    fallback honesto e retry. O resultado é EXIBIDO, nunca gravado no store
 *    (D16-C — traduzir o recorte não reescreve o item capturado).
 */
import { Sparkles, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import type { VocabListItem } from "@/lib/plus/vocab";
import { TYPE_META, positionInType, type TaskType } from "@/lib/pte";
import { TranslationSheet } from "@/components/plus/TranslationSheet";
import { VocabSnippet, VocabSnippetSkeleton } from "@/components/plus/VocabSnippet";
import { VocabAudioSection } from "@/components/plus/VocabAudio";
import { MechanismChip, type Mechanism } from "@/components/plus/MechanismChip";
import { aiCacheStore, phraseCacheKey } from "@/lib/plus/aiCache";
import {
  aiSessionId,
  aiUsable,
  enterCooldown,
  loadAiStatus,
  pauseForCredits,
  saveAiStatus,
} from "@/lib/plus/aiStatus";
import { translateAiPhrase } from "@/lib/plus/ai-translate.functions";
import { cn } from "@/lib/utils";

/** Rótulo do tipo de tarefa (sempre via TYPE_META — nunca hardcode). */
function typeLabel(type: string): string {
  const meta = (TYPE_META as Record<string, { label?: string } | undefined>)[type];
  return meta?.label ?? type;
}

/** Dedupe (D10): chamadas idênticas em voo compartilham a mesma Promise. */
const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof translateAiPhrase>>>>();

/** Estado da tradução sob demanda do recorte (D16-2b). */
type SnippetDemand =
  | { phase: "loading" }
  | { phase: "done"; text: string; from: "ai" | "ai-cache" }
  | { phase: "error"; reason: "settings" | "credits" | "unavailable" };

const DEMAND_ERROR_TEXT: Record<Extract<SnippetDemand, { phase: "error" }>["reason"], string> = {
  settings: "A IA está desligada nos Ajustes — ligue-a para traduzir o recorte.",
  credits: "Créditos de IA esgotados — tente novamente mais tarde.",
  unavailable: "Tradução não disponível agora — tente novamente.",
};

/**
 * Chip de contexto: leva de volta à questão de origem (o "reencontro").
 * Extraído da rota /vocabulary (projeto 10) — consumido pela lista E pelo sheet.
 */
export function SourceChip({ type, qid, extra }: { type: string; qid?: string; extra?: string }) {
  const pos = qid ? positionInType(qid) : { number: 0, total: 0 };
  const label =
    pos.number > 0
      ? `${typeLabel(type)} · q. ${pos.number}/${pos.total}${extra ?? ""}`
      : typeLabel(type);
  if (!qid || pos.number === 0) {
    return (
      <span className="inline-flex max-w-full items-center whitespace-normal rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
        {label}
      </span>
    );
  }
  return (
    <Link
      to="/practice"
      search={{ q: qid }}
      className="inline-flex min-h-11 max-w-full items-center whitespace-normal rounded-full border border-border px-3 py-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:border-primary/50 hover:text-foreground hover:underline"
    >
      {label}
    </Link>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}

export interface VocabDetailSheetProps {
  /** Item em detalhe (null → sheet fechado). Sempre o item VIVO do store. */
  item: VocabListItem | null;
  /** Recorte efetivo: palavra = snippet ?? derivação; frase = en. */
  snippet?: string;
  /** Derivação em curso (D16-0c) — skeleton, nunca conteúdo falso. */
  snippetLoading?: boolean;
  /** IA de tradução nos Ajustes (settings.plus.aiTranslation) — D16-2b. */
  aiEnabled?: boolean;
  /** Áudio de pronúncia (settings.plus.plusAudio) — D16-3a. */
  audioOn?: boolean;
  onClose: () => void;
  onStar: () => void;
  /** Remoção com Desfazer (D15-4c) — resolvida pelo dono da lista. */
  onRemove: () => void;
}

export function VocabDetailSheet({
  item,
  snippet,
  snippetLoading,
  aiEnabled,
  audioOn,
  onClose,
  onStar,
  onRemove,
}: VocabDetailSheetProps) {
  // D16-2b: estado da demanda — zerado quando o item/recorte muda (a resposta
  // tardia de outro recorte nunca vira conteúdo do sheet aberto).
  const [demand, setDemand] = useState<SnippetDemand | null>(null);
  // D15-5d: navigator só PÓS-MOUNT — o estado inicial assume online e o
  // effect corrige (hidratação nunca lê API do browser).
  const [online, setOnline] = useState(true);
  const activeKey = item ? `${item.kind}:${item.key}` : null;
  const activeRef = useRef<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    activeRef.current = activeKey;
    setDemand(null);
  }, [activeKey, snippet]);

  if (!item) return null;
  const isPhrase = item.kind === "phrase";
  const hasSenses = !isPhrase && (item.senses?.length ?? 0) > 0;
  const showSnippet = !isPhrase && (snippetLoading === true || snippet !== undefined);

  // D16-2a: a tradução in-contexto CAPTURADA só é exibida para o recorte que a
  // produziu (snippet efetivo === snippet capturado) — nunca mente coerência.
  const capturedInContext =
    !isPhrase &&
    item.snippetInContext !== undefined &&
    item.snippet !== undefined &&
    item.snippet === snippet;

  /** D16-2b: gesto de tradução do recorte — cache ANTES da disponibilidade. */
  const requestSnippet = () => {
    if (isPhrase || snippet === undefined || snippetLoading === true) return;
    const taskType = item.sources[item.sources.length - 1]?.type ?? item.originType;
    if (!taskType) {
      setDemand({ phase: "error", reason: "unavailable" });
      return;
    }
    const key = phraseCacheKey(taskType, snippet);
    // D7/D8: cache ANTES da checagem de disponibilidade — recorte traduzido
    // uma vez volta offline/cooldown/pausado.
    const hit = aiCacheStore.getPhrase(key);
    if (hit) {
      setDemand({ phase: "done", text: hit.translation, from: "ai-cache" });
      return;
    }
    if (aiEnabled !== true) {
      setDemand({ phase: "error", reason: "settings" });
      return;
    }
    const status = loadAiStatus();
    if (!online || !aiUsable(true, online, status)) {
      setDemand({ phase: "error", reason: "unavailable" });
      return;
    }
    setDemand({ phase: "loading" });
    const reqKey = activeKey;
    let req = inFlight.get(key);
    if (!req) {
      req = translateAiPhrase({
        data: { sentence: snippet, taskType, sessionId: aiSessionId() },
      }).finally(() => {
        inFlight.delete(key);
      });
      inFlight.set(key, req);
    }
    void req
      .then((resp) => {
        if (activeRef.current !== reqKey) return; // item fechado/trocado — órfã
        if (resp && resp.ok) {
          aiCacheStore.putPhrase(key, resp.result);
          setDemand({ phase: "done", text: resp.result.translation, from: "ai" });
          return;
        }
        const code = resp && !resp.ok ? resp.code : "server";
        const st = loadAiStatus();
        if (code === "credits") saveAiStatus(pauseForCredits(st));
        else if (code === "rate" || code === "network") saveAiStatus(enterCooldown(st));
        setDemand({
          phase: "error",
          reason: code === "credits" ? "credits" : "unavailable",
        });
      })
      .catch(() => {
        if (activeRef.current !== reqKey) return;
        saveAiStatus(enterCooldown(loadAiStatus()));
        setDemand({ phase: "error", reason: "unavailable" });
      });
  };

  // Chip honesto: só existe quando conteúdo de tradução está em exibição ou
  // chegando — falha não exibe tradução, logo não exibe chip (D16-2b).
  const mechanism: Mechanism | null = capturedInContext
    ? "ai"
    : demand?.phase === "loading"
      ? "ai"
      : demand?.phase === "done"
        ? demand.from
        : null;

  return (
    <TranslationSheet
      open
      onClose={onClose}
      title={item.en}
      kicker="Studie Plus · Vocabulário"
      ariaLabel={`Detalhe completo de ${item.en}`}
      headerExtra={mechanism ? <MechanismChip mechanism={mechanism} /> : undefined}
    >
      {showSnippet ? (
        <section aria-label="No contexto original" className="mb-4">
          <SectionLabel>No contexto</SectionLabel>
          <div className="mt-2">
            {snippetLoading === true ? (
              <VocabSnippetSkeleton />
            ) : snippet !== undefined ? (
              <>
                <VocabSnippet
                  snippet={snippet}
                  token={item.en}
                  {...(capturedInContext ? { inContext: item.snippetInContext } : {})}
                  {...(capturedInContext && item.snippetWhy !== undefined
                    ? { why: item.snippetWhy }
                    : {})}
                  {...(demand?.phase === "done" ? { inContext: demand.text } : {})}
                />
                {/* D16-2a/2b: demanda explícita do item de dicionário. O
                    resultado é exibido, NUNCA gravado no store (D16-C). */}
                {!capturedInContext ? (
                  <div aria-live="polite" className="mt-2">
                    {demand === null ? (
                      <button
                        type="button"
                        onClick={requestSnippet}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      >
                        <Sparkles className="size-4" strokeWidth={2} aria-hidden />
                        Traduzir este recorte
                      </button>
                    ) : demand.phase === "loading" ? (
                      <p className="text-xs text-muted-foreground">
                        <span className="sr-only">Traduzindo o recorte…</span>
                        <span
                          aria-hidden
                          className="block h-4 w-3/4 animate-pulse rounded bg-secondary"
                        />
                      </p>
                    ) : demand.phase === "done" ? null : (
                      <>
                        <p className="text-xs leading-snug text-muted-foreground">
                          {DEMAND_ERROR_TEXT[demand.reason]}
                        </p>
                        <button
                          type="button"
                          onClick={requestSnippet}
                          className="mt-1.5 inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                        >
                          Tentar de novo
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-label="Tradução">
        <SectionLabel>Tradução</SectionLabel>
        <p className="mt-1 text-[15px] font-medium leading-relaxed text-foreground">
          {item.literal}
        </p>
        {item.contextual ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.contextual}</p>
        ) : null}
      </section>

      {hasSenses ? (
        <section
          aria-label="Outros sentidos vistos"
          className="mt-4 border-t border-border/60 pt-3"
        >
          <SectionLabel>Outros sentidos vistos</SectionLabel>
          <ul className="mt-2 space-y-1">
            {(item.senses ?? []).map((s) => (
              <li key={`${s.literal}:${s.ts}`} className="text-sm text-foreground/85">
                {s.literal}
                {s.contextual ? (
                  <span className="text-xs text-muted-foreground"> — {s.contextual}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Origem" className="mt-4 border-t border-border/60 pt-3">
        <SectionLabel>Origem</SectionLabel>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            traduzida {item.seenCount} {item.seenCount === 1 ? "vez" : "vezes"}
          </span>
          {isPhrase && item.type ? (
            <SourceChip
              type={item.type}
              {...(item.qid !== undefined ? { qid: item.qid } : {})}
              extra={` · frase ${(item.index ?? 0) + 1}`}
            />
          ) : (
            item.sources.map((s) => (
              <SourceChip key={`${s.type}:${s.qid}`} type={s.type} qid={s.qid} />
            ))
          )}
        </div>
      </section>

      {/* D16-3a: bloco de áudio do sheet — 🔊 palavra / 🔊 recorte + sequência */}
      <VocabAudioSection
        en={item.en}
        isWord={!isPhrase}
        enabled={audioOn === true}
        {...(snippet !== undefined ? { snippet } : {})}
      />

      {/* Ações: favorito e remoção (com Desfazer no toast — D15-4c) */}
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
        <button
          type="button"
          aria-pressed={item.starred === true}
          onClick={onStar}
          className={cn(
            "flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors hover:bg-secondary",
            item.starred ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Star className="size-4" strokeWidth={2} aria-hidden />
          {item.starred ? "Nos favoritos" : "Favoritar"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Trash2 className="size-4" strokeWidth={2} aria-hidden />
          Remover
        </button>
      </div>
    </TranslationSheet>
  );
}
