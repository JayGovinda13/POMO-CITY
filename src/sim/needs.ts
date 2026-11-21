// Necessidades de cada idade: criança precisa de escola, brincadeira e segurança; jovem de estudo ou
// emprego e lazer; adulto de emprego, saúde, transporte e segurança; idoso de saúde, renda e lazer.

export type AgeGroup = "crianca" | "jovem" | "adulto" | "idoso";
export const AGE_GROUPS: AgeGroup[] = ["crianca", "jovem", "adulto", "idoso"];

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  crianca: "Crianças (até 15 anos)",
  jovem: "Jovens (16 a 24)",
  adulto: "Adultos (25 até aposentar)",
  idoso: "Idosos (aposentados)",
};

export type NeedId = "escola" | "brincar" | "seguranca" | "estudo_emprego" | "lazer" | "moradia" | "emprego" | "saude" | "transporte" | "renda";

export interface Need {
  id: NeedId;
  text: string;
  met: boolean;
}

/** Necessidades que pesam no humor quando faltam (peso do desconto). */
export const UNMET_PENALTY: Partial<Record<AgeGroup, Partial<Record<NeedId, { text: string; delta: number }>>>> = {
  crianca: {
    escola: { text: "Criança sem escola por perto", delta: -1 },
    brincar: { text: "Sem lugar para as crianças brincarem", delta: -1 },
  },
  // (Jovem sem emprego já pesa como "Desempregado": só o lazer entra aqui.)
  jovem: {
    lazer: { text: "Sem lazer para os jovens", delta: -1 },
  },
  idoso: {
    saude: { text: "Idoso sem hospital por perto", delta: -2 },
    lazer: { text: "Sem praça ou parque para os idosos", delta: -1 },
  },
};

/** Faixa de idade (a de idoso é a de aposentado). */
export const ageGroupOf = (age: number, retireAge: number): AgeGroup => (age < 16 ? "crianca" : age < 25 ? "jovem" : age < retireAge ? "adulto" : "idoso");

/** O que o morador de cada faixa precisa, e se está sendo atendido. `ctx` traz os fatos do bairro dele. */
export function needsFor(
  group: AgeGroup,
  ctx: { hasHome: boolean; school: boolean; leisure: boolean; safe: boolean; health: boolean; transport: boolean; job: boolean; income: boolean },
): Need[] {
  switch (group) {
    case "crianca":
      return [
        { id: "escola", text: "Escola por perto", met: ctx.school },
        { id: "brincar", text: "Lugar para brincar", met: ctx.leisure },
        { id: "seguranca", text: "Bairro seguro", met: ctx.safe },
      ];
    case "jovem":
      return [
        { id: "estudo_emprego", text: "Estudo ou emprego", met: ctx.job || ctx.school },
        { id: "lazer", text: "Lazer", met: ctx.leisure },
        { id: "moradia", text: "Moradia", met: ctx.hasHome },
      ];
    case "adulto":
      return [
        { id: "emprego", text: "Emprego", met: ctx.job },
        { id: "saude", text: "Hospital por perto", met: ctx.health },
        { id: "transporte", text: "Caminho até o trabalho", met: ctx.transport },
        { id: "seguranca", text: "Bairro seguro", met: ctx.safe },
      ];
    case "idoso":
      return [
        { id: "saude", text: "Hospital por perto", met: ctx.health },
        { id: "renda", text: "Renda da aposentadoria", met: ctx.income },
        { id: "lazer", text: "Praça ou parque", met: ctx.leisure },
      ];
  }
}

export interface NeedsSummary {
  group: AgeGroup;
  label: string;
  total: number;
  needs: { id: NeedId; text: string; met: number }[];
}

/** Quantos de cada faixa de idade têm cada necessidade atendida. */
export function needsSummary(views: { group: AgeGroup; needs: Need[] }[]): NeedsSummary[] {
  return AGE_GROUPS.map((group) => {
    const of = views.filter((v) => v.group === group);
    const ids = new Map<NeedId, { text: string; met: number }>();
    for (const v of of) for (const n of v.needs) {
      const cur = ids.get(n.id) ?? { text: n.text, met: 0 };
      if (n.met) cur.met++;
      ids.set(n.id, cur);
    }
    return { group, label: AGE_GROUP_LABEL[group], total: of.length, needs: [...ids].map(([id, v]) => ({ id, ...v })) };
  });
}
