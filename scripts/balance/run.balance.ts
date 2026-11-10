// npm run balance — roda o robô em cenários e imprime a evolução da cidade (um ano por linha).
import { it } from "vitest";
import { runBot, type BotOptions, type CycleRow } from "./bot";

const SCENARIOS: (BotOptions & { name: string })[] = [
  { name: "Focado (6 ciclos/dia), clima tropical", region: "salvador", cycles: 60, perDay: 6 },
  { name: "Casual (3 ciclos/dia, quebra 10%)", region: "salvador", cycles: 60, perDay: 3, breakChance: 0.1 },
  { name: "Fácil", region: "salvador", cycles: 60, perDay: 6, difficulty: "facil" },
  { name: "Inverno rigoroso (Moscou)", region: "moscou", cycles: 60, perDay: 6 },
  { name: "Sem produção local (só importa)", region: "salvador", cycles: 40, perDay: 6, noProduction: true },
  { name: "Difícil", region: "salvador", cycles: 60, perDay: 6, difficulty: "dificil" },
];

const pad = (v: unknown, n: number) => String(v).padStart(n);

function table(rows: CycleRow[]) {
  const head = "ano  rk   pop/casa   caixa  saldo  imp  manut  compras vendas | 🌾  🪵  🪚  ⚙️  🛍️ |  MW      água  desemp aprov  QE crime pol valor engarraf  demanda R/C/I";
  const lines = [head];
  for (const r of rows) {
    if (r.quarter !== 3 && r !== rows[rows.length - 1]) continue;
    lines.push(
      [
        pad(r.year, 4),
        pad(r.rank, 2),
        pad(`${r.pop}/${r.housing}`, 10),
        pad(r.money, 7),
        pad(r.net, 6),
        pad(r.taxes, 4),
        pad(r.upkeep, 6),
        pad(r.imports, 7),
        pad(r.sales, 6),
        "|",
        pad(r.food, 4),
        pad(r.wood, 3),
        pad(r.planks, 3),
        pad(r.metal, 3),
        pad(r.goods, 3),
        "|",
        pad(`${r.powerDemand}/${r.powerCap}`, 7),
        pad(r.water, 9),
        pad(r.unemployed, 6),
        pad(`${r.approval}%`, 5),
        pad(r.eq, 3),
        pad(r.crime, 5),
        pad(r.pollution, 3),
        pad(r.landValue, 5),
        pad(r.congested, 5),
        pad(r.demand, 15),
      ].join(" "),
    );
  }
  return lines.join("\n");
}

for (const sc of SCENARIOS) {
  it(sc.name, () => {
    const rows = runBot(sc);
    const starving = rows.filter((r) => r.starving).length;
    const brownouts = rows.filter((r) => r.brownout).length;
    const negative = rows.filter((r) => r.money < 0).length;
    const totalImports = rows.reduce((a, r) => a + r.imports, 0);
    const totalTaxes = rows.reduce((a, r) => a + r.taxes, 0);
    console.log(
      `\n══ ${sc.name} ══\n${table(rows)}\n` +
        `fome: ${starving} ciclos · apagão: ${brownouts} · caixa negativo: ${negative} · impostos ${totalTaxes} · compras ${totalImports}\n` +
        `obras: ${rows.flatMap((r) => r.builds.filter((b) => b !== "via" && !b.startsWith("zona"))).join(", ")}`,
    );
  });
}
