"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import type { PerfilRankeado } from "@/lib/types";
import { PodiumCard } from "./PodiumCard";
import { LeaderboardRow } from "./LeaderboardRow";
import { useConfetti } from "@/lib/useConfetti";

/**
 * O coração do jogo. `layout` + `layoutId` (dentro de PodiumCard e
 * LeaderboardRow) fazem o Framer Motion animar a REORDENAÇÃO sozinho —
 * quando um perfil sobe/desce de posição entre atualizações, ele desliza
 * suavemente até o novo lugar (o "efeito de transição gloriosa" pedido)
 * em vez de simplesmente re-renderizar na nova posição.
 *
 * Confete só dispara quando o #1 realmente muda — ver useConfetti.
 */
export function Leaderboard({ perfis }: { perfis: PerfilRankeado[] }) {
  const ordenados = [...perfis].sort((a, b) => a.posicao - b.posicao);
  const top3 = ordenados.filter((p) => p.posicao <= 3);
  const resto = ordenados.filter((p) => p.posicao > 3);

  const { dispararGlorioso } = useConfetti();
  const lider = useRef<string | null>(null);

  useEffect(() => {
    const novoLider = top3.find((p) => p.posicao === 1)?.conta.id ?? null;
    if (novoLider && lider.current && novoLider !== lider.current) {
      dispararGlorioso();
    }
    lider.current = novoLider;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top3.map((p) => `${p.conta.id}:${p.posicao}`).join(",")]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-end gap-4 md:flex-row md:items-end">
        <AnimatePresence mode="popLayout">
          {top3.map((perfil) => (
            <PodiumCard key={perfil.conta.id} perfil={perfil} />
          ))}
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {resto.map((perfil) => (
            <LeaderboardRow key={perfil.conta.id} perfil={perfil} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
