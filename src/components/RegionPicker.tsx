"use client";

import { useMemo, useState } from "react";
import {
  BIOMES,
  CLIMATE_TYPES,
  QUARTER_MONTHS,
  REGIONS,
  biomeOf,
  isPristine,
  nearestRegion,
  searchRegions,
  seasonName,
  type Continent,
  type Region,
} from "@/sim";
import { useGame } from "@/store/game";

type Tab = "mine" | "world";

/**
 * Fundação da cidade: o jogador escolhe a própria região ou outra parte do mundo.
 * Só o CLIMA é usado (o mapa é fictício). A localização do navegador é usada apenas
 * aqui, no próprio aparelho, para achar a região mais próxima; só o id da região vai ao servidor.
 */
export function RegionPicker() {
  const city = useGame((s) => s.serverState);
  const busy = useGame((s) => s.busy);
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Region | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const results = useMemo(() => searchRegions(query), [query]);
  const byContinent = useMemo(() => {
    const map = new Map<Continent, Region[]>();
    for (const r of REGIONS) map.set(r.continent, [...(map.get(r.continent) ?? []), r]);
    return [...map.entries()];
  }, []);

  if (!city || city.regionId) return null;
  const keepsMap = !isPristine(city);

  const locate = () => {
    if (!("geolocation" in navigator)) return setGeoMsg("Este navegador não informa a localização.");
    setGeoMsg("Procurando…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // A coordenada fica no aparelho: usamos só para achar a região da tabela.
        const r = nearestRegion(pos.coords.latitude, pos.coords.longitude);
        setSelected(r);
        setGeoMsg(`Região mais próxima: ${r.name}`);
      },
      () => setGeoMsg("Não foi possível obter a localização. Digite sua cidade abaixo."),
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-10 grid place-items-center bg-black/60 p-3">
      <section className="retro-panel flex max-h-[92dvh] w-full max-w-2xl flex-col">
        <header className="retro-title">Fundar a cidade: onde ela vai viver?</header>
        <div className="flex gap-1 p-2 text-xs">
          <button type="button" className={`retro-button flex-1 ${tab === "mine" ? "retro-button-active" : ""}`} onClick={() => setTab("mine")}>
            📍 Minha região
          </button>
          <button type="button" className={`retro-button flex-1 ${tab === "world" ? "retro-button-active" : ""}`} onClick={() => setTab("world")}>
            🌍 Outra parte do mundo
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-2 text-xs md:grid-cols-2">
          <div className="space-y-2">
            {tab === "mine" ? (
              <>
                <p className="text-zinc-400">A cidade terá o mesmo clima e as mesmas estações que você vive.</p>
                <button type="button" className="retro-button w-full" onClick={locate}>
                  Usar minha localização
                </button>
                {geoMsg && <p className="text-amber-300">{geoMsg}</p>}
                <label className="block">
                  <span className="text-zinc-400">ou digite sua cidade/estado/país:</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ex.: Campinas, Recife, Lisboa"
                    className="mt-1 w-full border-2 border-zinc-600 bg-zinc-900 px-2 py-1"
                  />
                </label>
                <RegionList regions={results} selected={selected} onSelect={setSelected} />
                {query && results.length === 0 && (
                  <p className="text-zinc-500">Nada encontrado. Tente a capital mais próxima ou escolha em “Outra parte do mundo”.</p>
                )}
              </>
            ) : (
              byContinent.map(([continent, list]) => (
                <div key={continent}>
                  <h3 className="mb-1 text-[10px] uppercase tracking-wider text-zinc-400">{continent}</h3>
                  <RegionList regions={list} selected={selected} onSelect={setSelected} />
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 md:sticky md:top-0 md:self-start">
            {selected ? <RegionPreview region={selected} /> : <p className="text-zinc-500">Escolha uma região para ver o clima.</p>}
            <p className="text-[11px] text-zinc-500">
              Só o clima é usado: o mapa da cidade é fictício. Não guardamos sua localização, apenas a região escolhida.
              {keepsMap && " Sua cidade já construída mantém o mapa e o bioma atuais."}
            </p>
            <button
              type="button"
              className="retro-button retro-button-primary w-full py-2"
              disabled={!selected || busy}
              onClick={() => selected && useGame.getState().chooseRegion(selected.id)}
            >
              Fundar em {selected?.name ?? "…"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function RegionList({ regions, selected, onSelect }: { regions: Region[]; selected: Region | null; onSelect: (r: Region) => void }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-1">
      {regions.map((r) => (
        <button
          key={r.id}
          type="button"
          className={`retro-button text-left ${selected?.id === r.id ? "retro-button-active" : ""}`}
          onClick={() => onSelect(r)}
        >
          {r.name} <span className="text-zinc-400">· {r.country}</span>
        </button>
      ))}
    </div>
  );
}

function RegionPreview({ region }: { region: Region }) {
  return (
    <div className="space-y-1 border-2 border-zinc-700 bg-zinc-900/60 p-2">
      <p>
        <strong>{region.name}</strong> <span className="text-zinc-400">· {region.country}</span>
      </p>
      <p className="text-zinc-300">
        {CLIMATE_TYPES[region.type].name} · bioma {BIOMES[biomeOf(region)].name} · hemisfério {region.lat >= 0 ? "Norte" : "Sul"}
      </p>
      <table className="w-full text-center">
        <thead className="text-zinc-400">
          <tr>
            <th className="text-left font-normal">Trimestre</th>
            <th className="font-normal">Estação</th>
            <th className="font-normal">°C</th>
            <th className="font-normal">Chuva</th>
          </tr>
        </thead>
        <tbody>
          {region.quarters.map((q, i) => (
            <tr key={i}>
              <td className="text-left">{QUARTER_MONTHS[i]}</td>
              <td>{seasonName(region, i)}</td>
              <td>{q.t}</td>
              <td>{q.rain} mm</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
