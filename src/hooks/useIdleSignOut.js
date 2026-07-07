import { useEffect } from "react";

export const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
export const IDLE_SIGNOUT_FLAG = "psa-hr:idle-signout";

const CHECK_EVERY_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];

// Calls onIdle after IDLE_LIMIT_MS without any user input. Idle time is tracked
// with a timestamp (not a single timeout) so throttled background tabs and
// laptop sleep still count toward the limit; visibilitychange re-checks
// immediately when the tab regains focus.
export function useIdleSignOut(enabled, onIdle) {
  useEffect(() => {
    if (!enabled) return;

    let lastActivity = Date.now();
    const markActivity = () => { lastActivity = Date.now(); };
    const checkIdle = () => {
      if (Date.now() - lastActivity >= IDLE_LIMIT_MS) onIdle();
    };
    const onVisibilityChange = () => { if (!document.hidden) checkIdle(); };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = setInterval(checkIdle, CHECK_EVERY_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, markActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(timer);
    };
  }, [enabled, onIdle]);
}
