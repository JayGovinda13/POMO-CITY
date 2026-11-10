// Gera os sprites com pxl e copia a folha para public/sprites/.
// Uso: npm run art   (PXL=/caminho/para/pxl.js para usar outra instalação)
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const candidates = [
  process.env.PXL,
  path.join(homedir(), ".claude/skills/pxl-pixel-art/bin/pxl.js"),
  path.join(homedir(), ".claude/skills/claude-pxl/bin/pxl.js"),
].filter(Boolean);
const pxl = candidates.find((p) => existsSync(p));
if (!pxl) {
  console.error("pxl não encontrado. Instale o skill (git clone https://github.com/crsolver/claude-pxl.git ~/.claude/skills/pxl-pixel-art) ou defina PXL.");
  process.exit(1);
}
execFileSync(process.execPath, [pxl, "build", "art/city.px.js"], { stdio: "inherit" });
mkdirSync("public/sprites", { recursive: true });
for (const f of ["city.png", "city.json"]) copyFileSync(path.join("art/out", f), path.join("public/sprites", f));
console.log("✓ public/sprites/city.png + city.json");
