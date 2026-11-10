import { describe, expect, it } from "vitest";
import { applyCommand, cityDisplayName, createCity, foundCity, generateNewspaper, resolveCycle, sanitizeCityName } from "./index";

const T0 = Date.UTC(2026, 10, 10, 12);

describe("nome da cidade", () => {
  it("limpa o nome digitado", () => {
    expect(sanitizeCityName("  Nova   Pomópolis ")).toBe("Nova Pomópolis");
    expect(sanitizeCityName("<b>Vila\u0007</b>")).toBe("bVila/b");
    expect(sanitizeCityName("   ")).toBeNull();
    expect(sanitizeCityName(42)).toBeNull();
    expect([...sanitizeCityName("x".repeat(80))!]).toHaveLength(28);
  });

  it("funda com nome próprio; sem nome usa a região", () => {
    const named = foundCity(createCity(5, T0), "salvador", T0, "medio", "Pomópolis");
    expect(named.ok && named.state.name).toBe("Pomópolis");
    expect(named.ok && cityDisplayName(named.state)).toBe("Pomópolis");
    const plain = foundCity(createCity(5, T0), "salvador", T0, "medio", "  ");
    expect(plain.ok && plain.state.name).toBeUndefined();
    expect(plain.ok && cityDisplayName(plain.state)).toMatch(/Salvador/);
  });

  it("renomeia pelo comando e o jornal usa o nome", () => {
    const f = foundCity(createCity(5, T0), "salvador", T0, "medio", "Pomópolis");
    if (!f.ok) throw new Error(f.error);
    expect(applyCommand(f.state, { type: "rename", name: "  " }).ok).toBe(false);
    const r = applyCommand(f.state, { type: "rename", name: "Vila Foco" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.name).toBe("Vila Foco");
    const { state, report } = resolveCycle(r.state, T0);
    expect(generateNewspaper(state, report).name).toBe("Gazeta Vila Foco");
  });
});
