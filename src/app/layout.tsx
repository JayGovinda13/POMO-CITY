import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ADSENSE_CLIENT, adsEnabled } from "@/lib/ads";
import "./globals.css";

export const metadata: Metadata = {
  title: "POMO-CITY",
  description: "City-builder em pixel art movido a ciclos Pomodoro.",
  // Verificação do site no AdSense (só com o ID de editor configurado).
  ...(adsEnabled ? { other: { "google-adsense-account": ADSENSE_CLIENT } } : {}),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1b1f3a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        {adsEnabled && (
          <Script
            id="adsense"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          />
        )}
      </body>
    </html>
  );
}
