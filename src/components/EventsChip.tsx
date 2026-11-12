"use client";

import { EVENT_LABEL, activeEvents } from "@/sim";
import { useGame } from "@/store/game";
import { Party } from "./icons";

/** Eventos aleatórios em andamento (feira, greve, desafio…). */
export function EventsChip() {
  const city = useGame((s) => s.city);
  if (!city) return null;
  const events = activeEvents(city);
  if (!events.length) return null;
  const text = events
    .map((e) => `${EVENT_LABEL[e.id]}${e.target ? ` (meta ${e.target})` : ""} — ${e.left} ciclo${e.left === 1 ? "" : "s"}`)
    .join("\n");
  return (
    <span className="text-amber-300" title={`Eventos em andamento:\n${text}`}>
      <Party /> <span className="hidden sm:inline">{EVENT_LABEL[events[0].id]}</span>
      {events.length > 1 ? ` +${events.length - 1}` : ""}
    </span>
  );
}
