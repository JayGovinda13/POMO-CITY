"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { CityScene } from "./CityScene";

/** Carregado só no cliente via next/dynamic({ ssr: false }). */
export default function PhaserGame() {
  const parent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parent.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parent.current,
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      backgroundColor: "#1b1f3a",
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
      scene: [CityScene],
      banner: false,
    });
    return () => game.destroy(true);
  }, []);

  return <div ref={parent} className="absolute inset-0" />;
}
