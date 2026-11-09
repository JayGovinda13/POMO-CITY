import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POMO-CITY",
  description: "City-builder em pixel art movido a ciclos Pomodoro.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1b1f3a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
