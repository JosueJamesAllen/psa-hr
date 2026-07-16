import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check .env (local) or the site's environment variables (Netlify).",
  );
}

// Sessions persisted by the previous localStorage config would otherwise
// linger with a valid refresh token; drop them so sessionStorage is the
// only place a session can live.
Object.keys(window.localStorage)
  .filter((key) => key.startsWith("sb-") && key.includes("-auth-token"))
  .forEach((key) => window.localStorage.removeItem(key));

export const supabase = createClient(
  url,
  anonKey,
  {
    auth: {
      // sessionStorage ends the session when the tab/browser closes
      // (survives reloads and the OAuth redirect within the same tab).
      storage: window.sessionStorage,
    },
  },
);
