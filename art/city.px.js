// POMO-CITY — sprites isométricos (32×16 por tile), estilo city-builder anos 90.
// Gerado com pxl (https://github.com/crsolver/claude-pxl):
//   node ~/.claude/skills/pxl-pixel-art/bin/pxl.js build art/city.px.js
// Depois copie art/out/city.png e art/out/city.json para public/sprites/ (ver `npm run art`).
//
// Convenções
// - Terreno e estradas: losango 32×16 exato (sem contorno), desenhados no chão.
// - Construções: largura 32 + contorno (34 px). A base do losango toca a borda de baixo:
//   no Phaser, origem (0.5, 1) no vértice inferior do tile + 1 px do contorno.

pal({
  k: "#1b1630", // contorno
  // terreno
  g: "#6aa84f", G: "#558f40", h: "#86c065",
  f: "#3f7a3a", F: "#2f6130", v: "#5a9a48",
  s: "#e3c88a", S: "#cdb070", e: "#f0dca8",
  t: "#a7b8a6", T: "#8c9d8c", n: "#eef4f6",
  m: "#8f8a68", M: "#747054", j: "#a9a37e",
  b: "#3f6fb5", B: "#2f558f", c: "#7aa8e0",
  // estrada
  a: "#4d4d57", A: "#3d3d46", p: "#aaa79d", y: "#e8c94a",
  // paredes e telhados
  w: "#ecdfc2", W: "#cdbb98", x: "#b39d78",
  r: "#c0563e", R: "#8e3b2c",
  o: "#a85a3e", O: "#7f4330",
  q: "#7ab0e0", Q: "#4a80b8", u: "#2e5684",
  i: "#a3a196", I: "#7b796f", z: "#5f5550", Z: "#463e3b",
  d: "#2f3e5a", l: "#ffe9a0", L: "#f5b84a",
  // madeira, lavoura, metal
  P: "#9a6a3a", D: "#6e4a28",
  C: "#d9c25a", E: "#8faa45",
  H: "#e6e8ec", J: "#b8bcc4",
  K: "#3d6b8a", N: "#d84a3a", Y: "#f4f1e8",
})

// ───────────────────────── helpers de geometria isométrica ─────────────────────────

/** Losango do chão de um tile, com o topo em `oy`. */
const ground = (oy, ins = 0) => [16, oy + ins / 2, 32 - ins, oy + 8, 16, oy + 16 - ins / 2, ins, oy + 8]

/**
 * Bloco isométrico (paralelepípedo) com base num losango de meia-largura `hw` (par),
 * centrado no centro do tile. Devolve os vértices para detalhes.
 */
function block(c, { oy, hw = 12, H, top, left, right, dx = 0, dy = 0 }) {
  const cx = 16 + dx
  const cy = oy + 8 + dy
  const hh = hw / 2
  const L = [cx - hw, cy], B = [cx, cy + hh], R = [cx + hw, cy], T = [cx, cy - hh]
  c.poly([L[0], L[1], B[0], B[1], B[0], B[1] - H, L[0], L[1] - H], left)
  c.poly([B[0], B[1], R[0], R[1], R[0], R[1] - H, B[0], B[1] - H], right)
  if (top) c.poly([L[0], L[1] - H, T[0], T[1] - H, R[0], R[1] - H, B[0], B[1] - H], top)
  return { L, B, R, T, H, hw, hh, cx, cy }
}

/** Janelas acompanhando a inclinação das faces (esquerda e direita). */
function windows(c, b, { floors, fh, col = "d", lit = "l", step = 3, from = 2, every = 3, h = 2 }) {
  for (let f = 0; f < floors; f++) {
    const lift = f * fh + Math.round(fh / 2) + 1
    let n = 0
    for (let x = b.L[0] + from; x <= b.cx - 2; x += step) {
      const y = Math.round(b.L[1] + (x - b.L[0]) / 2) - lift
      c.rect(x, y, 1, h, (n++ + f) % every === 0 ? lit : col)
    }
    n = 1
    for (let x = b.cx + 2; x <= b.R[0] - from; x += step) {
      const y = Math.round(b.B[1] - (x - b.cx) / 2) - lift
      c.rect(x, y, 1, h, (n++ + f) % every === 0 ? lit : col)
    }
  }
}

/** Telhado em pirâmide sobre um bloco. */
function hipRoof(c, b, rh, light, dark) {
  const ax = b.cx, ay = b.cy - b.H - rh
  c.poly([b.L[0] - 1, b.L[1] - b.H, b.B[0], b.B[1] - b.H + 1, ax, ay], light)
  c.poly([b.B[0], b.B[1] - b.H + 1, b.R[0] + 1, b.R[1] - b.H, ax, ay], dark)
}

/** Platibanda (borda) em volta de um telhado plano. */
function parapet(c, b, col) {
  const y = (p) => p[1] - b.H
  c.line(b.L[0], y(b.L), b.T[0], y(b.T), col)
  c.line(b.T[0], y(b.T), b.R[0], y(b.R), col)
  c.line(b.L[0], y(b.L), b.B[0], y(b.B), col)
  c.line(b.B[0], y(b.B), b.R[0], y(b.R), col)
}

/** Chaminé cilíndrica-ish (2 tons) com topo. */
function chimney(c, x, yBase, h, w = 3, col = "z", dark = "Z", band) {
  c.rect(x, yBase - h, w, h, col)
  c.rect(x + w - 1, yBase - h, 1, h, dark)
  c.rect(x - 1, yBase - h - 1, w + 2, 2, dark)
  if (band) c.rect(x, yBase - h + 3, w, 1, band)
}

/** Porta na face esquerda, a `t` (0..1) do caminho entre L e B. */
function door(c, b, t = 0.5, col = "D") {
  const x = Math.round(b.L[0] + (b.cx - b.L[0]) * t)
  const y = Math.round(b.L[1] + (x - b.L[0]) / 2)
  c.rect(x, y - 4, 2, 4, col)
}

// ───────────────────────────────── terreno ─────────────────────────────────

/** Tile de chão: base + manchas com causa (tufos, ondulações, pedras), sem ruído aleatório. */
function groundTile(name, base, dark, light, marks) {
  for (let v = 0; v < 2; v++) {
    sprite(`ground_${name}_${v}`, { w: 32, h: 16 }, (c) => {
      c.poly(ground(0), base)
      const rng = c.rng(v * 7 + name.length)
      marks(c, rng, v, dark, light)
    })
  }
}

const inDiamond = (x, y) => Math.abs(x - 16) / 16 + Math.abs(y - 8) / 8 <= 0.82

/** Tufos de grama: pares de pixels claros/escuros. */
function tufts(c, rng, n, dark, light) {
  for (let i = 0; i < n; i++) {
    const x = 3 + Math.floor(rng() * 26), y = 2 + Math.floor(rng() * 12)
    if (!inDiamond(x, y)) continue
    c.px(x, y, light)
    c.px(x + 1, y + 1, dark)
  }
}

groundTile("plains", "g", "G", "h", (c, rng, v, d, l) => tufts(c, rng, 7 + v * 2, d, l))
groundTile("forest", "f", "F", "v", (c, rng, v, d, l) => tufts(c, rng, 9 + v * 2, d, l))
groundTile("desert", "s", "S", "e", (c, rng, v, d, l) => {
  // Ondulações de areia seguindo a diagonal isométrica.
  for (let i = 0; i < 3; i++) {
    const x = 6 + Math.floor(rng() * 14) + v, y = 4 + i * 3
    if (inDiamond(x, y) && inDiamond(x + 6, y + 3)) {
      c.line(x, y, x + 5, y + 2, d)
      c.line(x + 1, y - 1, x + 5, y + 1, l)
    }
  }
})
groundTile("tundra", "t", "T", "n", (c, rng, v, d, l) => {
  // Placas de neve e líquen.
  for (let i = 0; i < 3 + v; i++) {
    const x = 5 + Math.floor(rng() * 20), y = 3 + Math.floor(rng() * 9)
    if (!inDiamond(x, y) || !inDiamond(x + 4, y + 1)) continue
    c.rect(x, y, 4, 1, l)
    c.rect(x + 1, y + 1, 2, 1, l)
  }
  tufts(c, rng, 3, d, "T")
})
groundTile("mountains", "m", "M", "j", (c, rng, v, d, l) => {
  // Pedras: topo claro, base escura.
  for (let i = 0; i < 4 + v; i++) {
    const x = 4 + Math.floor(rng() * 23), y = 3 + Math.floor(rng() * 10)
    if (!inDiamond(x, y) || !inDiamond(x + 2, y + 1)) continue
    c.rect(x, y, 2, 1, l)
    c.rect(x, y + 1, 3, 1, d)
  }
})

// Água em 4 quadros: os reflexos caminham na diagonal (o jogo alterna os quadros → ondas).
for (let v = 0; v < 4; v++) {
  sprite(`water_${v}`, { w: 32, h: 16 }, (c) => {
    c.poly(ground(0), "b")
    const base = [[10, 5], [16, 8], [21, 6], [9, 10], [14, 3], [20, 11]]
    for (const [x0, y0] of base) {
      const x = x0 + v * 2, y = y0 + (v >> 1)
      if (!inDiamond(x, y) || !inDiamond(x + 3, y + 1)) continue
      c.hline(x, y, 3, "c")
      c.hline(x + 1, y + 1, 2, "B")
    }
  })
}
// Espuma na beira do mar, uma por aresta do losango (mesma máscara das estradas:
// 1 = x−1 cima-esq., 2 = y−1 cima-dir., 4 = x+1 baixo-dir., 8 = y+1 baixo-esq.).
for (const [mask, x0, y0, x1, y1] of [[1, 1, 7, 15, 0], [2, 16, 0, 30, 7], [4, 30, 8, 16, 15], [8, 15, 15, 1, 8]]) {
  sprite(`foam_${mask}`, { w: 32, h: 16 }, (c) => {
    c.line(x0, y0, x1, y1, "Y")
    // Respingos soltos junto da linha.
    const mx = Math.round((x0 + x1) / 2), my = Math.round((y0 + y1) / 2)
    const inx = mx < 16 ? 2 : -2, iny = my < 8 ? 1 : -1
    c.px(mx + inx, my + iny, "c")
    c.px(Math.round((x0 * 3 + x1) / 4) + inx, Math.round((y0 * 3 + y1) / 4) + iny, "Y")
    c.px(Math.round((x0 + x1 * 3) / 4) + inx * 2, Math.round((y0 + y1 * 3) / 4) + iny, "c")
  })
}
// Faixa de areia (praia): areia molhada com conchas.
for (let v = 0; v < 2; v++) {
  sprite(`beach_${v}`, { w: 32, h: 16 }, (c) => {
    c.poly(ground(0), "s")
    const rng = c.rng(31 + v)
    for (let i = 0; i < 7; i++) {
      const x = 4 + Math.floor(rng() * 24), y = 2 + Math.floor(rng() * 12)
      if (!inDiamond(x, y)) continue
      c.px(x, y, i % 3 ? "e" : "S")
      if (i === 2) c.px(x + 1, y, "Y")
    }
    c.line(8 + v * 3, 8, 14 + v * 3, 11, "S")
  })
}

// ───────────────────────────────── estradas ─────────────────────────────────
// Máscara de vizinhos: 1 = x−1 (cima-esq.), 2 = y−1 (cima-dir.), 4 = x+1 (baixo-dir.), 8 = y+1 (baixo-esq.)

const EDGES = {
  1: { mid: [8, 4], a: [0, 8], b: [16, 0] },
  2: { mid: [24, 4], a: [16, 0], b: [32, 8] },
  4: { mid: [24, 12], a: [32, 8], b: [16, 16] },
  8: { mid: [8, 12], a: [16, 16], b: [0, 8] },
}

for (let mask = 0; mask < 16; mask++) {
  sprite(`road_${mask}`, { w: 32, h: 16 }, (c) => {
    c.poly(ground(0), "a")
    // Meio-fio nas bordas sem conexão.
    for (const bit of [1, 2, 4, 8]) {
      if (mask & bit) continue
      const e = EDGES[bit]
      c.line(e.a[0], e.a[1], e.b[0], e.b[1], "p")
    }
    // Faixa amarela tracejada do centro até cada saída.
    const conns = [1, 2, 4, 8].filter((bit) => mask & bit)
    for (const bit of conns) {
      const [mx, my] = EDGES[bit].mid
      for (let t = 0.15; t < 1; t += 0.3) {
        const x = Math.round(16 + (mx - 16) * t), y = Math.round(8 + (my - 8) * t)
        c.hline(x, y, 2, "y")
      }
    }
    if (conns.length !== 2) c.rect(15, 7, 2, 2, "A") // cruzamento / ponta
  })
}

// Rodovia (Fase 8): pista larga de concreto com mureta central e faixas brancas.
for (let mask = 0; mask < 16; mask++) {
  sprite(`highway_${mask}`, { w: 32, h: 16 }, (c) => {
    c.poly(ground(0), "I")
    for (const bit of [1, 2, 4, 8]) {
      if (mask & bit) continue
      const e = EDGES[bit]
      c.line(e.a[0], e.a[1], e.b[0], e.b[1], "J")
    }
    const conns = [1, 2, 4, 8].filter((bit) => mask & bit)
    for (const bit of conns) {
      const [mx, my] = EDGES[bit].mid
      // Mureta central (cinza claro) e faixas brancas tracejadas dos dois lados.
      c.line(16, 8, mx, my, "H")
      for (let t = 0.2; t < 1; t += 0.35) {
        const x = Math.round(16 + (mx - 16) * t), y = Math.round(8 + (my - 8) * t)
        c.px(x - 3, y - 1, "Y")
        c.px(x + 3, y + 1, "Y")
      }
    }
    if (conns.length !== 2) c.rect(15, 7, 2, 2, "J")
  })
}

// Trilho (Fase 8): leito de brita, dormentes de madeira e dois trilhos de aço.
for (let mask = 0; mask < 16; mask++) {
  sprite(`rail_${mask}`, { w: 32, h: 16 }, (c) => {
    c.poly(ground(0), "g")
    const conns = [1, 2, 4, 8].filter((bit) => mask & bit)
    const ends = conns.length ? conns : [1, 4]
    // Direção transversal na tela: via no eixo x (bits 1/4) → dormentes no eixo y, e vice-versa.
    const across = (bit) => (bit === 1 || bit === 4 ? [2, -1] : [2, 1])
    for (const bit of ends) {
      const [mx, my] = EDGES[bit].mid
      const [ax, ay] = across(bit)
      c.poly([16 + ax * 2, 8 + ay * 2, mx + ax * 2, my + ay * 2, mx - ax * 2, my - ay * 2, 16 - ax * 2, 8 - ay * 2], "j")
    }
    for (const bit of ends) {
      const [mx, my] = EDGES[bit].mid
      const [ax, ay] = across(bit)
      for (const t of [0.2, 0.55, 0.9]) {
        const x = Math.round(16 + (mx - 16) * t), y = Math.round(8 + (my - 8) * t)
        c.line(x - ax * 2, y - ay * 2, x + ax * 2, y + ay * 2, "D")
      }
    }
    for (const bit of ends) {
      const [mx, my] = EDGES[bit].mid
      const [ax, ay] = across(bit)
      c.line(16 + ax, 8 + ay, mx + ax, my + ay, "J")
      c.line(16 - ax, 8 - ay, mx - ax, my - ay, "J")
    }
  })
}

// Acesso à rodovia: trevo com setas.
sprite("onramp", { w: 32, h: 16 }, (c) => {
  c.poly(ground(0), "a")
  c.poly(ground(0, 10), "g")
  c.line(4, 8, 16, 2, "y")
  c.line(16, 14, 28, 8, "y")
  c.px(16, 2, "Y")
  c.px(28, 8, "Y")
})

// ───────────────────────────────── vegetação ─────────────────────────────────

sprite("_tree_round", { w: 12, h: 16 }, (c) => {
  c.rect(5, 11, 2, 5, "D")
  c.circ(6, 6, 5, "f")
  c.circ(5, 5, 3, "v")
  c.px(4, 3, "h")
})
sprite("_tree_pine", { w: 10, h: 18 }, (c) => {
  c.rect(4, 14, 2, 4, "D")
  c.poly([5, 0, 10, 8, 0, 8], "F")
  c.poly([5, 4, 10, 14, 0, 14], "f")
  c.line(5, 1, 2, 7, "v")
})
sprite("_pine_snow", { w: 10, h: 18 }, (c) => {
  c.rect(4, 14, 2, 4, "D")
  c.poly([5, 0, 10, 8, 0, 8], "F")
  c.poly([5, 4, 10, 14, 0, 14], "f")
  c.line(5, 0, 1, 7, "n")
  c.line(5, 4, 1, 13, "n")
})
sprite("_cactus", { w: 8, h: 14 }, (c) => {
  c.rect(3, 1, 2, 13, "E")
  c.rect(0, 5, 2, 4, "E")
  c.rect(1, 8, 2, 1, "E")
  c.rect(6, 3, 2, 5, "E")
  c.rect(5, 7, 1, 1, "E")
  c.vline(3, 1, 13, "v")
})
sprite("_rock", { w: 10, h: 7 }, (c) => {
  c.poly([1, 7, 2, 2, 5, 0, 9, 3, 10, 7], "M")
  c.poly([2, 3, 5, 0, 8, 3, 5, 4], "j")
})

/** Decoração de terreno vazio: 32×(16+altura), base no losango. */
function decor(name, parts) {
  sprite(name, { w: 32, h: 34, outline: "k" }, (c) => {
    for (const [p, x, y] of parts) c.stamp(p, x, y)
  })
}
decor("decor_forest_0", [["_tree_round", 6, 14], ["_tree_pine", 17, 10], ["_tree_round", 12, 18]])
decor("decor_forest_1", [["_tree_pine", 8, 12], ["_tree_pine", 15, 15], ["_tree_round", 19, 16]])
decor("decor_plains_0", [["_tree_round", 11, 16]])
decor("decor_plains_1", [["_tree_round", 6, 17], ["_tree_round", 16, 14]])
decor("decor_desert_0", [["_cactus", 12, 18]])
decor("decor_desert_1", [["_cactus", 8, 19], ["_rock", 18, 25]])
decor("decor_tundra_0", [["_pine_snow", 11, 14]])
decor("decor_tundra_1", [["_pine_snow", 7, 15], ["_pine_snow", 16, 13]])
decor("decor_mountains_0", [["_rock", 6, 24], ["_rock", 15, 22], ["_tree_pine", 18, 12]])
decor("decor_mountains_1", [["_rock", 10, 22], ["_rock", 14, 26]])

// ───────────────────────────────── construções ─────────────────────────────────

/** Construção com canvas 32×hc; `draw(c, oy)` recebe o topo do losango do chão. */
function building(name, hc, draw) {
  sprite(name, { w: 32, h: hc, outline: "k" }, (c) => draw(c, hc - 16))
}

// Zona residencial
building("zone_R_L1", 30, (c, oy) => {
  c.poly(ground(oy, 4), "G")
  const b = block(c, { oy, hw: 10, H: 7, left: "w", right: "W" })
  windows(c, b, { floors: 1, fh: 7, step: 4, every: 2 })
  door(c, b, 0.35)
  hipRoof(c, b, 8, "r", "R")
})
building("zone_R_L2", 36, (c, oy) => {
  c.poly(ground(oy, 2), "G")
  const b = block(c, { oy, hw: 12, H: 13, left: "w", right: "W" })
  windows(c, b, { floors: 2, fh: 6, step: 3, every: 2 })
  door(c, b, 0.3)
  hipRoof(c, b, 9, "Q", "u")
})
building("zone_R_D1", 32, (c, oy) => {
  const b = block(c, { oy, hw: 14, H: 12, top: "x", left: "o", right: "O" })
  windows(c, b, { floors: 2, fh: 6, every: 3 })
  parapet(c, b, "W")
  door(c, b, 0.5)
})
building("zone_R_D2", 40, (c, oy) => {
  const b = block(c, { oy, hw: 14, H: 20, top: "x", left: "o", right: "O" })
  windows(c, b, { floors: 3, fh: 6, every: 3 })
  parapet(c, b, "W")
  c.rect(b.cx - 3, b.cy - b.H - 4, 4, 3, "I") // caixa d'água
})
building("zone_R_D3", 48, (c, oy) => {
  const b = block(c, { oy, hw: 14, H: 28, top: "W", left: "w", right: "x" })
  windows(c, b, { floors: 4, fh: 6, every: 4 })
  parapet(c, b, "x")
})
building("zone_R_D4", 58, (c, oy) => {
  const b = block(c, { oy, hw: 12, H: 38, top: "x", left: "w", right: "W" })
  windows(c, b, { floors: 6, fh: 6, step: 3, every: 4 })
  parapet(c, b, "x")
  c.vline(b.cx, b.cy - b.H - b.hh - 6, 6, "I")
})

// Zona comercial
building("zone_C_L1", 30, (c, oy) => {
  c.poly(ground(oy, 2), "p")
  const b = block(c, { oy, hw: 12, H: 8, top: "i", left: "w", right: "W" })
  // Toldo listrado na fachada esquerda (listras de 2 px acompanhando a inclinação).
  for (let x = b.L[0]; x < b.cx; x++) {
    const y = Math.round(b.L[1] + (x - b.L[0]) / 2) - 7
    c.rect(x, y, 1, 3, Math.floor(x / 2) % 2 ? "N" : "Y")
  }
  c.rect(b.cx + 3, b.cy - 6, 6, 3, "q") // vitrine
  c.rect(b.cx - 4, b.cy - b.H - b.hh - 3, 8, 3, "N") // letreiro
})
building("zone_C_L2", 34, (c, oy) => {
  c.poly(ground(oy, 2), "p")
  const b = block(c, { oy, hw: 13, H: 12, top: "i", left: "q", right: "Q" })
  windows(c, b, { floors: 2, fh: 6, col: "u", lit: "Y", every: 4 })
  c.rect(b.cx - 5, b.cy - b.H - b.hh - 4, 10, 3, "L") // letreiro
  c.hline(b.cx - 4, b.cy - b.H - b.hh - 3, 8, "N")
})
for (const [lvl, H, hw] of [[1, 14, 14], [2, 22, 13], [3, 32, 12], [4, 44, 11]]) {
  building(`zone_C_D${lvl}`, 22 + H, (c, oy) => {
    c.poly(ground(oy, 0), "p")
    const b = block(c, { oy, hw, H, top: "i", left: "q", right: "Q" })
    // Faixas de vidro horizontais (pele de vidro).
    for (let f = 0; f < Math.floor(H / 4); f++) {
      const lift = f * 4 + 3
      c.line(b.L[0] + 1, b.L[1] - lift, b.cx - 1, b.B[1] - lift, f % 3 === 1 ? "Y" : "u")
      c.line(b.cx + 1, b.B[1] - lift, b.R[0] - 1, b.R[1] - lift, "u")
    }
    parapet(c, b, "J")
    if (lvl === 4) {
      c.vline(b.cx, b.cy - b.H - b.hh - 7, 7, "J")
      c.px(b.cx, b.cy - b.H - b.hh - 8, "N")
    }
  })
}

/** Torre em andares empilhados (base → topo). Devolve os blocos para os detalhes. */
function tower(c, oy, segs) {
  const out = []
  let lift = 0
  for (const sg of segs) {
    const b = block(c, { oy: oy - lift, hw: sg.hw, H: sg.H, top: sg.top, left: sg.left, right: sg.right })
    if (sg.win) windows(c, b, { floors: Math.floor(sg.H / (sg.win.fh ?? 6)), fh: 6, ...sg.win })
    if (sg.bands) {
      for (let f = 0; f < Math.floor(sg.H / 4); f++) {
        const up = f * 4 + 3
        c.line(b.L[0] + 1, b.L[1] - up, b.cx - 1, b.B[1] - up, f % 3 === 1 ? sg.bands[1] : sg.bands[0])
        c.line(b.cx + 1, b.B[1] - up, b.R[0] - 1, b.R[1] - up, sg.bands[0])
      }
    }
    if (sg.parapet) parapet(c, b, sg.parapet)
    out.push(b)
    lift += sg.H
  }
  return out
}
const roofY = (b) => b.cy - b.H - b.hh
const mast = (c, b, h, col = "J") => { c.vline(b.cx, roofY(b) + b.hh - h, h, col); c.px(b.cx, roofY(b) + b.hh - h - 1, "N") }

// Residencial densa das eras: Elétrica (art déco), Atômica (lâmina modernista), Digital (vidro),
// Verde (terraços-jardim) e Futuro (torre branca com luz ciano).
building("zone_R_D5", 66, (c, oy) => {
  const [, t] = tower(c, oy, [
    { hw: 12, H: 34, left: "o", right: "O", win: { every: 3 } },
    { hw: 8, H: 10, top: "x", left: "o", right: "O", win: { every: 2 }, parapet: "W" },
  ])
  c.rect(t.cx - 2, roofY(t) + t.hh - 4, 4, 4, "W")
  mast(c, t, 8, "x")
})
building("zone_R_D6", 72, (c, oy) => {
  const [b] = tower(c, oy, [{ hw: 12, H: 50, top: "Y", left: "w", right: "W", win: { every: 4, step: 3 }, parapet: "x" }])
  // Varandas corridas.
  for (let f = 1; f < 8; f++) c.line(b.L[0] + 1, b.L[1] - f * 6, b.cx - 1, b.B[1] - f * 6, "x")
  c.rect(b.cx - 4, roofY(b) + b.hh - 4, 5, 4, "I")
})
building("zone_R_D7", 80, (c, oy) => {
  const [, t] = tower(c, oy, [
    { hw: 12, H: 46, left: "q", right: "Q", bands: ["u", "Y"] },
    { hw: 9, H: 10, top: "i", left: "q", right: "Q", bands: ["u", "Y"], parapet: "J" },
  ])
  mast(c, t, 6)
})
building("zone_R_D8", 86, (c, oy) => {
  const bs = tower(c, oy, [
    { hw: 13, H: 22, top: "E", left: "w", right: "W", win: { every: 3 } },
    { hw: 11, H: 22, top: "E", left: "w", right: "W", win: { every: 3 } },
    { hw: 9, H: 18, top: "E", left: "w", right: "W", win: { every: 2 } },
  ])
  // Jardins nos terraços e no topo.
  for (const b of bs) {
    c.px(b.L[0] + 2, b.L[1] - b.H - 1, "f")
    c.px(b.R[0] - 2, b.R[1] - b.H - 1, "F")
    c.px(b.cx - 1, b.B[1] - b.H - 1, "f")
  }
  const t = bs[2]
  c.circ(t.cx - 2, roofY(t) + t.hh - 2, 2, "f")
  c.circ(t.cx + 3, roofY(t) + t.hh - 1, 1, "v")
})
building("zone_R_D9", 98, (c, oy) => {
  const bs = tower(c, oy, [
    { hw: 12, H: 30, left: "H", right: "J", bands: ["c", "l"] },
    { hw: 10, H: 26, left: "H", right: "J", bands: ["c", "l"] },
    { hw: 7, H: 16, top: "Y", left: "H", right: "J", bands: ["q", "l"] },
  ])
  const t = bs[2]
  c.vline(t.cx, roofY(t) + t.hh - 10, 10, "H")
  c.px(t.cx, roofY(t) + t.hh - 11, "c")
  c.hline(t.cx - 2, roofY(t) + t.hh - 5, 5, "c")
})

// Comercial densa das eras.
building("zone_C_D5", 78, (c, oy) => {
  const bs = tower(c, oy, [
    { hw: 11, H: 34, left: "i", right: "I", win: { col: "u", lit: "Y", every: 3 } },
    { hw: 8, H: 12, left: "i", right: "I", win: { col: "u", lit: "Y", every: 2 } },
    { hw: 5, H: 6, top: "L", left: "J", right: "I" },
  ])
  mast(c, bs[2], 9, "L")
})
building("zone_C_D6", 78, (c, oy) => {
  const [b] = tower(c, oy, [{ hw: 11, H: 56, top: "I", left: "u", right: "d", bands: ["K", "c"], parapet: "J" }])
  c.rect(b.cx - 5, roofY(b) + b.hh - 3, 10, 3, "Z")
})
building("zone_C_D7", 90, (c, oy) => {
  const bs = tower(c, oy, [
    { hw: 12, H: 44, left: "q", right: "Q", bands: ["u", "Y"] },
    { hw: 9, H: 16, top: "i", left: "q", right: "Q", bands: ["u", "Y"] },
  ])
  hipRoof(c, bs[1], 9, "c", "u")
  c.vline(bs[1].cx, roofY(bs[1]) + bs[1].hh - 15, 6, "J")
})
building("zone_C_D8", 92, (c, oy) => {
  const bs = tower(c, oy, [
    { hw: 12, H: 36, left: "q", right: "K", bands: ["E", "Y"] },
    { hw: 10, H: 30, top: "u", left: "q", right: "K", bands: ["E", "Y"], parapet: "E" },
  ])
  const t = bs[1]
  // Painéis solares e uma pequena turbina no topo.
  c.line(t.cx - 5, roofY(t) + t.hh, t.cx + 3, roofY(t) + t.hh - 3, "c")
  c.vline(t.cx + 5, roofY(t) + t.hh - 9, 8, "H")
  c.line(t.cx + 3, roofY(t) + t.hh - 10, t.cx + 7, roofY(t) + t.hh - 8, "H")
})
building("zone_C_D9", 108, (c, oy) => {
  const bs = tower(c, oy, [
    { hw: 11, H: 30, left: "u", right: "d", bands: ["c", "l"] },
    { hw: 12, H: 6, left: "H", right: "J" },
    { hw: 9, H: 28, left: "u", right: "d", bands: ["c", "l"] },
    { hw: 10, H: 5, left: "H", right: "J" },
    { hw: 6, H: 14, top: "c", left: "q", right: "Q", bands: ["l", "Y"] },
  ])
  const t = bs[4]
  c.vline(t.cx, roofY(t) + t.hh - 12, 12, "H")
  c.px(t.cx, roofY(t) + t.hh - 13, "N")
})

// Zona industrial
building("zone_I_L1", 30, (c, oy) => {
  c.poly(ground(oy, 2), "p")
  const b = block(c, { oy, hw: 13, H: 8, top: "I", left: "i", right: "I" })
  // Claraboias em fileira no telhado, paralelas à aresta L→T.
  for (let k = 1; k <= 3; k++) {
    const t = k / 4
    const x0 = Math.round(b.L[0] + (b.B[0] - b.L[0]) * t), y0 = Math.round(b.L[1] + (b.B[1] - b.L[1]) * t) - b.H
    const x1 = Math.round(b.T[0] + (b.R[0] - b.T[0]) * t), y1 = Math.round(b.T[1] + (b.R[1] - b.T[1]) * t) - b.H
    c.line(x0 + 2, y0 - 1, x1 - 2, y1 + 1, "J")
    c.line(x0 + 2, y0, x1 - 2, y1 + 2, "Z")
  }
  c.rect(b.cx + 4, b.cy - 5, 4, 5, "Z") // portão
})
building("zone_I_L2", 38, (c, oy) => {
  c.poly(ground(oy, 2), "p")
  const b = block(c, { oy, hw: 12, H: 10, top: "J", left: "i", right: "I" })
  windows(c, b, { floors: 1, fh: 8, col: "Z", lit: "l", every: 5 })
  chimney(c, b.R[0] - 6, b.R[1] - b.H, 14, 3, "z", "Z", "N")
})
for (const [lvl, H, chimneys] of [[1, 10, 1], [2, 12, 2], [3, 14, 2], [4, 16, 3]]) {
  building(`zone_I_D${lvl}`, 30 + H + 6, (c, oy) => {
    c.poly(ground(oy, 0), "p")
    const b = block(c, { oy, hw: 14, H, top: "J", left: "i", right: "I" })
    windows(c, b, { floors: Math.floor(H / 6), fh: 6, col: "Z", lit: "L", every: 4 })
    for (let k = 0; k < chimneys; k++) chimney(c, b.cx + 1 + k * 5 - chimneys * 2, b.cy - b.H - 1, 12 + lvl * 2, 3, "z", "Z", "N")
    if (lvl >= 3) {
      // Tanque cilíndrico.
      c.rect(b.L[0] + 2, b.L[1] - b.H - 8, 6, 8, "J")
      c.rect(b.L[0] + 6, b.L[1] - b.H - 8, 2, 8, "I")
      c.ellipse(b.L[0] + 4, b.L[1] - b.H - 8, 3, 1, "H")
    }
  })
}

// Industrial densa das eras: mais chaminés e tanques, depois fábrica limpa, verde e automatizada.
building("zone_I_D5", 60, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 14, H: 18, top: "J", left: "o", right: "O" })
  windows(c, b, { floors: 3, fh: 6, col: "Z", lit: "L", every: 3 })
  for (let k = 0; k < 3; k++) chimney(c, b.cx - 6 + k * 5, b.cy - b.H - 1, 22, 3, "o", "O", "Y")
  c.rect(b.L[0] + 2, b.L[1] - b.H - 9, 6, 9, "J")
  c.ellipse(b.L[0] + 4, b.L[1] - b.H - 9, 3, 1, "H")
})
building("zone_I_D6", 60, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 14, H: 16, top: "H", left: "J", right: "i" })
  windows(c, b, { floors: 2, fh: 7, col: "u", lit: "q", every: 2, h: 3 })
  // Esfera de gás e torre de destilação.
  c.circ(b.cx + 5, b.cy - b.H - 6, 5, "H")
  c.circ(b.cx + 6, b.cy - b.H - 5, 3, "J")
  c.rect(b.cx - 8, b.cy - b.H - 22, 4, 22, "J")
  c.rect(b.cx - 5, b.cy - b.H - 22, 1, 22, "I")
  for (let k = 0; k < 4; k++) c.hline(b.cx - 9, b.cy - b.H - 4 - k * 5, 6, "N")
})
building("zone_I_D7", 56, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 14, H: 20, top: "Y", left: "H", right: "J" })
  // Faixa azul e janelas em fita (sala limpa).
  c.line(b.L[0] + 1, b.L[1] - 14, b.cx - 1, b.B[1] - 14, "Q")
  c.line(b.cx + 1, b.B[1] - 14, b.R[0] - 1, b.R[1] - 14, "u")
  c.line(b.L[0] + 1, b.L[1] - 7, b.cx - 1, b.B[1] - 7, "q")
  c.line(b.cx + 1, b.B[1] - 7, b.R[0] - 1, b.R[1] - 7, "Q")
  parapet(c, b, "J")
  // Antena parabólica e exaustores.
  c.circ(b.cx + 4, b.cy - b.H - 5, 3, "H")
  c.line(b.cx + 4, b.cy - b.H - 5, b.cx + 7, b.cy - b.H - 8, "I")
  c.rect(b.cx - 7, b.cy - b.H - 4, 3, 3, "I")
})
building("zone_I_D8", 58, (c, oy) => {
  c.poly(ground(oy, 0), "G")
  const b = block(c, { oy, hw: 14, H: 18, top: "E", left: "w", right: "W" })
  windows(c, b, { floors: 2, fh: 8, col: "u", lit: "c", every: 2, h: 3 })
  // Painéis solares no telhado verde e turbina.
  for (let k = 0; k < 3; k++) c.line(b.cx - 8 + k * 4, b.cy - b.H + 1 - k, b.cx - 2 + k * 4, b.cy - b.H - 2 - k, "u")
  c.vline(b.cx + 8, b.cy - b.H - 16, 15, "H")
  c.line(b.cx + 8, b.cy - b.H - 16, b.cx + 8, b.cy - b.H - 22, "H")
  c.line(b.cx + 8, b.cy - b.H - 16, b.cx + 13, b.cy - b.H - 13, "H")
  c.line(b.cx + 8, b.cy - b.H - 16, b.cx + 3, b.cy - b.H - 13, "J")
})
building("zone_I_D9", 62, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 14, H: 14, top: "H", left: "u", right: "d" })
  for (let f = 0; f < 3; f++) {
    c.line(b.L[0] + 1, b.L[1] - 3 - f * 4, b.cx - 1, b.B[1] - 3 - f * 4, f === 1 ? "l" : "c")
    c.line(b.cx + 1, b.B[1] - 3 - f * 4, b.R[0] - 1, b.R[1] - 3 - f * 4, "c")
  }
  // Domo do reator e braço robótico.
  c.circ(b.cx - 3, b.cy - b.H - 5, 7, "Q")
  c.circ(b.cx - 4, b.cy - b.H - 6, 5, "q")
  c.px(b.cx - 6, b.cy - b.H - 9, "Y")
  c.hline(b.cx - 10, b.cy - b.H - 2, 15, "l")
  c.line(b.cx + 8, b.cy - b.H, b.cx + 10, b.cy - b.H - 12, "J", 2)
  c.line(b.cx + 10, b.cy - b.H - 12, b.cx + 5, b.cy - b.H - 16, "H", 2)
  c.px(b.cx + 4, b.cy - b.H - 16, "N")
})

// Prefeitura: palácio de 3 tiles em linha (eixo x), inspirado no Palácio dos Bandeirantes (SP):
// fachada longa e clara de pilastras, corpo central mais alto com pórtico, gramado e bandeiras.
sprite("cityhall", { w: 64, h: 62, outline: "k" }, (c) => {
  const oy = 62 - 32
  // Grade do palácio: i = 0..24 ao longo dos 3 tiles (eixo x), j = 0..8 na profundidade.
  const P = (i, j, up = 0) => [Math.round(16 + (i - j) * 2), Math.round(oy + i + j - up)]
  const quad = (pts, col) => c.poly(pts.flat(), col)
  const prism = (i0, i1, j0, j1, H, top, front, side) => {
    quad([P(i0, j1), P(i1, j1), P(i1, j1, H), P(i0, j1, H)], front)
    quad([P(i1, j1), P(i1, j0), P(i1, j0, H), P(i1, j1, H)], side)
    quad([P(i0, j0, H), P(i1, j0, H), P(i1, j1, H), P(i0, j1, H)], top)
  }
  // Gramado, esplanada e caminho de entrada.
  quad([P(0, 0), P(24, 0), P(24, 8), P(0, 8)], "g")
  quad([P(8, 6), P(16, 6), P(16, 8), P(8, 8)], "p")
  quad([P(0, 6.6), P(8, 6.6), P(8, 7.4), P(0, 7.4)], "h")
  quad([P(16, 6.6), P(24, 6.6), P(24, 7.4), P(16, 7.4)], "h")

  // Alas: 3 andares de janelas entre pilastras.
  const H = 13
  prism(1, 23, 1, 5.5, H, "x", "w", "W")
  for (let i = 1.5; i < 23; i += 1) {
    if (i > 8 && i < 16) continue
    const [x, y] = P(i, 5.5)
    for (const up of [3, 7, 11]) c.px(x, y - up, "d")
    c.px(x, y - 12, "Y")
  }
  for (let j = 1.75; j < 5.5; j += 1) {
    const [x, y] = P(23, j)
    for (const up of [3, 7, 11]) c.px(x, y - up, "u")
  }
  // Platibanda clara em toda a volta.
  c.line(...P(1, 5.5, H), ...P(23, 5.5, H), "Y")
  c.line(...P(23, 5.5, H), ...P(23, 1, H), "Y")
  c.line(...P(1, 1, H), ...P(23, 1, H), "W")
  c.line(...P(1, 1, H), ...P(1, 5.5, H), "W")

  // Corpo central, mais alto e avançado, com pórtico de colunas.
  const HC = 19
  prism(8, 16, 0.5, 6.2, HC, "W", "Y", "w")
  for (let i = 8.5; i < 16; i += 1) {
    const [x, y] = P(i, 6.2)
    c.vline(x, y - 14, 13, i % 2 < 1 ? "d" : "w")
    c.px(x, y - 16, "x")
  }
  c.line(...P(8, 6.2, 15), ...P(16, 6.2, 15), "x")
  c.line(...P(8, 6.2, HC), ...P(16, 6.2, HC), "H")
  c.line(...P(16, 6.2, HC), ...P(16, 0.5, HC), "H")
  // Porta e escadaria.
  const [dx, dy] = P(12, 6.2)
  c.rect(dx - 1, dy - 6, 3, 6, "D")
  c.line(...P(10.5, 6.8), ...P(13.5, 6.8), "Y")
  c.line(...P(10.5, 7.3), ...P(13.5, 7.3), "J")

  // Bandeiras no topo: Brasil, São Paulo e a da cidade.
  const flags = [[10, ["f", "y", "f"]], [12, ["Z", "Y", "N"]], [14, ["H", "Q", "H"]]]
  for (const [i, cols] of flags) {
    const [x, y] = P(i, 3.4, HC)
    c.vline(x, y - 9, 9, "J")
    cols.forEach((col, k) => c.hline(x + 1, y - 9 + k, 4, col))
  }
  // Arbustos e canteiros no gramado.
  for (const [i, j] of [[2, 7], [5, 7.2], [19, 7], [22, 7.2], [0.8, 3], [0.8, 5]]) {
    const [x, y] = P(i, j)
    c.circ(x, y - 1, 1, "F")
    c.px(x, y - 2, "v")
  }
})


// Monumento: obelisco sobre pedestal.
building("monument", 52, (c, oy) => {
  c.poly(ground(oy, 2), "p")
  const b = block(c, { oy, hw: 9, H: 4, top: "Y", left: "w", right: "W" })
  const base = b.cy - b.H
  c.poly([b.cx - 3, base, b.cx - 1, base - 32, b.cx + 1, base - 32, b.cx + 3, base], "Y")
  c.poly([b.cx, base - 32, b.cx + 3, base, b.cx, base], "J")
  c.poly([b.cx - 1, base - 32, b.cx, base - 36, b.cx + 1, base - 32], "L")
})

// ───────────────────────────── produção ─────────────────────────────

building("farm", 24, (c, oy) => {
  // Lavoura em fileiras na diagonal + celeiro pequeno.
  c.poly(ground(oy, 0), "E")
  for (let k = -4; k <= 4; k++) {
    c.line(8 + k * 3, oy + 4 + Math.abs(k) * 0, 18 + k * 3, oy + 9, "C")
  }
  const b = block(c, { oy, hw: 6, H: 6, left: "N", right: "R", dx: 6, dy: -2 })
  hipRoof(c, b, 4, "D", "P")
})
building("lumberyard", 30, (c, oy) => {
  c.poly(ground(oy, 2), "S")
  // Pilhas de toras (círculos de topo).
  for (const [x, y] of [[6, 8], [10, 8], [8, 6], [16, 11], [20, 11], [18, 9]]) {
    c.circ(x, oy + y, 2, "P")
    c.px(x, oy + y, "C")
  }
  const b = block(c, { oy, hw: 6, H: 7, left: "P", right: "D", dx: 7, dy: -3, top: "D" })
  hipRoof(c, b, 3, "I", "Z")
})
building("mine", 30, (c, oy) => {
  c.poly(ground(oy, 0), "M")
  // Monte de pedra com a boca da mina.
  c.poly([4, oy + 10, 12, oy - 2, 20, oy - 4, 28, oy + 8, 16, oy + 14], "m")
  c.poly([12, oy - 2, 20, oy - 4, 18, oy + 2], "j")
  c.rect(13, oy + 4, 6, 6, "Z")
  c.rect(12, oy + 3, 8, 1, "P")
  c.vline(12, oy + 4, 6, "P")
  c.vline(19, oy + 4, 6, "P")
  // Trilho e vagonete.
  c.line(16, oy + 10, 24, oy + 14, "J")
  c.rect(21, oy + 9, 4, 3, "I")
  c.px(22, oy + 9, "j")
})
building("sawmill", 34, (c, oy) => {
  c.poly(ground(oy, 2), "S")
  const b = block(c, { oy, hw: 11, H: 10, top: "D", left: "P", right: "D" })
  windows(c, b, { floors: 1, fh: 8, col: "Z", lit: "l", every: 3 })
  hipRoof(c, b, 6, "I", "Z")
  // Pilha de tábuas.
  for (let k = 0; k < 3; k++) c.hline(3, oy + 10 - k, 8, k % 2 ? "C" : "P")
})
building("smelter", 46, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 13, H: 12, top: "I", left: "z", right: "Z" })
  // Boca do forno acesa.
  const x = b.L[0] + 5, y = Math.round(b.L[1] + 2.5) - 6
  c.rect(x, y, 4, 4, "L")
  c.rect(x + 1, y + 1, 2, 2, "l")
  chimney(c, b.R[0] - 7, b.R[1] - b.H, 20, 4, "z", "Z", "N")
})

// ───────────────────────────── energia ─────────────────────────────

building("thermal_plant", 50, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 14, H: 12, top: "J", left: "i", right: "I" })
  windows(c, b, { floors: 1, fh: 8, col: "Z", lit: "L", every: 3 })
  chimney(c, b.cx - 6, b.cy - b.H - 2, 22, 4, "Y", "J", "N")
  chimney(c, b.cx + 3, b.cy - b.H, 18, 4, "Y", "J", "N")
})
building("wind_turbine", 50, (c, oy) => {
  c.poly(ground(oy, 6), "G")
  const hubX = 16, hubY = oy - 22
  c.line(16, oy + 8, hubX, hubY, "H", 2)
  c.vline(17, hubY + 2, oy + 8 - hubY - 2, "J")
  // Pás (três, fixas no ângulo da 1ª pose).
  c.line(hubX, hubY, hubX, hubY - 11, "H", 2)
  c.line(hubX, hubY, hubX + 10, hubY + 6, "H", 2)
  c.line(hubX, hubY, hubX - 10, hubY + 6, "J", 2)
  c.circ(hubX, hubY, 1, "N")
})
building("solar_plant", 30, (c, oy) => {
  c.poly(ground(oy, 2), "G")
  // Fileiras de painéis inclinados.
  for (let r = 0; r < 3; r++) {
    const x = 6 + r * 4, y = oy + 3 + r * 3
    c.poly([x, y + 3, x + 12, y - 3, x + 14, y - 1, x + 2, y + 5], "u")
    c.line(x + 1, y + 3, x + 12, y - 2, "q")
    c.line(x + 4, y + 2, x + 6, y + 3, "c")
    c.vline(x + 2, y + 5, 2, "J")
    c.vline(x + 13, y, 2, "J")
  }
})
building("nuclear_plant", 52, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 9, H: 9, top: "J", left: "i", right: "I", dx: -5, dy: 2 })
  windows(c, b, { floors: 1, fh: 7, col: "Z", lit: "q", every: 2 })
  // Torre de resfriamento (hiperboloide) soltando vapor.
  const tx = 21, base = oy + 9
  for (let k = 0; k < 24; k++) {
    const w = 5 + Math.round(2.4 * ((k - 14) / 12) ** 2 * 2)
    c.hline(tx - w, base - k, w, "H")
    c.hline(tx, base - k, w, "J")
  }
  c.hline(tx - 5, base - 24, 10, "Z")
  c.hline(tx - 6, base - 8, 12, "N")
  c.circ(tx, base - 28, 3, "Y")
  c.circ(tx + 3, base - 32, 2, "H")
})
building("recycling_center", 36, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 12, H: 10, top: "E", left: "v", right: "F", dx: 1 })
  windows(c, b, { floors: 1, fh: 8, col: "Z", lit: "l", every: 3 })
  badge(c, b, "Y", 0.5, 0)
  // Caçambas coloridas.
  c.rect(3, oy + 9, 4, 3, "Q")
  c.rect(8, oy + 11, 4, 3, "N")
  c.rect(4, oy + 12, 3, 2, "C")
})
building("fusion_plant", 50, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 14, H: 8, top: "H", left: "J", right: "i" })
  windows(c, b, { floors: 1, fh: 6, col: "u", lit: "c", every: 2 })
  // Reator: domo com anel de plasma.
  const cx = b.cx, cy = b.cy - b.H - 4
  c.circ(cx, cy, 8, "Q")
  c.circ(cx - 1, cy - 1, 6, "q")
  c.circ(cx - 2, cy - 3, 2, "c")
  c.hline(cx - 9, cy + 1, 19, "l")
  c.hline(cx - 8, cy + 2, 17, "L")
  c.vline(cx, cy - 16, 8, "H")
  c.px(cx, cy - 17, "N")
})
building("hydro_plant", 32, (c, oy) => {
  c.poly(ground(oy, 0), "b")
  const b = block(c, { oy, hw: 14, H: 10, top: "J", left: "i", right: "I" })
  // Comportas com água descendo.
  for (let x = b.L[0] + 3; x < b.cx - 1; x += 4) {
    const y = Math.round(b.L[1] + (x - b.L[0]) / 2)
    c.rect(x, y - 8, 2, 8, "c")
    c.vline(x + 1, y - 8, 8, "b")
  }
  c.rect(b.cx + 4, b.cy - b.H - 4, 5, 3, "w")
})

// ───────────────────────────── armazenagem ─────────────────────────────

building("warehouse", 32, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 14, H: 10, left: "P", right: "D" })
  // Tábuas verticais na fachada (seguem a inclinação) e portão largo.
  for (let x = b.L[0] + 2; x < b.cx; x += 3) {
    const y = Math.round(b.L[1] + (x - b.L[0]) / 2)
    c.vline(x, y - b.H + 1, b.H - 1, "D")
  }
  c.rect(b.cx + 3, b.cy - 6, 7, 6, "Z")
  c.rect(b.cx + 4, b.cy - 5, 5, 1, "I")
  hipRoof(c, b, 5, "r", "R")
})
building("silo", 44, (c, oy) => {
  c.poly(ground(oy, 4), "S")
  // Dois silos cilíndricos (corpo + faixa + cúpula).
  for (const [x, h] of [[8, 22], [17, 18]]) {
    const yb = oy + 11
    c.rect(x, yb - h, 8, h, "J")
    c.rect(x + 5, yb - h, 3, h, "I")
    c.rect(x, yb - h + 5, 8, 1, "I")
    c.ellipse(x + 3.5, yb - h, 4, 2, "H")
    c.ellipse(x + 3.5, yb, 4, 1, "I")
  }
})

// ───────────────────────────── água ─────────────────────────────

building("water_pump", 30, (c, oy) => {
  c.poly(ground(oy, 6), "p")
  const b = block(c, { oy, hw: 8, H: 7, top: "I", left: "K", right: "u" })
  // Cano saindo do poço e manivela.
  c.rect(b.cx - 1, b.cy - b.H - b.hh - 5, 3, 5, "J")
  c.rect(b.cx - 4, b.cy - b.H - b.hh - 6, 9, 2, "I")
  c.px(b.L[0] + 2, b.L[1] - 3, "c")
  c.px(b.L[0] + 3, b.L[1] - 2, "c")
})
building("water_tower", 52, (c, oy) => {
  c.poly(ground(oy, 8), "S")
  const cx = 16, base = oy + 9
  // Pernas de metal.
  c.line(cx - 6, base, cx - 4, base - 18, "I")
  c.line(cx + 6, base, cx + 4, base - 18, "I")
  c.line(cx, base + 2, cx, base - 18, "J")
  c.line(cx - 5, base - 9, cx + 5, base - 9, "I")
  // Tanque cilíndrico com cúpula.
  c.rect(cx - 7, base - 32, 15, 14, "c")
  c.rect(cx + 3, base - 32, 5, 14, "b")
  c.rect(cx - 7, base - 25, 15, 1, "B")
  c.ellipse(cx, base - 32, 7, 3, "H")
  c.ellipse(cx, base - 18, 7, 2, "b")
})
building("water_treatment", 34, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 9, H: 9, top: "J", left: "i", right: "I", dx: -5, dy: -1 })
  windows(c, b, { floors: 1, fh: 8, col: "Z", lit: "l", every: 3 })
  // Tanques de decantação redondos com água.
  for (const [x, y] of [[22, oy + 6], [18, oy + 11]]) {
    c.ellipse(x, y, 5, 3, "I")
    c.ellipse(x, y - 1, 4, 2, "c")
    c.px(x - 1, y - 1, "H")
  }
})

// ───────────────────────────── serviços (Fase 7) ─────────────────────────────

/** Placa/emblema colorido na face direita. */
function badge(c, b, col, t = 0.5, dy = 0) {
  const x = Math.round(b.cx + (b.R[0] - b.cx) * t)
  const y = Math.round(b.B[1] - (x - b.cx) / 2) - Math.round(b.H / 2) - 1 + dy
  c.rect(x - 1, y - 1, 3, 3, col)
}

building("police", 38, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 13, H: 12, top: "J", left: "K", right: "u" })
  windows(c, b, { floors: 2, fh: 5, col: "d", lit: "l", every: 3 })
  parapet(c, b, "H")
  door(c, b, 0.5, "Y")
  // Giroflex no telhado e viatura.
  c.rect(b.cx - 1, b.cy - b.H - 3, 3, 2, "N")
  c.px(b.cx + 1, b.cy - b.H - 3, "c")
  c.rect(b.R[0] - 6, b.R[1] + 2, 6, 3, "Y")
  c.rect(b.R[0] - 5, b.R[1] + 1, 3, 1, "d")
})
building("fire_station", 38, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 13, H: 12, top: "x", left: "N", right: "R" })
  // Portões da garagem (face direita) e torre de treino.
  for (let k = 0; k < 2; k++) {
    const x = b.cx + 2 + k * 5
    const y = Math.round(b.B[1] - (x - b.cx) / 2)
    c.rect(x, y - 7, 4, 7, "Y")
    c.hline(x, y - 4, 4, "J")
  }
  door(c, b, 0.4, "D")
  const t = block(c, { oy, hw: 4, H: 22, top: "W", left: "N", right: "R", dx: -7, dy: -1 })
  c.rect(t.cx - 1, t.cy - t.H + 3, 2, 2, "d")
})
building("prison", 36, (c, oy) => {
  c.poly(ground(oy, 0), "i")
  // Muro em volta.
  c.poly([2, oy + 8, 16, oy + 1, 30, oy + 8, 16, oy + 15], "I")
  c.poly([4, oy + 8, 16, oy + 2, 28, oy + 8, 16, oy + 14], "i")
  const b = block(c, { oy, hw: 9, H: 12, top: "J", left: "z", right: "Z" })
  // Grades.
  for (let x = b.L[0] + 2; x < b.cx; x += 2) c.vline(x, Math.round(b.L[1] + (x - b.L[0]) / 2) - 9, 5, "k")
  for (let x = b.cx + 2; x < b.R[0]; x += 2) c.vline(x, Math.round(b.B[1] - (x - b.cx) / 2) - 9, 5, "k")
  c.vline(4, oy + 2, 6, "z")
  c.rect(3, oy + 1, 3, 2, "l")
})
building("hospital", 46, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 14, H: 20, top: "J", left: "H", right: "J" })
  windows(c, b, { floors: 3, fh: 6, col: "q", lit: "c", every: 4 })
  parapet(c, b, "Y")
  door(c, b, 0.5, "Q")
  // Cruz vermelha no telhado.
  const ty = b.cy - b.H
  c.rect(b.cx - 1, ty - 3, 3, 7, "N")
  c.rect(b.cx - 3, ty - 1, 7, 3, "N")
})
building("school", 34, (c, oy) => {
  c.poly(ground(oy, 0), "g")
  const b = block(c, { oy, hw: 13, H: 9, left: "L", right: "o" })
  windows(c, b, { floors: 1, fh: 8, col: "d", lit: "q", step: 3, every: 2, h: 3 })
  door(c, b, 0.5)
  hipRoof(c, b, 6, "r", "R")
  // Mastro com bandeira.
  c.vline(28, oy - 6, 14, "J")
  c.rect(29, oy - 6, 3, 2, "E")
})
building("college", 48, (c, oy) => {
  c.poly(ground(oy, 0), "G")
  const b = block(c, { oy, hw: 14, H: 16, top: "x", left: "o", right: "O" })
  windows(c, b, { floors: 2, fh: 7, col: "d", lit: "l", every: 3, h: 3 })
  parapet(c, b, "W")
  // Torre do relógio.
  const t = block(c, { oy, hw: 4, H: 30, top: "x", left: "o", right: "O", dy: -1 })
  c.circ(t.cx + 2, t.cy - t.H + 6, 1, "Y")
  hipRoof(c, t, 6, "u", "d")
})
building("library", 34, (c, oy) => {
  c.poly(ground(oy, 2), "p")
  const b = block(c, { oy, hw: 13, H: 10, top: "W", left: "w", right: "W" })
  // Colunas na fachada esquerda.
  for (let x = b.L[0] + 2; x < b.cx - 1; x += 3) {
    const y = Math.round(b.L[1] + (x - b.L[0]) / 2)
    c.rect(x, y - 9, 1, 8, "Y")
  }
  windows(c, b, { floors: 1, fh: 8, col: "D", lit: "L", every: 2 })
  hipRoof(c, b, 4, "K", "u")
})
building("museum", 42, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 14, H: 12, top: "Y", left: "Y", right: "H" })
  for (let x = b.L[0] + 2; x < b.cx - 1; x += 3) {
    const y = Math.round(b.L[1] + (x - b.L[0]) / 2)
    c.rect(x, y - 11, 1, 10, "J")
  }
  badge(c, b, "L")
  // Frontão triangular.
  c.poly([b.L[0] - 1, b.L[1] - b.H, b.cx, b.cy - b.H - 10, b.B[0], b.B[1] - b.H], "H")
  c.poly([b.B[0], b.B[1] - b.H, b.cx, b.cy - b.H - 10, b.R[0] + 1, b.R[1] - b.H], "J")
})

// ───────────────────────────── lazer (Fase 7) ─────────────────────────────

building("plaza", 30, (c, oy) => {
  c.poly(ground(oy, 0), "h")
  c.poly(ground(oy, 6), "e")
  // Chafariz no centro e bancos.
  c.ellipse(16, oy + 8, 4, 2, "I")
  c.ellipse(16, oy + 7, 3, 1, "c")
  c.vline(16, oy + 3, 4, "c")
  c.rect(6, oy + 8, 3, 1, "D")
  c.rect(23, oy + 8, 3, 1, "D")
  c.stamp("_tree_round", 2, oy - 8)
})
building("park", 34, (c, oy) => {
  c.poly(ground(oy, 0), "h")
  // Caminho de terra cruzando o parque e lago.
  c.line(4, oy + 8, 28, oy + 8, "e", 2)
  c.ellipse(21, oy + 11, 4, 2, "b")
  c.ellipse(21, oy + 10, 3, 1, "c")
  c.stamp("_tree_round", 5, oy - 10)
  c.stamp("_tree_pine", 15, oy - 14)
  c.stamp("_tree_round", 9, oy - 4)
})
building("zoo", 36, (c, oy) => {
  c.poly(ground(oy, 0), "E")
  // Cercado, lago, tenda e uma girafa.
  c.line(2, oy + 8, 16, oy + 1, "D")
  c.line(16, oy + 1, 30, oy + 8, "D")
  c.ellipse(10, oy + 10, 4, 2, "b")
  c.stamp("_tree_round", 18, oy - 6)
  c.rect(23, oy - 6, 2, 12, "C")
  c.rect(22, oy - 8, 4, 2, "C")
  c.px(24, oy - 3, "D")
  c.px(23, oy + 1, "D")
  c.rect(20, oy + 3, 7, 3, "C")
  c.poly([4, oy + 6, 8, oy - 2, 12, oy + 6], "N")
  c.vline(8, oy - 4, 2, "J")
})
building("stadium", 40, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  // Arquibancada oval com gramado no centro.
  c.ellipse(16, oy + 6, 15, 8, "J")
  c.ellipse(16, oy + 8, 15, 7, "I")
  c.ellipse(16, oy + 5, 12, 5, "i")
  c.ellipse(16, oy + 5, 9, 3, "g")
  c.line(10, oy + 5, 22, oy + 5, "Y")
  c.ellipse(16, oy + 5, 1, 1, "Y")
  // Torres de iluminação.
  for (const x of [3, 28]) {
    c.vline(x, oy - 10, 14, "z")
    c.rect(x - 1, oy - 12, 3, 2, "l")
  }
})

// ───────────────────────────── transporte (Fase 8) ─────────────────────────────

building("bus_stop", 30, (c, oy) => {
  c.poly(ground(oy, 6), "p")
  // Abrigo: cobertura, banco e placa.
  c.rect(9, oy - 2, 12, 2, "Q")
  c.vline(10, oy, 9, "I")
  c.vline(20, oy, 9, "I")
  c.rect(11, oy + 5, 8, 2, "D")
  c.vline(24, oy - 4, 14, "J")
  c.rect(22, oy - 6, 5, 4, "y")
  c.px(24, oy - 5, "d")
})
building("train_station", 40, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 13, H: 11, left: "o", right: "O" })
  windows(c, b, { floors: 1, fh: 9, col: "d", lit: "l", every: 2, h: 3 })
  door(c, b, 0.5)
  hipRoof(c, b, 6, "u", "d")
  // Relógio no telhado.
  c.circ(b.cx, b.cy - b.H - 4, 2, "Y")
  c.px(b.cx, b.cy - b.H - 5, "k")
})
building("airport", 40, (c, oy) => {
  c.poly(ground(oy, 0), "I")
  // Pista com faixas e terminal com torre de controle.
  c.line(2, oy + 8, 16, oy + 15, "Y")
  c.line(16, oy + 1, 30, oy + 8, "a")
  for (let k = 0; k < 4; k++) c.px(20 + k * 2, oy + 3 + k, "Y")
  const b = block(c, { oy, hw: 8, H: 7, top: "J", left: "H", right: "J", dx: -5, dy: -1 })
  windows(c, b, { floors: 1, fh: 6, col: "q", lit: "c", every: 2 })
  c.rect(b.cx + 7, b.cy - 18, 3, 16, "J")
  c.rect(b.cx + 6, b.cy - 22, 5, 4, "q")
  // Avião estacionado.
  c.rect(19, oy + 9, 9, 2, "H")
  c.rect(22, oy + 7, 2, 6, "H")
  c.px(27, oy + 8, "N")
})
building("seaport", 40, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  // Cais de madeira, contêineres e guindaste.
  c.poly([2, oy + 8, 16, oy + 15, 18, oy + 14, 4, oy + 7], "P")
  for (const [x, y, col] of [[8, oy + 3, "N"], [13, oy + 5, "Q"], [10, oy + 1, "E"]]) {
    c.rect(x, y, 6, 3, col)
    c.hline(x, y, 6, "k")
  }
  c.vline(22, oy - 14, 22, "y")
  c.line(22, oy - 14, 30, oy - 8, "y")
  c.line(22, oy - 14, 16, oy - 10, "y")
  c.vline(29, oy - 8, 8, "J")
  c.rect(28, oy, 3, 2, "z")
})

// ───────────────────────────── terreno (Fase 9) ─────────────────────────────

building("tunnel", 32, (c, oy) => {
  c.poly(ground(oy, 0), "a")
  // Morro de pedra com a boca do túnel e a estrada entrando.
  c.poly([2, oy + 8, 8, oy - 4, 16, oy - 9, 24, oy - 4, 30, oy + 8, 16, oy + 2], "m")
  c.poly([16, oy - 9, 24, oy - 4, 30, oy + 8, 18, oy + 1], "M")
  c.ellipse(13, oy + 3, 5, 5, "Z")
  c.rect(8, oy + 3, 11, 5, "Z")
  c.ellipse(13, oy + 3, 3, 3, "k")
  c.rect(10, oy + 3, 7, 5, "k")
  c.line(7, oy + 8, 19, oy + 8, "j")
  c.hline(12, oy + 11, 3, "y")
})
building("desalination", 40, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 10, H: 12, top: "J", left: "H", right: "J", dx: -4, dy: -1 })
  windows(c, b, { floors: 1, fh: 9, col: "q", lit: "c", every: 2 })
  // Tanques de membrana e tubulação azul até o mar.
  for (const [x, y] of [[21, oy + 4], [25, oy + 8]]) {
    c.rect(x - 3, y - 9, 6, 9, "c")
    c.rect(x + 1, y - 9, 2, 9, "b")
    c.ellipse(x, y - 9, 3, 1, "H")
  }
  c.line(4, oy + 9, 16, oy + 15, "K")
})
building("marina", 30, (c, oy) => {
  c.poly(ground(oy, 0), "b")
  // Píer de madeira com barcos a vela.
  c.poly([4, oy + 8, 16, oy + 2, 18, oy + 3, 6, oy + 9], "P")
  c.poly([14, oy + 3, 26, oy + 9, 24, oy + 10, 12, oy + 4], "P")
  for (const [x, y] of [[9, oy + 12], [21, oy + 5]]) {
    c.rect(x - 3, y, 7, 2, "Y")
    c.vline(x, y - 9, 9, "D")
    c.poly([x + 1, y - 9, x + 1, y - 1, x + 5, y - 1], "H")
  }
  c.rect(25, oy + 2, 4, 4, "w")
  c.rect(25, oy + 1, 4, 1, "r")
})

// Poste de transmissão.
sprite("power_pole", { w: 8, h: 16, outline: "k" }, (c) => {
  c.vline(3, 2, 14, "D")
  c.hline(0, 3, 8, "D")
  c.px(0, 2, "J")
  c.px(7, 2, "J")
})

// ───────────────────────────── retratos dos cidadãos ─────────────────────────────
// Camadas sobrepostas (todas 18×20 depois do contorno): corpo (cor pela profissão), cabeça
// (4 tons de pele), cabelo (5 estilos × 4 cores) e rosto conforme o humor.

pal({
  1: "#f2c9a0", 2: "#d9a882", // pele clara
  3: "#d9a27a", 4: "#b9825c", // pele média
  5: "#a86f4a", 6: "#8a5638", // pele morena
  7: "#6e4630", 8: "#53331f", // pele escura
  9: "#2a2230", // cabelo preto
})

const SKINS = [["1", "2"], ["3", "4"], ["5", "6"], ["7", "8"]]
const HAIR = ["9", "D", "C", "J"]
const SHIRTS = { agro: "E", madeira: "P", mineracao: "M", industria: "L", comercio: "Q", energia: "y", servicos: "K", nenhum: "I" }

// Elipse do rosto (para recortar cabelos volumosos).
const inFace = (x, y) => ((x - 8) / 4.5) ** 2 + ((y - 7.5) / 4.5) ** 2 <= 1

for (const [cat, col] of Object.entries(SHIRTS)) {
  sprite(`pt_body_${cat}`, { w: 16, h: 18, outline: "k" }, (c) => {
    c.poly([0, 18, 1, 14, 4, 12, 12, 12, 15, 14, 16, 18], col)
    c.poly([6, 12, 8, 15, 10, 12], "Y") // gola
  })
}

SKINS.forEach(([skin, dark], k) => {
  sprite(`pt_head_${k}`, { w: 16, h: 18, outline: "k" }, (c) => {
    c.rect(6, 10, 4, 3, dark) // pescoço
    c.ellipse(8, 7, 4, 5, skin)
    c.px(3, 7, skin) // orelhas
    c.px(13, 7, skin)
    c.vline(12, 5, 5, dark) // sombra do lado direito
    c.px(11, 11, dark)
  })
})

const HAIRSTYLES = [
  // 0: curto
  (c, h) => { c.rect(4, 1, 9, 3, h); c.px(4, 4, h); c.px(12, 4, h) },
  // 1: longo
  (c, h) => { c.rect(4, 1, 9, 3, h); c.rect(3, 3, 2, 10, h); c.rect(12, 3, 2, 10, h) },
  // 2: coque
  (c, h) => { c.rect(4, 2, 9, 2, h); c.circ(8, 0, 2, h); c.px(4, 4, h); c.px(12, 4, h) },
  // 3: volumoso (recortado em volta do rosto)
  (c, h) => {
    for (let y = -2; y < 13; y++)
      for (let x = 1; x < 16; x++) {
        const inHair = (x - 8) ** 2 + (y - 5) ** 2 <= 49
        if (inHair && (!inFace(x, y) || y < 4)) c.px(x, y, h)
      }
  },
  // 4: boné (o cabelo aparece nas laterais)
  (c, h) => { c.px(4, 5, h); c.px(12, 5, h); c.rect(4, 0, 9, 4, "N"); c.rect(1, 3, 6, 1, "R") },
]

HAIRSTYLES.forEach((draw, st) => {
  HAIR.forEach((h, k) => {
    sprite(`pt_hair_${st}_${k}`, { w: 16, h: 18, outline: "k" }, (c) => draw(c, h))
  })
})

// Rostos (sem contorno, já no tamanho final 18×20: coordenadas +1).
const FACES = {
  feliz: (c) => { c.px(7, 8, "k"); c.px(11, 8, "k"); c.px(7, 11, "k"); c.hline(8, 12, 3, "k"); c.px(11, 11, "k"); c.px(6, 10, "N"); c.px(12, 10, "N") },
  ok: (c) => { c.px(7, 8, "k"); c.px(11, 8, "k"); c.hline(8, 11, 3, "k") },
  triste: (c) => {
    c.px(7, 8, "k"); c.px(11, 8, "k")
    c.px(6, 6, "k"); c.px(7, 6, "k"); c.px(11, 6, "k"); c.px(12, 6, "k") // sobrancelhas caídas
    c.px(7, 12, "k"); c.hline(8, 11, 3, "k"); c.px(11, 12, "k")
    c.px(7, 9, "c") // lágrima
  },
}
for (const [mood, draw] of Object.entries(FACES)) sprite(`pt_mood_${mood}`, { w: 18, h: 20 }, (c) => draw(c))

sheet("city", ["ground_*", "water_*", "road_*", "highway_*", "rail_*", "onramp", "foam_*", "beach_*", "decor_*", "zone_*", "cityhall", "monument", "farm", "lumberyard", "mine", "sawmill", "smelter", "thermal_plant", "wind_turbine", "hydro_plant", "solar_plant", "nuclear_plant", "recycling_center", "fusion_plant", "warehouse", "silo", "water_pump", "water_tower", "water_treatment", "police", "fire_station", "prison", "hospital", "school", "college", "library", "museum", "plaza", "park", "zoo", "stadium", "bus_stop", "train_station", "airport", "seaport", "tunnel", "desalination", "marina", "power_pole", "pt_*"], { pad: 1 })
