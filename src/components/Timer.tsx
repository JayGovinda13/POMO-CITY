"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/store/game";

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square"; // timbre 8-bit
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

function notify(title: string, body: string) {
  beep();
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {}
  }
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Timer anti-throttling: nunca acumula "ticks". O tempo restante é sempre
 * endsAt − Date.now(), então abas congeladas pelo navegador não atrasam o relógio.
 * O fim do ciclo também é validado pelo relógio do servidor.
 */
export function Timer() {
  const { phase, endsAt, busy, config } = useGame();
  const { startFocus, completeFocus, abandonFocus, skipBreak } = useGame.getState();
  const [now, setNow] = useState(() => Date.now());
  const lastAttempt = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    const onVis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const remaining = endsAt ? endsAt - now : 0;

  useEffect(() => {
    if (!endsAt || remaining > 0) return;
    if (phase === "focus" && !busy && now - lastAttempt.current > 3000) {
      lastAttempt.current = now;
      completeFocus().then(() => {
        if (useGame.getState().phase === "break") notify("Ciclo concluído!", "Hora da pausa: gerencie sua cidade.");
      });
    } else if (phase === "break") {
      notify("Pausa encerrada", "Pronto para mais um ciclo de foco?");
      skipBreak();
    }
  }, [phase, endsAt, remaining, busy, now, completeFocus, skipBreak]);

  useEffect(() => {
    const label = phase === "focus" ? "🍅 Foco" : phase === "break" ? "☕ Pausa" : null;
    document.title = label && endsAt ? `${fmt(remaining)} ${label} — POMO-CITY` : "POMO-CITY";
  }, [phase, endsAt, remaining]);

  const focusMin = config ? Math.round(config.focusSeconds / 60) : 25;

  return (
    <div className="retro-panel pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-3 px-3 py-2">
      <span className="text-zinc-300">
        {phase === "focus" ? "🍅 FOCO" : phase === "break" ? "☕ PAUSA — gestão liberada" : "Pronto"}
      </span>
      <span className="font-mono text-2xl tabular-nums text-amber-300">
        {phase === "idle" || phase === "loading" ? fmt((config?.focusSeconds ?? 1500) * 1000) : fmt(remaining)}
      </span>
      {phase === "focus" ? (
        <button
          type="button"
          className="retro-button"
          disabled={busy}
          onClick={() => {
            if (confirm("Abandonar o ciclo? Sua sequência vai cair.")) abandonFocus();
          }}
        >
          Abandonar
        </button>
      ) : (
        <>
          <button type="button" className="retro-button retro-button-primary" disabled={busy} onClick={startFocus}>
            Iniciar foco ({focusMin} min)
          </button>
          {phase === "break" && (
            <button type="button" className="retro-button" onClick={skipBreak}>
              Encerrar pausa
            </button>
          )}
        </>
      )}
    </div>
  );
}
