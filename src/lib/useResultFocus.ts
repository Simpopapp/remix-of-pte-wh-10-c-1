import { useEffect, useRef } from "react";

/**
 * D17-13 (projeto 17): foco programático no container de resultado quando ele
 * APARECE por mudança de estado pós-ação (fim de questão, fim de sessão, fim
 * de simulado). O elemento alvo precisa de `tabIndex={-1}` +
 * `focus:outline-none`. Foco move a rolagem do navegador até o resultado —
 * é esse o encaminhamento pedido; sem scroll suave (respeita reduced motion).
 *
 * `fireKey`: passe um valor que muda quando o resultado passa a ser exibido
 * (ex.: a fase do simulado, o estado ativo da sessão). O componente pode estar
 * montado antes do resultado existir — montar sozinho não basta; e a hidratação
 * do store pode trocar a vista DEPOIS do mount.
 */
export function useResultFocus<T extends HTMLElement>(fireKey?: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [fireKey]);
  return ref;
}
