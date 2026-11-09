"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useGame } from "@/store/game";
import { Hud } from "./Hud";

// Phaser acessa window/canvas: carregamos apenas no cliente.
const PhaserGame = dynamic(() => import("@/game/PhaserGame"), { ssr: false });

export function GameApp() {
  useEffect(() => {
    useGame.getState().load();
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <PhaserGame />
      <Hud />
    </main>
  );
}
