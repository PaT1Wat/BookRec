import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
// 🔥 กันพัง + debug ง่าย
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("❌ Missing Supabase environment variables");
}

// Helpful debug: show which URL the client is using (publishable key is public so we don't log it)
console.debug("Supabase URL:", SUPABASE_URL);

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
