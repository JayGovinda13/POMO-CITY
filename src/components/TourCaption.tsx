"use client";

import { useEffect, useState } from "react";
import { bus } from "@/game/bus";
import { useGame } from "@/store/game";

/** Legenda do passeio: nome, profissão e o que o morador acompanhado está fazendo agora. */
export function TourCaption() {
  const [info, setInfo] = useState<string | null>(null);
  const phase = useGame((s) => s.phase);
  const tour = useGame((s) => s.tour);
  useEffect(() => {
    const off = bus.on("tour:info", setInfo);
    return () => void off();
  }, []);
  if (phase !== "focus" || tour === "off" || !info) return null;
  return (
    <div className="retro-panel pointer-events-none mx-auto max-w-full px-3 py-1 text-center text-amber-100" role="status" aria-live="polite">
      🎥 {info}
    </div>
  );
}
