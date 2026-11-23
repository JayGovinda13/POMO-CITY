import { it } from "vitest";
import { runBotState } from "./bot";
import { applyCommands, buildingStatus, citizensView, laborStats, moodSummary, resolveCycle, ZONE, ecoState, type CityState, type LawId, type Command } from "../../src/sim";

const T0 = Date.UTC(2026, 0, 5, 8);

function unemployedCity(seed: number): CityState {
  const s = runBotState({ region: "salvador", cycles: 60, perDay: 6, seed });
  // Metade dos lotes comerciais e industriais fecham: sobra gente sem emprego.
  let k = 0;
  for (let i = 0; i < s.zoneType.length; i++) {
    if ((s.zoneType[i] === ZONE.C || s.zoneType[i] === ZONE.I) && s.zoneLevel[i] > 0 && k++ % 5 !== 0) s.zoneLevel[i] = 0;
  }
  return s;
}

const SCEN: { name: string; laws: LawId[]; hours?: 6 | 8 | 10 }[] = [
  { name: "base (8h, sem leis)", laws: [] },
  { name: "jornada 6h", laws: [], hours: 6 },
  { name: "jornada 10h", laws: [], hours: 10 },
  { name: "empreendedorismo", laws: ["microempreendedor", "credito_pequenos_negocios", "imposto_simplificado"] },
  { name: "cooperativas", laws: ["cooperativas_trabalhadores", "banco_cooperativo", "fabricas_recuperadas"] },
  { name: "6h + empreend. + coop.", laws: ["microempreendedor", "credito_pequenos_negocios", "cooperativas_trabalhadores", "banco_cooperativo"], hours: 6 },
];

it("desemprego alto: jornada, empreendedores e cooperativas", () => {
  const out: string[] = [];
  for (const sc of SCEN) {
    const agg = { unemp: 0, pop: 0, money: 0, taxes: 0, goods: 0, food: 0, appr: 0, ent: 0, coop: 0, biz: 0, strike: 0 };
    const N = 6;
    for (let seed = 1; seed <= N; seed++) {
      let s = unemployedCity(seed);
      s.council.laws = [...sc.laws, "proibicao_greves"]; // isola o efeito: sem greves em nenhum cenário
      const cmds: Command[] = [];
      if (sc.hours) for (const sector of ["campo", "oficina", "fabrica"] as const) cmds.push({ type: "labor", sector, hours: sc.hours });
      s = applyCommands(s, cmds).state;
      let t = T0 + 40 * 24 * 3600000;
      if (sc === SCEN[0]) out.push(`  [seed ${seed}] desempregados no início: ${laborStats(s, buildingStatus(s)).unemployed} de pop ${s.population}`);
      let goods = 0, taxes = 0, strikes = 0, unempSum = 0, apprSum = 0, entSum = 0, coopSum = 0, popSum = 0;
      const W = 80;
      for (let k = 0; k < W; k++) {
        t += 4 * 3600000; // ~6 ciclos por dia (sem estourar o limite diário)
        const res = resolveCycle(s, t);
        s = res.state;
        unempSum += laborStats(s, buildingStatus(s)).unemployed;
        apprSum += moodSummary(citizensView(s)).approval; entSum += s.business.entrepreneurs; coopSum += s.business.coops; popSum += s.population;
        goods += Object.entries(res.report.produced).filter(([n]) => n.startsWith("goods")).reduce((a, [, v]) => a + (v ?? 0), 0);
        taxes += res.report.taxes + res.report.finance.business;
      }
      const lab = laborStats(s, buildingStatus(s));
      agg.unemp += unempSum / W; agg.pop += s.population; agg.money += s.money; agg.taxes += taxes / W; agg.goods += goods / W;
      agg.appr += apprSum / W; agg.ent += entSum / W; agg.coop += coopSum / W; agg.pop += popSum / W - s.population;
    }
    const f = (v: number, d = 0) => (v / N).toFixed(d);
    out.push(`${sc.name.padEnd(26)} pop ${f(agg.pop)} · desempregados ${f(agg.unemp)} · empreend. ${f(agg.ent, 1)} coop. ${f(agg.coop, 1)} · impostos/ciclo ${f(agg.taxes)} · bens/ciclo ${f(agg.goods, 1)} · caixa ${f(agg.money)} · aprovação ${(agg.appr / N * 100).toFixed(0)}% · greve ${(agg.strike / N * 100).toFixed(0)}%`);
  }
  console.log("\n" + out.join("\n"));
});
