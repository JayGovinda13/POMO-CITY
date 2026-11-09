"use client";

import dynamic from "next/dynamic";

// O estado local (fila offline) vem do localStorage: renderizar só no cliente evita divergência de hidratação.
export const ClientOnlyGame = dynamic(() => import("./GameApp").then((m) => m.GameApp), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center text-sm">Carregando POMO-CITY…</div>,
});
