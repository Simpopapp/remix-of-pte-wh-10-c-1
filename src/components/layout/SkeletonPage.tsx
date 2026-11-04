/**
 * Skeleton de página (projeto 17, D17-0c): geometria estável de carregamento
 * compartilhada pelas rotas — header + bloco hero + estímulo + ações.
 * Markup equivalente aos skeletons locais que substitui (projeto 12, S1):
 * blocos aria-hidden pulsantes + rótulo anunciado via aria-live.
 */
import { cn } from "@/lib/utils";

interface SkeletonPageProps {
  /** Rótulo anunciado para leitores de tela (role="status" + aria-live). */
  label: string;
  /** Altura do bloco hero (h-40 padrão; h-24 no simulado). */
  heroClassName?: string;
  /** Largura do container da página que está carregando. */
  containerClassName?: string;
}

export function SkeletonPage({
  label,
  heroClassName = "h-40",
  containerClassName = "max-w-3xl",
}: SkeletonPageProps) {
  return (
    <main className={cn("mx-auto w-full px-4 pt-6 sm:px-6 sm:pt-8", containerClassName)}>
      <p role="status" aria-live="polite" className="sr-only">
        {label}
      </p>
      <div aria-hidden className="space-y-4">
        <div
          className={cn(
            "rounded-2xl border border-border/60 bg-card shadow-card motion-safe:animate-pulse",
            heroClassName,
          )}
        />
        <div className="min-h-[22rem] rounded-2xl border border-border/60 bg-card shadow-card motion-safe:animate-pulse" />
        <div className="h-16 rounded-2xl border border-border/60 bg-card shadow-card motion-safe:animate-pulse" />
      </div>
    </main>
  );
}
