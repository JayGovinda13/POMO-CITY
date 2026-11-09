import { snapshot } from "@/server/api";
import { withPlayer } from "@/server/repo";
import { getPlayerId } from "@/server/session";

export async function GET() {
  const id = await getPlayerId();
  return withPlayer(id, (rec) => snapshot(rec));
}
