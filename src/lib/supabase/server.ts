import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/** Cliente com a sessão do usuário (cookies) — usado só para descobrir QUEM está chamando. */
export async function sessionClient(): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Chamado fora de Route Handler/Server Action: a renovação fica para a próxima requisição.
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

/**
 * Cliente com a chave secreta: ignora RLS. Só o servidor grava o estado das cidades,
 * depois de validar cada comando e o tempo do ciclo.
 */
export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY não configurada");
  admin ??= createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}
