import { describe, expect, it } from "vitest";
import { crc16, pixPayload } from "./pix";

describe("Pix copia e cola", () => {
  it("CRC16 confere com o exemplo do manual do BR Code", () => {
    const body =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16(body)).toBe("1D3D");
  });

  it("monta o payload com chave, valor, nome e cidade normalizados", () => {
    const p = pixPayload({ key: "123e4567-e12b-12d1-a456-426655440000", name: "Jay Govinda", city: "São Paulo", amount: 10 });
    expect(p).toContain("0014br.gov.bcb.pix");
    expect(p).toContain("540510.00");
    expect(p).toContain("5911JAY GOVINDA");
    expect(p).toContain("6009SAO PAULO");
    expect(p.slice(-8, -4)).toBe("6304");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  it("sem valor, quem paga escolhe", () => {
    expect(pixPayload({ key: "abc", name: "X", city: "Y" })).not.toContain("5405");
  });
});
