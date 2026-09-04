import { createClient } from "@supabase/supabase-js";

// Mesmo projeto Supabase do CRM/Edge Function (ver supabase/migrations e
// supabase/functions/sync-meta-insights) — zero backend novo pra manter.
// Em produção, defina no ambiente do Next.js (Vercel → Project Settings →
// Environment Variables):
//   NEXT_PUBLIC_SUPABASE_URL=https://pcvraalvtnmogirblvxq.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=<a anon/publishable key, a mesma do public/index.html>
// A anon key é pra ficar pública mesmo — a segurança real está na RLS
// (supabase/migrations/0012_insights_rls.sql).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = supabaseConfigurado
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
