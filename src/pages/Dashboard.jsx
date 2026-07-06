import { useEffect, useMemo, useState } from "react";
import { MONTHLY_ACCRUAL_DAYS, projectCredits } from "../lib/leaveRules";
import { listEmployees, getBalances } from "../lib/leaveApi";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const YEAR = 2026;
const fmt = (n) => (Math.round(n * 1000) / 1000).toLocaleString("en-PH");
const quarterEnd = (m) => `${["Mar 31", "Jun 30", "Sep 30", "Dec 31"][Math.floor(m / 3)]}, ${YEAR}`;
const ACCENT = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  teal: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  gold: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export default function Dashboard() {
  const { employee, isHrOrAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState(employee?.id ?? null);
  const [balances, setBalances] = useState(null);

  useEffect(() => {
    if (!isHrOrAdmin) return; // office staff only ever see themselves
    listEmployees().then(setEmployees).catch(() => {});
  }, [isHrOrAdmin]);

  useEffect(() => {
    const id = selectedId ?? employee?.id;
    if (!id) return;
    let ok = true; setBalances(null);
    getBalances(id).then((b) => { if (ok) setBalances(b); }).catch(() => setBalances({}));
    return () => { ok = false; };
  }, [selectedId, employee]);

  const shown = employees.find((e) => e.id === (selectedId ?? employee?.id)) ?? employee;
  const isAccruing = shown && (shown.empClass === "regular" || shown.empClass === "contractual");
  const monthsLeft = useMemo(() => 11 - new Date().getMonth(), []);
  const projection = useMemo(() => {
    if (!isAccruing || !balances) return null;
    return { vacation: projectCredits(balances.vacation ?? 0, monthsLeft), sick: projectCredits(balances.sick ?? 0, monthsLeft) };
  }, [isAccruing, balances, monthsLeft]);

  if (!shown || !balances) return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">Leave balances</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{shown.name} · {shown.position}</p>
        </div>
        {isHrOrAdmin && employees.length > 1 && (
          <label className="text-sm">
            <span className="mr-2 text-slate-500 dark:text-slate-400">Employee</span>
            <select value={selectedId ?? employee?.id} onChange={(e) => setSelectedId(e.target.value)} className="ui-input px-3 py-1.5 text-sm">
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </label>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isAccruing && (
          <>
            <StatCard icon="wallet" accent="blue" label="Vacation leave" value={fmt(balances.vacation ?? 0)} foot={`Accrues +${MONTHLY_ACCRUAL_DAYS}/month`} />
            <StatCard icon="heart" accent="teal" label="Sick leave" value={fmt(balances.sick ?? 0)} foot={`Accrues +${MONTHLY_ACCRUAL_DAYS}/month`} />
          </>
        )}
        <StatCard icon="sparkles" accent="gold" label="Wellness leave" value={fmt(balances.wellness ?? 0)}
          foot={isAccruing ? `Expires Dec 31, ${YEAR}` : `This quarter · expires ${quarterEnd(new Date().getMonth())}`} />
      </div>

      {!isAccruing && (
        <p className="ui-card-soft mt-4 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          As a contract worker, vacation and sick leave are unpaid — each day filed is deducted from wages rather than drawn from a credit balance.
        </p>
      )}

      {projection && (
        <section className="ui-card mt-8 p-6">
          <h2 className="font-heading text-lg font-semibold text-slate-900 dark:text-white">Projected by Dec 31, {YEAR}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {monthsLeft > 0 ? `${monthsLeft} more monthly accrual${monthsLeft > 1 ? "s" : ""} of +${MONTHLY_ACCRUAL_DAYS} day each, if no leave is taken.` : "No further accruals remain this year."}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ProjectionRow label="Vacation" now={balances.vacation ?? 0} end={projection.vacation} />
            <ProjectionRow label="Sick" now={balances.sick ?? 0} end={projection.sick} />
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon, accent, label, value, foot }) {
  return (
    <div className="ui-card flex items-start gap-4 p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ACCENT[accent]}`}><Icon name={icon} className="h-5 w-5" /></span>
      <div>
        <p className="font-heading text-3xl font-bold leading-none tabular-nums text-slate-900 dark:text-white">{value}</p>
        <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        {foot && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{foot}</p>}
      </div>
    </div>
  );
}
function ProjectionRow({ label, now, end }) {
  const gain = Math.round((end - now) * 1000) / 1000;
  return (
    <div className="ui-card-soft px-4 py-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="font-heading text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{fmt(end)}</span>
        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">+{fmt(gain)}</span>
      </p>
    </div>
  );
}
