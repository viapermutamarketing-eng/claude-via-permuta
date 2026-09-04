import type { Config } from "tailwindcss";

// Paleta idêntica à identidade visual da Via Permuta (public/index.html) —
// bordô/preto profundo, dourado, creme — pra dashboard novo não parecer
// um produto diferente, e sim a evolução "premium" do mesmo mundo visual.
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: "#B08D4F", light: "#D9BD82", soft: "#E7D6AC", deep: "#7A5E30" },
        ink: "#0E0A08",
        cream: "#F7F0E4",
        night: { DEFAULT: "#170D0E", 2: "#1D1113" },
        card: { DEFAULT: "#211417", 2: "#28181B" },
        brd: "rgba(247,240,228,.10)",
        "brd-2": "rgba(247,240,228,.06)",
        txt: { DEFAULT: "#EFE6D8", dim: "rgba(239,230,216,.7)", faint: "rgba(239,230,216,.5)" },
        hot: { DEFAULT: "#FF5A36", glow: "#FF8A3D" },
        cold: { DEFAULT: "#5B9FE4", glow: "#8FC1F0" },
        win: "#3FBF7F",
        loss: "#E4685B",
        purple: "#B98BE0",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        mono: ["var(--font-jbmono)", "monospace"],
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(176,141,79,.25), 0 18px 40px -12px rgba(176,141,79,.35)",
        fire: "0 0 24px 4px rgba(255,90,54,.45), 0 0 60px 10px rgba(255,138,61,.25)",
        ice: "0 0 20px 2px rgba(91,159,228,.35)",
      },
      keyframes: {
        glowPulse: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        firePulse: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        floatUp: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        glowPulse: "glowPulse 2.6s ease-in-out infinite",
        firePulse: "firePulse 1.8s ease-in-out infinite",
        floatUp: "floatUp 2.4s ease-in-out infinite alternate",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
