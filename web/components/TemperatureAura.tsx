"use client";

import { motion } from "framer-motion";
import type { Temperatura } from "@/lib/types";
import { TEMPERATURA_UI } from "@/lib/temperature";

const AURA_GRADIENT: Record<Temperatura, string> = {
  estourando: "from-hot via-hot-glow to-transparent",
  quente: "from-hot-glow/70 via-hot-glow/30 to-transparent",
  morno: "from-gold/25 via-transparent to-transparent",
  frio: "from-cold/25 via-transparent to-transparent",
};

/**
 * A "aura de fogo" pedida: uma camada de brilho atrás do card, mais forte
 * quanto mais quente o perfil/post estiver. `estourando` também ganha um
 * pulso contínuo — é o sinal visual de "não desvie o olhar disso agora".
 */
export function TemperatureAura({ temperatura, children }: { temperatura: Temperatura; children: React.ReactNode }) {
  const pulsando = temperatura === "estourando" || temperatura === "quente";
  return (
    <div className="relative">
      <div
        className={`pointer-events-none absolute -inset-2 -z-10 rounded-[inherit] bg-gradient-to-br blur-xl ${AURA_GRADIENT[temperatura]} ${
          pulsando ? "animate-firePulse" : ""
        }`}
        aria-hidden
      />
      {children}
    </div>
  );
}

export function TemperatureTag({ temperatura }: { temperatura: Temperatura }) {
  const ui = TEMPERATURA_UI[temperatura];
  return (
    <motion.span
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex items-center gap-1 rounded-full border border-brd-2 bg-black/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-txt-dim"
    >
      <span>{ui.emoji}</span>
      {ui.label}
    </motion.span>
  );
}
