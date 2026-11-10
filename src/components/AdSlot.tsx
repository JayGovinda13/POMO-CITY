"use client";

import { useEffect, useRef } from "react";
import { AD_SLOTS, ADSENSE_CLIENT, adsEnabled, type AdPlacement } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Espaço publicitário (Google AdSense).
 * - Com NEXT_PUBLIC_ADSENSE_CLIENT e o slot configurados: bloco responsivo do AdSense.
 * - Em desenvolvimento, sem configuração: um marcador mostrando onde o anúncio vai ficar.
 * - Em produção, sem configuração: nada é exibido.
 * Sempre rotulado como "Publicidade" e afastado dos botões do jogo (evita cliques acidentais).
 */
export function AdSlot({ placement, className = "" }: { placement: AdPlacement; className?: string }) {
  const slot = AD_SLOTS[placement];
  const pushed = useRef(false);
  const live = adsEnabled && !!slot;

  useEffect(() => {
    if (!live || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Bloqueador de anúncios ou script ainda indisponível: o espaço só fica vazio.
    }
  }, [live]);

  if (!live) {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <aside className={`grid min-h-[90px] place-items-center border-2 border-dashed border-zinc-600 text-[10px] text-zinc-500 ${className}`}>
        Espaço publicitário · AdSense ({placement})
      </aside>
    );
  }

  return (
    <aside className={className} aria-label="Publicidade">
      <p className="mb-0.5 text-[9px] uppercase tracking-wider text-zinc-500">Publicidade</p>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
