import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import Icon from "./Icon";

export default function Sidebar() {
  const { user, employee, seat, isHrOrAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();

  const NAV = [
    { section: null, items: [{ to: "/", label: "Dashboard", icon: "dashboard", end: true, show: true }] },
    { section: "Leave", items: [
      { to: "/leaves", label: "File a leave", icon: "file", show: true },
      { to: "/card", label: "Leave card", icon: "card", show: true },
      { to: "/review", label: "Review queue", icon: "check", show: !!seat || isHrOrAdmin },
    ] },
    { section: "Admin", items: [
      { to: "/attendance", label: "Attendance", icon: "clock", show: isHrOrAdmin },
      { to: "/accounts", label: "Accounts", icon: "users", show: isHrOrAdmin },
      { to: "/hiring", label: "Hiring", icon: "briefcase", show: isHrOrAdmin },
    ] },
  ].map((g) => ({ ...g, items: g.items.filter((i) => i.show) })).filter((g) => g.items.length);

  const link = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
      isActive ? "bg-blue-600 font-medium text-white shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white"
    }`;

  const name = employee?.name || user?.email?.split("@")[0] || "User";
  const roleLabel = employee?.role === "admin" ? "Superuser" : employee?.role === "hr_staff" ? "HR staff" : "Staff";

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-[#0c1530] text-slate-200">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="leading-tight">
          <p className="font-heading text-base font-bold text-white">HRIS Portal</p>
          <p className="text-xs text-slate-400">PSA Marinduque</p>
        </div>
        <button onClick={toggle} aria-label="Toggle theme" className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:bg-white/5 hover:text-white">
          <Icon name={theme === "dark" ? "sun" : "moon"} className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV.map((group, gi) => (
          <div key={gi} className="space-y-1">
            {group.section && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.section}</p>}
            {group.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={link}>
                <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 px-4 py-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">{name.charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            <p className="truncate text-xs text-slate-400">{roleLabel}</p>
          </div>
        </div>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
          <Icon name="logout" className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </aside>
  );
}
