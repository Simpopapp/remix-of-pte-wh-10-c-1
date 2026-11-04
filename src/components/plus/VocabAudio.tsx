/**
 * Áudio de estudo do vocabulário (PRD projeto 16, D16-3a/D16-3b).
 *  - Bloco do sheet: 🔊 palavra / 🔊 recorte (PlusSpeakButton existente) e a
 *    sequência palavra→recorte.
 *  - D16-3b: sequência CANCELÁVEL — fala a palavra, pausa constante nomeada
 *    (SNIPPET_PAUSE_MS) e fala o recorte; novo toque PARA (nunca sobrepõe).
 *  - Regra do pack: só inglês — nunca idioma de tradução; `plusAudio` off não
 *    renderiza nada. Implementação local sobre a MESMA Web Speech API do
 *    PlusSpeakButton (sem serviço novo).
 */
import { useEffect, useRef, useState } from "react";

import { useSettings } from "@/lib/storage";
import { useSpeechSynthesis } from "@/lib/useSpeechSynthesis";
import { PlusSpeakButton } from "@/components/plus/PlusSpeakButton";
import { SectionLabel } from "@/components/plus/VocabDetailSheet";

/** D16-3b: pausa entre palavra e recorte — constante nomeada, nunca mágica. */
export const SNIPPET_PAUSE_MS = 300;

export function VocabSpeakSequence({
  word,
  snippet,
  enabled,
}: {
  /** Palavra EN (o alvo). */
  word: string;
  /** Recorte EN (a frase em contexto). */
  snippet: string;
  /** Pack ativo (settings.plus.plusAudio) — falso → nada renderiza. */
  enabled: boolean;
}) {
  const { supported, speak, cancel } = useSpeechSynthesis();
  const settings = useSettings();
  const modelRate = settings.modelRate;
  const [playing, setPlaying] = useState(false);
  const activeRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  };

  // Cancela a fala e os timers pendentes ao desmontar.
  useEffect(
    () => () => {
      cancel();
      clearTimers();
    },
    [cancel],
  );

  if (!enabled || !supported || !word.trim() || !snippet.trim()) return null;

  const stop = () => {
    activeRef.current = false;
    cancel();
    clearTimers();
    setPlaying(false);
  };

  const start = () => {
    activeRef.current = true;
    setPlaying(true);
    speak(word, modelRate, undefined, {
      onend: () => {
        if (!activeRef.current) return; // novo toque cancelou a sequência
        const t = window.setTimeout(() => {
          if (!activeRef.current) return;
          speak(snippet, modelRate, undefined, {
            onend: () => {
              if (!activeRef.current) return;
              activeRef.current = false;
              setPlaying(false);
            },
          });
        }, SNIPPET_PAUSE_MS);
        timersRef.current.push(t);
      },
    });
  };

  return (
    <button
      type="button"
      aria-pressed={playing}
      onClick={playing ? stop : start}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
    >
      <span aria-hidden>{playing ? "⏹" : "🔊"}</span>
      <span>{playing ? "parar sequência" : "Ouvir palavra e recorte"}</span>
    </button>
  );
}

/** Bloco de áudio do sheet completo (D16-1b, seção 5): palavra + recorte + sequência. */
export function VocabAudioSection({
  en,
  snippet,
  isWord,
  enabled,
}: {
  en: string;
  /** Recorte efetivo (só palavras). */
  snippet?: string;
  isWord: boolean;
  enabled: boolean;
}) {
  if (!enabled) return null; // plusAudio off desliga TUDO (regra do pack)
  const snippetText = isWord ? snippet : undefined;
  return (
    <section aria-label="Áudio de estudo" className="mt-4 border-t border-border/60 pt-3">
      <SectionLabel>Áudio</SectionLabel>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PlusSpeakButton text={en} enabled label={isWord ? "Ouvir palavra" : "Ouvir frase"} />
        {snippetText !== undefined && snippetText.trim() !== "" ? (
          <>
            <PlusSpeakButton text={snippetText} enabled label="Ouvir frase em contexto" />
            <VocabSpeakSequence word={en} snippet={snippetText} enabled />
          </>
        ) : null}
      </div>
    </section>
  );
}
