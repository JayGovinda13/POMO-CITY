"use client";

// Ícones da interface (Iconoir, https://iconoir.com). Os tamanhos seguem o texto (1.2em) e o traço
// é definido uma vez no IconoirProvider (GameApp). Os recursos continuam com seus emojis (🌾🪵🪨…):
// o Iconoir não tem madeira, minério ou tábuas, e eles são a identidade visual de cada recurso.

import type { ReactNode } from "react";
import { IconoirProvider } from "iconoir-react";
import { CloudSunny, FireFlame, HeavyRain, Rain, SnowFlake, SunLight } from "iconoir-react";
import type { Weather } from "@/sim";

export {
  Bank,
  Car,
  HomeSale,
  Industry,
  ShieldAlert,
  Calendar,
  City,
  Coins,
  Donate,
  DragHandGesture,
  Droplet,
  EmojiQuite,
  EmojiSad,
  EmojiSatisfied,
  Eye,
  Farm,
  FireFlame,
  Flash,
  GraduationCap,
  Group,
  Heart,
  MapsGoStraight,
  Map as MapIcon,
  Menu,
  MusicDoubleNote,
  Packages,
  SeaWaves,
  Shield,
  Shop,
  SoundOff,
  Tower,
  Train,
  Trash,
  Tree,
  Xmark,
} from "iconoir-react";

/** Padrões do Iconoir para o jogo: tamanho do texto, traço firme (combina com o pixel art). */
export function Icons({ children }: { children: ReactNode }) {
  return (
    <IconoirProvider
      iconProps={{
        width: "1.2em",
        height: "1.2em",
        strokeWidth: 2,
        style: { display: "inline-block", verticalAlign: "-0.25em", flexShrink: 0 },
        "aria-hidden": true,
      }}
    >
      {children}
    </IconoirProvider>
  );
}

/** Ícone do tempo da estação. */
export function WeatherIcon({ weather }: { weather: Pick<Weather, "label" | "rain" | "temp"> }) {
  if (weather.label === "Seca severa") return <SunLight />;
  if (weather.rain > 450) return <HeavyRain />;
  if (weather.temp < 5) return <SnowFlake />;
  if (weather.temp > 28) return <FireFlame />;
  if (weather.rain > 200) return <Rain />;
  return <CloudSunny />;
}
