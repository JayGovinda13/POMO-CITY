// Utilitários de grade reutilizados por energia, acesso viário e (fases futuras) água e serviços.

export interface GridSize {
  width: number;
  height: number;
}

export const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export const tileIndex = (g: GridSize, x: number, y: number) => y * g.width + x;
export const inGrid = (g: GridSize, x: number, y: number) => x >= 0 && y >= 0 && x < g.width && y < g.height;

export function neighbors4(g: GridSize, i: number): number[] {
  const x = i % g.width;
  const y = Math.floor(i / g.width);
  const out: number[] = [];
  for (const [dx, dy] of DIRS4) {
    const nx = x + dx;
    const ny = y + dy;
    if (inGrid(g, nx, ny)) out.push(tileIndex(g, nx, ny));
  }
  return out;
}

/**
 * BFS multi-origem. Retorna a distância (em passos 4-vizinhos) de cada tile alcançado,
 * ou -1. `passable` decide por onde a busca pode andar; `maxDist` corta a expansão.
 * A ordem de visita é determinística (fila FIFO, origens na ordem dada).
 */
export function bfsDistances(
  g: GridSize,
  sources: Iterable<number>,
  passable: (i: number) => boolean,
  maxDist = Infinity,
): { dist: Int32Array; order: number[] } {
  const dist = new Int32Array(g.width * g.height).fill(-1);
  const order: number[] = [];
  const queue: number[] = [];
  for (const s of sources) {
    if (dist[s] !== -1) continue;
    dist[s] = 0;
    queue.push(s);
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    order.push(i);
    if (dist[i] >= maxDist) continue;
    for (const n of neighbors4(g, i)) {
      if (dist[n] !== -1 || !passable(n)) continue;
      dist[n] = dist[i] + 1;
      queue.push(n);
    }
  }
  return { dist, order };
}

/** Componentes conectados (4-vizinhança) dentro do conjunto `member`. Retorna id do componente por tile (-1 fora). */
export function components(g: GridSize, member: (i: number) => boolean): Int32Array {
  const comp = new Int32Array(g.width * g.height).fill(-1);
  let next = 0;
  for (let i = 0; i < comp.length; i++) {
    if (comp[i] !== -1 || !member(i)) continue;
    const stack = [i];
    comp[i] = next;
    while (stack.length) {
      const c = stack.pop()!;
      for (const n of neighbors4(g, c)) {
        if (comp[n] === -1 && member(n)) {
          comp[n] = next;
          stack.push(n);
        }
      }
    }
    next++;
  }
  return comp;
}
