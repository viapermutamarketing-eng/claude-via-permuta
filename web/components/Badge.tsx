"use client";

import { motion } from "framer-motion";
import type { Conquista } from "@/lib/types";

/**
 * Badge de conquista — o "achievement unlocked" que fica ao lado do avatar
 * do perfil. Cada um tem um motivo claro (ver descricao no tooltip nativo)
 * pra reforçar que pontos vêm de comportamento específico, não sorte.
 */
export function Badge({ conquista, size = "md" }: { conquista: Conquista; size?: "sm" | "md" }) {
  const dimensao = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";
  return (
    <motion.span
      title={`${conquista.nome}${conquista.descricao ? " — " + conquista.descricao : ""}`}
      className={`inline-flex ${dimensao} select-none items-center justify-center rounded-full border border-brd-2 bg-card-2 shadow-[0_0_10px_rgba(217,189,130,.25)]`}
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.18, rotate: 6 }}
      transition={{ type: "spring", stiffness: 400, damping: 14 }}
    >
      {conquista.icone ?? "🏅"}
    </motion.span>
  );
}

export function BadgeRow({ conquistas, max = 4 }: { conquistas: Conquista[]; max?: number }) {
  if (!conquistas.length) return null;
  const extra = conquistas.length - max;
  return (
    <div className="flex items-center gap-1.5">
      {conquistas.slice(0, max).map((c) => (
        <Badge key={c.id} conquista={c} size="sm" />
      ))}
      {extra > 0 && (
        <span className="text-[10px] font-bold text-txt-faint">+{extra}</span>
      )}
    </div>
  );
}
