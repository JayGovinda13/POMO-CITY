// Doações (tudo opcional; sem configuração o botão não aparece em produção).
// NEXT_PUBLIC_PIX_KEY   = chave Pix (recomendado: chave aleatória, não CPF/telefone)
// NEXT_PUBLIC_PIX_NAME  = nome do recebedor (como aparece no banco)
// NEXT_PUBLIC_PIX_CITY  = cidade do recebedor
// NEXT_PUBLIC_DONATE_URL = link de doação por cartão/internacional (ex.: Stripe Payment Link,
//                          Ko-fi, Apoia.se, GitHub Sponsors)

export const PIX = {
  key: process.env.NEXT_PUBLIC_PIX_KEY ?? "",
  name: process.env.NEXT_PUBLIC_PIX_NAME ?? "",
  city: process.env.NEXT_PUBLIC_PIX_CITY ?? "",
};
export const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL ?? "";

export const pixEnabled = PIX.key.length > 0 && PIX.name.length > 0;
export const linkEnabled = /^https:\/\//.test(DONATE_URL);
export const donationsEnabled = pixEnabled || linkEnabled;

/** Valores sugeridos em reais. */
export const SUGGESTED_AMOUNTS = [5, 10, 25, 50];
