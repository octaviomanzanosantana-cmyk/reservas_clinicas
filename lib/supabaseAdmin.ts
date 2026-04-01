import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy init: lee process.env en runtime (dentro del getter),
// no en module scope. Esto evita capturar "" durante el build
// de Vercel donde las variables aún no están disponibles.
let _client: SupabaseClient | null = null;

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

      if (!url || !key) {
        throw new Error(
          "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL. " +
          "Add them to your environment variables.",
        );
      }
      _client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    return (_client as unknown as Record<string | symbol, unknown>)[prop];
  },
});
