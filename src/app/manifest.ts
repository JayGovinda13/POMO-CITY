import type { MetadataRoute } from "next";

// Instalar o POMO-CITY no celular/computador (PWA): nome, cores e ícones do logo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "POMO-CITY",
    short_name: "POMO-CITY",
    description: "City-builder em pixel art movido a ciclos Pomodoro: sua cidade cresce enquanto você foca.",
    start_url: "/",
    display: "standalone",
    background_color: "#1b1f3a",
    theme_color: "#1b1f3a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
