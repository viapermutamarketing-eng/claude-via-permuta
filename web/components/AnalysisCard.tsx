"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { PublicacaoAnalisada } from "@/lib/types";
import { TemperatureAura, TemperatureTag } from "./TemperatureAura";

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("pt-BR");
}

const TIPO_LABEL: Record<string, string> = { reels: "Reels", imagem: "Foto", carrossel: "Carrossel", story: "Story" };

/**
 * Card de análise com Flip Effect: FRENTE mostra as "métricas de vaidade"
 * (o que dá aquele gostinho de olhar rápido — views/likes/envios). VERSO
 * mostra a análise de verdade (retenção, engajamento, origem orgânico vs
 * pago, custo por resultado) — o board de decisão fica a um toque de
 * distância, sem poluir a primeira leitura.
 */
export function AnalysisCard({ nomeConta, post }: { nomeConta: string; post: PublicacaoAnalisada }) {
  const [virado, setVirado] = useState(false);
  const m = post.metrica;
  const impulsionado = post.origem === "impulsionado";

  return (
    <div className="flip-scene h-[300px] w-full">
      <TemperatureAura temperatura={post.temperatura}>
        <motion.div
          className="flip-card relative h-[300px] w-full cursor-pointer rounded-2xl"
          animate={{ rotateY: virado ? 180 : 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => setVirado((v) => !v)}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* FRENTE — métricas de vaidade */}
          <div className="flip-face absolute inset-0 flex flex-col justify-between rounded-2xl border border-brd-2 bg-gradient-to-br from-card to-card-2 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-txt-faint">{nomeConta}</div>
                <div className="mt-0.5 inline-block rounded-full bg-cold/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-cold">
                  {TIPO_LABEL[post.tipo] ?? post.tipo}
                </div>
              </div>
              <TemperatureTag temperatura={post.temperatura} />
            </div>

            <p className="line-clamp-2 text-sm font-semibold text-txt">{post.legenda ?? "Sem legenda"}</p>

            <div className="grid grid-cols-2 gap-3">
              <Vaidade emoji="👁" rotulo="Views" valor={fmt(m?.visualizacoes)} />
              <Vaidade emoji="❤️" rotulo="Curtidas" valor={fmt(m?.curtidas)} />
              <Vaidade emoji="✈️" rotulo="Envios" valor={fmt(m?.envios)} />
              <Vaidade emoji="🔖" rotulo="Salvos" valor={fmt(m?.salvamentos)} />
            </div>

            <div className="text-center text-[10px] font-bold uppercase tracking-widest text-txt-faint">
              toque pra ver a análise deep ↻
            </div>
          </div>

          {/* VERSO — análise deep */}
          <div className="flip-face flip-face-back absolute inset-0 flex flex-col justify-between rounded-2xl border border-gold/30 bg-gradient-to-br from-night to-card p-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide text-txt-faint">Análise deep</span>
                <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${impulsionado ? "bg-purple/15 text-purple" : "bg-win/15 text-win"}`}>
                  {impulsionado ? "Pago" : "Orgânico"}
                </span>
              </div>

              <div className="space-y-2.5">
                <Deep rotulo="Alcance" valor={fmt(m?.alcance)} />
                <Deep rotulo="Taxa de engajamento" valor={m?.taxa_engajamento != null ? `${(m.taxa_engajamento * 100).toFixed(1)}%` : "—"} />
                <Deep
                  rotulo="Retenção média"
                  valor={m?.retencao_media_seg != null ? `${m.retencao_media_seg.toFixed(1)}s` : "—"}
                />
                <Deep
                  rotulo={`Seguidores ganhos${m?.seguidores_estimado ? " (estimado)" : ""}`}
                  valor={fmt(m?.seguidores_ganhos)}
                />
                {impulsionado && post.paga && (
                  <>
                    <Deep rotulo="Investido" valor={`R$ ${post.paga.gasto.toFixed(2)}`} />
                    <Deep rotulo="Custo por resultado" valor={post.paga.custo_por_resultado != null ? `R$ ${post.paga.custo_por_resultado.toFixed(2)}` : "—"} />
                  </>
                )}
              </div>
            </div>

            <div className="text-center text-[10px] font-bold uppercase tracking-widest text-txt-faint">
              toque pra voltar ↻
            </div>
          </div>
        </motion.div>
      </TemperatureAura>
    </div>
  );
}

function Vaidade({ emoji, rotulo, valor }: { emoji: string; rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-night-2/60 p-2.5 text-center">
      <div className="text-lg">{emoji}</div>
      <div className="font-serif text-lg font-bold tabular-nums text-cream">{valor}</div>
      <div className="text-[9.5px] font-bold uppercase tracking-wide text-txt-faint">{rotulo}</div>
    </div>
  );
}

function Deep({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-brd-2 pb-1.5 text-xs">
      <span className="text-txt-dim">{rotulo}</span>
      <span className="font-mono font-bold text-gold-light">{valor}</span>
    </div>
  );
}
