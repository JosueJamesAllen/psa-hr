import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { mapEmployee } from "../lib/leaveApi";
import { useIdleSignOut, IDLE_SIGNOUT_FLAG } from "../hooks/useIdleSignOut";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [employee, setEmployee] = useState(null); // linked employee row, or null
  const [seat, setSeat] = useState(null);         // signatory seat, or null
  const [status, setStatus] = useState("loading"); // loading | ready | pending | error
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async (sess) => {
    if (!sess) { setEmployee(null); setSeat(null); setStatus("ready"); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc("bootstrap_current_user");
    if (error) { console.error("bootstrap failed", error); setStatus("error"); setLoading(false); return; }
    const emp = Array.isArray(data) ? data[0] : data;
    if (!emp || !emp.id) {
      // unknown email -> file a pending account request
      const { error: reqError } = await supabase.from("account_requests").insert({
        auth_user_id: sess.user.id,
        email: sess.user.email,
        full_name: sess.user.user_metadata?.full_name ?? null,
      });
      // 23505 = a pending request already exists for this email; anything else
      // means "HR has been notified" would be a lie, so keep a trace of it.
      if (reqError && reqError.code !== "23505") console.error("account request failed", reqError);
      setEmployee(null); setSeat(null); setStatus("pending"); setLoading(false); return;
    }
    // The RPC returns the raw employees row (snake_case); the pages consume the
    // camelCase shape (empClass, name, monthlySalary, …) that mapEmployee produces.
    setEmployee(mapEmployee(emp));
    const { data: seats } = await supabase
      .from("signatory_seats").select("seat")
      .eq("employee_id", emp.id).is("effective_to", null).limit(1);
    setSeat(seats?.[0]?.seat ?? null);
    setStatus("ready"); setLoading(false);
  }, []);

  // Who we last bootstrapped, so INITIAL_SESSION + SIGNED_IN (both fire after
  // the OAuth redirect) don't run it twice and file duplicate account requests.
  const bootedFor = useRef(undefined);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      // A token refresh doesn't change who is signed in; re-bootstrapping here
      // would flip the whole app back to "Loading…" and wipe in-progress forms.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      const uid = sess?.user?.id ?? null;
      if (uid === bootedFor.current) return;
      bootedFor.current = uid;
      if (!uid) { bootstrap(null); return; } // sign-out: pure state reset, safe inline
      // Defer: supabase calls inside this callback can deadlock on the auth lock.
      setTimeout(() => bootstrap(sess), 0);
    });
    return () => subscription.unsubscribe();
  }, [bootstrap]);

  const handleIdle = useCallback(() => {
    sessionStorage.setItem(IDLE_SIGNOUT_FLAG, "1");
    supabase.auth.signOut();
  }, []);
  useIdleSignOut(!!session, handleIdle);

  const role = employee?.role ?? null; // mapEmployee exposes app_role as .role
  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null,
      employee, role, seat,
      isHrOrAdmin: role === "hr_staff" || role === "admin",
      isAdmin: role === "admin",
      status, loading, signInWithGoogle, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
