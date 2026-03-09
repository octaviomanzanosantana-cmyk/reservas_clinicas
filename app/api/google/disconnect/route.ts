import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const GOOGLE_TOKEN_ROW_ID = "default";

export async function POST() {
  const { error } = await supabaseAdmin
    .from("google_calendar_tokens")
    .update({
      access_token: null,
      refresh_token: null,
      scope: null,
      token_type: null,
      expiry_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", GOOGLE_TOKEN_ROW_ID);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ disconnected: true });
}
