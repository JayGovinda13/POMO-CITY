"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useGame } from "@/store/game";
import { Hud } from "./Hud";
import { TitleScreen } from "./TitleScreen";
import { RegionPicker } from "./RegionPicker";
import { DisasterModal } from "./DisasterModal";
import { Tutorial } from "./Tutorial";
import { MusicController } from "./Music";
import { Icons } from "./icons";

// Phaser acessa window/canvas: carregamos apenas no cliente.
const PhaserGame = dynamic(() => import("@/game/PhaserGame"), { ssr: false });

export function GameApp() {
  const screen = useGame((s) => s.screen);
  const presence = useGame((s) => s.presence);

  useEffect(() => {
    useGame.getState().load();
  }, []);

  // Sessão aberta: avisar o servidor se a página for fechada sem sair pelo menu.
  useEffect(() => {
    if (screen !== "game" && presence !== "playing") return;
    const onHide = (e: PageTransitionEvent) => {
      if (!e.persisted) navigator.sendBeacon("/api/session/leave");
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // O navegador mostra um aviso genérico de "sair da página?".
      e.preventDefault();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [screen, presence]);

  if (screen === "menu")
    return (
      <Icons>
        <MusicController />
        <TitleScreen />
      </Icons>
    );

  return (
    <Icons>
    <main className="relative h-dvh w-full overflow-hidden">
      <MusicController />
      <PhaserGame />
      <Hud />
      <RegionPicker />
      <DisasterModal />
      <Tutorial />
    </main>
    </Icons>
  );
}
