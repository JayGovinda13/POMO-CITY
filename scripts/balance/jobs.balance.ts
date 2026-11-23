import { it } from "vitest";
import { runBotState } from "./bot";
import { applyCommands, buildingStatus, citizensView, laborStats, moodSummary, resolveCycle, ZONE, ecoState, ECO_PERIOD, type CityState, type LawId, type Command } from "../../src/sim";

const T0 = Date.UTC(2026, 0, 5, 8);

const CACHE = new Map<number, CityState>();
function unemployedCity(seed: number): CityState {
  const hit = CACHE.get(seed);
  if (hit) return structuredClone(hit);
  const s = runBotState({ region: "salvador", cycles: 60, perDay: 6, seed });
  // 80% dos lotes comerciais e industriais deixam de existir: sobra gente sem emprego.
  let k = 0;
  for (let i = 0; i < s.zoneType.length; i++) {
    if ((s.zoneType[i] === ZONE.C || s.zoneType[i] === ZONE.I) && s.zoneLevel[i] > 0 && k++ % 5 !== 0) {
      // Rezoneia como vazio: os empregos não voltam sozinhos e o desemprego persiste.
      s.zoneLevel[i] = 0;
      s.zoneType[i] = ZONE.NONE;
    }
  }
  CACHE.set(seed, s);
  return structuredClone(s);
}

const SCEN: { name: string; laws: LawId[]; hours?: 6 | 8 | 10 }[] = [
  { name: "base (8h, sem leis)", laws: [] },
  { name: "jornada 6h", laws: [], hours: 6 },
  { name: "jornada 10h", laws: [], hours: 10 },
  { name: "empreendedorismo", laws: ["microempreendedor", "credito_pequenos_negocios", "imposto_simplificado"] },
  { name: "cooperativas", laws: ["cooperativas_trabalhadores", "banco_cooperativo", "fabricas_recuperadas"] },
  { name: "6h + empreend. + coop.", laws: ["microempreendedor", "credito_pequenos_negocios", "cooperativas_trabalhadores", "banco_cooperativo"], hours: 6 },
];

for (const mode of ["normal", "crise"] as const) it(`desemprego alto (${mode}): jornada, empreendedores e cooperativas`, () => {
  const out: string[] = [];
  for (const sc of SCEN) {
    const agg = { fail: 0, min: 0, unemp: 0, pop: 0, money: 0, taxes: 0, goods: 0, food: 0, appr: 0, ent: 0, coop: 0, biz: 0, strike: 0 };
    const N = 4;
    for (let seed = 1; seed <= N; seed++) {
      let s = unemployedCity(seed);
      if (mode === "crise") {
        // Começa no primeiro ciclo da crise econômica (a fase dura 10 ciclos; os 20 seguintes são de recuperação).
        for (let g = 0; g < ECO_PERIOD && !(ecoState(s).phase === "crise" && ecoState(s).left === 10); g++) s.cyclesCompleted++;
      }
      s.council.laws = [...sc.laws, "proibicao_greves"]; // isola o efeito: sem greves em nenhum cenário
      const cmds: Command[] = [];
      if (sc.hours) for (const sector of ["campo", "oficina", "fabrica"] as const) cmds.push({ type: "labor", sector, hours: sc.hours });
      s = applyCommands(s, cmds).state;
      let t = T0 + 40 * 24 * 3600000;
      if (sc === SCEN[0]) out.push(`  [seed ${seed}] desempregados no início: ${laborStats(s, buildingStatus(s)).unemployed} de pop ${s.population}`);
      let samples = 0, goods = 0, taxes = 0, strikes = 0, failed = 0, minMoney = Infinity, unempSum = 0, apprSum = 0, entSum = 0, coopSum = 0, popSum = 0;
      const W = mode === "crise" ? 30 : 60;
      for (let k = 0; k < W; k++) {
        t += 4 * 3600000; // ~6 ciclos por dia (sem estourar o limite diário)
        const res = resolveCycle(s, t);
        s = res.state;
        // Os indicadores caros são amostrados a cada 4 ciclos (o robô fica ~3× mais rápido).
        if (k % 4 === 0) {
          samples++;
          unempSum += laborStats(s, buildingStatus(s)).unemployed;
          apprSum += moodSummary(citizensView(s)).approval;
          entSum += s.business.entrepreneurs; coopSum += s.business.coops; popSum += s.population;
        }
        goods += Object.entries(res.report.produced).filter(([n]) => n.startsWith("goods")).reduce((a, [, v]) => a + (v ?? 0), 0);
        taxes += res.report.taxes + res.report.finance.business;
        failed += res.report.business?.failed ?? 0;
        minMoney = Math.min(minMoney, s.money);
      }
      const lab = laborStats(s, buildingStatus(s));
      agg.unemp += unempSum / samples; agg.pop += s.population; agg.money += s.money; agg.taxes += taxes / W; agg.goods += goods / W;
      agg.fail += failed; agg.min += minMoney; agg.appr += apprSum / samples; agg.ent += entSum / samples; agg.coop += coopSum / samples; agg.pop += popSum / samples - s.population;
    }
    const f = (v: number, d = 0) => (v / N).toFixed(d);
    out.push(`${sc.name.padEnd(26)} pop ${f(agg.pop)} · desempregados ${f(agg.unemp)} · empreend. ${f(agg.ent, 1)} coop. ${f(agg.coop, 1)} · impostos/ciclo ${f(agg.taxes)} · bens/ciclo ${f(agg.goods, 1)} · negócios quebrados ${f(agg.fail, 1)} · caixa ${f(agg.money)} (mín ${f(agg.min)}) · aprovação ${(agg.appr / N * 100).toFixed(0)}% · greve ${(agg.strike / N * 100).toFixed(0)}%`);
  }
  console.log(`\n── ${mode} ──\n` + out.join("\n"));
});
