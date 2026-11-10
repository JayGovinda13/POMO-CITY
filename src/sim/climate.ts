// Fase 2 — Clima e estações.
// O jogador escolhe uma REGIÃO CLIMÁTICA (a própria ou outra parte do mundo). Só o clima é usado:
// o mapa continua fictício. Os valores são normais climatológicas aproximadas e arredondadas,
// agregadas por trimestre (Jan–Mar, Abr–Jun, Jul–Set, Out–Dez).

import type { BiomeId, CityState, ClimateEffects, WeatherSummary } from "./types";
import { calendarIdx, rng } from "./world";

export type ClimateType =
  | "tropical_umido"
  | "tropical_seco"
  | "semiarido"
  | "arido"
  | "subtropical_umido"
  | "oceanico"
  | "mediterraneo"
  | "continental"
  | "subartico"
  | "polar"
  | "altitude";

export const CLIMATE_TYPES: Record<ClimateType, { name: string; biome: BiomeId }> = {
  tropical_umido: { name: "Tropical úmido", biome: "forest" },
  tropical_seco: { name: "Tropical com estação seca", biome: "plains" },
  semiarido: { name: "Semiárido", biome: "desert" },
  arido: { name: "Árido", biome: "desert" },
  subtropical_umido: { name: "Subtropical úmido", biome: "plains" },
  oceanico: { name: "Temperado oceânico", biome: "plains" },
  mediterraneo: { name: "Mediterrâneo", biome: "plains" },
  continental: { name: "Continental", biome: "forest" },
  subartico: { name: "Subártico", biome: "tundra" },
  polar: { name: "Polar", biome: "tundra" },
  altitude: { name: "Tropical de altitude", biome: "mountains" },
};

/** Normal de um trimestre: temperatura média (°C), chuva total (mm), sol (h/dia), vento (m/s). */
export interface QuarterNormal {
  t: number;
  rain: number;
  sun: number;
  wind: number;
}

export type Continent = "América do Sul" | "América Central e Norte" | "Europa" | "África e Oriente Médio" | "Ásia" | "Oceania";

export interface Region {
  id: string;
  name: string;
  country: string;
  continent: Continent;
  /** Coordenadas do centro da região (só para encontrar a região mais próxima do jogador). */
  lat: number;
  lon: number;
  type: ClimateType;
  quarters: [QuarterNormal, QuarterNormal, QuarterNormal, QuarterNormal];
  aliases?: string[];
}

type Q = [number, number, number, number];
/** Compacta: temperaturas, chuvas, sol e vento por trimestre. */
function region(
  id: string,
  name: string,
  country: string,
  continent: Continent,
  lat: number,
  lon: number,
  type: ClimateType,
  t: Q,
  rain: Q,
  sun: Q,
  wind: number | Q,
  aliases?: string[],
): Region {
  const w: Q = typeof wind === "number" ? [wind, wind, wind, wind] : wind;
  const quarters = [0, 1, 2, 3].map((i) => ({ t: t[i], rain: rain[i], sun: sun[i], wind: w[i] })) as Region["quarters"];
  return { id, name, country, continent, lat, lon, type, quarters, aliases };
}

const SA = "América do Sul";
const NA = "América Central e Norte";
const EU = "Europa";
const AF = "África e Oriente Médio";
const AS = "Ásia";
const OC = "Oceania";

export const REGIONS: Region[] = [
  // América do Sul
  region("sao-paulo", "São Paulo", "Brasil", SA, -23.5, -46.6, "subtropical_umido", [23, 19, 17, 21], [650, 210, 140, 420], [5, 5.5, 6, 5], 2.5, ["campinas", "santos", "sorocaba"]),
  region("rio-de-janeiro", "Rio de Janeiro", "Brasil", SA, -22.9, -43.2, "tropical_seco", [27, 24, 22, 25], [400, 230, 150, 330], [6.5, 6, 6, 5.5], 3, ["niteroi", "vitoria"]),
  region("belo-horizonte", "Belo Horizonte", "Brasil", SA, -19.9, -43.9, "altitude", [23, 20, 19.5, 22.5], [560, 90, 40, 520], [6, 7, 8, 5.5], 2, ["minas gerais"]),
  region("brasilia", "Brasília", "Brasil", SA, -15.8, -47.9, "tropical_seco", [22, 20, 20.5, 22], [600, 160, 30, 560], [5, 7, 8.5, 5.5], 2.5, ["goiania"]),
  region("manaus", "Manaus", "Brasil", SA, -3.1, -60.0, "tropical_umido", [26.5, 26.8, 27.8, 28], [860, 620, 190, 470], [3.5, 4.5, 7, 5.5], 1.5, ["amazonia", "porto velho"]),
  region("belem", "Belém", "Brasil", SA, -1.5, -48.5, "tropical_umido", [26, 26.5, 27, 27.5], [1150, 700, 360, 380], [4, 6, 8, 7], 1.8, ["sao luis", "macapa"]),
  region("salvador", "Salvador", "Brasil", SA, -13.0, -38.5, "tropical_umido", [27, 25.5, 24, 26], [420, 810, 380, 310], [7, 5.5, 6, 7], 3.5, ["aracaju", "ilheus"]),
  region("recife", "Recife", "Brasil", SA, -8.05, -34.9, "tropical_seco", [27, 26, 24.5, 26.5], [330, 900, 450, 120], [7.5, 6, 6, 8.5], 3.8, ["joao pessoa", "maceio", "natal"]),
  region("fortaleza", "Fortaleza", "Brasil", SA, -3.7, -38.5, "tropical_seco", [27.5, 27, 27, 28], [800, 500, 60, 50], [6.5, 7, 9, 9.5], 4.5, ["teresina"]),
  region("sertao", "Sertão nordestino", "Brasil", SA, -9.4, -40.5, "semiarido", [27.5, 26, 25, 28], [280, 70, 10, 120], [7, 7, 8.5, 8], 4.5, ["petrolina", "juazeiro", "caatinga"]),
  region("cuiaba", "Cuiabá (Pantanal)", "Brasil", SA, -15.6, -56.1, "tropical_seco", [27, 25, 26, 28], [610, 160, 50, 430], [5.5, 7, 8, 6], 2, ["campo grande", "pantanal"]),
  region("curitiba", "Curitiba", "Brasil", SA, -25.4, -49.3, "oceanico", [20.5, 15.5, 13.5, 18], [480, 270, 260, 400], [5.5, 5, 5, 5], 2.5, ["florianopolis", "joinville"]),
  region("porto-alegre", "Porto Alegre", "Brasil", SA, -30.0, -51.2, "subtropical_umido", [24.5, 17.5, 14.5, 20.5], [330, 330, 400, 330], [7.5, 5.5, 5, 7], 2.8, ["pelotas", "rio grande do sul"]),
  region("buenos-aires", "Buenos Aires", "Argentina", SA, -34.6, -58.4, "subtropical_umido", [23, 15.5, 11.5, 19], [340, 230, 220, 340], [8, 5.5, 5.5, 7.5], 3.5, ["montevideu", "uruguai"]),
  region("santiago", "Santiago", "Chile", SA, -33.4, -70.7, "mediterraneo", [20, 13, 9, 16], [10, 150, 130, 20], [10, 5.5, 5.5, 9.5], 2, ["valparaiso", "mendoza"]),
  region("lima", "Lima", "Peru", SA, -12.0, -77.0, "arido", [23, 19.5, 16.5, 18.5], [3, 4, 8, 3], [6, 4, 2, 4], 3.5, ["atacama"]),
  region("bogota", "Bogotá", "Colômbia", SA, 4.7, -74.1, "altitude", [14, 14.3, 14, 14], [170, 300, 160, 330], [5, 3.5, 4.5, 3.5], 2, ["quito", "medellin"]),
  region("la-paz", "La Paz (Altiplano)", "Bolívia", SA, -16.5, -68.15, "altitude", [9.5, 7, 6.5, 9.5], [300, 40, 40, 170], [6, 8, 8.5, 7], 3, ["cusco", "altiplano"]),
  region("patagonia", "Patagônia austral", "Chile/Argentina", SA, -53.2, -70.9, "subartico", [10.5, 5, 2.5, 7.5], [100, 110, 90, 80], [6, 3, 3, 6.5], 7.5, ["punta arenas", "ushuaia"]),

  // América Central e do Norte
  region("cidade-do-mexico", "Cidade do México", "México", NA, 19.4, -99.1, "altitude", [15.5, 19, 17, 15], [30, 230, 420, 90], [7.5, 6.5, 5.5, 6.5], 2, ["guadalajara"]),
  region("havana", "Havana (Caribe)", "Cuba", NA, 23.1, -82.4, "tropical_seco", [22.5, 26.5, 28, 24.5], [170, 380, 450, 300], [7, 8.5, 8, 6.5], 3.5, ["caribe", "santo domingo", "porto rico"]),
  region("miami", "Miami", "EUA", NA, 25.8, -80.2, "tropical_seco", [21.5, 26.5, 28.5, 24], [190, 430, 610, 330], [7.5, 9, 8.5, 7], 4, ["florida"]),
  region("nova-york", "Nova York", "EUA", NA, 40.7, -74.0, "subtropical_umido", [2, 16.5, 23.5, 9.5], [280, 300, 310, 290], [5.5, 8, 8.5, 5.5], 4.5, ["new york", "boston", "washington", "filadelfia"]),
  region("chicago", "Chicago (Grandes Lagos)", "EUA", NA, 41.9, -87.6, "continental", [-2, 14, 22, 7], [170, 290, 280, 220], [5, 8, 9, 4.5], 4.8, ["toronto", "detroit", "montreal"]),
  region("los-angeles", "Los Angeles", "EUA", NA, 34.05, -118.2, "mediterraneo", [14.5, 17.5, 22, 17.5], [230, 20, 5, 90], [7.5, 9.5, 10.5, 7.5], 3, ["san diego", "california", "san francisco"]),
  region("phoenix", "Phoenix (Deserto de Sonora)", "EUA", NA, 33.4, -112.1, "arido", [15, 29, 33.5, 18], [70, 20, 60, 50], [9, 12, 11, 9], 2.8, ["las vegas", "arizona"]),
  region("vancouver", "Vancouver", "Canadá", NA, 49.3, -123.1, "oceanico", [5, 13, 17, 7], [400, 210, 140, 520], [3, 7.5, 9, 2.5], 3.5, ["seattle", "portland"]),
  region("anchorage", "Anchorage", "EUA", NA, 61.2, -149.9, "subartico", [-8, 7.5, 13, -3], [50, 60, 200, 130], [3.5, 9, 7, 2], 3, ["alasca", "yukon"]),
  region("nuuk", "Nuuk", "Groenlândia", NA, 64.2, -51.7, "polar", [-8, 1.5, 6, -3], [120, 140, 230, 200], [3, 7, 5, 1.5], 5, ["groenlandia"]),

  // Europa
  region("lisboa", "Lisboa", "Portugal", EU, 38.7, -9.1, "mediterraneo", [12.5, 18, 23, 16], [260, 120, 30, 340], [6, 9.5, 11.5, 6], 4, ["porto", "sevilha"]),
  region("madrid", "Madri", "Espanha", EU, 40.4, -3.7, "mediterraneo", [7.5, 17, 24.5, 11], [100, 120, 40, 160], [6, 10, 11.5, 5.5], 3, ["barcelona", "roma", "atenas"]),
  region("londres", "Londres", "Reino Unido", EU, 51.5, -0.1, "oceanico", [6, 13.5, 18, 9], [140, 140, 150, 190], [2.5, 6.5, 6, 2.5], 4.5, ["london", "dublin", "amsterdam"]),
  region("paris", "Paris", "França", EU, 48.9, 2.35, "oceanico", [6, 15, 20, 9], [140, 170, 160, 170], [3, 7, 7.5, 3], 4, ["bruxelas", "lyon"]),
  region("berlim", "Berlim", "Alemanha", EU, 52.5, 13.4, "continental", [1.5, 13.5, 18.5, 6.5], [115, 160, 170, 140], [2.5, 7.5, 7.5, 2.5], 4, ["berlin", "varsovia", "praga", "viena"]),
  region("moscou", "Moscou", "Rússia", EU, 55.75, 37.6, "continental", [-6, 11, 16, 0], [115, 180, 230, 170], [2, 8, 7, 1], 3.5, ["sao petersburgo", "kiev", "helsinque"]),
  region("tromso", "Tromsø (Ártico)", "Noruega", EU, 69.6, 18.9, "subartico", [-3.5, 4, 10.5, 0.5], [270, 180, 260, 330], [1, 6, 5, 0.5], 4.5, ["lapônia", "laponia"]),
  region("reykjavik", "Reykjavík", "Islândia", EU, 64.1, -21.9, "subartico", [0.5, 6, 10.5, 2.5], [230, 160, 210, 270], [1.5, 6, 4.5, 1], 6, ["islandia"]),

  // África e Oriente Médio
  region("cairo", "Cairo", "Egito", AF, 30.0, 31.2, "arido", [15.5, 24, 28, 20], [15, 2, 0, 10], [8, 11, 11.5, 8.5], 3.5, ["egito", "saara"]),
  region("dubai", "Dubai", "Emirados Árabes", AF, 25.2, 55.3, "arido", [20, 32, 35, 25], [50, 3, 1, 25], [8.5, 11, 10, 9], 4, ["riad", "doha"]),
  region("niamey", "Niamey (Sahel)", "Níger", AF, 13.5, 2.1, "semiarido", [29, 33.5, 28.5, 28], [5, 120, 420, 15], [9, 9, 8, 9.5], 3.5, ["sahel", "bamako"]),
  region("lagos", "Lagos", "Nigéria", AF, 6.5, 3.4, "tropical_umido", [28, 27.5, 25.5, 27.5], [180, 720, 360, 200], [6, 5, 3, 6], 3, ["acra", "abidja"]),
  region("nairobi", "Nairóbi", "Quênia", AF, -1.3, 36.8, "altitude", [19, 18, 16.5, 18.5], [260, 280, 60, 250], [8.5, 6, 5, 7], 3.5, ["adis abeba", "kampala"]),
  region("luanda", "Luanda", "Angola", AF, -8.8, 13.2, "semiarido", [27, 25.5, 21.5, 25.5], [190, 140, 2, 50], [6.5, 6, 4, 5.5], 3.5, ["angola"]),
  region("cidade-do-cabo", "Cidade do Cabo", "África do Sul", AF, -33.9, 18.4, "mediterraneo", [21.5, 16.5, 13, 19], [50, 250, 210, 70], [10.5, 6.5, 6.5, 10], 5.5, ["cape town"]),
  region("maputo", "Maputo", "Moçambique", AF, -25.97, 32.6, "tropical_seco", [26, 22, 19.5, 24], [380, 120, 50, 250], [7.5, 7.5, 7.5, 7], 3.5, ["mocambique", "durban"]),

  // Ásia
  region("mumbai", "Mumbai (Monções)", "Índia", AS, 19.1, 72.9, "tropical_seco", [25.5, 29.5, 27.5, 28], [2, 560, 1500, 90], [9.5, 8, 3, 8.5], 3.5, ["bombaim", "goa", "india"]),
  region("nova-delhi", "Nova Délhi", "Índia", AS, 28.6, 77.2, "semiarido", [17.5, 32.5, 30, 21], [50, 110, 560, 20], [8, 9, 5.5, 8], 2.5, ["delhi", "jaipur"]),
  region("singapura", "Singapura", "Singapura", AS, 1.35, 103.8, "tropical_umido", [27, 28.2, 27.8, 27.2], [600, 500, 480, 750], [6, 6, 6, 5], 2.5, ["kuala lumpur", "jacarta"]),
  region("bangkok", "Bangkok", "Tailândia", AS, 13.75, 100.5, "tropical_seco", [28, 29.5, 28.5, 27.5], [70, 450, 760, 260], [8, 7, 5, 7], 2.5, ["tailandia", "hanoi", "manila"]),
  region("toquio", "Tóquio", "Japão", AS, 35.7, 139.7, "subtropical_umido", [6, 18, 25, 12.5], [230, 430, 550, 330], [6, 5.5, 5.5, 5], 3.2, ["tokyo", "osaka", "seul"]),
  region("pequim", "Pequim", "China", AS, 39.9, 116.4, "continental", [-1, 20, 25, 7], [20, 150, 340, 40], [6.5, 8.5, 6.5, 6], 3, ["beijing", "xangai"]),
  region("ulaanbaatar", "Ulaanbaatar (Estepe)", "Mongólia", AS, 47.9, 106.9, "semiarido", [-19, 8, 15, -8], [5, 60, 160, 15], [7, 9, 8, 6.5], 3.5, ["mongolia", "gobi"]),
  region("katmandu", "Katmandu (Himalaia)", "Nepal", AS, 27.7, 85.3, "altitude", [12, 21.5, 23.5, 15], [60, 450, 1100, 60], [8, 7, 4, 8], 2, ["nepal", "tibete"]),

  // Oceania
  region("sydney", "Sydney", "Austrália", OC, -33.9, 151.2, "subtropical_umido", [23, 17, 13.5, 20], [380, 360, 230, 230], [7.5, 6, 7, 7.8], 4, ["brisbane"]),
  region("alice-springs", "Alice Springs (Outback)", "Austrália", OC, -23.7, 133.9, "arido", [28.5, 16.5, 15, 25.5], [120, 40, 25, 100], [9.5, 8.5, 9.5, 10.5], 3, ["outback"]),
  region("auckland", "Auckland", "Nova Zelândia", OC, -36.85, 174.76, "oceanico", [19.5, 15, 11.5, 16], [240, 330, 380, 270], [7.5, 5, 5, 6.5], 4.5, ["wellington", "nova zelandia"]),
];

export const REGION_BY_ID: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Busca por nome, país ou cidade próxima (sem acentos). Nada sai do navegador. */
export function searchRegions(query: string): Region[] {
  const q = normalize(query);
  if (!q) return [];
  return REGIONS.filter((r) =>
    [r.name, r.country, ...(r.aliases ?? [])].some((text) => normalize(text).includes(q)),
  );
}

/** Região da tabela mais próxima de uma coordenada (distância de grande círculo). */
export function nearestRegion(lat: number, lon: number): Region {
  const rad = Math.PI / 180;
  const dist = (r: Region) => {
    const dLat = (r.lat - lat) * rad;
    const dLon = (r.lon - lon) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(r.lat * rad) * Math.sin(dLon / 2) ** 2;
    return Math.asin(Math.min(1, Math.sqrt(a)));
  };
  return REGIONS.reduce((best, r) => (dist(r) < dist(best) ? r : best));
}

export const annualRain = (r: Region) => r.quarters.reduce((acc, q) => acc + q.rain, 0);
export const biomeOf = (r: Region): BiomeId => CLIMATE_TYPES[r.type].biome;
export const hemisphere = (r: Region): "N" | "S" => (r.lat >= 0 ? "N" : "S");

/** Perto do Equador as estações são definidas pela chuva, não pela temperatura. */
export const usesWetDrySeasons = (r: Region) => Math.abs(r.lat) < 23.45;

const TEMPERATE_NORTH = ["Inverno", "Primavera", "Verão", "Outono"];
const TEMPERATE_SOUTH = ["Verão", "Outono", "Inverno", "Primavera"];

/** Nome da estação de um trimestre (0 = Jan–Mar) numa região. */
export function seasonName(r: Region, quarter: number): string {
  if (!usesWetDrySeasons(r)) return (hemisphere(r) === "N" ? TEMPERATE_NORTH : TEMPERATE_SOUTH)[quarter];
  const mean = annualRain(r) / 4;
  const rain = r.quarters[quarter].rain;
  if (rain >= mean * 1.15) return "Estação chuvosa";
  if (rain <= mean * 0.6) return "Estação seca";
  return "Transição";
}

// ───────────────────────── Tempo de cada estação ─────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);

export const NEUTRAL_EFFECTS: ClimateEffects = { farm: 1, wind: 1, hydro: 1, demand: 1, water: 1 };

/** Efeitos do tempo sobre a simulação. */
export function climateEffects(w: { temp: number; rain: number; wind: number }): ClimateEffects {
  // Lavoura: ideal entre 16 e 30 °C; geada e calor extremo derrubam a colheita.
  const t = w.temp;
  const ft =
    t < 0 ? 0.15 : t < 8 ? lerp(0.15, 0.5, t / 8) : t < 16 ? lerp(0.5, 1, (t - 8) / 8) : t <= 30 ? 1 : lerp(1, 0.6, (t - 30) / 8);
  // Chuva no trimestre: seca derruba; excesso encharca.
  const r = w.rain;
  const fr = r < 30 ? 0.45 : r < 150 ? lerp(0.45, 1, (r - 30) / 120) : r <= 700 ? lerp(1, 1.1, (r - 150) / 550) : lerp(1.1, 0.85, (r - 700) / 800);
  // Aquecimento abaixo de 12 °C e refrigeração acima de 26 °C.
  const demand = t < 12 ? 1 + Math.min(0.6, (12 - t) * 0.04) : t > 26 ? 1 + Math.min(0.5, (t - 26) * 0.05) : 1;
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    farm: round(clamp(ft * fr, 0.1, 1.3)),
    wind: round(clamp(w.wind / 4, 0.3, 1.8)),
    hydro: round(clamp(r / 250, 0.25, 1.3)),
    demand: round(demand),
    // Bombas tiram mais água em estação chuvosa e menos na seca (Fase 6).
    water: round(clamp(0.45 + r / 500, 0.5, 1.3)),
  };
}

export interface Weather extends WeatherSummary {
  quarter: number;
  normal: QuarterNormal;
}

/**
 * Tempo da estação de índice `index` (padrão: a estação que o próximo ciclo vai viver).
 * Sorteado com seed em torno da normal: cliente e servidor sempre chegam ao mesmo resultado,
 * e a HUD pode mostrar a previsão exata na pausa. Sem região escolhida, retorna null (neutro).
 */
export function weatherAt(s: CityState, index = calendarIdx(s)): Weather | null {
  const r = s.regionId ? REGION_BY_ID[s.regionId] : undefined;
  if (!r) return null;
  const quarter = ((index % 4) + 4) % 4;
  const normal = r.quarters[quarter];
  const rand = rng((s.seed ^ Math.imul(index + 1, 0x85ebca6b) ^ 0x51ed270b) >>> 0);

  const u = rand();
  const rainMult = u < 0.08 ? 0.3 : u > 0.92 ? 1.7 : 0.75 + rand() * 0.5;
  const v = rand();
  const dt = v < 0.07 ? -5 : v > 0.93 ? 5 : (rand() - 0.5) * 3;
  const windMult = 0.75 + rand() * 0.5;

  const temp = Math.round((normal.t + dt) * 10) / 10;
  const rain = Math.round(normal.rain * rainMult);
  const wind = Math.round(normal.wind * windMult * 10) / 10;

  let label = "Dentro do normal";
  if (rainMult <= 0.3 && normal.rain >= 40) label = "Seca severa";
  else if (rainMult >= 1.7 && normal.rain >= 40) label = "Chuvas acima da média";
  else if (dt >= 5) label = "Onda de calor";
  else if (dt <= -5) label = "Frente fria";

  return {
    quarter,
    normal,
    season: seasonName(r, quarter),
    label,
    temp,
    rain,
    wind,
    effects: climateEffects({ temp, rain, wind }),
  };
}

export const effectsOf = (w: Weather | WeatherSummary | null | undefined): ClimateEffects => w?.effects ?? NEUTRAL_EFFECTS;
