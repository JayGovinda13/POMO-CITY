"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  BIOMES,
  COAST_NAMES,
  FOREST_NAMES,
  MAP_SIZE,
  RELIEF_NAMES,
  WATER_NAMES,
  generateMap,
  type BiomeId,
  type MapOptions,
} from "@/sim";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const mix = (c: number, f: number) => {
  const ch = (sh: number) => Math.max(0, Math.min(255, Math.round(((c >> sh) & 255) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * Editor do mapa antes de fundar (Fase 9): relevo, água doce, mar e mata, com prévia de cima.
 * O mapa é sempre fictício; a mesma seed + opções geram o mesmo mapa no servidor.
 */
export function MapEditor({
  seed,
  biome,
  wetness,
  value,
  onChange,
}: {
  seed: number;
  biome: BiomeId;
  wetness: number;
  value: MapOptions;
  onChange: (v: MapOptions) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const map = useMemo(() => generateMap(seed, MAP_SIZE, biome, value, wetness), [seed, biome, value, wetness]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const px = 4;
    const grass = BIOMES[biome].grass;
    for (let y = 0; y < MAP_SIZE; y++)
      for (let x = 0; x < MAP_SIZE; x++) {
        const i = y * MAP_SIZE + x;
        const t = map.terrain[i];
        const color = t === 2 ? 0x2f4f8f : t === 1 ? 0x3f6fb5 : mix(grass, 0.8 + map.elevation[i] * 0.17);
        ctx.fillStyle = hex(color);
        ctx.fillRect(x * px, y * px, px, px);
        if (map.trees[i]) {
          ctx.fillStyle = hex(mix(grass, 0.45));
          ctx.fillRect(x * px + 1, y * px + 1, 2, 2);
        }
      }
    // Prefeitura no centro.
    const c = Math.floor(MAP_SIZE / 2);
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(c * px - 1, c * px - 1, px + 2, px + 2);
  }, [map, biome]);

  const select = <K extends keyof MapOptions>(key: K, label: string, options: Record<string, string> | readonly string[]) => (
    <label className="flex items-center gap-1">
      <span className="w-14 text-zinc-400">{label}</span>
      <select
        className="flex-1 border-2 border-zinc-600 bg-zinc-900 px-1 py-0.5"
        value={String(value[key])}
        onChange={(e) => {
          const raw = e.target.value;
          onChange({ ...value, [key]: key === "forest" ? Number(raw) : raw });
        }}
      >
        {Array.isArray(options)
          ? options.map((name, k) => (
              <option key={k} value={k}>
                {name}
              </option>
            ))
          : Object.entries(options).map(([k, name]) => (
              <option key={k} value={k}>
                {name}
              </option>
            ))}
      </select>
    </label>
  );

  return (
    <fieldset className="space-y-1">
      <legend className="text-zinc-400">Mapa ({MAP_SIZE}×{MAP_SIZE})</legend>
      <div className="flex gap-2">
        <canvas
          ref={canvas}
          width={MAP_SIZE * 4}
          height={MAP_SIZE * 4}
          className="h-32 w-32 shrink-0 border-2 border-zinc-600"
          style={{ imageRendering: "pixelated" }}
          aria-label="Prévia do mapa"
        />
        <div className="min-w-0 flex-1 space-y-1">
          {select("relief", "Relevo", RELIEF_NAMES)}
          {select("water", "Água", WATER_NAMES)}
          {select("coast", "Mar", COAST_NAMES)}
          {select("forest", "Mata", FOREST_NAMES)}
          <button type="button" className="retro-button w-full" onClick={() => onChange({ ...value, variant: value.variant + 1 })}>
            🎲 Outro mapa
          </button>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500">Mais claro = mais alto. O mapa é fictício: só o clima vem da região.</p>
    </fieldset>
  );
}
