"use client";

import { useGame } from "@/store/game";

/** Aviso na barra superior: greve em andamento (fração dos trabalhadores parada e os motivos). */
export function StrikeChip() {
  const strike = useGame((s) => s.city?.strike);
  if (!strike || strike.share < 0.03) return null;
  const why = strike.causes.map((c) => `${c.text}: ${Math.round(c.share * 100)}%`).join("\n");
  return (
    <span className="text-red-300" title={`Greve: ${Math.round(strike.share * 100)}% dos trabalhadores parados.\n${why}`}>
      ✊ {Math.round(strike.share * 100)}%
    </span>
  );
}
