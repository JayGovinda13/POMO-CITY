import { route, snapshot } from "@/server/api";
import { withPlayer } from "@/server/repo";

export const GET = route((id) => withPlayer(id, (rec) => snapshot(rec)));
