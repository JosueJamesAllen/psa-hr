import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const { user, signOut } = useAuth();

  const tabClass = ({ isActive }) =>
    `text-sm ${isActive ? "font-semibold text-psa-blue dark:text-blue-300" : "text-slate-600 dark:text-slate-300"}`;

  return (
    <nav className="flex items-center gap-6 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
      <NavLink
        to="/"
        className="font-heading font-semibold text-psa-blue dark:text-white"
      >
        PSA Marinduque - HRIS Portal
      </NavLink>

      <div className="flex gap-4">
        <NavLink to="/leaves" className={tabClass}>
          Leaves
        </NavLink>
        <NavLink to="/hiring" className={tabClass}>
          Hiring
        </NavLink>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {user?.email}
        </span>
        <ThemeToggle />
        <button
          onClick={signOut}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
