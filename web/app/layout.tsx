import type { Metadata } from "next";
import { Fraunces, Nunito, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fraunces" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-nunito" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-jbmono" });

export const metadata: Metadata = {
  title: "Insights · Via Permuta",
  description: "Ranking gamificado de performance orgânica e paga das contas Via Permuta no Instagram/Meta.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${nunito.variable} ${jbmono.variable}`}>
      <body className="min-h-screen bg-night-2 font-sans text-txt">{children}</body>
    </html>
  );
}
