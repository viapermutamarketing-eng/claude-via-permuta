"use client";

import { motion } from "framer-motion";
import type { PerfilRankeado } from "@/lib/types";
import { BadgeRow } from "./Badge";
import { TemperatureTag } from "./TemperatureAura";
import { useCountUp } from "@/lib/useCountUp";

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function Tendencia({ variacao }: { variacao: number }) {
  if (variacao === 0) {
    return <span className="font-mono text-[11px] text-txt-faint">—</span>;
  }
  const subiu = variacao > 0;
  return (
    <motion.span
      initial={{ opacity: 0, y: subiu ? 6 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-0.5 font-mono text-[11px] font-bold ${subiu ? "text-win" : "text-loss"}`}
    >
      {subiu ? "▲" : "▼"} {Math.abs(variacao)}
    </motion.span>
  );
}

/**
 * Linha de leaderboard estilo "placar de partida" (Valorant/LoL): compacta,
 * escaneável, sem enfeite pesado — o pódio já carrega o peso visual, aqui é
 * ritmo e comparação rápida entre pares.
 */
export function LeaderboardRow({ perfil }: { perfil: PerfilRankeado }) {
  const score = useCountUp(perfil.pontuacaoTotal, 500);
  const corDestaque = perfil.conta.cor_destaque ?? "#B08D4F";
  const criteriosTop = Object.entries(perfil.detalhamento)
    .sort((a, b) => (b[1].contribuicao ?? 0) - (a[1].contribuicao ?? 0))
    .slice(0, 3);

  return (
    <motion.div
      layout
      layoutId={`perfil-${perfil.conta.id}`}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      whileHover={{ x: 4 }}
      className="grid grid-cols-[32px_36px_1fr_auto_auto] items-center gap-3 rounded-xl border border-brd-2 bg-card px-4 py-3 sm:grid-cols-[32px_36px_1fr_180px_70px_auto]"
    >
      <div className="font-mono text-sm font-bold text-txt-faint">#{perfil.posicao}</div>

      <div
        className="flex h-9 w-9 items-center justify-center rounded-full border font-serif text-xs font-bold text-cream"
        style={{ borderColor: corDestaque, background: `${corDestaque}22` }}
      >
        {iniciais(perfil.conta.nome)}
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-txt">{perfil.conta.nome}</div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-txt-faint">{perfil.conta.tipo}</span>
          <BadgeRow conquistas={perfil.badges} max={3} />
        </div>
      </div>

      <div className="hidden flex-col gap-1 sm:flex">
        {criteriosTop.map(([chave, d]) => (
          <div key={chave} className="flex items-center gap-2">
            <span className="w-14 truncate text-[10px] text-txt-faint">{chave}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-night-2">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-light"
                initial={{ width: 0 }}
                animate={{ width: `${d.normalizado}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-right font-serif text-lg font-bold tabular-nums text-gold-light">{score}</div>

      <div className="hidden items-center justify-end gap-2 sm:flex">
        <TemperatureTag temperatura={perfil.temperatura} />
        <Tendencia variacao={perfil.variacaoPosicoes} />
      </div>
    </motion.div>
  );
}
