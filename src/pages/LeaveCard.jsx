import { useEffect, useState } from "react";
import { listEmployees, getLeaveCard, getBalances } from "../lib/leaveApi";
import { useAuth } from "../context/AuthContext";

const YEAR = new Date().getFullYear();
const fmt = (n) => (n == null ? "" : (Math.round(n * 1000) / 1000).toLocaleString("en-PH"));

export default function LeaveCard() {
  const { employee, isHrOrAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState(employee?.id ?? null);
  const [rows, setRows] = useState(undefined);
  const [balances, setBalances] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (isHrOrAdmin) listEmployees().then(setEmployees).catch((e) => console.error("listEmployees failed", e));
  }, [isHrOrAdmin]);

  useEffect(() => {
    const id = selectedId ?? employee?.id;
    if (!id) return;
    let ok = true; setRows(undefined); setErr(null);
    Promise.all([getLeaveCard(id, YEAR), getBalances(id)])
      .then(([r, b]) => { if (ok) { setRows(r); setBalances(b); } })
      .catch((e) => { if (ok) setErr(e.message); });
    return () => { ok = false; };
  }, [selectedId, employee]);

  const shown = employees.find((e) => e.id === (selectedId ?? employee?.id)) ?? employee;
  if (!shown) return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">Leave card</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{shown.name} · {shown.position} · {YEAR}</p>
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

      {err ? (
        <p className="text-sm text-psa-red">Couldn't load the leave card: {err}</p>
      ) : rows === undefined ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : rows === null ? (
        <div className="ui-card-soft p-6 text-sm text-slate-600 dark:text-slate-300">
          Contract workers don't keep a vacation/sick leave card — those leaves are unpaid and deducted from wages.
          {balances?.wellness != null && <span className="mt-2 block font-medium text-slate-800 dark:text-slate-200">Wellness leave available this quarter: {fmt(balances.wellness)} day(s).</span>}
        </div>
      ) : (
        <div className="ui-card overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <th rowSpan={2} className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold dark:border-slate-800">Period</th>
                <th rowSpan={2} className="border-b border-r border-slate-200 px-3 py-2 text-right font-semibold dark:border-slate-800">Total credits</th>
                <th colSpan={3} className="border-b border-r border-slate-200 px-3 py-1 text-center font-semibold dark:border-slate-800">Vacation leave</th>
                <th colSpan={3} className="border-b border-slate-200 px-3 py-1 text-center font-semibold dark:border-slate-800">Sick leave</th>
              </tr>
              <tr className="bg-slate-50 text-xs text-slate-400 dark:bg-slate-900/60">
                <SubHead>Earned</SubHead><SubHead>Abs./Und.</SubHead><SubHead right>Balance</SubHead>
                <SubHead>Earned</SubHead><SubHead>Abs./Und.</SubHead><SubHead right last>Balance</SubHead>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={r.forward ? "bg-slate-50/60 dark:bg-slate-900/30" : "odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-900/40 dark:even:bg-slate-900/20"}>
                  <td className="border-r border-slate-200 px-3 py-2 font-medium text-slate-700 dark:border-slate-800 dark:text-slate-300">{r.period}</td>
                  <td className="border-r border-slate-200 px-3 py-2 text-right font-semibold tabular-nums text-slate-900 dark:border-slate-800 dark:text-white">{fmt(r.total)}</td>
                  <Num v={r.vlEarned} /><Num v={r.vlCharged} charge /><Num v={r.vlBalance} strong border />
                  <Num v={r.slEarned} /><Num v={r.slCharged} charge /><Num v={r.slBalance} strong />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function SubHead({ children, right, last }) {
  return <th className={`px-3 py-1 text-${right ? "right" : "center"} font-medium ${last ? "" : "border-r"} border-slate-200 dark:border-slate-800`}>{children}</th>;
}
function Num({ v, charge, strong, border }) {
  const empty = v == null || v === "";
  const showCharge = charge && v > 0;
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${border ? "border-r border-slate-200 dark:border-slate-800" : ""} ${strong ? "font-semibold text-slate-900 dark:text-white" : showCharge ? "text-psa-red" : "text-slate-500 dark:text-slate-400"}`}>
      {empty || (charge && !v) ? (charge ? "—" : "") : fmt(v)}
    </td>
  );
}
