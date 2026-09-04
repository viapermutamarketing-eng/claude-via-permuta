"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { PerfilRankeado, RankingExecucao } from "@/lib/types";
import { useCountUp } from "@/lib/useCountUp";
import { supabase, supabaseConfigurado } from "@/lib/supabase";

function fmtQuando(iso: string | null) {
  if (!iso) return "ainda não sincronizado";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function StatBloco({ valor, rotulo }: { valor: number; rotulo: string }) {
  const exibido = useCountUp(valor);
  return (
    <div className="rounded-2xl border border-brd-2 bg-card/70 px-5 py-4 backdrop-blur">
      <div className="font-serif text-3xl font-bold tabular-nums text-cream">{exibido}</div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-txt-faint">{rotulo}</div>
    </div>
  );
}

/**
 * Hero da plataforma: não é só um título — é o "placar geral" e o botão
 * mais importante da tela (Atualizar agora), com feedback tátil imediato
 * (whileTap, spinner, e um pulso de sucesso quando termina).
 */
export function Hero({
  execucao,
  perfis,
  fonte,
  onAtualizado,
}: {
  execucao: RankingExecucao | null;
  perfis: PerfilRankeado[];
  fonte: "supabase" | "demonstracao";
  onAtualizado: () => void;
}) {
  const [status, setStatus] = useState<"parado" | "sincronizando" | "sucesso" | "erro">("parado");

  const totalViews = perfis.reduce((s, p) => s + (p.detalhamento.views?.valor ?? 0), 0);
  const totalSeguidores = perfis.reduce((s, p) => s + (p.detalhamento.seguidores?.valor ?? 0), 0);

  async function atualizarAgora() {
    setStatus("sincronizando");
    try {
      if (!supabaseConfigurado || !supabase) throw new Error("Supabase não configurado — modo demonstração");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("faça login pra sincronizar dados reais");

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-meta-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tipo: "manual" }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "falha na sincronização");
      setStatus("sucesso");
      onAtualizado();
    } catch {
      setStatus("erro");
    } finally {
      setTimeout(() => setStatus("parado"), 2200);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-brd-2 bg-gradient-to-br from-night via-night-2 to-card p-8 md:p-12">
      <motion.div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          {fonte === "demonstracao" && (
            <span className="mb-3 inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-amber-400">
              Modo demonstração — dados fictícios
            </span>
          )}
          <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold-light">Via Permuta</p>
          <h1 className="font-serif text-4xl font-bold text-cream md:text-5xl">Insights ao vivo</h1>
          <p className="mt-2 max-w-md text-sm text-txt-dim">
            Ranking orgânico + pago das contas do time, atualizado 2x/dia — ou agora mesmo, no seu comando.
          </p>
          <p className="mt-3 font-mono text-[11px] text-txt-faint">
            última execução: {fmtQuando(execucao?.criado_em ?? null)}
            {execucao ? ` · ${execucao.tipo}` : ""}
          </p>
        </div>

        <motion.button
          onClick={atualizarAgora}
          disabled={status === "sincronizando"}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.92 }}
          className={`flex items-center gap-2 rounded-full px-6 py-3.5 font-bold shadow-gold transition-colors ${
            status === "erro" ? "bg-loss text-white" : status === "sucesso" ? "bg-win text-ink" : "bg-gold text-ink hover:bg-gold-light"
          } disabled:cursor-wait disabled:opacity-70`}
        >
          <motion.span animate={status === "sincronizando" ? { rotate: 360 } : { rotate: 0 }} transition={{ repeat: status === "sincronizando" ? Infinity : 0, duration: 0.8, ease: "linear" }}>
            ↻
          </motion.span>
          {status === "sincronizando" ? "Sincronizando…" : status === "sucesso" ? "Atualizado!" : status === "erro" ? "Falhou — tentar de novo" : "Atualizar agora"}
        </motion.button>
      </div>

      <div className="relative mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBloco valor={perfis.length} rotulo="Contas monitoradas" />
        <StatBloco valor={totalViews} rotulo="Views no período" />
        <StatBloco valor={totalSeguidores} rotulo="Seguidores ganhos" />
        <StatBloco valor={perfis.filter((p) => p.temperatura === "estourando").length} rotulo="Perfis estourando 🔥" />
      </div>
    </div>
  );
}
