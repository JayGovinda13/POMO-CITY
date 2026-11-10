// Jornal da cidade: a cada ciclo concluído, uma edição com manchete, notícias e a fala de um
// morador. Gerado de forma determinística a partir do relatório e do estado depois do ciclo.

import { citizensView, moodSummary, type CitizenView } from "./citizens";
import { REGION_BY_ID } from "./climate";
import { cityDisplayName } from "./founding";
import { RESOURCES } from "./catalog";
import { ORDINANCES, ORDINANCE_IDS, isActive } from "./finance";
import { RANKS, type CityState, type CycleReport, type ResourceId } from "./types";
import { QUARTER_MONTHS, rng } from "./world";

export interface NewsStory {
  title: string;
  body: string;
  tone: "good" | "bad" | "neutral";
}

export interface Newspaper {
  name: string;
  edition: number;
  date: string;
  headline: NewsStory;
  stories: NewsStory[];
  quote: { citizen: CitizenView; text: string } | null;
}

const money = (v: number) => `$${Math.abs(v).toLocaleString("pt-BR")}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Fala do morador conforme o motivo que mais pesa no humor dele. */
function quoteFor(c: CitizenView, r: () => number): string {
  const sorted = [...c.reasons].sort((a, b) => (c.mood === "triste" ? a.delta - b.delta : b.delta - a.delta));
  const top = sorted[0]?.text ?? "";
  const lines: Record<string, string[]> = {
    "Tem emprego": ["Trabalho não falta por aqui. Isso dá tranquilidade.", "Gosto do meu emprego e do caminho até ele."],
    "Desempregado(a)": ["Procuro emprego há semanas. Falta comércio e indústria nesta cidade.", "Sem trabalho fica difícil. Cadê as vagas, prefeitura?"],
    "Casa com energia": ["A luz não cai mais lá em casa. Que alívio.", "Energia firme: dá até para trabalhar de casa."],
    "Casa sem energia": ["Mais uma noite no escuro. Precisamos de usinas!", "A luz caiu de novo no meu bairro."],
    "Comida na mesa": ["A feira está cheia e o preço justo.", "Não falta comida na mesa, graças às fazendas."],
    "Falta comida (nem dá para comprar)": ["Os mercados estão vazios. Assim não dá.", "Estamos passando fome. Socorro, prefeitura!"],
    "Desastre recente": ["Ainda estamos limpando os estragos do último desastre.", "Depois do desastre, tudo ficou mais difícil."],
    "Frio intenso": ["Que frio! A lenha está mais cara que nunca.", "Nem o casaco dá conta deste inverno."],
    "Calor forte": ["Este calor está insuportável, o ventilador não para.", "Calor demais! Ninguém aguenta."],
    "Prefeitura focada": ["Dá para ver que a prefeitura está trabalhando sério.", "A cidade anda com foco. Gosto disso."],
    "Cidade bonita": ["As praças novas deixaram o bairro mais bonito.", "Dá gosto passear pela cidade agora."],
    "Festival da cidade": ["O festival foi o melhor dos últimos anos!", "A cidade ganhou vida com o festival."],
    "Reprova a jogatina": ["Esses jogos de azar não fazem bem à cidade.", "Não gosto nada desses cassinos."],
    "Prêmio de produtividade": ["O bônus de produtividade veio em boa hora.", "Trabalhar focado compensa: veio o prêmio!"],
    "Trânsito parado": ["Duas horas pra atravessar o centro! Cadê o ônibus?", "Buzina, fumaça e fila. Esse trânsito não anda."],
    "Trabalho longe demais": ["Não acho emprego perto de casa. Faltam vias até o centro.", "O trabalho fica tão longe que nem compensa ir."],
    "Transporte público perto": ["Vou de ônibus e chego descansado.", "O trem passa aqui do lado: ótimo pra ir trabalhar."],
    "Bairro perigoso": ["Não saio mais à noite. Precisamos de policiamento!", "Assaltaram a padaria de novo. Cadê a delegacia?"],
    "Bairro seguro": ["Com a delegacia aqui perto, as crianças brincam na rua.", "Durmo tranquilo: o bairro está seguro."],
    "Ar poluído": ["Esse ar está me fazendo tossir. Menos fumaça, por favor!", "A fumaça das fábricas chega até a minha janela."],
    "Parque perto de casa": ["Corro no parque toda manhã. Que maravilha!", "O parque é o lugar preferido da família."],
    "Escola no bairro": ["Meus filhos estudam pertinho de casa.", "A escola nova é motivo de orgulho no bairro."],
    "Atendimento médico": ["Fui bem atendido no hospital. Recomendo!", "Ter hospital por perto dá segurança."],
    "Sem hospital por perto": ["Pra ir ao médico preciso sair da cidade!", "A cidade cresceu e o hospital não veio."],
    Otimista: ["Tenho fé que esta cidade vai longe!", "Cada estação a cidade fica melhor."],
    "Rabugento(a)": ["Hunf. Na minha época tudo era mais simples.", "Reclamo, mas não saio daqui."],
  };
  const options = lines[top] ?? ["É uma boa cidade para morar.", "Vamos ver como fica a próxima estação."];
  return options[Math.floor(r() * options.length)];
}

const sum = (inv: Partial<Record<string, number>>) => Object.values(inv).reduce<number>((a, b) => a + (b ?? 0), 0);

/** Gera a edição do jornal a partir do relatório do ciclo e do estado já atualizado. */
export function generateNewspaper(state: CityState, report: CycleReport): Newspaper {
  const r = rng((state.seed ^ Math.imul(state.cyclesCompleted + 3, 0x7feb352d)) >>> 0);
  const region = state.regionId ? REGION_BY_ID[state.regionId] : null;
  const name = state.name || region ? `Gazeta ${cityDisplayName(state)}` : "Gazeta da Cidade";
  const season = report.weather?.season ? `${report.weather.season} · ` : "";
  const date = `${season}${QUARTER_MONTHS[report.quarter]} de ${report.year}`;
  const growth = report.populationAfter - report.populationBefore;
  const f = report.finance;
  const views = citizensView(state);
  const mood = moodSummary(views);

  // ── Manchete: o fato mais importante do ciclo ──
  const candidates: (NewsStory & { priority: number })[] = [];
  if (!report.rewarded) {
    candidates.push({ priority: 100, tone: "neutral", title: "Cidade descansa após jornada recorde", body: "O limite de ciclos do dia foi atingido: a cidade folga até amanhã." });
  }
  if (report.starving) {
    candidates.push({ priority: 90, tone: "bad", title: "FOME! Moradores deixam a cidade", body: "Sem comida nem dinheiro para comprá-la, famílias fazem as malas. Fazendas são urgentes." });
  }
  if (report.power.brownout) {
    candidates.push({ priority: 80, tone: "bad", title: "APAGÃO atinge bairros inteiros", body: `A cidade pediu ${report.power.demand} MW, mas só há ${report.power.capacity} MW. A população cobra novas usinas e linhas.` });
  }
  if (report.water?.shortage) {
    candidates.push({
      priority: 75,
      tone: "bad",
      title: "Torneiras secas em vários bairros",
      body: `A cidade precisou de ${report.water.demand} de água e só teve ${report.water.supplied}. Prédios altos sem água começam a esvaziar.`,
    });
  }
  if (report.quarter === 0) {
    candidates.push({ priority: 60, tone: "good", title: `Feliz ${report.year}!`, body: "Fogos no céu e balanço do ano: a prefeitura promete uma cidade ainda maior." });
  }
  if (report.rank === "S") {
    candidates.push({ priority: 55, tone: "good", title: "Ritmo máximo: lote de pureza S", body: `Com ${plural(report.streak, "ciclo", "ciclos")} de foco seguidos, a produção saiu com qualidade máxima.` });
  }
  if (growth >= 8) {
    candidates.push({ priority: 50, tone: "good", title: `Cidade cresce: +${growth} novos moradores`, body: "Mudanças e caminhões de mudança por toda parte." });
  }
  if (report.weather && report.weather.label !== "Dentro do normal") {
    candidates.push({ priority: 45, tone: "bad", title: `${report.weather.label} marca a estação`, body: `Termômetros em ${report.weather.temp}°C e ${report.weather.rain} mm de chuva. Lavoura a ${Math.round(report.weather.effects.farm * 100)}%.` });
  }
  if (report.zones.grown >= 3) {
    candidates.push({ priority: 40, tone: "good", title: `Construção em alta: ${report.zones.grown} prédios novos`, body: "Guindastes e andaimes mudam a paisagem da cidade." });
  }
  if (report.netMoney < 0) {
    candidates.push({ priority: 35, tone: "bad", title: `Contas no vermelho: déficit de ${money(report.netMoney)}`, body: "Analistas sugerem rever impostos, verbas e decretos no Orçamento." });
  }
  candidates.push({ priority: 1, tone: "neutral", title: `Estação tranquila${state.name || region ? ` em ${cityDisplayName(state)}` : ""}`, body: "Sem grandes novidades: a cidade segue seu ritmo." });
  candidates.sort((a, b) => b.priority - a.priority);
  const { priority: _p, ...headline } = candidates[0];

  // ── Notícias ──
  const stories: NewsStory[] = [];
  const income = report.taxes + f.ordinanceRevenue + report.salesRevenue;
  const spend = report.upkeep + f.ordinanceCost + report.importCost + f.interest;
  stories.push({
    title: report.netMoney >= 0 ? `Prefeitura fecha a estação com ${money(report.netMoney)} de saldo` : `Prefeitura gasta mais do que arrecada`,
    body: `Entraram ${money(income)} (impostos ${money(report.taxes)}${report.salesRevenue ? `, vendas ${money(report.salesRevenue)}` : ""}) e saíram ${money(spend)} (manutenção ${money(report.upkeep)}${report.importCost ? `, compras ${money(report.importCost)}` : ""}${f.interest ? `, juros ${money(f.interest)}` : ""}). Caixa atual: ${money(state.money)}.`,
    tone: report.netMoney >= 0 ? "good" : "bad",
  });

  if (report.jobs.unemployed > 0) {
    stories.push({
      title: `${plural(report.jobs.unemployed, "morador procura", "moradores procuram")} emprego`,
      body: "Associações pedem mais zonas comerciais e industriais para abrir vagas.",
      tone: "bad",
    });
  } else if (report.jobs.total > 0) {
    stories.push({ title: "Pleno emprego!", body: `Todas as ${report.jobs.filled} vagas ocupadas. Empresas já disputam trabalhadores.`, tone: "good" });
  }

  const bought = Object.entries(report.ledger)
    .filter(([, l]) => (l?.bought ?? 0) > 0)
    .sort((a, b) => (b[1]!.bought ?? 0) - (a[1]!.bought ?? 0))[0];
  if (bought) {
    const res = bought[0] as ResourceId;
    stories.push({
      title: `Cidade importa ${RESOURCES[res].name.toLowerCase()}`,
      body: `Foram ${bought[1]!.bought} unidades compradas de fora. Produzir localmente sairia mais barato.`,
      tone: "neutral",
    });
  } else if (sum(report.sold) > 0) {
    stories.push({ title: "Exportações animam a economia", body: `${sum(report.sold)} unidades vendidas renderam ${money(report.salesRevenue)}.`, tone: "good" });
  }

  if (report.weather && headline.title.indexOf(report.weather.label) < 0) {
    stories.push({
      title: `Tempo: ${report.weather.season.toLowerCase()} com ${report.weather.temp}°C`,
      body: `${report.weather.label}. ${report.weather.rain} mm de chuva e ventos de ${report.weather.wind} m/s; colheita a ${Math.round(report.weather.effects.farm * 100)}%.`,
      tone: report.weather.effects.farm >= 0.9 ? "good" : "neutral",
    });
  }

  if (views.length) {
    stories.push({
      title: mood.approval >= 0.3 ? "Moradores aprovam a gestão" : mood.approval < 0 ? "Insatisfação cresce nos bairros" : "Opinião pública dividida",
      body: `Pesquisa: ${mood.feliz} felizes, ${mood.ok} satisfeitos e ${mood.triste} insatisfeitos. Aprovação de ${Math.round(mood.approval * 100)}%.`,
      tone: mood.approval >= 0.3 ? "good" : mood.approval < 0 ? "bad" : "neutral",
    });
  }

  if (report.insuranceLapsed) {
    stories.unshift({
      title: "Seguradora cancela a apólice da cidade",
      body: "Sem dinheiro em caixa para o prêmio, a cidade ficou sem seguro. Recontratar exige nova carência.",
      tone: "bad",
    });
  }

  // Trânsito (Fase 8).
  const tr = report.traffic;
  if (tr && tr.congested > 0) {
    stories.push({
      title: `Engarrafamento em ${plural(tr.congested, "trecho", "trechos")}`,
      body: "Ruas acima da capacidade poluem e espantam moradores. Rodovias comportam o dobro; ônibus e trens tiram carros das ruas.",
      tone: "bad",
    });
  } else if (tr && (tr.bus > 0 || tr.rail > 0)) {
    stories.push({
      title: "Transporte público ganha passageiros",
      body: `${tr.bus} viagens de ônibus e ${tr.rail} de trem nesta estação. Tempo médio até o trabalho: ${tr.avgCommute}.`,
      tone: "good",
    });
  }

  // Qualidade de vida (Fase 7).
  const sv = report.services;
  if (sv && state.population > 0) {
    if (sv.crime > 45) {
      stories.push({ title: "Onda de crimes preocupa moradores", body: `Índice de crime em ${Math.round(sv.crime)}. Delegacias reduzem o crime ao redor; uma prisão reforça a polícia.`, tone: "bad" });
    } else if (sv.pollution > 40) {
      stories.push({ title: "Fumaça encobre bairros", body: `Poluição média de ${Math.round(sv.pollution)}. Parques e praças limpam o ar; indústria longe das casas também ajuda.`, tone: "bad" });
    } else if (state.cyclesCompleted % 4 === 2) {
      stories.push({
        title: `Educação em ${Math.round(sv.eq)} pontos; vida média de ${Math.round(sv.lifeExpectancy)} anos`,
        body: "Escolas levam o QE até 90 e faculdades até 140. Hospitais aumentam a expectativa de vida aos poucos.",
        tone: sv.eq >= 90 ? "good" : "neutral",
      });
    }
  }

  const active = ORDINANCE_IDS.filter((id) => isActive(state, id));
  if (active.length) {
    stories.push({ title: "Em vigor", body: active.map((id) => ORDINANCES[id].name).join(" · "), tone: "neutral" });
  }

  if (report.rank !== "S" && report.rewarded) {
    const next = RANKS[Math.min(RANKS.indexOf(report.rank) + 1, RANKS.length - 1)];
    stories.push({ title: `Lote de pureza ${report.rank}`, body: `Mais um ciclo de foco seguido e o próximo lote sai com pureza ${next}.`, tone: "neutral" });
  }

  // ── Fala de um morador ──
  const citizen = views.length ? views[Math.floor(r() * views.length)] : null;
  const quote = citizen ? { citizen, text: quoteFor(citizen, r) } : null;

  return { name, edition: state.cyclesCompleted, date, headline, stories: stories.slice(0, 5), quote };
}
