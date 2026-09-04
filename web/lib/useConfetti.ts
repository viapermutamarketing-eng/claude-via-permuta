"use client";

import { useCallback, useRef } from "react";
import confetti from "canvas-confetti";

/**
 * Confete dourado — dispara só quando o #1 do ranking muda de verdade
 * (ver Leaderboard.tsx), nunca em toda atualização. Se disparasse sempre,
 * viraria ruído e perderia o efeito "dopaminérgico"; o gatilho raro é o
 * que faz valer a pena.
 */
export function useConfetti() {
  const disparandoRef = useRef(false);

  const dispararGlorioso = useCallback(() => {
    if (disparandoRef.current) return;
    disparandoRef.current = true;

    const cores = ["#B08D4F", "#D9BD82", "#F7F0E4", "#7A5E30"];
    const duracao = 1400;
    const fim = Date.now() + duracao;

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 65,
        origin: { x: 0, y: 0.6 },
        colors: cores,
        startVelocity: 45,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 65,
        origin: { x: 1, y: 0.6 },
        colors: cores,
        startVelocity: 45,
      });
      if (Date.now() < fim) requestAnimationFrame(frame);
      else disparandoRef.current = false;
    })();

    confetti({
      particleCount: 90,
      spread: 100,
      startVelocity: 55,
      origin: { x: 0.5, y: 0.3 },
      colors: cores,
    });
  }, []);

  return { dispararGlorioso };
}
