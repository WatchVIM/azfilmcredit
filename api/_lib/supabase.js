import { createClient } from "@supabase/supabase-js";

function getEnv(name, fallbacks = []) {
  if (process.env[name]) return process.env[name];
  for (const fb of fallbacks) {
    if (process.env[fb]) return process.env[fb];
  }
  return undefined;
}

/**
 * Server-side admin client (Service Role).
 * - Use ONLY in API routes / server context.
 * - Never expose SERVICE_ROLE_KEY to the browser.
 */
export function supabaseAdmin() {
  const url = getEnv("SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL"]);
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY", [
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SERVICE_ROLE",
    "SUPABASE_SERVICE_ROLE_SECRET"
  ]);

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in environment variables."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: {
        "X-Client-Info": "azfilmcredit-api",
      },
    },
  });
}

/**
 * (Optional) Server-side anon client (public key).
 * Useful if you ever want to read public data safely from API routes.
 */
export function supabaseAnon() {
  const url = getEnv("SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL"]);
  const anon = getEnv("SUPABASE_ANON_KEY", ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

  if (!url || !anon) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: {
        "X-Client-Info": "azfilmcredit-api-anon",
      },
    },
  });
}
