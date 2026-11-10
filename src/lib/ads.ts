// Configuração do Google AdSense (tudo opcional: sem as variáveis, nenhum anúncio é carregado).
// NEXT_PUBLIC_ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX" (ID de editor)
// NEXT_PUBLIC_ADSENSE_SLOT_TITLE / NEXT_PUBLIC_ADSENSE_SLOT_NEWSPAPER = IDs dos blocos de anúncio

export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
export const adsEnabled = /^ca-pub-\d{10,20}$/.test(ADSENSE_CLIENT);

export const AD_SLOTS = {
  title: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TITLE ?? "",
  newspaper: process.env.NEXT_PUBLIC_ADSENSE_SLOT_NEWSPAPER ?? "",
} as const;
export type AdPlacement = keyof typeof AD_SLOTS;
