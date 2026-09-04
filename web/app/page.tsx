import { getDashboardData } from "@/lib/data";
import { Dashboard } from "@/components/Dashboard";

// Server Component: busca os dados uma vez no servidor (SSR — primeira
// pintura já vem com o ranking, sem "pulo" de loading) e entrega pro
// Dashboard (client) tocar as animações e re-sincronizar sob demanda.
export default async function Page() {
  const dados = await getDashboardData();
  return <Dashboard inicial={dados} />;
}
