"use client";

import { motion } from "framer-motion";
import type { PerfilRankeado } from "@/lib/types";
import { PodiumMedal } from "./PodiumMedal";
import { TemperatureAura, TemperatureTag } from "./TemperatureAura";
import { BadgeRow } from "./Badge";
import { useCountUp } from "@/lib/useCountUp";

const ALTURA_POR_POSICAO: Record<1 | 2 | 3, string> = {
  1: "md:mt-0",
  2: "md:mt-8",
  3: "md:mt-14",
};

const ORDEM_VISUAL: Record<1 | 2 | 3, string> = { 1: "md:order-2", 2: "md:order-1", 3: "md:order-3" };

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/**
 * O pódio (top 3) — design deliberadamente "superior" ao resto do
 * leaderboard: maior, com medalha SVG, glow próprio e o avatar flutuando
 * (pra parecer troféu de verdade, não uma linha de tabela).
 */
export function PodiumCard({ perfil }: { perfil: PerfilRankeado }) {
  const posicao = perfil.posicao as 1 | 2 | 3;
  const score = useCountUp(perfil.pontuacaoTotal);
  const corDestaque = perfil.conta.cor_destaque ?? "#B08D4F";

  return (
    <motion.div
      layout
      layoutId={`perfil-${perfil.conta.id}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={`${ORDEM_VISUAL[posicao]} ${ALTURA_POR_POSICAO[posicao]} flex-1`}
    >
      <TemperatureAura temperatura={perfil.temperatura}>
        <div
          className={`relative overflow-hidden rounded-3xl border bg-gradient-to-b from-card to-card-2 p-6 text-center ${
            posicao === 1 ? "border-gold shadow-gold" : "border-brd-2"
          }`}
        >
          {posicao === 1 && (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-transparent via-gold/10 to-transparent"
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <motion.div className="mx-auto mb-2 w-fit" animate={{ y: [0, -6, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
            <PodiumMedal posicao={posicao} />
          </motion.div>

          <div
            className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 font-serif text-xl font-bold text-cream"
            style={{ borderColor: corDestaque, background: `${corDestaque}22` }}
          >
            {iniciais(perfil.conta.nome)}
          </div>

          <h3 className="font-serif text-lg font-semibold text-cream">{perfil.conta.nome}</h3>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-txt-faint">{perfil.conta.tipo}</p>

          <div className="mb-1 font-serif text-4xl font-bold tabular-nums text-gold-light">{score}</div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-txt-faint">pontos</p>

          <div className="mb-3 flex justify-center">
            <TemperatureTag temperatura={perfil.temperatura} />
          </div>

          <div className="flex justify-center">
            <BadgeRow conquistas={perfil.badges} />
          </div>
        </div>
      </TemperatureAura>
    </motion.div>
  );
}
