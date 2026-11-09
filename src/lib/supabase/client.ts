"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseEnabled } from "./env";

let client: SupabaseClient | null = null;

export function browserClient(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}

/**
 * Garante uma sessão antes de falar com a API. Quem chega pela primeira vez
 * entra como usuário anônimo e pode vincular um e-mail depois sem perder a cidade.
 */
export async function ensureSession(): Promise<void> {
  const sb = browserClient();
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  if (data.session) return;
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw new Error(`Falha ao criar sessão: ${error.message}`);
}
