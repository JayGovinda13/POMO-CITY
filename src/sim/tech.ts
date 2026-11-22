// Árvore de tecnologia: 200 anos de avanço (1900 → 2100).
//
// A cidade gera PONTOS DE PESQUISA a cada ciclo concluído (educação, escolas, faculdades,
// bibliotecas, museus) — multiplicados pelo Rank do foco. O jogador escolhe o que pesquisar;
// cada tecnologia tem ano mínimo, pré-requisitos e custo. Ao concluir, ela dá modificadores
// permanentes (produção, energia, poluição, crime, impostos…) ou libera construções novas.

import type { BuildingType, CityState, Rank } from "./types";
import { RANK_YIELD } from "./config";
import { isDown } from "./lifecycle";
import { lawMods } from "./laws";
import { ordinanceMods } from "./finance";
import { cityYear } from "./world";

/** Modificadores somados de todas as tecnologias pesquisadas (frações: 0,15 = +15%). */
export interface TechMods {
  farm: number;
  wood: number;
  ore: number;
  /** Serraria e fundição. */
  refine: number;
  /** Bens da indústria. */
  goods: number;
  /** Geração de todas as usinas. */
  power: number;
  water: number;
  /** Negativo = menos poluição. */
  pollution: number;
  /** Negativo = menos crime. */
  crime: number;
  /** Negativo = manutenção mais barata. */
  upkeep: number;
  tax: number;
  research: number;
  /** Capacidade das vias. */
  traffic: number;
  /** Capacidade dos hospitais. */
  health: number;
  /** Negativo = desastres mais fracos. */
  disaster: number;
  /** Lotes a mais que crescem por ciclo. */
  growth: number;
  /** Fração dos empregos industriais que as máquinas eliminam (ver labor.ts). */
  automation: number;
  /** QE alvo a mais (pontos). */
  eq: number;
  /** Desconto de frete (fração, soma ao das obras e leis). */
  trade: number;
  /** Mais nascimentos (fração a mais na chance de filhos). */
  births: number;
}

export const NO_MODS: TechMods = {
  farm: 0, wood: 0, ore: 0, refine: 0, goods: 0, power: 0, water: 0, pollution: 0, crime: 0,
  upkeep: 0, tax: 0, research: 0, traffic: 0, health: 0, disaster: 0, growth: 0, automation: 0, eq: 0, trade: 0, births: 0,
};

export type EraId = "industrial" | "eletrica" | "atomica" | "digital" | "verde" | "futuro";

export const ERAS: { id: EraId; name: string; from: number }[] = [
  { id: "industrial", name: "Era Industrial", from: 1900 },
  { id: "eletrica", name: "Era Elétrica", from: 1930 },
  { id: "atomica", name: "Era Atômica", from: 1960 },
  { id: "digital", name: "Era Digital", from: 1990 },
  { id: "verde", name: "Era Verde", from: 2030 },
  { id: "futuro", name: "Era do Futuro", from: 2070 },
];

export interface TechDef {
  name: string;
  era: EraId;
  /** Ano mínimo da cidade para pesquisar. */
  year: number;
  cost: number;
  requires: string[];
  description: string;
  mods?: Partial<TechMods>;
  /** Construções que a tecnologia libera. */
  unlocks?: BuildingType[];
}

export const TECHS: Record<string, TechDef> = {
  // ── Era Industrial ──
  agricultura_moderna: { name: "Agricultura moderna", era: "industrial", year: 1900, cost: 12, requires: [], description: "Arado de ferro e rotação de culturas: +15% de comida.", mods: { farm: 0.15 } },
  maquina_vapor: { name: "Máquina a vapor", era: "industrial", year: 1900, cost: 15, requires: [], description: "Serraria e fundição a vapor: +15% de produção refinada.", mods: { refine: 0.15 } },
  imprensa: { name: "Imprensa popular", era: "industrial", year: 1903, cost: 20, requires: [], description: "Jornais e bibliotecas: +10% de pesquisa.", mods: { research: 0.1 } },
  saneamento: { name: "Saneamento básico", era: "industrial", year: 1905, cost: 25, requires: [], description: "Esgoto e água tratada: +15% de água e +10% de saúde.", mods: { water: 0.15, health: 0.1 } },
  aco: { name: "Aço Bessemer", era: "industrial", year: 1912, cost: 45, requires: ["maquina_vapor"], description: "Minas mais fundas e aço barato: +15% de minério e +10% de refino.", mods: { ore: 0.15, refine: 0.1 } },
  locomotiva: { name: "Locomotiva moderna", era: "industrial", year: 1915, cost: 40, requires: ["maquina_vapor"], description: "Frete rápido: +10% de bens e +10% de capacidade das vias.", mods: { goods: 0.1, traffic: 0.1 } },
  // ── Era Elétrica ──
  eletrificacao: { name: "Eletrificação", era: "eletrica", year: 1930, cost: 70, requires: ["maquina_vapor"], description: "Redes e turbinas melhores: +15% de energia.", mods: { power: 0.15 } },
  fertilizantes: { name: "Fertilizantes", era: "eletrica", year: 1935, cost: 80, requires: ["agricultura_moderna"], description: "Adubo químico: +20% de comida.", mods: { farm: 0.2 } },
  linha_montagem: { name: "Linha de montagem", era: "eletrica", year: 1935, cost: 90, requires: ["aco"], description: "Produção em série: +20% de bens, mas 8% dos empregos industriais somem.", mods: { goods: 0.2, automation: 0.08 } },
  radio: { name: "Rádio", era: "eletrica", year: 1940, cost: 80, requires: ["imprensa"], description: "Educação e comércio no ar: +10% de pesquisa e +5% de impostos.", mods: { research: 0.1, tax: 0.05 } },
  antibioticos: { name: "Antibióticos", era: "eletrica", year: 1945, cost: 110, requires: ["saneamento"], description: "Hospitais atendem 20% mais gente.", mods: { health: 0.2 } },
  policia_cientifica: { name: "Polícia científica", era: "eletrica", year: 1950, cost: 110, requires: ["radio"], description: "Perícia e rádio-patrulha: −15% de crime.", mods: { crime: -0.15 } },
  // ── Era Atômica ──
  energia_nuclear: { name: "Energia nuclear", era: "atomica", year: 1960, cost: 220, requires: ["eletrificacao"], description: "Libera a usina nuclear (120 MW).", unlocks: ["nuclear_plant"] },
  revolucao_verde: { name: "Revolução verde", era: "atomica", year: 1965, cost: 200, requires: ["fertilizantes"], description: "Sementes melhoradas: +25% de comida.", mods: { farm: 0.25 } },
  engenharia_trafego: { name: "Engenharia de tráfego", era: "atomica", year: 1965, cost: 180, requires: ["locomotiva"], description: "Semáforos e viadutos: +25% de capacidade das vias.", mods: { traffic: 0.25 } },
  conteineres: { name: "Contêineres", era: "atomica", year: 1968, cost: 200, requires: ["linha_montagem"], description: "Logística padronizada: +10% de bens e +5% de impostos; 4% dos empregos industriais somem.", mods: { goods: 0.1, tax: 0.05, automation: 0.04 } },
  televisao: { name: "Televisão", era: "atomica", year: 1970, cost: 180, requires: ["radio"], description: "Propaganda e consumo: +5% de impostos.", mods: { tax: 0.05 } },
  computadores: { name: "Computadores", era: "atomica", year: 1975, cost: 260, requires: ["televisao"], description: "Prefeitura informatizada: +20% de pesquisa e −5% de manutenção; 5% dos empregos industriais somem.", mods: { research: 0.2, upkeep: -0.05, automation: 0.05 } },
  // ── Era Digital ──
  internet: { name: "Internet", era: "digital", year: 1990, cost: 400, requires: ["computadores"], description: "+20% de pesquisa e +5% de impostos.", mods: { research: 0.2, tax: 0.05 } },
  reciclagem: { name: "Reciclagem", era: "digital", year: 1990, cost: 350, requires: ["conteineres"], description: "Libera o centro de reciclagem e reduz 10% da poluição.", mods: { pollution: -0.1 }, unlocks: ["recycling_center"] },
  energia_solar: { name: "Energia solar", era: "digital", year: 1995, cost: 420, requires: ["eletrificacao", "computadores"], description: "Libera a usina solar (limpa).", unlocks: ["solar_plant"] },
  automacao: { name: "Automação industrial", era: "digital", year: 2000, cost: 480, requires: ["linha_montagem", "computadores"], description: "Robôs nas fábricas: +25% de bens e +15% de refino; 20% dos empregos industriais somem.", mods: { goods: 0.25, refine: 0.15, automation: 0.2 } },
  biotecnologia: { name: "Biotecnologia", era: "digital", year: 2005, cost: 500, requires: ["antibioticos", "revolucao_verde"], description: "+20% de comida e +15% de saúde.", mods: { farm: 0.2, health: 0.15 } },
  cidade_inteligente: { name: "Cidade inteligente", era: "digital", year: 2015, cost: 650, requires: ["internet"], description: "Sensores e dados: −10% de manutenção, +15% nas vias, −10% de crime.", mods: { upkeep: -0.1, traffic: 0.15, crime: -0.1 } },
  // ── Era Verde ──
  carros_eletricos: { name: "Carros elétricos", era: "verde", year: 2030, cost: 900, requires: ["cidade_inteligente"], description: "−20% de poluição.", mods: { pollution: -0.2 } },
  baterias: { name: "Baterias de grafeno", era: "verde", year: 2035, cost: 950, requires: ["energia_solar"], description: "Energia guardada: +20% de energia.", mods: { power: 0.2 } },
  agricultura_vertical: { name: "Agricultura vertical", era: "verde", year: 2040, cost: 1000, requires: ["biotecnologia"], description: "Fazendas em prédios: +30% de comida e +10% de água.", mods: { farm: 0.3, water: 0.1 } },
  agua_do_futuro: { name: "Água do futuro", era: "verde", year: 2045, cost: 1100, requires: ["baterias"], description: "Captação e reúso total: +30% de água.", mods: { water: 0.3 } },
  inteligencia_artificial: { name: "Inteligência artificial", era: "verde", year: 2050, cost: 1400, requires: ["internet", "automacao"], description: "+30% de pesquisa e −10% de manutenção; 15% dos empregos industriais somem.", mods: { research: 0.3, upkeep: -0.1, automation: 0.15 } },
  medicina_regenerativa: { name: "Medicina regenerativa", era: "verde", year: 2055, cost: 1300, requires: ["biotecnologia"], description: "Hospitais atendem 30% mais gente.", mods: { health: 0.3 } },
  // ── Era do Futuro ──
  fusao: { name: "Fusão nuclear", era: "futuro", year: 2070, cost: 2500, requires: ["energia_nuclear", "inteligencia_artificial"], description: "Libera o reator de fusão (400 MW, sem combustível).", unlocks: ["fusion_plant"] },
  nanotecnologia: { name: "Nanotecnologia", era: "futuro", year: 2075, cost: 2600, requires: ["automacao", "inteligencia_artificial"], description: "+30% de refino e +20% de minério.", mods: { refine: 0.3, ore: 0.2 } },
  engenharia_climatica: { name: "Engenharia climática", era: "futuro", year: 2080, cost: 3000, requires: ["carros_eletricos", "fusao"], description: "Desastres 40% mais fracos e −20% de poluição.", mods: { disaster: -0.4, pollution: -0.2 } },
  logistica_quantica: { name: "Logística quântica", era: "futuro", year: 2085, cost: 3200, requires: ["nanotecnologia"], description: "+20% de bens e +30% nas vias.", mods: { goods: 0.2, traffic: 0.3 } },
  pos_escassez: { name: "Economia pós-escassez", era: "futuro", year: 2095, cost: 4500, requires: ["fusao", "nanotecnologia", "engenharia_climatica"], description: "+15% de impostos e −15% de manutenção.", mods: { tax: 0.15, upkeep: -0.15 } },
  arcologias: { name: "Arcologias", era: "futuro", year: 2100, cost: 6000, requires: ["pos_escassez"], description: "Cidades verticais: +3 lotes crescem por ciclo.", mods: { growth: 3 } },
  irrigacao: { name: "Irrigação", era: "industrial", year: 1902, cost: 18, requires: [], description: "Canais e açudes: +8% de comida.", mods: { farm: 0.08 } },
  telegrafo: { name: "Telégrafo", era: "industrial", year: 1906, cost: 26, requires: ["imprensa"], description: "Notícia e pedido de longe: +5% de pesquisa e frete 3% mais barato.", mods: { research: 0.05, trade: 0.03 } },
  vacinas: { name: "Vacinas", era: "industrial", year: 1908, cost: 28, requires: ["saneamento"], description: "Menos crianças doentes: +10% de saúde e 5% mais nascimentos.", mods: { health: 0.1, births: 0.05 } },
  escola_publica: { name: "Escola pública", era: "industrial", year: 1910, cost: 32, requires: ["imprensa"], description: "Ensino para todos: QE alvo +6.", mods: { eq: 6 } },
  mineracao_mecanizada: { name: "Mineração mecanizada", era: "industrial", year: 1914, cost: 40, requires: ["maquina_vapor"], description: "Perfuratrizes a vapor: +10% de minério.", mods: { ore: 0.1 } },
  bombeiros_modernos: { name: "Bombeiros modernos", era: "industrial", year: 1918, cost: 35, requires: ["saneamento"], description: "Carros-pipa e escadas: desastres 10% mais fracos.", mods: { disaster: -0.1 } },
  concreto: { name: "Concreto armado", era: "industrial", year: 1920, cost: 50, requires: ["aco"], description: "Obras duram mais: manutenção 4% mais barata.", mods: { upkeep: -0.04 } },
  telefone: { name: "Telefone", era: "industrial", year: 1925, cost: 55, requires: ["telegrafo"], description: "Negócios por fio: +3% de impostos e +5% de pesquisa.", mods: { tax: 0.03, research: 0.05 } },
  ensino_secundario: { name: "Ensino secundário", era: "eletrica", year: 1932, cost: 75, requires: ["escola_publica"], description: "Mais anos de estudo: QE alvo +8.", mods: { eq: 8 } },
  tratores: { name: "Tratores", era: "eletrica", year: 1938, cost: 85, requires: ["fertilizantes"], description: "Máquinas no campo: +12% de comida.", mods: { farm: 0.12 } },
  aviacao_comercial: { name: "Aviação comercial", era: "eletrica", year: 1942, cost: 100, requires: ["locomotiva"], description: "Frete aéreo: frete 4% mais barato e +5% nas vias.", mods: { trade: 0.04, traffic: 0.05 } },
  previdencia_social: { name: "Previdência social", era: "eletrica", year: 1946, cost: 100, requires: ["antibioticos"], description: "Famílias mais seguras: +8% de nascimentos e +5% de saúde.", mods: { births: 0.08, health: 0.05 } },
  eletrodomesticos: { name: "Eletrodomésticos", era: "eletrica", year: 1950, cost: 100, requires: ["eletrificacao"], description: "Geladeira e fogão elétrico: +4% de impostos.", mods: { tax: 0.04 } },
  plasticos: { name: "Plásticos", era: "eletrica", year: 1952, cost: 110, requires: ["linha_montagem"], description: "Bens baratos, porém sujos: +10% de bens e +5% de poluição.", mods: { goods: 0.1, pollution: 0.05 } },
  rodovias_modernas: { name: "Rodovias modernas", era: "eletrica", year: 1955, cost: 120, requires: ["locomotiva"], description: "Estradas largas: +10% nas vias e frete 4% mais barato.", mods: { traffic: 0.1, trade: 0.04 } },
  universidade_publica: { name: "Universidade pública", era: "eletrica", year: 1958, cost: 130, requires: ["ensino_secundario"], description: "Pesquisa e diploma: QE alvo +8 e +10% de pesquisa.", mods: { eq: 8, research: 0.1 } },
  satelites: { name: "Satélites", era: "atomica", year: 1972, cost: 200, requires: ["televisao"], description: "Telecomunicação global: +5% de pesquisa e frete 5% mais barato.", mods: { research: 0.05, trade: 0.05 } },
  petroquimica: { name: "Petroquímica", era: "atomica", year: 1968, cost: 210, requires: ["plasticos"], description: "Combustíveis e resinas: +12% de bens e +6% de poluição.", mods: { goods: 0.12, pollution: 0.06 } },
  turbinas_eficientes: { name: "Turbinas eficientes", era: "atomica", year: 1970, cost: 190, requires: ["eletrificacao"], description: "Mais energia com a mesma água e vento: +10% de energia.", mods: { power: 0.1 } },
  inspecao_ambiental: { name: "Inspeção ambiental", era: "atomica", year: 1972, cost: 170, requires: ["saneamento"], description: "Fiscais do ar e da água: 8% menos poluição.", mods: { pollution: -0.08 } },
  tomografia: { name: "Diagnóstico por imagem", era: "atomica", year: 1975, cost: 230, requires: ["antibioticos", "computadores"], description: "Exames precisos: hospitais atendem 10% mais gente.", mods: { health: 0.1 } },
  educacao_tecnica: { name: "Educação técnica", era: "atomica", year: 1978, cost: 220, requires: ["universidade_publica"], description: "Escolas de ofício: QE alvo +6 e +4% de bens.", mods: { eq: 6, goods: 0.04 } },
  robotica_inicial: { name: "Robótica inicial", era: "atomica", year: 1984, cost: 280, requires: ["computadores"], description: "Braços mecânicos: +10% de bens; 6% dos empregos industriais somem.", mods: { goods: 0.1, automation: 0.06 } },
  engenharia_genetica: { name: "Engenharia genética", era: "atomica", year: 1985, cost: 300, requires: ["revolucao_verde"], description: "Plantas mais fortes: +12% de comida.", mods: { farm: 0.12 } },
  comercio_eletronico: { name: "Comércio eletrônico", era: "digital", year: 1996, cost: 430, requires: ["internet"], description: "Lojas na rede: +6% de impostos e frete 5% mais barato.", mods: { tax: 0.06, trade: 0.05 } },
  telemedicina: { name: "Telemedicina", era: "digital", year: 2002, cost: 460, requires: ["internet", "antibioticos"], description: "Consulta à distância: hospitais atendem 12% mais gente.", mods: { health: 0.12 } },
  ensino_distancia: { name: "Ensino a distância", era: "digital", year: 2004, cost: 450, requires: ["internet", "universidade_publica"], description: "Aulas pela rede: QE alvo +8 e +5% de pesquisa.", mods: { eq: 8, research: 0.05 } },
  logistica_gps: { name: "Logística por GPS", era: "digital", year: 2006, cost: 470, requires: ["satelites", "internet"], description: "Rotas inteligentes: +12% nas vias e frete 4% mais barato.", mods: { traffic: 0.12, trade: 0.04 } },
  rede_inteligente: { name: "Rede elétrica inteligente", era: "digital", year: 2010, cost: 560, requires: ["energia_solar", "internet"], description: "Menos desperdício: +10% de energia e manutenção 3% mais barata.", mods: { power: 0.1, upkeep: -0.03 } },
  analise_de_dados: { name: "Análise de dados policial", era: "digital", year: 2012, cost: 560, requires: ["internet", "policia_cientifica"], description: "Patrulha por mapa de crime: 10% menos crime.", mods: { crime: -0.1 } },
  impressao_3d: { name: "Impressão 3D", era: "digital", year: 2018, cost: 600, requires: ["automacao"], description: "Peças sob demanda: +8% de bens e +5% de refino.", mods: { goods: 0.08, refine: 0.05 } },
  tratamento_avancado: { name: "Tratamento avançado de água", era: "digital", year: 2020, cost: 620, requires: ["reciclagem", "saneamento"], description: "Esgoto virando água limpa: +10% de água e 8% menos poluição.", mods: { water: 0.1, pollution: -0.08 } },
  eolica_offshore: { name: "Eólica no mar", era: "verde", year: 2038, cost: 900, requires: ["baterias"], description: "Parques de vento em alto-mar: +10% de energia.", mods: { power: 0.1 } },
  cidade_15_minutos: { name: "Cidade de 15 minutos", era: "verde", year: 2042, cost: 980, requires: ["cidade_inteligente"], description: "Tudo perto de casa: +15% nas vias e 10% menos poluição.", mods: { traffic: 0.15, pollution: -0.1 } },
  edicao_genomica: { name: "Edição genômica", era: "verde", year: 2048, cost: 1150, requires: ["biotecnologia"], description: "Doenças hereditárias curadas: +10% de saúde e 8% mais nascimentos.", mods: { health: 0.1, births: 0.08 } },
  educacao_personalizada: { name: "Educação personalizada", era: "verde", year: 2052, cost: 1200, requires: ["inteligencia_artificial"], description: "Tutores de IA: QE alvo +12.", mods: { eq: 12 } },
  economia_circular: { name: "Economia circular", era: "verde", year: 2056, cost: 1250, requires: ["reciclagem", "carros_eletricos"], description: "Nada vira lixo: 15% menos poluição e +5% de bens.", mods: { pollution: -0.15, goods: 0.05 } },
  reflorestamento: { name: "Reflorestamento em massa", era: "verde", year: 2060, cost: 1100, requires: ["carros_eletricos"], description: "Florestas urbanas: 10% menos poluição e desastres 10% mais fracos.", mods: { pollution: -0.1, disaster: -0.1 } },
  fazendas_autonomas: { name: "Fazendas autônomas", era: "verde", year: 2064, cost: 1500, requires: ["agricultura_vertical", "inteligencia_artificial"], description: "Colheita sem gente: +20% de comida; 10% dos empregos industriais somem.", mods: { farm: 0.2, automation: 0.1 } },
  computacao_quantica: { name: "Computação quântica", era: "futuro", year: 2072, cost: 2500, requires: ["inteligencia_artificial"], description: "Simulações impossíveis: +40% de pesquisa.", mods: { research: 0.4 } },
  cidades_flutuantes: { name: "Cidades flutuantes", era: "futuro", year: 2078, cost: 2800, requires: ["nanotecnologia"], description: "Expansão sobre a água: desastres 20% mais fracos e +1 lote por ciclo.", mods: { disaster: -0.2, growth: 1 } },
  elevador_orbital: { name: "Elevador orbital", era: "futuro", year: 2088, cost: 3400, requires: ["logistica_quantica"], description: "Frete até o espaço: frete 10% mais barato e +10% de bens.", mods: { trade: 0.1, goods: 0.1 } },
  longevidade: { name: "Longevidade", era: "futuro", year: 2090, cost: 3600, requires: ["medicina_regenerativa", "nanotecnologia"], description: "Viver 120 anos: +20% de saúde e 10% mais nascimentos.", mods: { health: 0.2, births: 0.1 } },
  governanca_algoritmica: { name: "Governança algorítmica", era: "futuro", year: 2092, cost: 3800, requires: ["computacao_quantica"], description: "A prefeitura decide com dados: manutenção 10% mais barata e 15% menos crime.", mods: { upkeep: -0.1, crime: -0.15 } },
  terraformacao_local: { name: "Terraformação local", era: "futuro", year: 2096, cost: 5000, requires: ["engenharia_climatica", "nanotecnologia"], description: "O clima sob controle: +30% de comida e +20% de água.", mods: { farm: 0.3, water: 0.2 } },
};

export const TECH_IDS = Object.keys(TECHS);

/** Soma dos modificadores das tecnologias pesquisadas. */
export function techMods(s: Pick<CityState, "techs"> & Partial<Pick<CityState, "council" | "ordinances">>): TechMods {
  const out: TechMods = { ...NO_MODS };
  // Leis municipais somam aos efeitos das tecnologias.
  const lm = lawMods(s);
  for (const k of Object.keys(lm) as (keyof TechMods)[]) out[k] += lm[k] ?? 0;
  // Decretos ativos também.
  const om = ordinanceMods(s);
  for (const k of Object.keys(om) as (keyof TechMods)[]) out[k] += om[k] ?? 0;
  for (const id of s.techs ?? []) {
    const m = TECHS[id]?.mods;
    if (!m) continue;
    for (const k of Object.keys(m) as (keyof TechMods)[]) out[k] += m[k] ?? 0;
  }
  return out;
}

export const hasTech = (s: Pick<CityState, "techs">, id: string) => (s.techs ?? []).includes(id);

/** Por que a tecnologia não pode ser pesquisada agora (null = pode). */
export function techLock(s: CityState, id: string): string | null {
  const t = TECHS[id];
  if (!t) return "Tecnologia desconhecida";
  if (hasTech(s, id)) return "Já pesquisada";
  const missing = t.requires.filter((r) => !hasTech(s, r));
  if (missing.length) return `Requer: ${missing.map((r) => TECHS[r].name).join(", ")}`;
  if (cityYear(s) < t.year) return `Disponível em ${t.year}`;
  return null;
}

/**
 * Pontos de pesquisa por ciclo: educação da população, escolas, faculdades, bibliotecas e
 * museus, multiplicados pelo Rank do foco e pelas tecnologias de pesquisa.
 */
export function researchPerCycle(s: CityState, rank: Rank = "D"): number {
  const count = (t: BuildingType) => s.buildings.filter((b) => b.type === t && !isDown(b, s)).length;
  const base =
    1 +
    s.population * ((s.eq ?? 40) / 100) * 0.04 +
    count("school") * 1.5 +
    count("college") * 5 +
    count("university") * 14 +
    count("library") * 1 +
    count("incubator") * 2 +
    count("museum") * 2;
  return Math.round(base * RANK_YIELD[rank] * (1 + techMods(s).research) * 10) / 10;
}

/** Adiciona os pontos do ciclo à pesquisa em andamento e conclui o que der. Muta `s`. */
export function advanceResearch(s: CityState, points: number): string[] {
  s.research ??= { target: null, progress: 0 };
  s.research.progress = Math.round((s.research.progress + points) * 10) / 10;
  const done: string[] = [];
  // Pontos sem alvo ficam guardados (são usados quando o jogador escolher o que pesquisar).
  while (s.research.target) {
    const t = TECHS[s.research.target];
    if (!t || hasTech(s, s.research.target)) {
      s.research.target = null;
      break;
    }
    if (s.research.progress < t.cost) break;
    s.research.progress = Math.round((s.research.progress - t.cost) * 10) / 10;
    s.techs = [...(s.techs ?? []), s.research.target];
    done.push(s.research.target);
    s.research.target = null;
  }
  return done;
}

/** Pontuação de avanço (ranking online): tecnologia pesa mais; população e valor também contam. */
export function advancementScore(s: CityState, cityValue: number): number {
  const techPoints = (s.techs ?? []).reduce((acc, id) => acc + (TECHS[id]?.cost ?? 0), 0);
  return Math.round((s.techs?.length ?? 0) * 500 + techPoints * 2 + s.population * 3 + cityValue / 20);
}

/** Era atual da cidade (pela tecnologia mais avançada ou pelo ano). */
export function currentEra(s: CityState): (typeof ERAS)[number] {
  const year = cityYear(s);
  let era = ERAS[0];
  for (const e of ERAS) if (year >= e.from) era = e;
  return era;
}

/** Só disputa o ranking a cidade que nunca sofreu catástrofe (ciclo quebrado). */
export function rankEligible(s: Pick<CityState, "disasterCount"> & Partial<Pick<CityState, "ended">>): boolean {
  return (s.disasterCount ?? 0) === 0 && !s.ended;
}
