// Event Bus mínimo entre Phaser e React — apenas eventos de interface.
// O estado do jogo em si vive no Zustand (fonte única de verdade).

type Events = {
  "tile:click": { x: number; y: number };
  "tile:hover": { x: number; y: number } | null;
  "area:select": { x0: number; y0: number; x1: number; y1: number };
};

type Handler<K extends keyof Events> = (payload: Events[K]) => void;

const handlers: { [K in keyof Events]?: Set<Handler<K>> } = {};

export const bus = {
  on<K extends keyof Events>(event: K, fn: Handler<K>) {
    (handlers[event] ??= new Set() as never).add(fn as never);
    return () => handlers[event]?.delete(fn as never);
  },
  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    handlers[event]?.forEach((fn) => (fn as Handler<K>)(payload));
  },
};
