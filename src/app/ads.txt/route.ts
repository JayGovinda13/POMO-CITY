import { ADSENSE_CLIENT, adsEnabled } from "@/lib/ads";

/** /ads.txt exigido pelo AdSense (só existe quando o ID de editor está configurado). */
export function GET() {
  if (!adsEnabled) return new Response("Not found", { status: 404 });
  const pub = ADSENSE_CLIENT.replace(/^ca-/, "");
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
}
