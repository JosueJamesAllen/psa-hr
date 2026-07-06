import { useEffect, useState } from "react";
import { listPendingAccounts, listProcessedAccounts, listUnits, approveAccount, rejectAccount } from "../lib/leaveApi";

const CLASS_LABEL = { regular: "Regular", contractual: "Contractual", cosw: "COSW" };
const prettyDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—");

export default function Accounts() {
  const [pending, setPending] = useState(null);
  const [processed, setProcessed] = useState([]);
  const [units, setUnits] = useState([]);

  const refresh = () => {
    Promise.all([listPendingAccounts(), listProcessedAccounts()]).then(([p, pr]) => {
      setPending(p);
      setProcessed(pr);
    });
  };
  useEffect(() => {
    listUnits().then(setUnits);
    refresh();
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">Account requests</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          New sign-ins waiting to be set up. Fill in the employee details, then approve to grant access.
        </p>
      </header>

      {pending === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No pending requests.
        </div>
      ) : (
        <ul className="space-y-4">
          {pending.map((req) => (
            <RequestCard key={req.id} req={req} units={units} onDone={refresh} />
          ))}
        </ul>
      )}

      {processed.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-lg font-semibold text-slate-900 dark:text-white">Processed this session</h2>
          <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {processed.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 text-sm dark:bg-slate-900/40">
                <span className="font-medium text-slate-800 dark:text-slate-200">{a.name}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {a.status === "approved" ? `${CLASS_LABEL[a.empClass] ?? ""} · ${a.position ?? ""}` : "rejected"}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${a.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300" : "bg-red-100 text-psa-red dark:bg-red-950/50 dark:text-red-300"}`}>
                  {a.status === "approved" ? "Approved" : "Rejected"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RequestCard({ req, units, onDone }) {
  const [empClass, setEmpClass] = useState("regular");
  const [coswSub, setCoswSub] = useState("contract_of_service");
  const [payBasis, setPayBasis] = useState("monthly");
  const [rate, setRate] = useState("");
  const [salary, setSalary] = useState("");
  const [position, setPosition] = useState("");
  const [unit, setUnit] = useState("");
  const [employeeIdNo, setEmployeeIdNo] = useState("");
  const [salaryGrade, setSalaryGrade] = useState("");
  const [busy, setBusy] = useState(false);

  const isCosw = empClass === "cosw";
  const rateNeeded = isCosw ? payBasis === "daily" ? "daily wage" : "monthly rate" : "monthly salary";
  const rateValue = isCosw ? rate : salary;
  const canApprove = employeeIdNo.trim() && position.trim() && unit && String(rateValue).trim() && !busy;

  const approve = async () => {
    setBusy(true);
    try {
      await approveAccount(req, {
        employeeIdNo: employeeIdNo.trim(),
        empClass,
        coswSub: isCosw ? coswSub : null,
        position: position.trim(),
        unit,
        salaryGrade: salaryGrade.trim() || null,
        payBasis: isCosw ? payBasis : "monthly",
        monthlySalary: isCosw ? (payBasis === "monthly" ? Number(rate) : null) : Number(salary),
        dailyWage: isCosw && payBasis === "daily" ? Number(rate) : null,
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };
  const reject = async () => { setBusy(true); try { await rejectAccount(req.id); onDone(); } finally { setBusy(false); } };

  const field = "ui-input mt-1 w-full px-3 py-2 text-sm";
  const label = "text-xs font-medium text-slate-500 dark:text-slate-400";

  return (
    <li className="ui-card p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{req.name}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{req.email}</p>
        </div>
        <span className="text-xs text-slate-400">Requested {prettyDate(req.requestedAt)}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Employee ID no.</label>
          <input value={employeeIdNo} onChange={(e) => setEmployeeIdNo(e.target.value)} placeholder="e.g. 005976 or 2019-03-045" className={field} />
        </div>
        <div>
          <label className={label}>Employee class</label>
          <select value={empClass} onChange={(e) => setEmpClass(e.target.value)} className={field}>
            <option value="regular">Regular</option>
            <option value="contractual">Contractual</option>
            <option value="cosw">COSW</option>
          </select>
        </div>

        {isCosw && (
          <>
            <div>
              <label className={label}>Engagement</label>
              <select value={coswSub} onChange={(e) => { const v = e.target.value; setCoswSub(v); setPayBasis(v === "job_order" ? "daily" : "monthly"); }} className={field}>
                <option value="contract_of_service">Contract of Service (monthly)</option>
                <option value="job_order">Job Order (daily)</option>
              </select>
            </div>
            <div>
              <label className={label}>Pay basis</label>
              <select value={payBasis} onChange={(e) => setPayBasis(e.target.value)} className={field}>
                <option value="monthly">Monthly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
          </>
        )}

        <div>
          <label className={label}>Position / designation</label>
          <input value={position} onChange={(e) => setPosition(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>Unit</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={field}>
            <option value="">Select unit…</option>
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Salary grade <span className="font-normal text-slate-400">(optional)</span></label>
          <input value={salaryGrade} onChange={(e) => setSalaryGrade(e.target.value)} placeholder="e.g. SG 11 Step 1" className={field} />
        </div>
        <div>
          <label className={label}>{`Rate — ${rateNeeded} (₱)`}</label>
          {isCosw ? (
            <input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className={field} />
          ) : (
            <input type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} className={field} />
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button onClick={approve} disabled={!canApprove} className="rounded-lg bg-psa-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-psa-blue/90 focus:outline-none focus:ring-2 focus:ring-psa-blue/40 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Saving…" : "Approve & create account"}
        </button>
        <button onClick={reject} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          Reject
        </button>
      </div>
    </li>
  );
}
