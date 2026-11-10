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

for (let v = 0; v < 2; v++) {
  sprite(`water_${v}`, { w: 32, h: 16 }, (c) => {
    c.poly(ground(0), "b")
    // Reflexos curtos, deslocados por variante.
    const marks = v ? [[8, 6], [18, 4], [14, 10], [22, 9]] : [[10, 5], [16, 8], [21, 6], [9, 10]]
    for (const [x, y] of marks) {
      c.hline(x, y, 3, "c")
      c.hline(x + 1, y + 1, 2, "B")
    }
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

// Prefeitura: prédio clássico com colunas, cúpula e bandeira.
building("cityhall", 48, (c, oy) => {
  c.poly(ground(oy, 0), "p")
  const b = block(c, { oy, hw: 14, H: 12, top: "W", left: "w", right: "W" })
  // Colunas na fachada esquerda.
  for (let x = b.L[0] + 2; x < b.cx; x += 3) {
    const y = Math.round(b.L[1] + (x - b.L[0]) / 2)
    c.rect(x, y - 10, 1, 9, "Y")
  }
  for (let x = b.cx + 3; x < b.R[0] - 1; x += 4) {
    const y = Math.round(b.B[1] - (x - b.cx) / 2)
    c.rect(x, y - 9, 1, 3, "d")
  }
  parapet(c, b, "x")
  // Cúpula.
  const top = b.cy - b.H
  c.rect(b.cx - 4, top - 6, 9, 5, "w")
  c.ellipse(b.cx, top - 7, 5, 4, "K")
  c.px(b.cx - 2, top - 9, "q")
  c.vline(b.cx, top - 17, 7, "D")
  c.rect(b.cx + 1, top - 17, 4, 3, "N")
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
const SHIRTS = { agro: "E", madeira: "P", mineracao: "M", industria: "L", comercio: "Q", energia: "y", nenhum: "I" }

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

sheet("city", ["ground_*", "water_*", "road_*", "decor_*", "zone_*", "cityhall", "monument", "farm", "lumberyard", "mine", "sawmill", "smelter", "thermal_plant", "wind_turbine", "hydro_plant", "warehouse", "silo", "water_pump", "water_tower", "water_treatment", "power_pole", "pt_*"], { pad: 1 })
