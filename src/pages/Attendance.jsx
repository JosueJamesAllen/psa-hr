import { useEffect, useMemo, useState } from "react";
import { minutesToDays } from "../lib/leaveRules";
import { listEmployees, getBalances, postAttendanceEvent, listAttendanceEvents } from "../lib/leaveApi";

const TYPES = [
  { value: "personnel_pass", label: "Personnel pass", unit: "none" },
  { value: "tardiness", label: "Tardiness", unit: "minutes" },
  { value: "undertime", label: "Undertime", unit: "minutes" },
  { value: "absence", label: "Absence", unit: "days" },
];
const typeLabel = (v) => TYPES.find((t) => t.value === v)?.label ?? v;
const todayISO = () => new Date().toISOString().slice(0, 10);
const prettyDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "\u2014");
const fmt = (n) => (Math.round(n * 1000) / 1000).toLocaleString("en-PH");

export default function Attendance() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState(null);
  const [balances, setBalances] = useState(null);
  const [events, setEvents] = useState([]);

  const [type, setType] = useState("tardiness");
  const [date, setDate] = useState(todayISO());
  const [minutes, setMinutes] = useState(0);
  const [days, setDays] = useState(1);
  const [withPay, setWithPay] = useState(true);
  const [chargeCategory, setChargeCategory] = useState("vacation");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let ok = true;
    listEmployees().then((emps) => {
      if (!ok) return;
      setEmployees(emps);
      setEmployeeId(emps[0]?.id ?? null);
    });
    return () => { ok = false; };
  }, []);

  const reload = (id) => {
    Promise.all([getBalances(id), listAttendanceEvents(id)]).then(([b, e]) => { setBalances(b); setEvents(e); });
  };
  useEffect(() => { if (employeeId) reload(employeeId); }, [employeeId]);

  const employee = employees.find((e) => e.id === employeeId) ?? null;
  const isAccruing = employee && (employee.empClass === "regular" || employee.empClass === "contractual");
  const unit = TYPES.find((t) => t.value === type)?.unit ?? "none";

  const equivalentDays = useMemo(() => {
    if (unit === "minutes") return minutesToDays(minutes);
    if (unit === "days") return Number(days) || 0;
    return 0; // personnel pass isn't a time charge
  }, [unit, minutes, days]);

  const canCharge = isAccruing && withPay && equivalentDays > 0 && unit !== "none";
  const canPost = !!employee && !posting && (unit === "none" || equivalentDays > 0);

  const handlePost = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      await postAttendanceEvent({
        employeeId,
        date,
        type,
        minutes: unit === "minutes" ? Number(minutes) : null,
        equivalentDays,
        withPay: canCharge,
        chargeCategory: canCharge ? chargeCategory : null,
      });
      reload(employeeId);
      setMinutes(0);
      setDays(1);
    } finally {
      setPosting(false);
    }
  };

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-psa-blue focus:outline-none focus:ring-2 focus:ring-psa-blue/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";

  if (!employee) return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">Attendance</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Record a personnel pass, tardiness, undertime, or absence.</p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-slate-500 dark:text-slate-400">Employee</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-psa-blue focus:outline-none focus:ring-2 focus:ring-psa-blue/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </label>
      </header>

      {/* current balances */}
      {isAccruing && balances && (
        <div className="mb-6 flex gap-6 rounded-xl bg-slate-50 px-5 py-3 text-sm dark:bg-slate-800/40">
          <span className="text-slate-500 dark:text-slate-400">Current credits</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">VL {fmt(balances.vacation ?? 0)}</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">SL {fmt(balances.sick ?? 0)}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="type" className={labelClass}>Type</label>
              <select id="type" value={type} onChange={(e) => setType(e.target.value)} className={fieldClass}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="date" className={labelClass}>Date</label>
              <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
            </div>
          </div>

          {unit === "minutes" && (
            <div>
              <label htmlFor="minutes" className={labelClass}>Minutes late / short</label>
              <input id="minutes" type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={fieldClass} />
            </div>
          )}
          {unit === "days" && (
            <div>
              <label htmlFor="days" className={labelClass}>Days absent</label>
              <input id="days" type="number" min={0} step="0.5" value={days} onChange={(e) => setDays(e.target.value)} className={fieldClass} />
            </div>
          )}
          {unit === "none" && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
              A personnel pass is logged only; it doesn't draw against leave credits.
            </p>
          )}

          {unit !== "none" && (
            <div className="space-y-3">
              <label className={`flex items-center gap-2 ${isAccruing ? "" : "opacity-40"}`}>
                <input type="checkbox" checked={withPay} disabled={!isAccruing} onChange={(e) => setWithPay(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-psa-blue focus:ring-psa-blue/30" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Charge with pay (deduct from a leave credit)</span>
              </label>
              {!isAccruing && (
                <p className="text-xs text-slate-400">Contract workers don't have VL/SL credits — record the time, but it can't be charged to a balance here.</p>
              )}
              {canCharge && (
                <div>
                  <label htmlFor="cat" className={labelClass}>Charge to</label>
                  <select id="cat" value={chargeCategory} onChange={(e) => setChargeCategory(e.target.value)} className={fieldClass}>
                    <option value="vacation">Vacation leave</option>
                    <option value="sick">Sick leave</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <button onClick={handlePost} disabled={!canPost} className="w-full rounded-lg bg-psa-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-psa-blue/90 focus:outline-none focus:ring-2 focus:ring-psa-blue/40 disabled:cursor-not-allowed disabled:opacity-40">
            {posting ? "Recording…" : "Record entry"}
          </button>
        </div>

        {/* live conversion */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/40">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">This entry</h2>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {unit === "minutes" ? `${minutes || 0} min` : unit === "days" ? `${days || 0} day(s)` : typeLabel(type)}
              </span>
              <span className="font-heading text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {unit === "none" ? "—" : `${fmt(equivalentDays)} day`}
              </span>
            </div>
            {canCharge ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Charged to {chargeCategory === "vacation" ? "VL" : "SL"} · new balance {fmt((balances?.[chargeCategory] ?? 0) - equivalentDays)}
              </p>
            ) : unit !== "none" ? (
              <p className="text-xs text-slate-400">Recorded without a credit charge.</p>
            ) : null}
          </div>
        </aside>
      </div>

      {events.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-lg font-semibold text-slate-900 dark:text-white">Recorded this session</h2>
          <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 text-sm dark:bg-slate-900/40">
                <span className="font-medium text-slate-800 dark:text-slate-200">{typeLabel(e.type)}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {prettyDate(e.date)}
                  {e.minutes != null ? ` · ${e.minutes} min` : ""}
                  {e.equivalentDays > 0 ? ` · ${fmt(e.equivalentDays)} day` : ""}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {e.withPay ? `charged to ${e.chargeCategory === "vacation" ? "VL" : "SL"} → ${fmt(e.balanceAfter)}` : "no charge"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
