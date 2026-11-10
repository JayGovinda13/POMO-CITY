/* eslint-disable @next/next/no-img-element -- pixel art 34×34 ampliado sem suavizar; next/image não ajuda aqui. */

/** Logo do POMO-CITY: tomate (pomodoro) com a cidade dentro, em pixel art nítido. */
export function Logo({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
