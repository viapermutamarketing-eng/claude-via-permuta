import type { Temperatura } from "./types";

/**
 * "Status Quente/Frio": não é a métrica em si, é a VELOCIDADE dela.
 * Compara o normalizado do critério "views" (0-100, já relativo às outras
 * contas na mesma execução) com o quanto ele pesou na pontuação total.
 * Um número alto sozinho não "estoura" — estoura quando também está
 * puxando a pontuação pra cima rápido. É essa combinação que gera a aura
 * de fogo: sinaliza IMPULSO, não só posição.
 */
export function temperaturaDaPontuacao(scoreNormalizadoViews: number, crescimentoRelativo: number): Temperatura {
  const impulso = scoreNormalizadoViews * 0.6 + crescimentoRelativo * 0.4;
  if (impulso >= 85) return "estourando";
  if (impulso >= 60) return "quente";
  if (impulso >= 35) return "morno";
  return "frio";
}

export const TEMPERATURA_UI: Record<Temperatura, { label: string; classe: string; emoji: string }> = {
  estourando: { label: "Estourando", classe: "hot", emoji: "🔥" },
  quente: { label: "Quente", classe: "warm", emoji: "🌡️" },
  morno: { label: "Estável", classe: "neutral", emoji: "➖" },
  frio: { label: "Esfriando", classe: "cold", emoji: "❄️" },
};
