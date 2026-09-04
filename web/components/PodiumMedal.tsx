const MEDAL_STOPS: Record<1 | 2 | 3, { from: string; to: string; ring: string }> = {
  1: { from: "#F6D77A", to: "#B08D4F", ring: "#7A5E30" },
  2: { from: "#EDEDED", to: "#B7B7B7", ring: "#8A8A8A" },
  3: { from: "#E3A567", to: "#A8622C", ring: "#7A4419" },
};

/** Medalha em SVG puro — sem ícone externo, sem custo, sem dependência. */
export function PodiumMedal({ posicao }: { posicao: 1 | 2 | 3 }) {
  const c = MEDAL_STOPS[posicao];
  const gradId = `medal-grad-${posicao}`;
  return (
    <svg width="56" height="72" viewBox="0 0 56 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.from} />
          <stop offset="100%" stopColor={c.to} />
        </linearGradient>
      </defs>
      <path d="M18 4h20l8 18-18 14L10 22z" fill={c.to} opacity="0.5" />
      <circle cx="28" cy="42" r="22" fill={`url(#${gradId})`} stroke={c.ring} strokeWidth="2" />
      <circle cx="28" cy="42" r="15.5" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="1.5" strokeDasharray="2 3" />
      <text x="28" y="48" textAnchor="middle" fontSize="18" fontWeight="800" fill="rgba(0,0,0,.55)" fontFamily="ui-sans-serif, system-ui">
        {posicao}
      </text>
    </svg>
  );
}
