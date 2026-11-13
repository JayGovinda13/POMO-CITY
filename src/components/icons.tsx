"use client";

// Ícones do jogo: Game-icons.net (https://game-icons.net), via react-icons/gi.
// Licença CC BY 3.0 — crédito aos autores na tela inicial e em /privacidade (obrigatório).
// Silhuetas cheias, feitas para jogos: combinam com o pixel art e cobrem até os recursos
// (trigo, lenha, minério, tábuas, metal, bens). Os nomes exportados descrevem a função no jogo.

import type { ReactNode } from "react";
import { IconContext } from "react-icons";
import {
  GiAtom,
  GiAnticlockwiseRotation,
  GiClockwiseRotation,
  GiBank,
  GiTrophyCup,
  GiPadlock,
  GiCheckMark,
  GiPartyPopper,
  GiCalendar,
  GiCardboardBox,
  GiCityCar,
  GiCrossMark,
  GiDespair,
  GiDynamite,
  GiEyeTarget,
  GiFactory,
  GiFarmTractor,
  GiFlame,
  GiGraduateCap,
  GiGreekTemple,
  GiHamburgerMenu,
  GiHand,
  GiHandcuffs,
  GiHeartBeats,
  GiHeartPlus,
  GiHeavyRain,
  GiLightningFrequency,
  GiMetalBar,
  GiModernCity,
  GiMountains,
  GiMusicalNotes,
  GiMute,
  GiOre,
  GiPerson,
  GiPineTree,
  GiPlanks,
  GiPoliceBadge,
  GiPriceTag,
  GiRaining,
  GiRoad,
  GiSharpSmile,
  GiShop,
  GiShoppingBag,
  GiShrug,
  GiSnowflake1,
  GiSteamLocomotive,
  GiSun,
  GiSunCloud,
  GiTwoCoins,
  GiWaterDrop,
  GiWaveCrest,
  GiWheat,
  GiWoodPile,
} from "react-icons/gi";
import type { ResourceId, Weather } from "@/sim";

// Nomes pela função na interface (os componentes não precisam saber de qual biblioteca vêm).
export {
  GiAtom as Atom,
  GiAnticlockwiseRotation as RotateLeft,
  GiClockwiseRotation as RotateRight,
  GiTrophyCup as Trophy,
  GiPadlock as Lock,
  GiCheckMark as Check,
  GiPartyPopper as Party,
  GiBank as Bank,
  GiCalendar as Calendar,
  GiCityCar as Car,
  GiModernCity as City,
  GiTwoCoins as Coins,
  GiHeartPlus as Donate,
  GiHand as DragHandGesture,
  GiWaterDrop as Droplet,
  GiShrug as EmojiQuite,
  GiDespair as EmojiSad,
  GiSharpSmile as EmojiSatisfied,
  GiEyeTarget as Eye,
  GiFarmTractor as Farm,
  GiFlame as FireFlame,
  GiLightningFrequency as Flash,
  GiGraduateCap as GraduationCap,
  GiPerson as Group,
  GiHeartBeats as Heart,
  GiPriceTag as HomeSale,
  GiFactory as Industry,
  GiRoad as MapsGoStraight,
  GiMountains as MapIcon,
  GiHamburgerMenu as Menu,
  GiMusicalNotes as MusicDoubleNote,
  GiCardboardBox as Packages,
  GiWaveCrest as SeaWaves,
  GiPoliceBadge as Shield,
  GiHandcuffs as ShieldAlert,
  GiShop as Shop,
  GiMute as SoundOff,
  GiGreekTemple as Tower,
  GiSteamLocomotive as Train,
  GiDynamite as Trash,
  GiPineTree as Tree,
  GiCrossMark as Xmark,
};

/** Tamanho padrão: acompanha o texto, alinhado à linha. */
export function Icons({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={{ size: "1.2em", style: { display: "inline-block", verticalAlign: "-0.25em", flexShrink: 0 } }}>
      {children}
    </IconContext.Provider>
  );
}

/** Ícone do tempo da estação. */
export function WeatherIcon({ weather }: { weather: Pick<Weather, "label" | "rain" | "temp"> }) {
  if (weather.label === "Seca severa") return <GiSun />;
  if (weather.rain > 450) return <GiHeavyRain />;
  if (weather.temp < 5) return <GiSnowflake1 />;
  if (weather.temp > 28) return <GiFlame />;
  if (weather.rain > 200) return <GiRaining />;
  return <GiSunCloud />;
}

const RESOURCE_ICON: Record<ResourceId, typeof GiWheat> = {
  food: GiWheat,
  wood: GiWoodPile,
  ore: GiOre,
  planks: GiPlanks,
  metal: GiMetalBar,
  goods: GiShoppingBag,
};
/** Cor de cada recurso (a mesma do catálogo), para reconhecer de relance. */
const RESOURCE_COLOR: Record<ResourceId, string> = {
  food: "#e3c25a",
  wood: "#b07a46",
  ore: "#a7a9b4",
  planks: "#d09a5c",
  metal: "#d06a5a",
  goods: "#8a9af0",
};

/** Ícone de um recurso (trigo, lenha, minério, tábuas, metal, bens). */
export function ResourceIcon({ res, colored = true }: { res: ResourceId; colored?: boolean }) {
  const I = RESOURCE_ICON[res];
  return <I style={colored ? { color: RESOURCE_COLOR[res], display: "inline-block", verticalAlign: "-0.25em" } : undefined} />;
}
