import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sessionClient } from "@/lib/supabase/server";

/** Destino dos links de e-mail (login por link mágico e confirmação de vínculo de e-mail). */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const sb = await sessionClient();

  let error: string | null = url.searchParams.get("error_description");
  if (code) error = (await sb.auth.exchangeCodeForSession(code)).error?.message ?? null;
  else if (tokenHash && type) error = (await sb.auth.verifyOtp({ token_hash: tokenHash, type })).error?.message ?? null;

  const dest = new URL("/", url.origin);
  if (error) dest.searchParams.set("auth_error", error);
  return NextResponse.redirect(dest);
}
