import { createClient } from "@supabase/supabase-js";

// Sessions persisted by the previous localStorage config would otherwise
// linger with a valid refresh token; drop them so sessionStorage is the
// only place a session can live.
Object.keys(window.localStorage)
  .filter((key) => key.startsWith("sb-") && key.includes("-auth-token"))
  .forEach((key) => window.localStorage.removeItem(key));

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      // sessionStorage ends the session when the tab/browser closes
      // (survives reloads and the OAuth redirect within the same tab).
      storage: window.sessionStorage,
    },
  },
);
