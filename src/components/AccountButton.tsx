"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase/client";
import { useGame } from "@/store/game";
import { Xmark } from "./icons";

/** Conta: o jogador começa anônimo e pode vincular um e-mail para jogar em outros aparelhos. */
export function AccountButton() {
  const sb = browserClient();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    // Erro vindo do link de e-mail (/auth/callback?auth_error=...).
    const err = new URLSearchParams(location.search).get("auth_error");
    if (err) {
      useGame.getState().showToast(`Login: ${err}`);
      history.replaceState(null, "", location.pathname);
    }
    return () => data.subscription.unsubscribe();
  }, [sb]);

  if (!sb) return null;

  const redirect = () => `${location.origin}/auth/callback`;
  const anonymous = !user || user.is_anonymous;

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const linkEmail = () =>
    run(async () => {
      const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: redirect() });
      if (error) throw error;
      return "Enviamos um link de confirmação. Ao confirmar, sua cidade fica salva nesse e-mail.";
    });

  const signInOther = () =>
    run(async () => {
      if (!confirm("Entrar em outra conta troca de cidade. A cidade anônima deste navegador será perdida. Continuar?")) {
        return "";
      }
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirect(), shouldCreateUser: false },
      });
      if (error) throw error;
      return "Confira seu e-mail e abra o link de acesso.";
    });

  const signOut = () =>
    run(async () => {
      await sb.auth.signOut();
      await useGame.getState().reset(); // cria uma nova sessão anônima
      setOpen(false);
      return "";
    });

  return (
    <>
      <button type="button" className="retro-button" onClick={() => setOpen(true)}>
        {anonymous ? "👤 Convidado" : `👤 ${user?.email}`}
      </button>
      {open && (
        <div className="pointer-events-auto fixed inset-0 z-10 grid place-items-center bg-black/50 p-4">
          <section className="retro-panel w-full max-w-sm">
            <header className="retro-title flex">
              Conta
              <button type="button" className="ml-auto" aria-label="Fechar" onClick={() => setOpen(false)}>
                <Xmark />
              </button>
            </header>
            <div className="space-y-2 p-3">
              {anonymous ? (
                <>
                  <p>Você está jogando como convidado. A cidade fica salva no servidor, mas presa a este navegador.</p>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full border-2 border-zinc-600 bg-zinc-900 px-2 py-1"
                  />
                  <button
                    type="button"
                    className="retro-button retro-button-primary w-full"
                    disabled={busy || !email}
                    onClick={linkEmail}
                  >
                    Salvar cidade neste e-mail
                  </button>
                  <button type="button" className="retro-button w-full" disabled={busy || !email} onClick={signInOther}>
                    Já tenho conta: entrar
                  </button>
                </>
              ) : (
                <>
                  <p>
                    Conectado como <strong>{user?.email}</strong>.
                  </p>
                  <button type="button" className="retro-button w-full" disabled={busy} onClick={signOut}>
                    Sair
                  </button>
                </>
              )}
              {msg && <p className="text-amber-300">{msg}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
