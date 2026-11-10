"use client";

import { useEffect, useState } from "react";
import type { CitizenView, Mood } from "@/sim";

type Frames = Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
type Atlas = { frames: Frames; meta: { size: { w: number; h: number } } };

let atlasPromise: Promise<Atlas> | null = null;
/** Mesma folha de sprites do mapa (gerada com pxl); carregada uma vez. */
function loadAtlas() {
  atlasPromise ??= fetch("/sprites/city.json").then((r) => r.json());
  return atlasPromise;
}

function useAtlas() {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  useEffect(() => {
    let alive = true;
    loadAtlas()
      .then((a) => alive && setAtlas(a))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return atlas;
}

export const MOOD_ICON: Record<Mood, string> = { feliz: "😊", ok: "😐", triste: "☹️" };

/** Retrato em camadas: corpo (profissão), cabeça (pele), cabelo e rosto (humor). */
export function Portrait({ citizen, scale = 2 }: { citizen: Pick<CitizenView, "look" | "job" | "mood" | "name">; scale?: number }) {
  const atlas = useAtlas();
  const w = 18 * scale;
  const h = 20 * scale;
  if (!atlas) return <span className="inline-block bg-zinc-800" style={{ width: w, height: h }} aria-hidden />;
  const layers = [
    `pt_body_${citizen.job?.category ?? "nenhum"}`,
    `pt_head_${citizen.look.skin}`,
    `pt_hair_${citizen.look.hair}_${citizen.look.hairColor}`,
    `pt_mood_${citizen.mood}`,
  ];
  const { w: sw, h: sh } = atlas.meta.size;
  return (
    <span className="relative inline-block shrink-0" style={{ width: w, height: h }} role="img" aria-label={`${citizen.name} (${citizen.mood})`}>
      {layers.map((name) => {
        const f = atlas.frames[name]?.frame;
        if (!f) return null;
        return (
          <span
            key={name}
            className="absolute left-0 top-0"
            style={{
              width: f.w * scale,
              height: f.h * scale,
              backgroundImage: "url(/sprites/city.png)",
              backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
              backgroundSize: `${sw * scale}px ${sh * scale}px`,
              imageRendering: "pixelated",
            }}
          />
        );
      })}
    </span>
  );
}
