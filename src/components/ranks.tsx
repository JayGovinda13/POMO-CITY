import type { Rank } from "@/sim";

export const RANK_CLASS: Record<Rank, string> = {
  D: "bg-zinc-600 text-zinc-100",
  C: "bg-emerald-700 text-emerald-50",
  B: "bg-sky-700 text-sky-50",
  A: "bg-violet-700 text-violet-50",
  S: "bg-amber-400 text-amber-950",
};

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function RankBadge({ rank }: { rank: Rank }) {
  return <span className={`inline-block px-1 leading-4 text-[10px] font-bold ${RANK_CLASS[rank]}`}>{rank}</span>;
}
