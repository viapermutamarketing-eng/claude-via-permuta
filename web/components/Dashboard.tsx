"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import type { DashboardData } from "@/lib/data";
import { getDashboardData } from "@/lib/data";
import { Hero } from "./Hero";
import { Leaderboard } from "./Leaderboard";
import { AnalysisCard } from "./AnalysisCard";

/**
 * Composição principal — Hero + Leaderboard + grade de Cards de Análise.
 * Recebe os dados iniciais do Server Component (app/page.tsx) e depois
 * se auto-atualiza no cliente (após "Atualizar agora" ou, no futuro,
 * via Supabase Realtime nas tabelas de ranking — o mesmo canal que
 * public/insights.html já usa).
 */
export function Dashboard({ inicial }: { inicial: DashboardData }) {
  const [dados, setDados] = useState(inicial);

  const recarregar = useCallback(async () => {
    const novo = await getDashboardData();
    setDados(novo);
  }, []);

  const perfisComMelhorPost = dados.perfis.filter((p) => p.melhorPost);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 md:px-8 md:py-12">
      <Hero execucao={dados.execucao} perfis={dados.perfis} fonte={dados.fonte} onAtualizado={recarregar} />

      <section>
        <SectionTitle titulo="Ranking" subtitulo="Quem está no topo agora — orgânico e pago combinados" />
        <Leaderboard perfis={dados.perfis} />
      </section>

      <section>
        <SectionTitle titulo="Melhor conteúdo de cada perfil" subtitulo="Toque num card pra virar e ver a análise deep" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {perfisComMelhorPost.map((p) => (
            <AnalysisCard key={p.conta.id} nomeConta={p.conta.nome} post={p.melhorPost!} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-5">
      <h2 className="font-serif text-2xl font-bold text-cream">{titulo}</h2>
      <p className="text-sm text-txt-faint">{subtitulo}</p>
    </motion.div>
  );
}
