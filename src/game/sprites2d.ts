// Desenho (por quadro, em pixels) dos carros, pedestres e trens da vida da cidade.
// Tudo é desenhado numa Phaser.Graphics, sem texturas: formas pequenas com sombra, luz e detalhes.

import Phaser from "phaser";

const INK = 0x1b1630;
const SHADOW = 0x0b0820;

/** Escurece (k < 1) ou clareia (k > 1) uma cor 0xRRGGBB. */
export function shade(color: number, k: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * k));
  const b = Math.min(255, Math.round((color & 255) * k));
  return (r << 16) | (g << 8) | b;
}

export type CarStyle = "sedan" | "van" | "pickup" | "taxi" | "hatch";
const STYLES: CarStyle[] = ["sedan", "sedan", "hatch", "hatch", "van", "pickup", "taxi", "sedan"];
export const carStyleOf = (seed: number): CarStyle => STYLES[Math.abs(Math.floor(seed)) % STYLES.length];

interface Dim {
  /** meio-comprimento e meia-largura do casco */
  l: number;
  w: number;
  /** cabine: de c0 a c1 ao longo do comprimento (−l..l) */
  c0: number;
  c1: number;
  /** altura da cabine */
  roof: number;
}
const DIMS: Record<CarStyle, Dim> = {
  sedan: { l: 3.1, w: 1.55, c0: -1.5, c1: 1.0, roof: 2.6 },
  hatch: { l: 2.7, w: 1.5, c0: -1.9, c1: 1.1, roof: 2.8 },
  van: { l: 3.4, w: 1.65, c0: -2.9, c1: 2.0, roof: 3.6 },
  pickup: { l: 3.4, w: 1.6, c0: -0.4, c1: 2.0, roof: 3 },
  taxi: { l: 3.1, w: 1.55, c0: -1.5, c1: 1.0, roof: 2.6 },
};

/** Retângulo orientado: de a..b ao longo da direção (ux, uy), meia-largura w, elevado `lift`. */
function box(g: Phaser.GameObjects.Graphics, cx: number, cy: number, ux: number, uy: number, a: number, b: number, w: number, color: number, lift = 0, alpha = 1) {
  const px = -uy;
  const py = ux;
  g.fillStyle(color, alpha);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(cx + ux * b + px * w, cy + uy * b + py * w - lift),
      new Phaser.Math.Vector2(cx + ux * b - px * w, cy + uy * b - py * w - lift),
      new Phaser.Math.Vector2(cx + ux * a - px * w, cy + uy * a - py * w - lift),
      new Phaser.Math.Vector2(cx + ux * a + px * w, cy + uy * a + py * w - lift),
    ],
    true,
  );
}

const dot = (g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, s = 1) => {
  g.fillStyle(color, 1);
  g.fillRect(Math.round(x), Math.round(y), s, s);
};

/**
 * Carro visto de cima (iso): sombra no chão, casco com contorno, vidros, teto, faróis amarelos na frente,
 * lanternas vermelhas atrás e rodas. `u` é a direção de movimento (frente do carro).
 */
export function drawCar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, ux: number, uy: number, color: number, style: CarStyle, braking = false) {
  const d = DIMS[style];
  const px = -uy;
  const py = ux;
  const paint = style === "taxi" ? 0xf0c040 : color;
  // Sombra projetada no chão (um pouco maior e deslocada).
  box(g, cx + 0.6, cy + 1, ux, uy, -d.l - 0.4, d.l + 0.4, d.w + 0.4, SHADOW, 0, 0.3);
  // Rodas (aparecem nas laterais, abaixo do casco).
  for (const along of [-d.l * 0.6, d.l * 0.6])
    for (const side of [-1, 1]) dot(g, cx + ux * along + px * (d.w + 0.2) * side, cy + uy * along + py * (d.w + 0.2) * side - 0.5, INK, 1);
  // Contorno e casco.
  box(g, cx, cy, ux, uy, -d.l - 0.4, d.l + 0.4, d.w + 0.35, INK, 0.6);
  box(g, cx, cy, ux, uy, -d.l, d.l, d.w, paint, 1.2);
  // Capô e porta-malas mais escuros (casco), cabine com vidros e teto.
  box(g, cx, cy, ux, uy, d.c1, d.l, d.w * 0.8, shade(paint, 0.85), 1.4);
  if (style === "pickup") box(g, cx, cy, ux, uy, -d.l + 0.2, d.c0 - 0.2, d.w * 0.8, shade(paint, 0.6), 1.6);
  box(g, cx, cy, ux, uy, d.c0, d.c1, d.w * 0.85, 0x9ad0ff, 1.8);
  box(g, cx, cy, ux, uy, d.c0 + 0.5, d.c1 - 0.8, d.w * 0.7, shade(paint, 1.12), d.roof);
  // Faróis na frente e lanternas atrás.
  for (const side of [-0.7, 0.7]) {
    dot(g, cx + ux * (d.l - 0.1) + px * d.w * side, cy + uy * (d.l - 0.1) + py * d.w * side - 1.4, 0xfff0a0);
    dot(g, cx - ux * (d.l - 0.1) + px * d.w * side, cy - uy * (d.l - 0.1) + py * d.w * side - 1.4, braking ? 0xff3030 : 0xb02a2a);
  }
  // Placa luminosa do táxi.
  if (style === "taxi") box(g, cx, cy, ux, uy, -0.4, 0.4, 0.5, 0xfff7a0, d.roof + 1);
}

/**
 * Pedestre (≈8 px): sombra, pernas que alternam, tronco com sombra lateral, braços que balançam,
 * cabeça com cabelo e, conforme a idade, mochila, bengala ou tamanho de criança.
 */
export interface PersonLook {
  shirt: number;
  pants: number;
  skin: number;
  hair: number;
  kid: boolean;
  old: boolean;
  seed: number;
}
export function drawPerson(g: Phaser.GameObjects.Graphics, sx: number, sy: number, look: PersonLook, walking: boolean, phase: number, faceRight: boolean) {
  const kid = look.kid;
  const legH = kid ? 1 : 2;
  const torsoH = kid ? 2 : 3;
  const stoop = look.old ? 1 : 0;
  const step = walking ? Math.floor(phase) % 2 : 0;
  const f = faceRight ? 1 : -1;
  // Sombra.
  g.fillStyle(SHADOW, 0.28);
  g.fillRect(sx - 2, sy, 5, 1);
  // Mochila (atrás do tronco) para parte dos adultos.
  const bag = !kid && !look.old && look.seed % 3 === 0;
  const ty = sy - legH - torsoH; // topo do tronco
  if (bag) {
    g.fillStyle(shade(look.shirt, 0.55), 1);
    g.fillRect(sx - 2 * f - (faceRight ? 0 : 1), ty, 1, 2);
  }
  // Pernas: uma sempre apoiada, a outra levantada no meio do passo; pés escuros.
  g.fillStyle(look.pants, 1);
  g.fillRect(sx - 1, sy - legH + (walking && step === 0 ? 1 : 0), 1, legH - (walking && step === 0 ? 1 : 0));
  g.fillRect(sx + 1 - 1, sy - legH + (walking && step === 1 ? 1 : 0), 1, legH - (walking && step === 1 ? 1 : 0));
  g.fillStyle(INK, 1);
  g.fillRect(sx - 1, sy - (walking && step === 0 ? 1 : 0) - 0, 1, 1);
  g.fillRect(sx, sy - (walking && step === 1 ? 1 : 0), 1, 1);
  // Tronco (a sombra cai do lado direito).
  g.fillStyle(look.shirt, 1);
  g.fillRect(sx - 1, ty + stoop, kid ? 2 : 3, torsoH);
  g.fillStyle(shade(look.shirt, 0.72), 1);
  g.fillRect(sx + (kid ? 0 : 1), ty + stoop, 1, torsoH);
  // Braços balançando em oposição às pernas.
  g.fillStyle(look.skin, 1);
  const armY = ty + stoop + (kid ? 0 : 1);
  g.fillRect(sx - 2, armY + (walking && step === 1 ? 1 : 0), 1, 2);
  g.fillRect(sx + (kid ? 1 : 2), armY + (walking && step === 0 ? 1 : 0), 1, 2);
  // Cabeça e cabelo.
  const hy = ty + stoop - 2;
  g.fillStyle(look.skin, 1);
  g.fillRect(sx - 1, hy, 3, 2);
  g.fillStyle(look.old ? 0xe8e8f0 : look.hair, 1);
  g.fillRect(sx - 1, hy - 1, 3, 1);
  g.fillRect(faceRight ? sx - 1 : sx + 1, hy, 1, 1);
  // Olho na direção em que olha.
  dot(g, faceRight ? sx + 1 : sx - 1, hy + 1, INK);
  // Bengala dos idosos.
  if (look.old) {
    g.fillStyle(0x8a5a2a, 1);
    g.fillRect(sx + 2 * f, sy - 3, 1, 3);
  }
}

/** Trem: locomotiva com cabine, farol e chaminé, seguida de vagões com janelas. */
export function drawTrain(g: Phaser.GameObjects.Graphics, x: number, y: number, ux: number, uy: number) {
  for (let k = 0; k < 3; k++) {
    const tx = x - ux * k * 7;
    const ty = y - uy * k * 7;
    box(g, tx + 0.5, ty + 0.8, ux, uy, -3.6, 3.6, 2.0, SHADOW, 0, 0.3);
    box(g, tx, ty, ux, uy, -3.7, 3.7, 2.1, INK, 0.5);
    if (k === 0) {
      box(g, tx, ty, ux, uy, -3.5, 3.5, 1.9, 0xa83a2a, 1.5);
      box(g, tx, ty, ux, uy, -3.5, -0.5, 1.9, 0x7a2a22, 3.2); // cabine
      box(g, tx, ty, ux, uy, 0.4, 3.0, 0.9, 0x2a2a30, 3.2); // caldeira
      dot(g, tx + ux * 2.2, ty + uy * 2.2 - 5.2, 0x2a2a30, 2); // chaminé
      dot(g, tx + ux * 3.5, ty + uy * 3.5 - 2.5, 0xffe9a0, 2); // farol
    } else {
      box(g, tx, ty, ux, uy, -3.5, 3.5, 1.9, k % 2 ? 0x3a5a8a : 0x4a8a5a, 1.5);
      box(g, tx, ty, ux, uy, -3.5, 3.5, 1.5, shade(k % 2 ? 0x3a5a8a : 0x4a8a5a, 1.2), 3);
      for (const along of [-2.2, -0.4, 1.4]) dot(g, tx + ux * along, ty + uy * along - 2.5, 0xffe9a0);
    }
    // Rodas.
    for (const along of [-2.4, 0, 2.4]) dot(g, tx + ux * along, ty + uy * along - 0.3, INK, 1);
  }
}
