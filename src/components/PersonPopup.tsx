"use client";

import { useEffect, useMemo, useState } from "react";
import { bus } from "@/game/bus";
import { citizensView } from "@/sim";
import { useGame } from "@/store/game";
import { CitizenCard } from "./CitizensPanel";
import { Xmark } from "./icons";

/** Ficha do morador clicado na rua. */
export function PersonPopup() {
  const city = useGame((s) => s.city);
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    const off = bus.on("person:click", setId);
    return () => void off();
  }, []);
  const view = useMemo(() => (city && id !== null ? citizensView(city).find((v) => v.id === id) ?? null : null), [city, id]);
  if (!view) return null;
  return (
    <div className="retro-panel pointer-events-auto mx-auto max-h-[60dvh] w-full max-w-sm overflow-y-auto p-2 text-xs">
      <button type="button" className="float-right" aria-label="Fechar" onClick={() => setId(null)}>
        <Xmark />
      </button>
      <CitizenCard citizen={view} />
    </div>
  );
}
