import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

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
      // unknown email -> file a pending account request (ignore duplicate)
      await supabase.from("account_requests").insert({
        auth_user_id: sess.user.id,
        email: sess.user.email,
        full_name: sess.user.user_metadata?.full_name ?? null,
      });
      setEmployee(null); setSeat(null); setStatus("pending"); setLoading(false); return;
    }
    setEmployee(emp);
    const { data: seats } = await supabase
      .from("signatory_seats").select("seat")
      .eq("employee_id", emp.id).is("effective_to", null).limit(1);
    setSeat(seats?.[0]?.seat ?? null);
    setStatus("ready"); setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); bootstrap(session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess); bootstrap(sess);
    });
    return () => subscription.unsubscribe();
  }, [bootstrap]);

  const role = employee?.app_role ?? null;
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
