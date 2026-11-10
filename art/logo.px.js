// POMO-CITY — logo: um tomate (pomodoro) com a silhueta da cidade dentro.
// Gerado com pxl (npm run logo). Saída: art/out/logo.png (32×32), ampliada sem suavizar para
// o favicon, os ícones de app e a tela inicial.

pal({
  k: "#1b1630", // contorno
  r: "#d8483a", // tomate
  R: "#a8322a", // sombra do tomate
  h: "#f07a5a", // brilho
  H: "#ffd2b0", // reflexo
  g: "#5fa84a", // folhas
  G: "#3f7a34", // folhas (sombra)
  w: "#f4f1e8", // prédios
  W: "#cdbb98", // prédios (sombra)
  y: "#ffe9a0", // janelas acesas
  d: "#7a2a24", // janelas apagadas
})

sprite("logo", { w: 32, h: 32, outline: "k" }, (c) => {
  // Corpo do tomate: sombra embaixo à direita, corpo, brilho em cima à esquerda.
  c.ellipse(16, 18, 14, 12, "R")
  c.ellipse(15, 17, 13, 11, "r")
  c.ellipse(10, 12, 4, 3, "h")
  c.px(8, 11, "H")
  c.px(9, 10, "H")

  // Cidade dentro do tomate (do chão para cima), recortada pela borda.
  const inside = (x, y) => ((x - 16) / 13.2) ** 2 + ((y - 18) / 11.2) ** 2 <= 1
  const towers = [
    [7, 23, 4], // x, topo, largura
    [11, 17, 4],
    [15, 13, 3],
    [18, 19, 5],
    [23, 21, 3],
  ]
  for (const [x0, top, w] of towers) {
    for (let x = x0; x < x0 + w; x++)
      for (let y = top; y <= 29; y++) {
        if (!inside(x, y)) continue
        c.px(x, y, x === x0 + w - 1 ? "W" : "w")
      }
    // Janelas: colunas alternadas, algumas acesas.
    for (let y = top + 2; y <= 27; y += 2)
      for (let x = x0 + 1; x < x0 + w - 1; x += 2) if (inside(x, y)) c.px(x, y, (x + y) % 3 === 0 ? "y" : "d")
  }
  // Antena da torre mais alta.
  c.px(16, 12, "w")
  c.px(16, 11, "y")

  // Coroa de folhas e cabinho.
  c.poly([16, 7, 10, 4, 13, 8], "g")
  c.poly([16, 7, 22, 4, 19, 8], "g")
  c.poly([16, 7, 12, 9, 16, 10, 20, 9], "G")
  c.rect(15, 2, 2, 5, "G")
  c.px(17, 2, "g")
})

sheet("logo", ["logo"], { pad: 0 })
