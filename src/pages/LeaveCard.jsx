import { useEffect, useState } from "react";
import { listEmployees, getLeaveCard, getBalances } from "../lib/leaveApi";

const YEAR = 2026;
const fmt = (n) => (n == null ? "" : (Math.round(n * 1000) / 1000).toLocaleString("en-PH"));

export default function LeaveCard() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState(null);
  const [rows, setRows] = useState(undefined); // undefined = loading, null = no card, [] = card
  const [balances, setBalances] = useState(null);

  useEffect(() => {
    let ok = true;
    listEmployees().then((emps) => {
      if (!ok) return;
      setEmployees(emps);
      setEmployeeId(emps[0]?.id ?? null);
    });
    return () => { ok = false; };
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    let ok = true;
    setRows(undefined);
    Promise.all([getLeaveCard(employeeId, YEAR), getBalances(employeeId)]).then(([r, b]) => {
      if (!ok) return;
      setRows(r);
      setBalances(b);
    });
    return () => { ok = false; };
  }, [employeeId]);

  const employee = employees.find((e) => e.id === employeeId) ?? null;
  if (!employee) return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">Leave card</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{employee.name} · {employee.position} · {YEAR}</p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-slate-500 dark:text-slate-400">Employee</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="ui-input px-3 py-1.5 text-sm">
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </label>
      </header>

      {rows === undefined ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : rows === null ? (
        <div className="ui-card-soft p-6 text-sm text-slate-600 dark:text-slate-300">
          Contract workers don't keep a vacation/sick leave card — those leaves are unpaid and deducted from wages.
          {balances?.wellness != null && (
            <span className="mt-2 block font-medium text-slate-800 dark:text-slate-200">Wellness leave available this quarter: {fmt(balances.wellness)} day(s).</span>
          )}
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
                  <Num v={r.vlEarned} />
                  <Num v={r.vlCharged} charge />
                  <Num v={r.vlBalance} strong border />
                  <Num v={r.slEarned} />
                  <Num v={r.slCharged} charge />
                  <Num v={r.slBalance} strong />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {Array.isArray(rows) && (
        <p className="mt-3 text-xs text-slate-400">
          Balance Forwarded reflects credits carried into {YEAR}. Absences/undertime charged with pay (from the Attendance screen) appear in their month and reduce the running balance.
        </p>
      )}
    </div>
  );
}

function SubHead({ children, right, last }) {
  return (
    <th className={`px-3 py-1 text-${right ? "right" : "center"} font-medium ${last ? "" : "border-r"} border-slate-200 dark:border-slate-800`}>
      {children}
    </th>
  );
}
function Num({ v, charge, strong, border }) {
  const empty = v == null || v === "" ;
  const showCharge = charge && v > 0;
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${border ? "border-r border-slate-200 dark:border-slate-800" : ""} ${
      strong ? "font-semibold text-slate-900 dark:text-white" : showCharge ? "text-psa-red" : "text-slate-500 dark:text-slate-400"
    }`}>
      {empty || (charge && !v) ? (charge ? "—" : "") : fmt(v)}
    </td>
  );
}
