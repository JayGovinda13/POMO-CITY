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
  | "milicia_urbana";

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

export const LAWS: Record<LawId, LawDef> = {
  // ── Esquerda Radical ──
  jornada_8h: {
    party: "esquerda",
    name: "Jornada máxima de 8 horas",
    description: "Nenhum setor passa de 8 horas por dia (jornadas longas voltam a 8 h). Os trabalhadores ficam mais contentes, mas o ganho de produção de jornadas longas some.",
    hoursCap: 8,
    moodWorkers: { text: "Jornada limitada por lei", delta: 1 },
  },
  salario_minimo: {
    party: "esquerda",
    name: "Salário mínimo municipal",
    description: "Piso salarial: trabalhadores contentes (+1 de humor), mas as fábricas produzem 5% menos bens.",
    mods: { goods: -0.05 },
    moodWorkers: { text: "Salário mínimo", delta: 1 },
  },
  fiscalizacao: {
    party: "esquerda",
    name: "Fiscalização obrigatória do trabalho",
    description: "Fiscais em toda a cidade, sem precisar do prédio: humor e desgaste dos trabalhadores pela metade, e o ganho de jornada longa também.",
    inspection: true,
  },
  taxar_grandes_empresas: {
    party: "esquerda",
    name: "Imposto sobre grandes empresas",
    description: "A indústria paga 25% a mais de imposto, mas produz 4% menos bens.",
    taxIndustry: -0.25,
    mods: { goods: -0.04 },
  },
  // ── Social Democrata ──
  saude_universal: {
    party: "socialdemocrata",
    name: "Saúde universal",
    description: "Os hospitais atendem 25% mais gente, ao custo de uma verba por ciclo.",
    mods: { health: 0.25 },
    cost: perPop(0.2),
  },
  merenda_escolar: {
    party: "socialdemocrata",
    name: "Merenda escolar",
    description: "Alunos bem alimentados aprendem mais: QE alvo +5, ao custo de uma verba por ciclo.",
    eq: 5,
    cost: perPop(0.12),
  },
  pensao_universal: {
    party: "socialdemocrata",
    name: "Pensão universal",
    description: "Todo aposentado recebe uma renda mínima ($3 por ciclo), mesmo sem previdência. Evita a tristeza dos sem renda, mas custa por aposentado.",
    pensionAll: true,
    cost: (_s, retirees) => retirees * 3,
  },
  renda_basica: {
    party: "socialdemocrata",
    name: "Renda básica",
    description: "Uma renda mínima para todos: +1 de humor para todos, ao custo de uma verba por ciclo.",
    moodAll: { text: "Renda básica", delta: 1 },
    cost: perPop(0.25),
  },
  arborizacao: {
    party: "socialdemocrata",
    name: "Arborização urbana",
    description: "Ruas e praças cheias de árvores: todos ficam um pouco mais felizes (+1), ao custo de uma verba por ciclo.",
    moodAll: { text: "Cidade arborizada", delta: 1 },
    cost: perPop(0.15),
  },
  taxa_carbono: {
    party: "socialdemocrata",
    name: "Taxa de carbono",
    description: "A indústria paga para poluir: 20% menos poluição e 4% menos bens.",
    mods: { pollution: -0.2, goods: -0.04 },
  },
  // ── Centro ──
  orcamento_participativo: {
    party: "centro",
    name: "Orçamento participativo",
    description: "Os moradores decidem parte das obras: +1 de humor para todos, com uma pequena verba por ciclo.",
    moodAll: { text: "Orçamento participativo", delta: 1 },
    cost: perPop(0.08),
  },
  parceria_publico_privada: {
    party: "centro",
    name: "Parcerias público-privadas",
    description: "A iniciativa privada ajuda a tocar obras: manutenção 6% mais barata e vias 10% mais fluidas.",
    mods: { upkeep: -0.06, traffic: 0.1 },
  },
  reforma_administrativa: {
    party: "centro",
    name: "Reforma administrativa",
    description: "Prefeitura mais enxuta e moderna: manutenção 5% mais barata e 5% mais pesquisa.",
    mods: { upkeep: -0.05, research: 0.05 },
  },
  energia_limpa: {
    party: "centro",
    name: "Incentivo à energia limpa",
    description: "As usinas geram 6% a mais, com um pequeno custo por ciclo em subsídios.",
    mods: { power: 0.06 },
    cost: perPop(0.1),
  },
  // ── Liberal ──
  isencao_industria: {
    party: "liberal",
    name: "Isenção para a indústria",
    description: "Imposto industrial 25% menor e 8% mais bens, pensando em atrair fábricas.",
    taxIndustry: 0.25,
    mods: { goods: 0.08 },
  },
  jornada_flexivel: {
    party: "liberal",
    name: "Jornada flexível",
    description: "Empresas negociam horários: +4% de bens e de refino, mas os trabalhadores ficam mais cansados (−1 de humor).",
    mods: { goods: 0.04, refine: 0.04 },
    moodWorkers: { text: "Jornada flexível (banco de horas)", delta: -1 },
  },
  livre_comercio: {
    party: "liberal",
    name: "Zona de livre comércio",
    description: "O frete fica 6% mais barato nas importações e sobe o preço de venda.",
    trade: 0.06,
  },
  desburocratizacao: {
    party: "liberal",
    name: "Desburocratização",
    description: "Alvarás rápidos: um lote a mais cresce por ciclo e a manutenção cai 3%.",
    mods: { growth: 1, upkeep: -0.03 },
  },
  // ── Conservador ──
  toque_recolher: {
    party: "conservador",
    name: "Toque de recolher",
    description: "20% menos crime, mas ninguém gosta de ser vigiado (−1 de humor para todos).",
    mods: { crime: -0.2 },
    moodAll: { text: "Toque de recolher", delta: -1 },
  },
  guarda_municipal: {
    party: "conservador",
    name: "Guarda municipal",
    description: "Patrulhas nas ruas: 15% menos crime, ao custo de uma verba por ciclo.",
    mods: { crime: -0.15 },
    cost: perPop(0.15),
  },
  austeridade: {
    party: "conservador",
    name: "Lei de austeridade",
    description: "Cortes em toda a máquina: manutenção 10% mais barata, mas os hospitais atendem 10% menos.",
    mods: { upkeep: -0.1, health: -0.1 },
  },
  incentivo_familia: {
    party: "conservador",
    name: "Incentivo à família",
    description: "Benefício para famílias com filhos: 40% mais nascimentos, ao custo de uma verba por ciclo.",
    births: 0.4,
    cost: perPop(0.1),
  },
  // ── Fascista (só surge em crise) ──
  estado_de_excecao: {
    party: "fascista",
    name: "Estado de exceção",
    description: "Repressão total: 35% menos crime, mas o medo derruba o humor de todos (−2).",
    mods: { crime: -0.35 },
    moodAll: { text: "Estado de exceção", delta: -2 },
  },
  proibicao_greves: {
    party: "fascista",
    name: "Proibição de greves",
    description: "Ninguém para de trabalhar, nem com motivo. Os trabalhadores ficam revoltados (−2) e o problema continua embaixo do tapete.",
    noStrike: true,
    moodWorkers: { text: "Greves proibidas", delta: -2 },
  },
  milicia_urbana: {
    party: "fascista",
    name: "Milícia urbana",
    description: "Grupos armados patrulham as ruas: 25% menos crime e −1 de humor para todos, com uma verba por ciclo.",
    mods: { crime: -0.25 },
    moodAll: { text: "Milícia nas ruas", delta: -1 },
    cost: perPop(0.2),
  },

  // ── Esquerda Radical: cooperativas, trabalho e redistribuição ──
  cooperativas_trabalhadores: {
    party: "esquerda",
    name: "Cooperativas de trabalhadores",
    description: "A prefeitura apoia quem se junta para tocar o próprio negócio: moradores sem emprego fundam cooperativas, que dividem o lucro e resistem melhor às crises. Custa uma verba por ciclo.",
    coop: 1,
    cost: perPop(0.1),
  },
  fabricas_recuperadas: {
    party: "esquerda",
    name: "Fábricas recuperadas",
    description: "Trabalhadores assumem fábricas falidas: mais cooperativas e trabalhadores orgulhosos (+1), mas 2% menos bens.",
    coop: 0.6,
    mods: { goods: -0.02 },
    moodWorkers: { text: "Fábrica nas mãos dos trabalhadores", delta: 1 },
  },
  banco_cooperativo: {
    party: "esquerda",
    name: "Banco cooperativo",
    description: "Crédito sem juros abusivos para cooperativas: mais cooperados, com uma verba por ciclo.",
    coop: 0.5,
    cost: perPop(0.08),
  },
  reforma_agraria: {
    party: "esquerda",
    name: "Reforma agrária",
    description: "Terra para quem planta: 10% mais comida das fazendas, com uma verba por ciclo.",
    mods: { farm: 0.1 },
    cost: perPop(0.1),
  },
  tarifa_zero: {
    party: "esquerda",
    name: "Tarifa zero no transporte",
    description: "Ônibus e trens gratuitos: as vias ficam 8% mais fluidas, ao custo de uma verba por ciclo.",
    mods: { traffic: 0.08 },
    cost: perPop(0.2),
  },
  participacao_lucros: {
    party: "esquerda",
    name: "Participação nos lucros",
    description: "Os trabalhadores levam parte do lucro: +1 de humor, mas 3% menos bens.",
    mods: { goods: -0.03 },
    moodWorkers: { text: "Participação nos lucros", delta: 1 },
  },
  grandes_fortunas: {
    party: "esquerda",
    name: "Imposto sobre grandes fortunas",
    description: "Os ricos pagam mais: a indústria paga 15% a mais de imposto e a arrecadação geral sobe 4%, mas 2% menos bens.",
    taxIndustry: -0.15,
    mods: { tax: 0.04, goods: -0.02 },
  },
  descanso_remunerado: {
    party: "esquerda",
    name: "Descanso semanal remunerado",
    description: "Folga paga para todos: +1 de humor dos trabalhadores e 2% menos bens.",
    mods: { goods: -0.02 },
    moodWorkers: { text: "Descanso remunerado", delta: 1 },
  },
  moradia_publica: {
    party: "esquerda",
    name: "Moradia pública",
    description: "A prefeitura constrói casas populares: +1 de humor para todos, ao custo de uma verba grande por ciclo.",
    moodAll: { text: "Moradia pública", delta: 1 },
    cost: perPop(0.3),
  },
  estatizacao_energia: {
    party: "esquerda",
    name: "Estatização da energia",
    description: "A energia passa a ser pública: as usinas geram 10% a mais, mas a manutenção encarece 4%.",
    mods: { power: 0.1, upkeep: 0.04 },
  },

  // ── Social Democrata: bem-estar e economia solidária ──
  seguro_desemprego: {
    party: "socialdemocrata",
    name: "Seguro-desemprego",
    description: "Quem perde o emprego tem renda por um tempo: +1 de humor para todos, com uma verba por ciclo.",
    moodAll: { text: "Seguro-desemprego", delta: 1 },
    cost: perPop(0.2),
  },
  creche_publica: {
    party: "socialdemocrata",
    name: "Creches públicas",
    description: "Pais podem trabalhar e ter mais filhos: 15% mais nascimentos, ao custo de uma verba por ciclo.",
    births: 0.15,
    cost: perPop(0.15),
  },
  escola_integral: {
    party: "socialdemocrata",
    name: "Escola em tempo integral",
    description: "Mais horas de aula e refeição na escola: QE alvo +8, com uma verba por ciclo.",
    eq: 8,
    cost: perPop(0.2),
  },
  vacinacao_massa: {
    party: "socialdemocrata",
    name: "Vacinação em massa",
    description: "Campanhas todo ano: hospitais atendem 10% mais gente e as pestes são 10% mais fracas.",
    mods: { health: 0.1, disaster: -0.1 },
    cost: perPop(0.1),
  },
  ciclovias: {
    party: "socialdemocrata",
    name: "Ciclovias",
    description: "Menos carros nas ruas: 8% menos poluição e vias 5% mais fluidas.",
    mods: { pollution: -0.08, traffic: 0.05 },
  },
  microcredito_solidario: {
    party: "socialdemocrata",
    name: "Microcrédito solidário",
    description: "Pequenos empréstimos para quem quer empreender sozinho ou em grupo: mais empreendedores e cooperados, com uma verba por ciclo.",
    entrepreneur: 0.3,
    coop: 0.4,
    cost: perPop(0.1),
  },
  licenca_parental: {
    party: "socialdemocrata",
    name: "Licença parental",
    description: "Pais e mães com tempo para os filhos: 20% mais nascimentos e +1 de humor dos trabalhadores.",
    births: 0.2,
    moodWorkers: { text: "Licença parental", delta: 1 },
  },
  restaurante_popular: {
    party: "socialdemocrata",
    name: "Restaurante popular",
    description: "Refeição barata para todos: +1 de humor, com uma verba por ciclo.",
    moodAll: { text: "Comida barata", delta: 1 },
    cost: perPop(0.2),
  },
  habitacao_social: {
    party: "socialdemocrata",
    name: "Habitação social",
    description: "Aluguel social para quem tem pouco: +1 de humor para todos, com uma verba por ciclo.",
    moodAll: { text: "Habitação social", delta: 1 },
    cost: perPop(0.25),
  },

  // ── Centro: parcerias, gestão e incubação ──
  incubadora_municipal: {
    party: "centro",
    name: "Incubadora municipal",
    description: "Espaço, mentoria e contabilidade para novos negócios: moradores sem emprego abrem empresas e cooperativas (mais empreendedores que cooperados). Custa uma verba por ciclo.",
    entrepreneur: 0.5,
    coop: 0.3,
    cost: perPop(0.1),
  },
  governo_digital: {
    party: "centro",
    name: "Governo digital",
    description: "Serviços pela internet: manutenção 3% mais barata e 8% mais pesquisa.",
    mods: { upkeep: -0.03, research: 0.08 },
  },
  coleta_seletiva: {
    party: "centro",
    name: "Coleta seletiva",
    description: "Reciclagem organizada: 10% menos poluição, com uma pequena verba por ciclo.",
    mods: { pollution: -0.1 },
    cost: perPop(0.08),
  },
  conselhos_bairro: {
    party: "centro",
    name: "Conselhos de bairro",
    description: "Vizinhos cuidam uns dos outros: 8% menos crime, com uma pequena verba por ciclo.",
    mods: { crime: -0.08 },
    cost: perPop(0.08),
  },
  plano_diretor: {
    party: "centro",
    name: "Plano diretor",
    description: "A cidade cresce com plano: vias 8% mais fluidas e manutenção 2% mais barata.",
    mods: { traffic: 0.08, upkeep: -0.02 },
  },
  conciliacao_trabalhista: {
    party: "centro",
    name: "Câmara de conciliação trabalhista",
    description: "Patrões e empregados negociam antes do conflito: +1 de humor dos trabalhadores e 1% menos bens.",
    mods: { goods: -0.01 },
    moodWorkers: { text: "Conciliação trabalhista", delta: 1 },
  },
  convenio_universidades: {
    party: "centro",
    name: "Convênio com universidades",
    description: "Pesquisa 10% mais rápida e QE alvo +3, com uma verba por ciclo.",
    mods: { research: 0.1 },
    eq: 3,
    cost: perPop(0.1),
  },
  consorcio_intermunicipal: {
    party: "centro",
    name: "Consórcio intermunicipal",
    description: "Compras e fretes em conjunto com as cidades vizinhas: frete 4% mais barato e manutenção 2% menor.",
    trade: 0.04,
    mods: { upkeep: -0.02 },
  },
  fundo_cultura: {
    party: "centro",
    name: "Fundo de cultura",
    description: "Teatro, música e festas de rua: +1 de humor para todos, com uma verba por ciclo.",
    moodAll: { text: "Vida cultural", delta: 1 },
    cost: perPop(0.12),
  },

  // ── Liberal: empreendedorismo e livre mercado ──
  microempreendedor: {
    party: "liberal",
    name: "Microempreendedor individual",
    description: "Abrir um negócio fica fácil e barato: muitos moradores sem emprego viram empreendedores, que pagam imposto. Mas negócios novos quebram, sobretudo nas crises.",
    entrepreneur: 0.8,
  },
  credito_pequenos_negocios: {
    party: "liberal",
    name: "Crédito para pequenos negócios",
    description: "A prefeitura avaliza empréstimos para empreender: mais empreendedores, com uma verba por ciclo.",
    entrepreneur: 0.6,
    cost: perPop(0.12),
  },
  polo_startups: {
    party: "liberal",
    name: "Polo de startups",
    description: "Empresas de tecnologia nascem na cidade: mais empreendedores e 6% mais pesquisa.",
    entrepreneur: 0.6,
    mods: { research: 0.06 },
  },
  imposto_simplificado: {
    party: "liberal",
    name: "Imposto simplificado para pequenas empresas",
    description: "Um só boleto por mês: mais empreendedores, mas a arrecadação geral cai 3%.",
    entrepreneur: 0.5,
    mods: { tax: -0.03 },
  },
  feira_empreendedores: {
    party: "liberal",
    name: "Feira de empreendedores",
    description: "Vitrine anual para quem tem ideia e pouco capital: mais empreendedores, com uma pequena verba por ciclo.",
    entrepreneur: 0.4,
    cost: perPop(0.06),
  },
  privatizacao_servicos: {
    party: "liberal",
    name: "Privatização dos serviços",
    description: "Empresas assumem serviços públicos: manutenção 8% mais barata, mas os hospitais atendem 8% menos.",
    mods: { upkeep: -0.08, health: -0.08 },
  },
  terceirizacao: {
    party: "liberal",
    name: "Terceirização irrestrita",
    description: "Contratos flexíveis para as empresas: 6% mais bens, mas os trabalhadores perdem direitos (−1 de humor).",
    mods: { goods: 0.06 },
    moodWorkers: { text: "Contratos precários", delta: -1 },
  },
  zona_franca: {
    party: "liberal",
    name: "Zona franca",
    description: "Importar e exportar sem tarifa: frete 6% mais barato e imposto industrial 15% menor.",
    trade: 0.06,
    taxIndustry: 0.15,
  },
  comercio_24h: {
    party: "liberal",
    name: "Comércio aberto 24 horas",
    description: "Lojas e fábricas sem horário: 3% mais bens, mas os trabalhadores ficam mais cansados (−1 de humor).",
    mods: { goods: 0.03 },
    moodWorkers: { text: "Comércio 24 horas", delta: -1 },
  },

  // ── Conservador: ordem, família e pequeno negócio ──
  credito_rural: {
    party: "conservador",
    name: "Crédito rural",
    description: "Financiamento para o campo: 8% mais comida e alguns moradores abrem pequenos negócios (empreendedores).",
    mods: { farm: 0.08 },
    entrepreneur: 0.3,
  },
  negocio_familiar: {
    party: "conservador",
    name: "Negócio de família",
    description: "Isenção para pequenos negócios tocados pela família: mais empreendedores e 10% mais nascimentos.",
    entrepreneur: 0.5,
    births: 0.1,
  },
  disciplina_escolar: {
    party: "conservador",
    name: "Disciplina escolar",
    description: "Escolas rígidas, com ordem e tarefa: QE alvo +4.",
    eq: 4,
  },
  reforco_policial: {
    party: "conservador",
    name: "Reforço policial",
    description: "Mais policiais nas ruas: 12% menos crime, com uma verba por ciclo.",
    mods: { crime: -0.12 },
    cost: perPop(0.12),
  },
  auxilio_casamento: {
    party: "conservador",
    name: "Auxílio-casamento",
    description: "Ajuda a casais que se casam: 20% mais nascimentos, com uma pequena verba por ciclo.",
    births: 0.2,
    cost: perPop(0.08),
  },
  responsabilidade_fiscal: {
    party: "conservador",
    name: "Lei de responsabilidade fiscal",
    description: "Gasto só com o que arrecada: manutenção 6% mais barata, mas 3% menos pesquisa.",
    mods: { upkeep: -0.06, research: -0.03 },
  },
  protecao_propriedade: {
    party: "conservador",
    name: "Proteção da propriedade",
    description: "Cercas, alarmes e seguranças: 8% menos crime e imposto industrial 5% menor.",
    mods: { crime: -0.08 },
    taxIndustry: 0.05,
  },
  festas_tradicionais: {
    party: "conservador",
    name: "Festas tradicionais",
    description: "Missa, quermesse e festa junina: +1 de humor para todos, com uma verba por ciclo.",
    moodAll: { text: "Festas tradicionais", delta: 1 },
    cost: perPop(0.1),
  },

  // ── Fascista: só em crise ──
  corporativismo_estado: {
    party: "fascista",
    name: "Corporativismo de Estado",
    description: "Patrões e sindicatos subordinados ao governo: 8% mais bens e alguns empreendedores aliados do regime, mas os trabalhadores ficam revoltados (−2).",
    mods: { goods: 0.08 },
    entrepreneur: 0.3,
    moodWorkers: { text: "Sindicato oficial", delta: -2 },
  },
  propaganda_oficial: {
    party: "fascista",
    name: "Propaganda oficial",
    description: "Rádio e cartazes do governo: +1 de humor para todos, com uma verba por ciclo (e menos pesquisa livre: −8%).",
    moodAll: { text: "Propaganda oficial", delta: 1 },
    mods: { research: -0.08 },
    cost: perPop(0.2),
  },
  guarda_nacional: {
    party: "fascista",
    name: "Guarda nacional",
    description: "Tropas na cidade: 30% menos crime e −1 de humor, com uma verba grande por ciclo.",
    mods: { crime: -0.3 },
    moodAll: { text: "Tropas nas ruas", delta: -1 },
    cost: perPop(0.25),
  },
  controle_imprensa: {
    party: "fascista",
    name: "Controle da imprensa",
    description: "Só se publica o que o governo aprova: 10% menos crime, mas 10% menos pesquisa.",
    mods: { crime: -0.1, research: -0.1 },
  },
  economia_de_guerra: {
    party: "fascista",
    name: "Economia de guerra",
    description: "Fábricas a todo vapor: 12% mais bens e 8% mais refino, mas −2 de humor dos trabalhadores e manutenção 5% mais cara.",
    mods: { goods: 0.12, refine: 0.08, upkeep: 0.05 },
    moodWorkers: { text: "Economia de guerra", delta: -2 },
  },
  vigilancia_total: {
    party: "fascista",
    name: "Vigilância total",
    description: "Delação e câmeras em toda esquina: 30% menos crime, mas o medo derruba o humor de todos (−2).",
    mods: { crime: -0.3 },
    moodAll: { text: "Vigilância total", delta: -2 },
  },

  // ── Esquerda Radical (mais) ──
  teto_salarial: {
    party: "esquerda",
    name: "Teto salarial dos dirigentes",
    description: "Ninguém na prefeitura ganha demais: manutenção 3% mais barata e +1 de humor dos trabalhadores.",
    mods: { upkeep: -0.03 },
    moodWorkers: { text: "Teto salarial", delta: 1 },
  },
  comissao_fabrica: {
    party: "esquerda",
    name: "Comissões de fábrica",
    description: "Os trabalhadores participam da gestão: +1 de humor e 1% menos bens.",
    mods: { goods: -0.01 },
    moodWorkers: { text: "Comissão de fábrica", delta: 1 },
  },
  biblioteca_bairro: {
    party: "esquerda",
    name: "Biblioteca em cada bairro",
    description: "Livro e internet de graça: QE alvo +4, com uma verba por ciclo.",
    eq: 4,
    cost: perPop(0.12),
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
    description: "As minas passam a ser públicas: 10% mais minério, mas manutenção 3% mais cara.",
    mods: { ore: 0.1, upkeep: 0.03 },
  },
  // ── Social Democrata (mais) ──
  bolsa_estudante: {
    party: "socialdemocrata",
    name: "Bolsa-estudante",
    description: "Dinheiro para quem estuda: QE alvo +6, com uma verba por ciclo.",
    eq: 6,
    cost: perPop(0.18),
  },
  atencao_basica: {
    party: "socialdemocrata",
    name: "Atenção básica de saúde",
    description: "Postos de saúde em cada bairro: hospitais atendem 12% mais gente, com uma verba por ciclo.",
    mods: { health: 0.12 },
    cost: perPop(0.1),
  },
  parques_lineares: {
    party: "socialdemocrata",
    name: "Parques lineares",
    description: "Verde ao longo dos rios: 6% menos poluição e +1 de humor, com uma verba por ciclo.",
    mods: { pollution: -0.06 },
    moodAll: { text: "Parques lineares", delta: 1 },
    cost: perPop(0.15),
  },
  centro_dia_idoso: {
    party: "socialdemocrata",
    name: "Centro-dia do idoso",
    description: "Convivência, atividade e refeição para quem se aposentou: +1 de humor, com uma verba por ciclo.",
    moodAll: { text: "Centro-dia do idoso", delta: 1 },
    cost: perPop(0.15),
  },
  // ── Centro (mais) ──
  selo_qualidade: {
    party: "centro",
    name: "Selo de qualidade",
    description: "Produtos certificados valem mais: 3% mais bens e 3% menos poluição.",
    mods: { goods: 0.03, pollution: -0.03 },
  },
  hortas_urbanas: {
    party: "centro",
    name: "Hortas urbanas",
    description: "Hortas em lotes vazios: 6% mais comida, com uma pequena verba por ciclo.",
    mods: { farm: 0.06 },
    cost: perPop(0.06),
  },
  transporte_integrado: {
    party: "centro",
    name: "Transporte integrado",
    description: "Um só bilhete para tudo: vias 10% mais fluidas, com uma verba por ciclo.",
    mods: { traffic: 0.1 },
    cost: perPop(0.1),
  },
  ouvidoria_publica: {
    party: "centro",
    name: "Ouvidoria pública",
    description: "A população reclama e a prefeitura responde: +1 de humor, com uma pequena verba por ciclo.",
    moodAll: { text: "Ouvidoria pública", delta: 1 },
    cost: perPop(0.05),
  },
  // ── Liberal (mais) ──
  importacao_livre: {
    party: "liberal",
    name: "Importação livre",
    description: "Sem tarifas para o que vem de fora: frete 8% mais barato.",
    trade: 0.08,
  },
  liberdade_economica: {
    party: "liberal",
    name: "Lei da liberdade econômica",
    description: "Menos regras e menos imposto para a indústria: 4% mais bens e imposto industrial 10% menor.",
    mods: { goods: 0.04 },
    taxIndustry: 0.1,
  },
  mercado_carbono: {
    party: "liberal",
    name: "Mercado de carbono",
    description: "Empresas negociam o direito de poluir: 10% menos poluição e 2% mais bens.",
    mods: { pollution: -0.1, goods: 0.02 },
  },
  dados_abertos_mercado: {
    party: "liberal",
    name: "Dados abertos para o mercado",
    description: "Informação pública para quem quer empreender: 5% mais pesquisa e manutenção 2% menor.",
    mods: { research: 0.05, upkeep: -0.02 },
  },
  // ── Conservador (mais) ──
  valorizacao_professor: {
    party: "conservador",
    name: "Valorização do professor",
    description: "Respeito e salário para quem ensina: QE alvo +5, com uma verba por ciclo.",
    eq: 5,
    cost: perPop(0.15),
  },
  escola_militar: {
    party: "conservador",
    name: "Escola cívico-militar",
    description: "Disciplina e farda nas escolas: QE alvo +3 e 5% menos crime, com uma verba por ciclo.",
    eq: 3,
    mods: { crime: -0.05 },
    cost: perPop(0.1),
  },
  lavoura_familiar: {
    party: "conservador",
    name: "Apoio à lavoura familiar",
    description: "Sítios de família recebem ajuda: 6% mais comida e 10% mais nascimentos.",
    mods: { farm: 0.06 },
    births: 0.1,
  },
  previdencia_incentivada: {
    party: "conservador",
    name: "Previdência privada incentivada",
    description: "Dedução de imposto para quem poupa: a arrecadação geral sobe 3%.",
    mods: { tax: 0.03 },
  },
  // ── Fascista (mais) ──
  registro_cidadaos: {
    party: "fascista",
    name: "Registro de cidadãos",
    description: "Todo morador fichado: 15% menos crime, mas −1 de humor para todos.",
    mods: { crime: -0.15 },
    moodAll: { text: "Fichado pelo Estado", delta: -1 },
  },
  culto_lider: {
    party: "fascista",
    name: "Culto ao líder",
    description: "Retratos, hinos e comícios: +1 de humor, com uma verba por ciclo, mas 5% menos pesquisa.",
    moodAll: { text: "Culto ao líder", delta: 1 },
    mods: { research: -0.05 },
    cost: perPop(0.15),
  },
  rearmamento: {
    party: "fascista",
    name: "Rearmamento",
    description: "A indústria vira fábrica de armas: 10% mais bens e manutenção 5% mais cara, mas −1 de humor dos trabalhadores.",
    mods: { goods: 0.1, upkeep: 0.05 },
    moodWorkers: { text: "Rearmamento", delta: -1 },
  },
};


/**
 * Época de cada lei: a câmara só propõe o que faz sentido para o ano da cidade (e para a tecnologia que existe).
 * Leis fora da lista valem desde 1900.
 */
export const LAW_ERA: Partial<Record<LawId, { year: number; tech?: string }>> = {
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
export function lawMoods(s: Partial<Pick<CityState, "council">>, worker: boolean): { text: string; delta: number }[] {
  const out: { text: string; delta: number }[] = [];
  // Os ganhos de humor das leis não se acumulam sem fim: no máximo +3 para todos e +3 para trabalhadores
  // (as perdas valem por inteiro).
  let posAll = 0;
  let posWorkers = 0;
  const push = (m: { text: string; delta: number }, pos: "all" | "workers") => {
    if (m.delta <= 0) return void out.push(m);
    const used = pos === "all" ? posAll : posWorkers;
    const allowed = Math.min(m.delta, LAW_MOOD_CAP - used);
    if (allowed <= 0) return;
    if (pos === "all") posAll += allowed;
    else posWorkers += allowed;
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
