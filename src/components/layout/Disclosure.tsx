import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface DisclosureProps {
  /** Rótulo do gatilho quando fechado. */
  trigger: ReactNode;
  /** Rótulo do gatilho quando aberto (default: o mesmo do fechado). */
  openTrigger?: ReactNode;
  /** Controlado (ex.: nota do runner). Ausente = estado interno. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  /** id da região para consumidores com contrato de aria-controls existente. */
  contentId?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * D17-12/D17-11: disclosure acessível único do design system — botão (≥44px,
 * `aria-expanded`/`aria-controls`) + região renderizada com entrada curta
 * (`.disclosure-anim`; a guarda global de `prefers-reduced-motion` em
 * styles.css zera a duração para quem pede menos movimento). Substitui
 * details/summary improvisados: PracticeShell (F4) e, na F5, filtros de
 * vocabulário/SectionPage.
 */
export function Disclosure({
  trigger,
  openTrigger,
  open,
  onOpenChange,
  defaultOpen = false,
  contentId,
  className,
  triggerClassName,
  contentClassName,
  children,
}: DisclosureProps) {
  const generatedId = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const regionId = contentId ?? generatedId;
  const setOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={regionId}
        onClick={() => setOpen(!isOpen)}
        className={cn(
          "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          triggerClassName,
        )}
      >
        {isOpen ? (openTrigger ?? trigger) : trigger}
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen ? (
        <div id={regionId} className={cn("disclosure-anim", contentClassName)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
