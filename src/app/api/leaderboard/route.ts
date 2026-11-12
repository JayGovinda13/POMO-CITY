import { NextResponse } from "next/server";
import { route } from "@/server/api";
import { repo } from "@/server/repo";

/** Ranking online: as 50 cidades mais avançadas e a posição de quem pergunta. */
export const GET = route(async (id) => {
  const board = await repo().leaderboard(50, id);
  return NextResponse.json(board, { headers: { "cache-control": "no-store" } });
});
