// Leis municipais: a câmara de vereadores propõe, o prefeito aprova ou veta. Cada lei liga a uma
// mecânica que já existe (trabalho, impostos, poluição, saúde, segurança, aposentadoria…).

import type { TechMods } from "./tech";
import type { CityState } from "./types";

/**
 * Espectro político, da esquerda para a direita. O Fascista só entra na disputa em tempos de crise
 * (greve geral, aprovação despencando, caixa no vermelho, desastre, desemprego ou crime altos).
 */
export type PartyId = "esquerda" | "socialdemocrata" | "centro" | "liberal" | "conservador" | "fascista";
export const PARTY_IDS: PartyId[] = ["esquerda", "socialdemocrata", "centro", "liberal", "conservador", "fascista"];

export const PARTIES: Record<PartyId, { name: string; short: string; color: string; ideology: string; position: number; crisisOnly?: boolean }> = {
  esquerda: { name: "Esquerda Radical", short: "ER", color: "#c0392b", ideology: "Os trabalhadores no poder: jornada curta, salário mínimo, fiscalização e imposto sobre os grandes.", position: -2 },
  socialdemocrata: { name: "Social Democrata", short: "SD", color: "#e8708a", ideology: "Estado de bem-estar: saúde, escola, pensão, ar limpo e renda para todos.", position: -1 },
  centro: { name: "Centro", short: "CE", color: "#e8c040", ideology: "Pragmatismo: participação, parcerias, gestão e energia limpa.", position: 0 },
  liberal: { name: "Liberal", short: "LB", color: "#4a8fd8", ideology: "Menos Estado: impostos baixos, livre comércio, jornada flexível e menos burocracia.", position: 1 },
  conservador: { name: "Conservador", short: "CV", color: "#2f4f8f", ideology: "Ordem, família e contas em dia: segurança, austeridade e incentivo à família.", position: 2 },
  fascista: { name: "Fascista", short: "FA", color: "#4a3a32", ideology: "Surge na crise: promete ordem a qualquer custo, com repressão e sem greves.", position: 3, crisisOnly: true },
};

export interface Councillor {
  id: number;
  party: PartyId;
}

export interface Bill {
  id: number;
  law: LawId;
  party: PartyId;
  /** Vereador que propôs. */
  proposer: number;
  /** Ciclo da proposta. */
  cycle: number;
}

export interface CouncilState {
  members: Councillor[];
  /** Ciclo da última eleição. */
  electedAt: number;
  laws: LawId[];
  bills: Bill[];
  nextBillId: number;
  /** Prestígio de cada partido com o prefeito: +1 por lei aprovada, −1 por veto (−5..5). */
  standing: Record<PartyId, number>;
  /** Últimas decisões e eleições (mais recentes por último). */
  history: { cycle: number; text: string }[];
}

export const EMPTY_COUNCIL: CouncilState = {
  members: [],
  electedAt: 0,
  laws: [],
  bills: [],
  nextBillId: 1,
  standing: { esquerda: 0, socialdemocrata: 0, centro: 0, liberal: 0, conservador: 0, fascista: 0 },
  history: [],
};

export const newCouncil = (): CouncilState => structuredClone(EMPTY_COUNCIL);


export type LawId =
  | "jornada_8h"
  | "salario_minimo"
  | "fiscalizacao"
  | "taxar_grandes_empresas"
  | "saude_universal"
  | "merenda_escolar"
  | "pensao_universal"
  | "renda_basica"
  | "arborizacao"
  | "taxa_carbono"
  | "orcamento_participativo"
  | "parceria_publico_privada"
  | "reforma_administrativa"
  | "energia_limpa"
  | "isencao_industria"
  | "jornada_flexivel"
  | "livre_comercio"
  | "desburocratizacao"
  | "toque_recolher"
  | "guarda_municipal"
  | "austeridade"
  | "incentivo_familia"
  | "estado_de_excecao"
  | "proibicao_greves"
  | "cooperativas_trabalhadores"
  | "fabricas_recuperadas"
  | "banco_cooperativo"
  | "reforma_agraria"
  | "tarifa_zero"
  | "participacao_lucros"
  | "grandes_fortunas"
  | "descanso_remunerado"
  | "moradia_publica"
  | "estatizacao_energia"
  | "seguro_desemprego"
  | "creche_publica"
  | "escola_integral"
  | "vacinacao_massa"
  | "ciclovias"
  | "microcredito_solidario"
  | "licenca_parental"
  | "restaurante_popular"
  | "habitacao_social"
  | "incubadora_municipal"
  | "governo_digital"
  | "coleta_seletiva"
  | "conselhos_bairro"
  | "plano_diretor"
  | "conciliacao_trabalhista"
  | "convenio_universidades"
  | "consorcio_intermunicipal"
  | "fundo_cultura"
  | "microempreendedor"
  | "credito_pequenos_negocios"
  | "polo_startups"
  | "imposto_simplificado"
  | "feira_empreendedores"
  | "privatizacao_servicos"
  | "terceirizacao"
  | "zona_franca"
  | "comercio_24h"
  | "credito_rural"
  | "negocio_familiar"
  | "disciplina_escolar"
  | "reforco_policial"
  | "auxilio_casamento"
  | "responsabilidade_fiscal"
  | "protecao_propriedade"
  | "festas_tradicionais"
  | "corporativismo_estado"
  | "propaganda_oficial"
  | "guarda_nacional"
  | "controle_imprensa"
  | "economia_de_guerra"
  | "vigilancia_total"
  | "teto_salarial"
  | "comissao_fabrica"
  | "biblioteca_bairro"
  | "preco_alimentos"
  | "nacionalizar_minas"
  | "bolsa_estudante"
  | "atencao_basica"
  | "parques_lineares"
  | "centro_dia_idoso"
  | "selo_qualidade"
  | "hortas_urbanas"
  | "transporte_integrado"
  | "ouvidoria_publica"
  | "importacao_livre"
  | "liberdade_economica"
  | "mercado_carbono"
  | "dados_abertos_mercado"
  | "valorizacao_professor"
  | "escola_militar"
  | "lavoura_familiar"
  | "previdencia_incentivada"
  | "registro_cidadaos"
  | "culto_lider"
  | "rearmamento"
  | "milicia_urbana"
  | "imposto_heranca"
  | "contribuicao_solidaria"
  | "pedagio_urbano"
  | "concessao_servicos"
  | "taxa_lixo"
  | "subsidio_empresarial"
  | "reducao_imposto_comercio"
  | "fundo_garantidor"
  | "pensao_viuvas"
  | "imposto_predial"
  | "licenca_armas"
  | "venda_terras_publicas"
  | "juventude_partido"
  | "obras_monumentais"
  | "policia_secreta"
  | "confisco_bens"
  | "imposto_guerra"
  | "trabalho_obrigatorio"
  | "expropriacao_empresas"
  | "banco_do_estado";

export interface LawDef {
  party: PartyId;
  name: string;
  description: string;
  /** Efeitos somados aos das tecnologias (frações). */
  mods?: Partial<TechMods>;
  /** Humor: dos trabalhadores empregados e de todos. */
  moodWorkers?: { text: string; delta: number };
  moodAll?: { text: string; delta: number };
  /** Jornada máxima (horas): aprovar leva todos os setores a, no máximo, esse valor. */
  hoursCap?: 8;
  /** Fiscais de fábrica em toda a cidade, sem precisar do prédio. */
  inspection?: boolean;
  /** Mudança do imposto industrial (fração; negativo = imposto maior). */
  taxIndustry?: number;
  /** Desconto de frete (fração). */
  trade?: number;
  /** QE alvo a mais. */
  eq?: number;
  /** Todo aposentado tem renda de aposentadoria. */
  pensionAll?: boolean;
  /** Mais nascimentos (fração a mais na chance de filhos). */
  births?: number;
  /** Greves proibidas: ninguém para de trabalhar por causa. */
  noStrike?: boolean;
  /** Empreendedorismo: força com que moradores sem emprego abrem o próprio negócio (0..1; ver business.ts). */
  entrepreneur?: number;
  /** Cooperativismo: força com que moradores sem emprego formam cooperativas (0..1; ver business.ts). */
  coop?: number;
  /** Custo por ciclo para o caixa. */
  cost?: (s: Pick<CityState, "population" | "citizens" | "people" | "cyclesCompleted" | "pension">, retirees: number) => number;
}

const perPop = (k: number) => (s: { population: number }) => Math.ceil(s.population * k);
/** Receita por ciclo (custo negativo): multas, taxas e contribuições que a lei arrecada. */
const earn = (k: number) => (s: { population: number }) => -Math.ceil(s.population * k);

export const LAWS: Record<LawId, LawDef> = {
  // ── Esquerda Radical ──
  jornada_8h: {
    party: "esquerda",
    name: "Jornada máxima de 8 horas",
    description: "Nenhum setor passa de 8 horas por dia (jornadas longas voltam a 8 h). Trabalhadores descansados consomem mais: +2% de arrecadação e mais contentes, mas o ganho de produção de jornadas longas some. Efeito extra: 3% mais bens.",
    hoursCap: 8,
    moodWorkers: { text: "Jornada limitada por lei", delta: 1 },
    mods: { tax: 0.02, goods: 0.03 },
  },
  salario_minimo: {
    party: "esquerda",
    name: "Salário mínimo municipal",
    description: "Piso salarial: trabalhadores contentes (+1 de humor) e mais imposto sobre a renda (+3% de arrecadação), mas as fábricas produzem 5% menos bens.",
    moodWorkers: { text: "Salário mínimo", delta: 1 },
    mods: { goods: -0.05, tax: 0.03 },
  },
  fiscalizacao: {
    party: "esquerda",
    name: "Fiscalização obrigatória do trabalho",
    description: "Fiscais em toda a cidade, sem precisar do prédio: humor e desgaste dos trabalhadores pela metade, e o ganho de jornada longa também. As multas aplicadas rendem uma receita por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    inspection: true,
    cost: earn(0.08),
    moodAll: { text: "Fiscalização obrigatória do trabalho (impopular)", delta: -1 },
    mods: { goods: -0.03 },
  },
  taxar_grandes_empresas: {
    party: "esquerda",
    name: "Imposto sobre grandes empresas",
    description: "A indústria paga 25% a mais de imposto, mas produz 4% menos bens. Efeito extra: −1 de humor para todos (medida impopular).",
    taxIndustry: -0.25,
    mods: { goods: -0.04 },
    moodAll: { text: "Imposto sobre grandes empresas (impopular)", delta: -1 },
  },
  // ── Social Democrata ──
  saude_universal: {
    party: "socialdemocrata",
    name: "Saúde universal",
    description: "Os hospitais atendem 25% mais gente, ao custo de uma verba por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% mais bens.",
    cost: perPop(0.2),
    moodAll: { text: "Saúde universal (impopular)", delta: -1 },
    mods: { health: 0.25, goods: 0.03 },
  },
  merenda_escolar: {
    party: "socialdemocrata",
    name: "Merenda escolar",
    description: "Alunos bem alimentados aprendem mais: QE alvo +5, ao custo de uma verba por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% mais bens.",
    eq: 5,
    cost: perPop(0.12),
    moodAll: { text: "Merenda escolar (impopular)", delta: -1 },
    mods: { goods: 0.03 },
  },
  pensao_universal: {
    party: "socialdemocrata",
    name: "Pensão universal",
    description: "Todo aposentado recebe uma renda mínima ($3 por ciclo), mesmo sem previdência. Evita a tristeza dos sem renda, mas custa por aposentado. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    pensionAll: true,
    cost: (_s, retirees) => retirees * 3,
    moodAll: { text: "Pensão universal", delta: 1 },
    mods: { goods: 0.03 },
  },
  renda_basica: {
    party: "socialdemocrata",
    name: "Renda básica",
    description: "Uma renda mínima para todos: +1 de humor para todos, ao custo de uma verba por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Renda básica", delta: 1 },
    cost: perPop(0.25),
    mods: { goods: 0.03 },
  },
  arborizacao: {
    party: "socialdemocrata",
    name: "Arborização urbana",
    description: "Ruas e praças cheias de árvores: todos ficam um pouco mais felizes (+1), ao custo de uma verba por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Cidade arborizada", delta: 1 },
    cost: perPop(0.15),
    mods: { goods: 0.03 },
  },
  taxa_carbono: {
    party: "socialdemocrata",
    name: "Taxa de carbono",
    description: "A indústria paga para poluir: 20% menos poluição e 4% menos bens, e a taxa rende uma receita por ciclo. Efeito extra: −1 de humor para todos (medida impopular).",
    cost: earn(0.1),
    mods: { pollution: -0.2, goods: -0.04 },
    moodAll: { text: "Taxa de carbono (impopular)", delta: -1 },
  },
  // ── Centro ──
  orcamento_participativo: {
    party: "centro",
    name: "Orçamento participativo",
    description: "Os moradores decidem parte das obras: +1 de humor para todos, com uma pequena verba por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Orçamento participativo", delta: 1 },
    cost: perPop(0.08),
    mods: { goods: 0.03 },
  },
  parceria_publico_privada: {
    party: "centro",
    name: "Parcerias público-privadas",
    description: "A iniciativa privada ajuda a tocar obras: manutenção 6% mais barata e vias 10% mais fluidas. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Parcerias público-privadas (impopular)", delta: -1 },
    mods: { upkeep: -0.06, traffic: 0.1, goods: -0.03 },
  },
  reforma_administrativa: {
    party: "centro",
    name: "Reforma administrativa",
    description: "Prefeitura mais enxuta e moderna: manutenção 5% mais barata e 5% mais pesquisa. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Reforma administrativa (impopular)", delta: -1 },
    mods: { upkeep: -0.05, research: 0.05, goods: -0.03 },
  },
  energia_limpa: {
    party: "centro",
    name: "Incentivo à energia limpa",
    description: "As usinas geram 6% a mais, com um pequeno custo por ciclo em subsídios. Efeito extra: +1 de humor para todos.",
    cost: perPop(0.1),
    mods: { power: 0.06 },
    moodAll: { text: "Incentivo à energia limpa", delta: 1 },
  },
  // ── Liberal ──
  isencao_industria: {
    party: "liberal",
    name: "Isenção para a indústria",
    description: "Imposto industrial 25% menor e 8% mais bens, pensando em atrair fábricas. Efeito extra: +1 de humor para todos.",
    taxIndustry: 0.25,
    mods: { goods: 0.08 },
    moodAll: { text: "Isenção para a indústria", delta: 1 },
  },
  jornada_flexivel: {
    party: "liberal",
    name: "Jornada flexível",
    description: "Empresas negociam horários: +4% de bens e de refino e +2% de arrecadação, mas os trabalhadores ficam mais cansados (−1 de humor).",
    moodWorkers: { text: "Jornada flexível (banco de horas)", delta: -1 },
    mods: { goods: 0.04, refine: 0.04, tax: 0.02 },
  },
  livre_comercio: {
    party: "liberal",
    name: "Zona de livre comércio",
    description: "O frete fica 6% mais barato nas importações e sobe o preço de venda. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    trade: 0.06,
    moodAll: { text: "Zona de livre comércio (impopular)", delta: -1 },
    mods: { goods: -0.03 },
  },
  desburocratizacao: {
    party: "liberal",
    name: "Desburocratização",
    description: "Alvarás rápidos: um lote a mais cresce por ciclo e a manutenção cai 3%. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Desburocratização (impopular)", delta: -1 },
    mods: { growth: 1, upkeep: -0.03, goods: -0.03 },
  },
  // ── Conservador ──
  toque_recolher: {
    party: "conservador",
    name: "Toque de recolher",
    description: "20% menos crime, e as multas de quem desobedece rendem uma receita por ciclo, mas ninguém gosta de ser vigiado (−1 de humor para todos). Efeito extra: 3% menos bens.",
    moodAll: { text: "Toque de recolher", delta: -1 },
    cost: earn(0.06),
    mods: { crime: -0.2, goods: -0.03 },
  },
  guarda_municipal: {
    party: "conservador",
    name: "Guarda municipal",
    description: "Patrulhas nas ruas: 15% menos crime, ao custo de uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    cost: perPop(0.15),
    moodAll: { text: "Guarda municipal", delta: 1 },
    mods: { crime: -0.15, goods: 0.03 },
  },
  austeridade: {
    party: "conservador",
    name: "Lei de austeridade",
    description: "Cortes em toda a máquina: manutenção 10% mais barata, mas os hospitais atendem 10% menos. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Lei de austeridade (impopular)", delta: -1 },
    mods: { upkeep: -0.1, health: -0.1, goods: -0.03 },
  },
  incentivo_familia: {
    party: "conservador",
    name: "Incentivo à família",
    description: "Benefício para famílias com filhos: 40% mais nascimentos, ao custo de uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    births: 0.4,
    cost: perPop(0.1),
    moodAll: { text: "Incentivo à família", delta: 1 },
    mods: { goods: 0.03 },
  },
  // ── Fascista (só surge em crise) ──
  estado_de_excecao: {
    party: "fascista",
    name: "Estado de exceção",
    description: "Repressão total: 35% menos crime e confisco de bens que rende uma receita por ciclo, mas o medo derruba o humor de todos (−2). Efeito extra: 3% menos bens.",
    moodAll: { text: "Estado de exceção", delta: -2 },
    cost: earn(0.2),
    mods: { crime: -0.35, goods: -0.03 },
  },
  proibicao_greves: {
    party: "fascista",
    name: "Proibição de greves",
    description: "Ninguém para de trabalhar, nem com motivo (+3% de arrecadação). Os trabalhadores ficam revoltados (−1), mas as ruas calmas dão +1 de humor para todos e o problema continua embaixo do tapete. Efeito extra: 3% menos bens.",
    noStrike: true,
    moodWorkers: { text: "Greves proibidas", delta: -1 },
    moodAll: { text: "Ordem nas ruas", delta: 1 },
    mods: { tax: 0.03, goods: -0.03 },
  },
  milicia_urbana: {
    party: "fascista",
    name: "Milícia urbana",
    description: "Grupos armados patrulham as ruas: 25% menos crime e −1 de humor para todos, com uma verba por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Milícia nas ruas", delta: -1 },
    cost: perPop(0.2),
    mods: { crime: -0.25, goods: 0.03 },
  },

  // ── Esquerda Radical: cooperativas, trabalho e redistribuição ──
  cooperativas_trabalhadores: {
    party: "esquerda",
    name: "Cooperativas de trabalhadores",
    description: "A prefeitura apoia quem se junta para tocar o próprio negócio: moradores sem emprego fundam cooperativas, que dividem o lucro e resistem melhor às crises. Custa uma verba por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% mais bens.",
    coop: 1,
    cost: perPop(0.06),
    moodAll: { text: "Cooperativas de trabalhadores (impopular)", delta: -1 },
    mods: { goods: 0.03 },
  },
  fabricas_recuperadas: {
    party: "esquerda",
    name: "Fábricas recuperadas",
    description: "Trabalhadores assumem fábricas falidas, que voltam a pagar imposto: mais cooperativas, trabalhadores orgulhosos (+1) e 3% mais arrecadação, mas 2% menos bens.",
    coop: 0.6,
    moodWorkers: { text: "Fábrica nas mãos dos trabalhadores", delta: 1 },
    mods: { goods: -0.02, tax: 0.03 },
  },
  banco_cooperativo: {
    party: "esquerda",
    name: "Banco cooperativo",
    description: "Crédito sem juros abusivos para cooperativas: mais cooperados, com uma verba por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% mais bens.",
    coop: 0.5,
    cost: perPop(0.05),
    moodAll: { text: "Banco cooperativo (impopular)", delta: -1 },
    mods: { goods: 0.03 },
  },
  reforma_agraria: {
    party: "esquerda",
    name: "Reforma agrária",
    description: "Terra para quem planta: 10% mais comida das fazendas, com uma verba por ciclo. Efeito extra: −1 de humor para todos (medida impopular).",
    cost: perPop(0.1),
    mods: { farm: 0.1 },
    moodAll: { text: "Reforma agrária (impopular)", delta: -1 },
  },
  tarifa_zero: {
    party: "esquerda",
    name: "Tarifa zero no transporte",
    description: "Ônibus e trens gratuitos: as vias ficam 8% mais fluidas, ao custo de uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    cost: perPop(0.2),
    moodAll: { text: "Tarifa zero no transporte", delta: 1 },
    mods: { traffic: 0.08, goods: 0.03 },
  },
  participacao_lucros: {
    party: "esquerda",
    name: "Participação nos lucros",
    description: "Os trabalhadores levam parte do lucro e consomem mais: +1 de humor e 3% mais arrecadação, mas 3% menos bens.",
    moodWorkers: { text: "Participação nos lucros", delta: 1 },
    mods: { goods: -0.03, tax: 0.03 },
  },
  grandes_fortunas: {
    party: "esquerda",
    name: "Imposto sobre grandes fortunas",
    description: "Os ricos pagam mais: a indústria paga 15% a mais de imposto e a arrecadação geral sobe 4%, mas 2% menos bens. Efeito extra: −1 de humor para todos (medida impopular).",
    taxIndustry: -0.15,
    mods: { tax: 0.04, goods: -0.02 },
    moodAll: { text: "Imposto sobre grandes fortunas (impopular)", delta: -1 },
  },
  descanso_remunerado: {
    party: "esquerda",
    name: "Descanso semanal remunerado",
    description: "Folga paga para todos: +1 de humor dos trabalhadores e 2% menos bens, com uma verba por ciclo.",
    moodWorkers: { text: "Descanso remunerado", delta: 1 },
    mods: { goods: -0.02 },
    cost: perPop(0.08),
  },
  moradia_publica: {
    party: "esquerda",
    name: "Moradia pública",
    description: "A prefeitura constrói casas populares: +1 de humor para todos, ao custo de uma verba grande por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Moradia pública", delta: 1 },
    cost: perPop(0.3),
    mods: { goods: 0.03 },
  },
  estatizacao_energia: {
    party: "esquerda",
    name: "Estatização da energia",
    description: "A energia passa a ser pública: as usinas geram 10% a mais, mas a manutenção encarece 4%. Efeito extra: −1 de humor para todos (medida impopular).",
    mods: { power: 0.1, upkeep: 0.04 },
    moodAll: { text: "Estatização da energia (impopular)", delta: -1 },
  },

  // ── Social Democrata: bem-estar e economia solidária ──
  seguro_desemprego: {
    party: "socialdemocrata",
    name: "Seguro-desemprego",
    description: "Quem perde o emprego tem renda por um tempo: +1 de humor para todos; a contribuição de patrões e empregados cobre mais que o gasto. Efeito extra: 3% menos bens.",
    moodAll: { text: "Seguro-desemprego", delta: 1 },
    cost: earn(0.06),
    mods: { goods: -0.03 },
  },
  creche_publica: {
    party: "socialdemocrata",
    name: "Creches públicas",
    description: "Pais podem trabalhar e ter mais filhos: 15% mais nascimentos, ao custo de uma verba por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% mais bens.",
    births: 0.15,
    cost: perPop(0.15),
    moodAll: { text: "Creches públicas (impopular)", delta: -1 },
    mods: { goods: 0.03 },
  },
  escola_integral: {
    party: "socialdemocrata",
    name: "Escola em tempo integral",
    description: "Mais horas de aula e refeição na escola: QE alvo +8, com uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    eq: 8,
    cost: perPop(0.2),
    moodAll: { text: "Escola em tempo integral", delta: 1 },
    mods: { goods: 0.03 },
  },
  vacinacao_massa: {
    party: "socialdemocrata",
    name: "Vacinação em massa",
    description: "Campanhas todo ano: hospitais atendem 10% mais gente, as pestes são 10% mais fracas e a prevenção poupa 4% da manutenção. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Vacinação em massa (impopular)", delta: -1 },
    mods: { health: 0.1, disaster: -0.1, upkeep: -0.04, goods: -0.03 },
  },
  ciclovias: {
    party: "socialdemocrata",
    name: "Ciclovias",
    description: "Menos carros nas ruas: 8% menos poluição, vias 5% mais fluidas e 3% menos gasto de manutenção. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Ciclovias (impopular)", delta: -1 },
    mods: { pollution: -0.08, traffic: 0.05, upkeep: -0.03, goods: -0.03 },
  },
  microcredito_solidario: {
    party: "socialdemocrata",
    name: "Microcrédito solidário",
    description: "Pequenos empréstimos para quem quer empreender sozinho ou em grupo: mais empreendedores e cooperados; os juros pagos rendem uma pequena receita. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    entrepreneur: 0.3,
    coop: 0.4,
    cost: earn(0.04),
    moodAll: { text: "Microcrédito solidário (impopular)", delta: -1 },
    mods: { goods: -0.03 },
  },
  licenca_parental: {
    party: "socialdemocrata",
    name: "Licença parental",
    description: "Pais e mães com tempo para os filhos: 20% mais nascimentos e +1 de humor dos trabalhadores, com uma verba por ciclo. Efeito extra: 3% mais bens.",
    births: 0.2,
    moodWorkers: { text: "Licença parental", delta: 1 },
    cost: perPop(0.1),
    mods: { goods: 0.03 },
  },
  restaurante_popular: {
    party: "socialdemocrata",
    name: "Restaurante popular",
    description: "Refeição a preço de custo para todos: +1 de humor, e a venda das refeições rende uma receita por ciclo. Efeito extra: 3% menos bens.",
    moodAll: { text: "Comida barata", delta: 1 },
    cost: earn(0.04),
    mods: { goods: -0.03 },
  },
  habitacao_social: {
    party: "socialdemocrata",
    name: "Habitação social",
    description: "Aluguel social para quem tem pouco: +1 de humor para todos, e os aluguéis rendem uma receita por ciclo. Efeito extra: 3% menos bens.",
    moodAll: { text: "Habitação social", delta: 1 },
    cost: earn(0.05),
    mods: { goods: -0.03 },
  },

  // ── Centro: parcerias, gestão e incubação ──
  incubadora_municipal: {
    party: "centro",
    name: "Incubadora municipal",
    description: "Espaço, mentoria e contabilidade para novos negócios: moradores sem emprego abrem empresas e cooperativas (mais empreendedores que cooperados). Custa uma verba por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% mais bens.",
    entrepreneur: 0.5,
    coop: 0.3,
    cost: perPop(0.06),
    moodAll: { text: "Incubadora municipal (impopular)", delta: -1 },
    mods: { goods: 0.03 },
  },
  governo_digital: {
    party: "centro",
    name: "Governo digital",
    description: "Serviços pela internet: manutenção 3% mais barata e 8% mais pesquisa. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Governo digital (impopular)", delta: -1 },
    mods: { upkeep: -0.03, research: 0.08, goods: -0.03 },
  },
  coleta_seletiva: {
    party: "centro",
    name: "Coleta seletiva",
    description: "Reciclagem organizada: 10% menos poluição, com uma pequena verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    cost: perPop(0.08),
    moodAll: { text: "Coleta seletiva", delta: 1 },
    mods: { pollution: -0.1, goods: 0.03 },
  },
  conselhos_bairro: {
    party: "centro",
    name: "Conselhos de bairro",
    description: "Vizinhos cuidam uns dos outros: 8% menos crime, com uma pequena verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    cost: perPop(0.08),
    moodAll: { text: "Conselhos de bairro", delta: 1 },
    mods: { crime: -0.08, goods: 0.03 },
  },
  plano_diretor: {
    party: "centro",
    name: "Plano diretor",
    description: "A cidade cresce com plano: vias 8% mais fluidas e manutenção 2% mais barata. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Plano diretor (impopular)", delta: -1 },
    mods: { traffic: 0.08, upkeep: -0.02, goods: -0.03 },
  },
  conciliacao_trabalhista: {
    party: "centro",
    name: "Câmara de conciliação trabalhista",
    description: "Patrões e empregados negociam antes do conflito: +1 de humor dos trabalhadores e 1% menos bens, com uma pequena verba por ciclo.",
    moodWorkers: { text: "Conciliação trabalhista", delta: 1 },
    mods: { goods: -0.01 },
    cost: perPop(0.05),
  },
  convenio_universidades: {
    party: "centro",
    name: "Convênio com universidades",
    description: "Pesquisa 10% mais rápida e QE alvo +3, com uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    eq: 3,
    cost: perPop(0.1),
    moodAll: { text: "Convênio com universidades", delta: 1 },
    mods: { research: 0.1, goods: 0.03 },
  },
  consorcio_intermunicipal: {
    party: "centro",
    name: "Consórcio intermunicipal",
    description: "Compras e fretes em conjunto com as cidades vizinhas: frete 4% mais barato e manutenção 2% menor. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    trade: 0.04,
    moodAll: { text: "Consórcio intermunicipal (impopular)", delta: -1 },
    mods: { upkeep: -0.02, goods: -0.03 },
  },
  fundo_cultura: {
    party: "centro",
    name: "Fundo de cultura",
    description: "Teatro, música e festas de rua: +1 de humor para todos, e a venda de ingressos rende uma receita por ciclo. Efeito extra: 3% menos bens.",
    moodAll: { text: "Vida cultural", delta: 1 },
    cost: earn(0.04),
    mods: { goods: -0.03 },
  },

  // ── Liberal: empreendedorismo e livre mercado ──
  microempreendedor: {
    party: "liberal",
    name: "Microempreendedor individual",
    description: "Abrir um negócio fica fácil e barato: muitos moradores viram empreendedores, que pagam imposto (+2% de arrecadação). Mas negócios novos quebram, sobretudo nas crises. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    entrepreneur: 0.8,
    moodAll: { text: "Microempreendedor individual (impopular)", delta: -1 },
    mods: { tax: 0.02, goods: -0.03 },
  },
  credito_pequenos_negocios: {
    party: "liberal",
    name: "Crédito para pequenos negócios",
    description: "A prefeitura avaliza empréstimos para empreender: mais empreendedores, com uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% menos bens.",
    entrepreneur: 0.6,
    cost: perPop(0.06),
    moodAll: { text: "Crédito para pequenos negócios", delta: 1 },
    mods: { goods: -0.03 },
  },
  polo_startups: {
    party: "liberal",
    name: "Polo de startups",
    description: "Empresas de tecnologia nascem na cidade: mais empreendedores e 6% mais pesquisa, ao custo de subsídios por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    entrepreneur: 0.6,
    cost: perPop(0.08),
    moodAll: { text: "Polo de startups", delta: 1 },
    mods: { research: 0.06, goods: 0.03 },
  },
  imposto_simplificado: {
    party: "liberal",
    name: "Imposto simplificado para pequenas empresas",
    description: "Um só boleto por mês: mais empreendedores, mas a arrecadação geral cai 3%. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    entrepreneur: 0.5,
    moodAll: { text: "Imposto simplificado para pequenas empresas", delta: 1 },
    mods: { tax: -0.03, goods: 0.03 },
  },
  feira_empreendedores: {
    party: "liberal",
    name: "Feira de empreendedores",
    description: "Vitrine anual para quem tem ideia e pouco capital: mais empreendedores, com uma pequena verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% menos bens.",
    entrepreneur: 0.4,
    cost: perPop(0.04),
    moodAll: { text: "Feira de empreendedores", delta: 1 },
    mods: { goods: -0.03 },
  },
  privatizacao_servicos: {
    party: "liberal",
    name: "Privatização dos serviços",
    description: "Empresas assumem serviços públicos: manutenção 8% mais barata, mas os hospitais atendem 8% menos. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Privatização dos serviços (impopular)", delta: -1 },
    mods: { upkeep: -0.08, health: -0.08, goods: -0.03 },
  },
  terceirizacao: {
    party: "liberal",
    name: "Terceirização irrestrita",
    description: "Contratos flexíveis para as empresas: 6% mais bens e +2% de arrecadação, mas os trabalhadores perdem direitos (−1 de humor).",
    moodWorkers: { text: "Contratos precários", delta: -1 },
    mods: { goods: 0.06, tax: 0.02 },
  },
  zona_franca: {
    party: "liberal",
    name: "Zona franca",
    description: "Importar e exportar sem tarifa: frete 6% mais barato e imposto industrial 15% menor. Efeito extra: +1 de humor para todos. Efeito extra: 3% menos bens.",
    trade: 0.06,
    taxIndustry: 0.15,
    moodAll: { text: "Zona franca", delta: 1 },
    mods: { goods: -0.03 },
  },
  comercio_24h: {
    party: "liberal",
    name: "Comércio aberto 24 horas",
    description: "Lojas e fábricas sem horário: 3% mais bens e +3% de arrecadação, mas os trabalhadores ficam mais cansados (−1 de humor).",
    moodWorkers: { text: "Comércio 24 horas", delta: -1 },
    mods: { goods: 0.03, tax: 0.03 },
  },

  // ── Conservador: ordem, família e pequeno negócio ──
  credito_rural: {
    party: "conservador",
    name: "Crédito rural",
    description: "Financiamento para o campo: 8% mais comida, +2% de arrecadação e alguns moradores abrem pequenos negócios (empreendedores). Efeito extra: −1 de humor para todos (medida impopular).",
    entrepreneur: 0.3,
    mods: { farm: 0.08, tax: 0.02 },
    moodAll: { text: "Crédito rural (impopular)", delta: -1 },
  },
  negocio_familiar: {
    party: "conservador",
    name: "Negócio de família",
    description: "Isenção para pequenos negócios tocados pela família: mais empreendedores, 10% mais nascimentos e +2% de arrecadação. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    entrepreneur: 0.5,
    births: 0.1,
    moodAll: { text: "Negócio de família (impopular)", delta: -1 },
    mods: { tax: 0.02, goods: -0.03 },
  },
  disciplina_escolar: {
    party: "conservador",
    name: "Disciplina escolar",
    description: "Escolas rígidas, com ordem e tarefa: QE alvo +4, com uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% menos bens.",
    eq: 4,
    cost: perPop(0.05),
    moodAll: { text: "Disciplina escolar", delta: 1 },
    mods: { goods: -0.03 },
  },
  reforco_policial: {
    party: "conservador",
    name: "Reforço policial",
    description: "Mais policiais nas ruas: 12% menos crime, com uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    cost: perPop(0.12),
    moodAll: { text: "Reforço policial", delta: 1 },
    mods: { crime: -0.12, goods: 0.03 },
  },
  auxilio_casamento: {
    party: "conservador",
    name: "Auxílio-casamento",
    description: "Ajuda a casais que se casam: 20% mais nascimentos, com uma pequena verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    births: 0.2,
    cost: perPop(0.08),
    moodAll: { text: "Auxílio-casamento", delta: 1 },
    mods: { goods: 0.03 },
  },
  responsabilidade_fiscal: {
    party: "conservador",
    name: "Lei de responsabilidade fiscal",
    description: "Gasto só com o que arrecada: manutenção 6% mais barata, mas 3% menos pesquisa. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Lei de responsabilidade fiscal (impopular)", delta: -1 },
    mods: { upkeep: -0.06, research: -0.03, goods: -0.03 },
  },
  protecao_propriedade: {
    party: "conservador",
    name: "Proteção da propriedade",
    description: "Cercas, alarmes e seguranças: 8% menos crime e imposto industrial 5% menor. Efeito extra: +1 de humor para todos. Efeito extra: 3% menos bens.",
    taxIndustry: 0.05,
    moodAll: { text: "Proteção da propriedade", delta: 1 },
    mods: { crime: -0.08, goods: -0.03 },
  },
  festas_tradicionais: {
    party: "conservador",
    name: "Festas tradicionais",
    description: "Missa, quermesse e festa junina: +1 de humor para todos, com uma verba por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Festas tradicionais", delta: 1 },
    cost: perPop(0.1),
    mods: { goods: 0.03 },
  },

  // ── Fascista: só em crise ──
  corporativismo_estado: {
    party: "fascista",
    name: "Corporativismo de Estado",
    description: "Patrões e sindicatos subordinados ao governo: 8% mais bens, +4% de arrecadação e alguns empreendedores aliados do regime, mas os trabalhadores ficam revoltados (−2).",
    entrepreneur: 0.3,
    moodWorkers: { text: "Sindicato oficial", delta: -2 },
    mods: { goods: 0.08, tax: 0.04 },
  },
  propaganda_oficial: {
    party: "fascista",
    name: "Propaganda oficial",
    description: "Rádio e cartazes do governo: +1 de humor para todos, com uma verba por ciclo (e menos pesquisa livre: −8%). Efeito extra: 3% mais bens.",
    moodAll: { text: "Propaganda oficial", delta: 1 },
    cost: perPop(0.2),
    mods: { research: -0.08, goods: 0.03 },
  },
  guarda_nacional: {
    party: "fascista",
    name: "Guarda nacional",
    description: "Tropas na cidade: 30% menos crime e −1 de humor, com uma verba grande por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Tropas nas ruas", delta: -1 },
    cost: perPop(0.25),
    mods: { crime: -0.3, goods: 0.03 },
  },
  controle_imprensa: {
    party: "fascista",
    name: "Controle da imprensa",
    description: "Só se publica o que o governo aprova: 10% menos crime e 10% menos pesquisa; as licenças de imprensa rendem uma receita por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% menos bens.",
    cost: earn(0.08),
    moodAll: { text: "Controle da imprensa", delta: 1 },
    mods: { crime: -0.1, research: -0.1, goods: -0.03 },
  },
  economia_de_guerra: {
    party: "fascista",
    name: "Economia de guerra",
    description: "Fábricas a todo vapor: 12% mais bens e 8% mais refino, mas −1 de humor dos trabalhadores (com +1 de fervor patriótico para todos) e manutenção 5% mais cara.",
    moodWorkers: { text: "Economia de guerra", delta: -1 },
    mods: { goods: 0.12, refine: 0.08, upkeep: 0.05 },
    moodAll: { text: "Fervor patriótico", delta: 1 },
  },
  vigilancia_total: {
    party: "fascista",
    name: "Vigilância total",
    description: "Delação e câmeras em toda esquina: 30% menos crime, mas o medo derruba o humor de todos (−2), com uma verba grande por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Vigilância total", delta: -2 },
    cost: perPop(0.2),
    mods: { crime: -0.3, goods: 0.03 },
  },

  // ── Esquerda Radical (mais) ──
  teto_salarial: {
    party: "esquerda",
    name: "Teto salarial dos dirigentes",
    description: "Ninguém na prefeitura ganha demais: manutenção 3% mais barata e +1 de humor dos trabalhadores. Efeito extra: 3% mais bens.",
    moodWorkers: { text: "Teto salarial", delta: 1 },
    mods: { upkeep: -0.03, goods: 0.03 },
  },
  comissao_fabrica: {
    party: "esquerda",
    name: "Comissões de fábrica",
    description: "Os trabalhadores participam da gestão e cortam desperdício: +1 de humor, manutenção 2% mais barata e 1% menos bens.",
    moodWorkers: { text: "Comissão de fábrica", delta: 1 },
    mods: { goods: -0.01, upkeep: -0.02 },
  },
  biblioteca_bairro: {
    party: "esquerda",
    name: "Biblioteca em cada bairro",
    description: "Livro e internet de graça: QE alvo +4, com uma verba por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% mais bens.",
    eq: 4,
    cost: perPop(0.12),
    moodAll: { text: "Biblioteca em cada bairro (impopular)", delta: -1 },
    mods: { goods: 0.03 },
  },
  preco_alimentos: {
    party: "esquerda",
    name: "Controle de preço dos alimentos",
    description: "Comida tabelada: +1 de humor, mas os produtores plantam 3% menos.",
    mods: { farm: -0.03 },
    moodAll: { text: "Comida tabelada", delta: 1 },
    cost: perPop(0.1),
  },
  nacionalizar_minas: {
    party: "esquerda",
    name: "Nacionalização das minas",
    description: "As minas passam a ser públicas: 10% mais minério, mas manutenção 3% mais cara. Efeito extra: −1 de humor para todos (medida impopular).",
    mods: { ore: 0.1, upkeep: 0.03 },
    moodAll: { text: "Nacionalização das minas (impopular)", delta: -1 },
  },
  // ── Social Democrata (mais) ──
  bolsa_estudante: {
    party: "socialdemocrata",
    name: "Bolsa-estudante",
    description: "Dinheiro para quem estuda: QE alvo +6, com uma verba por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% mais bens.",
    eq: 6,
    cost: perPop(0.18),
    moodAll: { text: "Bolsa-estudante (impopular)", delta: -1 },
    mods: { goods: 0.03 },
  },
  atencao_basica: {
    party: "socialdemocrata",
    name: "Atenção básica de saúde",
    description: "Postos de saúde em cada bairro: hospitais atendem 12% mais gente e a prevenção poupa 4% da manutenção. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Atenção básica de saúde (impopular)", delta: -1 },
    mods: { health: 0.12, upkeep: -0.04, goods: -0.03 },
  },
  parques_lineares: {
    party: "socialdemocrata",
    name: "Parques lineares",
    description: "Verde ao longo dos rios: 6% menos poluição, +1 de humor e bairros valorizados (+3% de arrecadação). Efeito extra: 3% menos bens.",
    moodAll: { text: "Parques lineares", delta: 1 },
    mods: { pollution: -0.06, tax: 0.03, goods: -0.03 },
  },
  centro_dia_idoso: {
    party: "socialdemocrata",
    name: "Centro-dia do idoso",
    description: "Convivência, atividade e refeição para quem se aposentou: +1 de humor, com uma verba por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Centro-dia do idoso", delta: 1 },
    cost: perPop(0.15),
    mods: { goods: 0.03 },
  },
  // ── Centro (mais) ──
  selo_qualidade: {
    party: "centro",
    name: "Selo de qualidade",
    description: "Produtos certificados valem mais: 3% mais bens, 3% menos poluição e 2% mais arrecadação. Efeito extra: −1 de humor para todos (medida impopular).",
    mods: { goods: 0.03, pollution: -0.03, tax: 0.02 },
    moodAll: { text: "Selo de qualidade (impopular)", delta: -1 },
  },
  hortas_urbanas: {
    party: "centro",
    name: "Hortas urbanas",
    description: "Hortas em lotes vazios: 6% mais comida, com uma pequena verba por ciclo. Efeito extra: +1 de humor para todos.",
    cost: perPop(0.06),
    mods: { farm: 0.06 },
    moodAll: { text: "Hortas urbanas", delta: 1 },
  },
  transporte_integrado: {
    party: "centro",
    name: "Transporte integrado",
    description: "Um só bilhete para tudo: vias 10% mais fluidas, com uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    cost: perPop(0.1),
    moodAll: { text: "Transporte integrado", delta: 1 },
    mods: { traffic: 0.1, goods: 0.03 },
  },
  ouvidoria_publica: {
    party: "centro",
    name: "Ouvidoria pública",
    description: "A população reclama e a prefeitura responde: +1 de humor, com uma pequena verba por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Ouvidoria pública", delta: 1 },
    cost: perPop(0.05),
    mods: { goods: 0.03 },
  },
  // ── Liberal (mais) ──
  importacao_livre: {
    party: "liberal",
    name: "Importação livre",
    description: "Sem tarifas para o que vem de fora: frete 8% mais barato. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    trade: 0.08,
    moodAll: { text: "Importação livre (impopular)", delta: -1 },
    mods: { goods: -0.03 },
  },
  liberdade_economica: {
    party: "liberal",
    name: "Lei da liberdade econômica",
    description: "Menos regras e menos imposto para a indústria: 4% mais bens e imposto industrial 10% menor. Efeito extra: +1 de humor para todos.",
    taxIndustry: 0.1,
    mods: { goods: 0.04 },
    moodAll: { text: "Lei da liberdade econômica", delta: 1 },
  },
  mercado_carbono: {
    party: "liberal",
    name: "Mercado de carbono",
    description: "Empresas negociam o direito de poluir: 10% menos poluição, 2% mais bens e uma receita por ciclo com a venda de créditos. Efeito extra: −1 de humor para todos (medida impopular).",
    cost: earn(0.1),
    mods: { pollution: -0.1, goods: 0.02 },
    moodAll: { text: "Mercado de carbono (impopular)", delta: -1 },
  },
  dados_abertos_mercado: {
    party: "liberal",
    name: "Dados abertos para o mercado",
    description: "Informação pública para quem quer empreender: 5% mais pesquisa e manutenção 2% menor. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Dados abertos para o mercado (impopular)", delta: -1 },
    mods: { research: 0.05, upkeep: -0.02, goods: -0.03 },
  },
  // ── Conservador (mais) ──
  valorizacao_professor: {
    party: "conservador",
    name: "Valorização do professor",
    description: "Respeito e salário para quem ensina: QE alvo +5, com uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    eq: 5,
    cost: perPop(0.15),
    moodAll: { text: "Valorização do professor", delta: 1 },
    mods: { goods: 0.03 },
  },
  escola_militar: {
    party: "conservador",
    name: "Escola cívico-militar",
    description: "Disciplina e farda nas escolas: QE alvo +3 e 5% menos crime, com uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    eq: 3,
    cost: perPop(0.1),
    moodAll: { text: "Escola cívico-militar", delta: 1 },
    mods: { crime: -0.05, goods: 0.03 },
  },
  lavoura_familiar: {
    party: "conservador",
    name: "Apoio à lavoura familiar",
    description: "Sítios de família recebem ajuda: 6% mais comida, 10% mais nascimentos e +2% de arrecadação. Efeito extra: −1 de humor para todos (medida impopular).",
    births: 0.1,
    mods: { farm: 0.06, tax: 0.02 },
    moodAll: { text: "Apoio à lavoura familiar (impopular)", delta: -1 },
  },
  previdencia_incentivada: {
    party: "conservador",
    name: "Previdência privada incentivada",
    description: "Dedução de imposto para quem poupa: a arrecadação geral sobe 3%. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Previdência privada incentivada (impopular)", delta: -1 },
    mods: { tax: 0.03, goods: -0.03 },
  },
  // ── Fascista (mais) ──
  registro_cidadaos: {
    party: "fascista",
    name: "Registro de cidadãos",
    description: "Todo morador fichado, com taxa de registro: 15% menos crime e uma receita por ciclo, mas −1 de humor para todos. Efeito extra: 3% menos bens.",
    moodAll: { text: "Fichado pelo Estado", delta: -1 },
    cost: earn(0.06),
    mods: { crime: -0.15, goods: -0.03 },
  },
  culto_lider: {
    party: "fascista",
    name: "Culto ao líder",
    description: "Retratos, hinos e comícios: +1 de humor, com uma verba por ciclo, mas 5% menos pesquisa. Efeito extra: 3% mais bens.",
    moodAll: { text: "Culto ao líder", delta: 1 },
    cost: perPop(0.15),
    mods: { research: -0.05, goods: 0.03 },
  },
  rearmamento: {
    party: "fascista",
    name: "Rearmamento",
    description: "A indústria vira fábrica de armas: 10% mais bens e manutenção 5% mais cara, mas −1 de humor dos trabalhadores. O orgulho nacional dá +1 de humor para todos.",
    moodWorkers: { text: "Rearmamento", delta: -1 },
    mods: { goods: 0.1, upkeep: 0.05 },
    moodAll: { text: "Orgulho nacional", delta: 1 },
  },

  // ── Leis financeiras novas (para equilibrar receita e custo em cada partido) ──
  imposto_heranca: {
    party: "esquerda",
    name: "Imposto sobre heranças",
    description: "Grandes fortunas pagam ao herdar: uma receita por ciclo, mas parte dos ricos reclama (a indústria perde 2% de bens). Efeito extra: −1 de humor para todos (medida impopular).",
    cost: earn(0.15),
    mods: { goods: -0.02 },
    moodAll: { text: "Imposto sobre heranças (impopular)", delta: -1 },
  },
  contribuicao_solidaria: {
    party: "socialdemocrata",
    name: "Contribuição solidária",
    description: "Quem ganha mais contribui para um fundo social: uma receita por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    cost: earn(0.15),
    moodAll: { text: "Contribuição solidária (impopular)", delta: -1 },
    mods: { goods: -0.03 },
  },
  pedagio_urbano: {
    party: "centro",
    name: "Pedágio urbano",
    description: "Quem entra no centro paga: uma receita por ciclo e vias 5% mais fluidas. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    cost: earn(0.12),
    moodAll: { text: "Pedágio urbano (impopular)", delta: -1 },
    mods: { traffic: 0.05, goods: -0.03 },
  },
  concessao_servicos: {
    party: "centro",
    name: "Concessão de serviços públicos",
    description: "A prefeitura concede serviços a empresas por contrato: manutenção 4% mais barata. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Concessão de serviços públicos (impopular)", delta: -1 },
    mods: { upkeep: -0.04, goods: -0.03 },
  },
  taxa_lixo: {
    party: "centro",
    name: "Taxa de coleta de lixo",
    description: "Cada domicílio paga a coleta: uma receita por ciclo e 3% menos poluição. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    cost: earn(0.08),
    moodAll: { text: "Taxa de coleta de lixo (impopular)", delta: -1 },
    mods: { pollution: -0.03, goods: -0.03 },
  },
  subsidio_empresarial: {
    party: "liberal",
    name: "Subsídio a empresas",
    description: "A prefeitura banca parte do custo das empresas: 6% mais bens, com uma verba por ciclo. Efeito extra: +1 de humor para todos.",
    cost: perPop(0.12),
    mods: { goods: 0.06 },
    moodAll: { text: "Subsídio a empresas", delta: 1 },
  },
  reducao_imposto_comercio: {
    party: "liberal",
    name: "Redução do imposto sobre o comércio",
    description: "Lojas pagam menos: a arrecadação cai 4% e mais gente se arrisca a abrir negócio. Efeito extra: +1 de humor para todos. Efeito extra: 3% mais bens.",
    entrepreneur: 0.3,
    moodAll: { text: "Redução do imposto sobre o comércio", delta: 1 },
    mods: { tax: -0.04, goods: 0.03 },
  },
  fundo_garantidor: {
    party: "liberal",
    name: "Fundo garantidor de crédito",
    description: "A prefeitura cobre calotes de pequenos negócios: mais empreendedores, com uma verba por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% menos bens.",
    entrepreneur: 0.4,
    cost: perPop(0.07),
    moodAll: { text: "Fundo garantidor de crédito", delta: 1 },
    mods: { goods: -0.03 },
  },
  pensao_viuvas: {
    party: "conservador",
    name: "Pensão às viúvas",
    description: "Amparo às famílias que perderam o provedor: +1 de humor para todos, com uma verba por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Pensão às viúvas", delta: 1 },
    cost: perPop(0.12),
    mods: { goods: 0.03 },
  },
  imposto_predial: {
    party: "conservador",
    name: "Imposto predial",
    description: "Quem tem imóvel paga: +4% de arrecadação. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    moodAll: { text: "Imposto predial (impopular)", delta: -1 },
    mods: { tax: 0.04, goods: -0.03 },
  },
  licenca_armas: {
    party: "conservador",
    name: "Taxa de licença de armas",
    description: "Registro e taxa para quem porta arma: 5% menos crime e uma receita por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    cost: earn(0.08),
    moodAll: { text: "Taxa de licença de armas (impopular)", delta: -1 },
    mods: { crime: -0.05, goods: -0.03 },
  },
  venda_terras_publicas: {
    party: "conservador",
    name: "Venda de terras públicas",
    description: "A prefeitura vende terrenos ociosos: uma receita por ciclo. Efeito extra: −1 de humor para todos (medida impopular). Efeito extra: 3% menos bens.",
    cost: earn(0.15),
    moodAll: { text: "Venda de terras públicas (impopular)", delta: -1 },
    mods: { goods: -0.03 },
  },
  juventude_partido: {
    party: "fascista",
    name: "Juventude do partido",
    description: "Desfiles e treino paramilitar: 10% menos crime e +1 de humor para todos, com uma verba por ciclo. Efeito extra: 3% menos bens.",
    moodAll: { text: "Juventude do partido", delta: 1 },
    cost: perPop(0.15),
    mods: { crime: -0.1, goods: -0.03 },
  },
  obras_monumentais: {
    party: "fascista",
    name: "Obras monumentais",
    description: "Arcos, estádios e avenidas para glorificar o regime: +1 de humor para todos, com uma verba grande por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Obras monumentais", delta: 1 },
    cost: perPop(0.25),
    mods: { goods: 0.03 },
  },
  policia_secreta: {
    party: "fascista",
    name: "Polícia secreta",
    description: "Informantes e prisões sem julgamento: 30% menos crime e −1 de humor para todos, com uma verba por ciclo. Efeito extra: 3% mais bens.",
    moodAll: { text: "Polícia secreta", delta: -1 },
    cost: perPop(0.2),
    mods: { crime: -0.3, goods: 0.03 },
  },
  confisco_bens: {
    party: "fascista",
    name: "Confisco de bens de opositores",
    description: "O regime toma o que é dos adversários: uma receita por ciclo, mas −1 de humor para todos. Efeito extra: 3% menos bens.",
    moodAll: { text: "Confisco de bens", delta: -1 },
    cost: earn(0.3),
    mods: { goods: -0.03 },
  },
  imposto_guerra: {
    party: "fascista",
    name: "Imposto de guerra",
    description: "Todos pagam pelo esforço de guerra: +6% de arrecadação e −1 de humor para os trabalhadores. Efeito extra: 3% menos bens.",
    moodWorkers: { text: "Imposto de guerra", delta: -1 },
    mods: { tax: 0.06, goods: -0.03 },
  },
  trabalho_obrigatorio: {
    party: "fascista",
    name: "Trabalho voluntário obrigatório",
    description: "Mutirões obrigatórios para o Estado: manutenção 6% mais barata e −1 de humor dos trabalhadores. Efeito extra: 3% menos bens.",
    moodWorkers: { text: "Trabalho obrigatório", delta: -1 },
    mods: { upkeep: -0.06, goods: -0.03 },
  },
  expropriacao_empresas: {
    party: "fascista",
    name: "Expropriação de empresas",
    description: "O Estado toma fábricas inteiras: a indústria paga 20% mais imposto, mas produz 6% menos bens. Efeito extra: +1 de humor para todos.",
    taxIndustry: -0.2,
    mods: { goods: -0.06 },
    moodAll: { text: "Expropriação de empresas", delta: 1 },
  },
  banco_do_estado: {
    party: "fascista",
    name: "Banco do Estado",
    description: "Um banco público controlado pelo regime: uma receita por ciclo. Efeito extra: +1 de humor para todos. Efeito extra: 3% menos bens.",
    cost: earn(0.1),
    moodAll: { text: "Banco do Estado", delta: 1 },
    mods: { goods: -0.03 },
  },
};


/**
 * Época de cada lei: a câmara só propõe o que faz sentido para o ano da cidade (e para a tecnologia que existe).
 * Leis fora da lista valem desde 1900.
 */
export const LAW_ERA: Partial<Record<LawId, { year: number; tech?: string }>> = {
  imposto_heranca: { year: 1930 },
  contribuicao_solidaria: { year: 1945 },
  pedagio_urbano: { year: 1960 },
  concessao_servicos: { year: 1950 },
  taxa_lixo: { year: 1930 },
  subsidio_empresarial: { year: 1930 },
  reducao_imposto_comercio: { year: 1900 },
  fundo_garantidor: { year: 1950 },
  pensao_viuvas: { year: 1915 },
  imposto_predial: { year: 1900 },
  licenca_armas: { year: 1920 },
  venda_terras_publicas: { year: 1900 },
  juventude_partido: { year: 1925 },
  obras_monumentais: { year: 1925 },
  policia_secreta: { year: 1925 },
  confisco_bens: { year: 1930 },
  imposto_guerra: { year: 1915 },
  trabalho_obrigatorio: { year: 1930 },
  expropriacao_empresas: { year: 1930 },
  banco_do_estado: { year: 1925 },
  jornada_8h: { year: 1915 },
  salario_minimo: { year: 1920 },
  fiscalizacao: { year: 1910 },
  taxar_grandes_empresas: { year: 1910 },
  saude_universal: { year: 1935 },
  merenda_escolar: { year: 1920 },
  pensao_universal: { year: 1935 },
  renda_basica: { year: 1960 },
  taxa_carbono: { year: 1990 },
  orcamento_participativo: { year: 1980 },
  parceria_publico_privada: { year: 1960 },
  reforma_administrativa: { year: 1930 },
  energia_limpa: { year: 1980 },
  jornada_flexivel: { year: 1970 },
  desburocratizacao: { year: 1950 },
  fabricas_recuperadas: { year: 1970 },
  banco_cooperativo: { year: 1910 },
  reforma_agraria: { year: 1920 },
  tarifa_zero: { year: 1970 },
  participacao_lucros: { year: 1930 },
  grandes_fortunas: { year: 1950 },
  descanso_remunerado: { year: 1920 },
  moradia_publica: { year: 1920 },
  estatizacao_energia: { year: 1930, tech: "eletrificacao" },
  seguro_desemprego: { year: 1920 },
  creche_publica: { year: 1930 },
  escola_integral: { year: 1950 },
  vacinacao_massa: { year: 1910, tech: "vacinas" },
  ciclovias: { year: 1970 },
  microcredito_solidario: { year: 1980 },
  licenca_parental: { year: 1960 },
  restaurante_popular: { year: 1930 },
  habitacao_social: { year: 1920 },
  incubadora_municipal: { year: 1980 },
  governo_digital: { year: 1990, tech: "internet" },
  coleta_seletiva: { year: 1980 },
  conselhos_bairro: { year: 1930 },
  plano_diretor: { year: 1920 },
  conciliacao_trabalhista: { year: 1920 },
  convenio_universidades: { year: 1958, tech: "universidade_publica" },
  consorcio_intermunicipal: { year: 1950 },
  fundo_cultura: { year: 1940 },
  microempreendedor: { year: 1990 },
  credito_pequenos_negocios: { year: 1930 },
  polo_startups: { year: 1995, tech: "internet" },
  imposto_simplificado: { year: 1990 },
  feira_empreendedores: { year: 1920 },
  privatizacao_servicos: { year: 1980 },
  terceirizacao: { year: 1980 },
  zona_franca: { year: 1960 },
  comercio_24h: { year: 1980 },
  auxilio_casamento: { year: 1930 },
  responsabilidade_fiscal: { year: 1930 },
  corporativismo_estado: { year: 1920 },
  propaganda_oficial: { year: 1935, tech: "radio" },
  controle_imprensa: { year: 1905, tech: "imprensa" },
  economia_de_guerra: { year: 1910 },
  vigilancia_total: { year: 1950 },
  registro_cidadaos: { year: 1930 },
  culto_lider: { year: 1920 },
  rearmamento: { year: 1930 },
  teto_salarial: { year: 1930 },
  comissao_fabrica: { year: 1910 },
  biblioteca_bairro: { year: 1910 },
  preco_alimentos: { year: 1915 },
  nacionalizar_minas: { year: 1920 },
  bolsa_estudante: { year: 1950 },
  atencao_basica: { year: 1950 },
  parques_lineares: { year: 1980 },
  centro_dia_idoso: { year: 1970 },
  selo_qualidade: { year: 1950 },
  hortas_urbanas: { year: 1940 },
  transporte_integrado: { year: 1960 },
  ouvidoria_publica: { year: 1980 },
  liberdade_economica: { year: 1980 },
  mercado_carbono: { year: 2000 },
  dados_abertos_mercado: { year: 1995, tech: "internet" },
  previdencia_incentivada: { year: 1960 },
};

export const LAW_IDS = Object.keys(LAWS) as LawId[];

/** Leis em vigor. */
export const activeLaws = (s: Partial<Pick<CityState, "council">>): LawId[] => s.council?.laws ?? [];
export const hasLaw = (s: Partial<Pick<CityState, "council">>, id: LawId): boolean => activeLaws(s).includes(id);

/** Soma dos efeitos numéricos das leis em vigor (somados aos das tecnologias). */
export function lawMods(s: Partial<Pick<CityState, "council">>): Partial<TechMods> {
  const out: Partial<TechMods> = {};
  for (const id of activeLaws(s)) {
    const m = LAWS[id]?.mods;
    if (!m) continue;
    for (const k of Object.keys(m) as (keyof TechMods)[]) out[k] = (out[k] ?? 0) + (m[k] ?? 0);
  }
  return out;
}

const sumOf = (s: Partial<Pick<CityState, "council">>, pick: (d: LawDef) => number | undefined): number => activeLaws(s).reduce((a, id) => a + (pick(LAWS[id]) ?? 0), 0);
export const lawTaxIndustry = (s: Partial<Pick<CityState, "council">>) => Math.max(-0.5, Math.min(0.9, sumOf(s, (d) => d.taxIndustry)));
export const lawBirths = (s: Partial<Pick<CityState, "council">>) => sumOf(s, (d) => d.births);
export const lawNoStrike = (s: Partial<Pick<CityState, "council">>): boolean => activeLaws(s).some((id) => LAWS[id].noStrike);
export const lawTrade = (s: Partial<Pick<CityState, "council">>) => sumOf(s, (d) => d.trade);
export const lawEntrepreneur = (s: Partial<Pick<CityState, "council">>) => Math.min(1.6, sumOf(s, (d) => d.entrepreneur));
export const lawCoop = (s: Partial<Pick<CityState, "council">>) => Math.min(1.6, sumOf(s, (d) => d.coop));
export const lawEq = (s: Partial<Pick<CityState, "council">>) => sumOf(s, (d) => d.eq);

/** Humor das leis para um morador (trabalhador empregado ou qualquer um). */
export const LAW_MOOD_CAP = 3;
/** Perdas de humor das leis também têm teto: no máximo −4 para todos e −4 para trabalhadores. */
export const LAW_MOOD_FLOOR = -4;
export function lawMoods(s: Partial<Pick<CityState, "council">>, worker: boolean): { text: string; delta: number }[] {
  const out: { text: string; delta: number }[] = [];
  // Os ganhos de humor das leis não se acumulam sem fim: no máximo +3 para todos e +3 para trabalhadores
  // (e as perdas, no máximo −4 em cada grupo).
  const used = { allPos: 0, workersPos: 0, allNeg: 0, workersNeg: 0 };
  const push = (m: { text: string; delta: number }, grp: "all" | "workers") => {
    const key = (m.delta > 0 ? `${grp}Pos` : `${grp}Neg`) as keyof typeof used;
    const room = m.delta > 0 ? LAW_MOOD_CAP - used[key] : used[key] - LAW_MOOD_FLOOR;
    const allowed = m.delta > 0 ? Math.min(m.delta, room) : Math.max(m.delta, -room);
    if (allowed === 0) return;
    used[key] += m.delta > 0 ? allowed : allowed;
    out.push(allowed === m.delta ? m : { text: m.text, delta: allowed });
  };
  for (const id of activeLaws(s)) {
    const d = LAWS[id];
    if (d.moodAll) push(d.moodAll, "all");
    if (worker && d.moodWorkers) push(d.moodWorkers, "workers");
  }
  return out;
}

/** Custo por ciclo das leis em vigor (inteiro). */
export function lawCost(s: Pick<CityState, "population" | "citizens" | "people" | "cyclesCompleted" | "pension"> & Partial<Pick<CityState, "council">>, retirees: number): number {
  return activeLaws(s).reduce((a, id) => a + (LAWS[id].cost?.(s, retirees) ?? 0), 0);
}

// ───────────────────────── resultado financeiro ─────────────────────────

/** Cidade de referência para estimar o resultado financeiro de uma lei ($ por ciclo). */
const REF = { population: 200, upkeep: 250, tax: 500, industryTax: 150, trade: 300, retirees: 40 };

/**
 * Resultado financeiro estimado de uma lei, em $ por ciclo numa cidade de 200 moradores: receita direta (custo negativo),
 * manutenção e arrecadação (modificadores), imposto industrial e frete. Positivo = rende, negativo = custa.
 */
export function lawFinanceScore(id: LawId): number {
  const d = LAWS[id];
  let v = 0;
  if (d.cost) v -= d.cost({ population: REF.population, citizens: [], people: {}, cyclesCompleted: 0, pension: undefined as never }, REF.retirees);
  v -= (d.mods?.upkeep ?? 0) * REF.upkeep;
  v += (d.mods?.tax ?? 0) * REF.tax;
  v -= (d.taxIndustry ?? 0) * REF.industryTax;
  v += (d.trade ?? 0) * REF.trade;
  return Math.round(v * 10) / 10;
}

export type LawFinance = "positiva" | "negativa";
/** Lei financeiramente positiva (rende ou economiza) ou negativa (custa ou reduz a receita). */
export const lawFinance = (id: LawId): LawFinance => (lawFinanceScore(id) > 0 ? "positiva" : "negativa");

// ───────────────────────── humor e produção ─────────────────────────

/** Humor líquido da lei: o que muda para todos mais metade do que muda para os trabalhadores. */
export const lawMoodScore = (id: LawId): number => (LAWS[id].moodAll?.delta ?? 0) + 0.5 * (LAWS[id].moodWorkers?.delta ?? 0);

/** Produção líquida da lei: soma dos modificadores de comida, madeira, minério, refino, bens e energia (frações). */
export const lawProductionScore = (id: LawId): number => {
  const m = LAWS[id].mods ?? {};
  return Math.round(((m.farm ?? 0) + (m.wood ?? 0) + (m.ore ?? 0) + (m.refine ?? 0) + (m.goods ?? 0) + (m.power ?? 0)) * 1000) / 1000;
};

/** Lei que deixa a cidade mais feliz ("feliz") ou mais triste ("triste"). */
export const lawHappiness = (id: LawId): "feliz" | "triste" => (lawMoodScore(id) > 0 ? "feliz" : "triste");
/** Lei que aumenta a produção ("produtiva") ou a reduz ("improdutiva"). */
export const lawProduction = (id: LawId): "produtiva" | "improdutiva" => (lawProductionScore(id) > 0 ? "produtiva" : "improdutiva");

