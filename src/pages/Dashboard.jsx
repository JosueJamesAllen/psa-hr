import { useEffect, useMemo, useState } from "react";
import { MONTHLY_ACCRUAL_DAYS, projectCredits } from "../lib/leaveRules";
import { listEmployees, getBalances } from "../lib/leaveApi";

const YEAR = 2026;
const fmt = (n) => (Math.round(n * 1000) / 1000).toLocaleString("en-PH");
const quarterEnd = (monthIdx) => {
  const ends = ["Mar 31", "Jun 30", "Sep 30", "Dec 31"];
  return `${ends[Math.floor(monthIdx / 3)]}, ${YEAR}`;
};

export default function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [balances, setBalances] = useState(null);

  useEffect(() => {
    let ok = true;
    listEmployees().then((emps) => {
      if (!ok) return;
      setEmployees(emps);
      setSelectedId(emps[0]?.id ?? null);
    });
    return () => { ok = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let ok = true;
    setBalances(null);
    getBalances(selectedId).then((b) => { if (ok) setBalances(b); });
    return () => { ok = false; };
  }, [selectedId]);

  const employee = employees.find((e) => e.id === selectedId) ?? null;
  const isAccruing = employee && (employee.empClass === "regular" || employee.empClass === "contractual");

  // Remaining monthly accruals left in the calendar year.
  const monthsLeft = useMemo(() => 11 - new Date().getMonth(), []);
  const projection = useMemo(() => {
    if (!isAccruing || !balances) return null;
    return {
      vacation: projectCredits(balances.vacation ?? 0, monthsLeft),
      sick: projectCredits(balances.sick ?? 0, monthsLeft),
    };
  }, [isAccruing, balances, monthsLeft]);

  if (!employee || !balances) {
    return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">Leave balances</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{employee.position}</p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-slate-500 dark:text-slate-400">Viewing as (demo)</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-psa-blue focus:outline-none focus:ring-2 focus:ring-psa-blue/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </label>
      </header>

      {/* balance cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isAccruing && (
          <>
            <StatCard label="Vacation leave" value={fmt(balances.vacation ?? 0)} unit="days" accent="blue" foot={`Accrues +${MONTHLY_ACCRUAL_DAYS}/month`} />
            <StatCard label="Sick leave" value={fmt(balances.sick ?? 0)} unit="days" accent="blue" foot={`Accrues +${MONTHLY_ACCRUAL_DAYS}/month`} />
          </>
        )}
        <StatCard
          label="Wellness leave"
          value={fmt(balances.wellness ?? 0)}
          unit="days"
          accent="gold"
          foot={isAccruing ? `Expires Dec 31, ${YEAR}` : `This quarter · expires ${quarterEnd(new Date().getMonth())}`}
        />
      </div>

      {!isAccruing && (
        <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          As a contract worker, vacation and sick leave are unpaid — each day filed is deducted from wages rather than drawn from a credit balance.
        </p>
      )}

      {/* projection */}
      {projection && (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="font-heading text-lg font-semibold text-slate-900 dark:text-white">Projected by Dec 31, {YEAR}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {monthsLeft > 0
              ? `${monthsLeft} more monthly accrual${monthsLeft > 1 ? "s" : ""} of +${MONTHLY_ACCRUAL_DAYS} day each, if no leave is taken.`
              : "No further accruals remain this year."}
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

function StatCard({ label, value, unit, foot, accent }) {
  const bar = accent === "gold" ? "bg-psa-gold" : "bg-psa-blue";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden="true" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 font-heading text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
        {value} <span className="text-base font-medium text-slate-400">{unit}</span>
      </p>
      {foot && <p className="mt-2 text-xs text-slate-400">{foot}</p>}
    </div>
  );
}

function ProjectionRow({ label, now, end }) {
  const gain = Math.round((end - now) * 1000) / 1000;
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/40">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="font-heading text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{fmt(end)}</span>
        <span className="text-sm font-medium text-green-600 dark:text-green-400">+{fmt(gain)}</span>
      </p>
    </div>
  );
}
