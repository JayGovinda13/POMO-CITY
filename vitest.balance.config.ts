import { defineConfig } from "vitest/config";
import path from "node:path";

// Balanceamento: roda o robô em cenários (npm run balance). Não faz parte da suíte de testes.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["scripts/balance/**/*.balance.ts"], testTimeout: 600_000 },
});
