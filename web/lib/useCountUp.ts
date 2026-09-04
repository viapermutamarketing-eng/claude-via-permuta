"use client";

import { useEffect, useState } from "react";

function formatarNumero(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("pt-BR");
}

/** Contador que sobe do valor anterior até o novo — o "tick" que dá dopamina. */
export function useCountUp(valorAlvo: number, duracaoMs = 700) {
  const [exibido, setExibido] = useState(0);

  useEffect(() => {
    let frame: number;
    const inicio = performance.now();
    const de = exibido;
    function passo(agora: number) {
      const p = Math.min(1, (agora - inicio) / duracaoMs);
      const suavizado = 1 - Math.pow(1 - p, 3);
      setExibido(de + (valorAlvo - de) * suavizado);
      if (p < 1) frame = requestAnimationFrame(passo);
      else setExibido(valorAlvo);
    }
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorAlvo, duracaoMs]);

  return formatarNumero(exibido);
}
