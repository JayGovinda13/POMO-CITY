// Aposentadoria: idade de aposentar, previdência pública (contribuição dos trabalhadores, benefício dos
// aposentados) e previdência privada oferecida aos moradores. A parte de contas fica nas funções abaixo.

export interface PensionPolicy {
  /** Idade em que o morador se aposenta (60–70). */
  retireAge: number;
  publicOn: boolean;
  /** Contribuição dos trabalhadores, em % do salário (0–15). */
  publicRate: number;
  /** Nível do benefício: 1 básico, 2 médio, 3 generoso. */
  publicLevel: 1 | 2 | 3;
  /** Fundo público acumulado. */
  fund: number;
  privateOn: boolean;
  /** Parte da contribuição privada que a prefeitura paga (0–100%). */
  privateSubsidy: number;
}

export const DEFAULT_PENSION: PensionPolicy = {
  retireAge: 65,
  publicOn: false,
  publicRate: 8,
  publicLevel: 2,
  fund: 0,
  privateOn: false,
  privateSubsidy: 0,
};
