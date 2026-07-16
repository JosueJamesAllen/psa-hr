import { useEffect, useMemo, useState } from "react";
import { computeWorkingDays, coswDeduction, hasEnoughCredits, payrollHalf, resolveRouting, checkFilingDate } from "../lib/leaveRules";
import { listLeaveTypes, getBalances, getSignatorySeats, getSignatoryUnavailability, submitLeaveApplication } from "../lib/leaveApi";
import { useAuth } from "../context/AuthContext";

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const peso = (n) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const prettyDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (n) => (Math.round(n * 1000) / 1000).toString();
const FILING_REASONS = {
  outside_window: "This filing date is outside the 7–14 day window before the leave.",
  signatory_unavailable: "A required signatory is unavailable on this date.",
};

export default function Leaves() {
  const { employee, seat } = useAuth();
  const [ref, setRef] = useState(null); // { seats, unavailability }
  const [types, setTypes] = useState(null);
  const [balances, setBalances] = useState({});
  const [typeCode, setTypeCode] = useState(null);
  const [start, setStart] = useState(addDaysISO(10));
  const [end, setEnd] = useState(addDaysISO(10));
  const [filingDate, setFilingDate] = useState(todayISO());
  const [purpose, setPurpose] = useState("");
  const [filed, setFiled] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!employee) return;
    Promise.all([getSignatorySeats(), getSignatoryUnavailability(), listLeaveTypes(employee.empClass), getBalances(employee.id)])
      .then(([seats, unavailability, ts, bal]) => {
        setRef({ seats, unavailability }); setTypes(ts); setBalances(bal); setTypeCode(ts[0]?.code ?? null);
      }).catch((e) => setErr(e.message));
  }, [employee]);

  const leaveType = types?.find((t) => t.code === typeCode) ?? types?.[0] ?? null;
  const datesValid = start && end && start <= end;
  const workingDays = datesValid ? computeWorkingDays(start, end) : 0;

  const routing = useMemo(() => {
    if (!leaveType || !ref) return null;
    return resolveRouting({ applicantSeat: seat, chain: leaveType.routing, seats: ref.seats });
  }, [leaveType, ref, seat]);

  const credit = useMemo(() => {
    if (!leaveType || !datesValid || workingDays === 0) return null;
    if (leaveType.isPaid && leaveType.requiresCredits) {
      const bal = balances[leaveType.category] ?? 0;
      return { kind: "credit", balance: bal, after: bal - workingDays, enough: hasEnoughCredits(bal, workingDays) };
    }
    if (!leaveType.isPaid) return { kind: "deduction", amount: coswDeduction(employee, workingDays), half: payrollHalf(start) };
    return { kind: "paid_no_credit" };
  }, [leaveType, balances, employee, workingDays, datesValid, start]);

  const filing = useMemo(() => {
    if (!leaveType || !routing || !ref) return null;
    const isAvailable = (seatObj, d) => !ref.unavailability.some((u) => u.signatoryId === seatObj.id && d >= u.start && d <= u.end);
    return checkFilingDate({ filingDate, inclusiveStart: start, advanceMinDays: leaveType.advanceMinDays, advanceMaxDays: leaveType.advanceMaxDays, requiredSeats: routing.requiredForAvailability, isAvailable });
  }, [filingDate, start, leaveType, routing, ref]);

  const creditsOk = !credit || credit.kind !== "credit" || credit.enough;
  const canSubmit = !!leaveType && datesValid && workingDays > 0 && creditsOk && !!filing?.ok && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setErr(null);
    try {
      const saved = await submitLeaveApplication({
        employeeId: employee.id, applicantName: employee.name, position: employee.position,
        empClass: employee.empClass, salary: employee.monthlySalary ?? null,
        leaveTypeId: leaveType.id, leaveTypeName: leaveType.name, category: leaveType.category,
        isPaid: leaveType.isPaid, approverExternal: routing.approverExternal,
        start, end, workingDays, filingDate, purpose,
        deduction: credit?.kind === "deduction" ? credit.amount : undefined,
        deductionHalf: credit?.kind === "deduction" ? credit.half : undefined,
      });
      setFiled((prev) => [{ ...saved, applicantName: employee.name, leaveTypeName: leaveType.name, start, end, workingDays }, ...prev]);
      setPurpose("");
    } catch (ex) { setErr(ex.message); } finally { setSubmitting(false); }
  };

  const fieldClass = "ui-input mt-1 w-full px-3 py-2 text-sm";
  const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";

  if (!employee) return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  if (err && !types) return <div className="p-6 text-sm text-psa-red">Couldn't load the filing form: {err}</div>;
  if (types && types.length === 0)
    return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No leave types are configured for your employment class. Please contact HR.</div>;
  if (!types || !leaveType || !routing) return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>;
  if (!routing.approver)
    return <div className="p-6 text-sm text-psa-red">Signatory seats aren't fully configured (no approver found), so leaves can't be filed yet. Please contact HR.</div>;

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">File a leave</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Filing as {employee.name}. The summary updates as you go and flags anything that would block filing.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <form onSubmit={handleSubmit} className="ui-card space-y-5 p-6">
          <div>
            <label htmlFor="type" className={labelClass}>Type of leave</label>
            <select id="type" value={leaveType.code} onChange={(e) => setTypeCode(e.target.value)} className={fieldClass}>
              {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="start" className={labelClass}>First day</label><input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={fieldClass} /></div>
            <div><label htmlFor="end" className={labelClass}>Last day</label><input id="end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={fieldClass} /></div>
          </div>
          {!datesValid && <p className="text-sm text-psa-red">The last day can't be before the first day.</p>}
          <div>
            <label htmlFor="filing" className={labelClass}>Date of filing</label>
            <input id="filing" type="date" value={filingDate} onChange={(e) => setFilingDate(e.target.value)} className={fieldClass} />
            {leaveType.advanceMinDays != null
              ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">File {leaveType.advanceMinDays}–{leaveType.advanceMaxDays} days before the leave, on a day all signatories can sign.</p>
              : <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This leave may be filed on or after the leave dates.</p>}
          </div>
          <div><label htmlFor="purpose" className={labelClass}>Purpose / details</label><textarea id="purpose" rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} className={fieldClass} placeholder="Optional" /></div>
          {err && <p className="text-sm text-psa-red">{err}</p>}
          <button type="submit" disabled={!canSubmit} className="w-full rounded-lg bg-psa-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-psa-blue/90 focus:outline-none focus:ring-2 focus:ring-psa-blue/40 disabled:cursor-not-allowed disabled:opacity-40">
            {submitting ? "Submitting…" : routing.approverExternal ? "Submit & forward to Regional Office" : "Submit application"}
          </button>
        </form>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="ui-card-soft space-y-4 p-5">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Summary</h2>
            <Row label="Working days" value={workingDays > 0 ? `${workingDays}` : "—"} />
            {credit?.kind === "credit" && (<>
              <Row label={`${cap(leaveType.category)} balance`} value={fmt(credit.balance)} />
              <Row label="After this leave" value={fmt(credit.after)} tone={credit.enough ? "ok" : "bad"} />
              {!credit.enough && <Note tone="bad">Not enough {leaveType.category} credits.</Note>}
            </>)}
            {credit?.kind === "deduction" && (<>
              <Row label="Wage deduction" value={peso(credit.amount)} tone="warn" />
              <Row label="Payroll cutoff" value={credit.half === "first_half" ? "1st half (to 15th)" : "2nd half (to 30th/31st)"} />
              <Note tone="warn">Unpaid — deducted from wages.</Note>
            </>)}
            {credit?.kind === "paid_no_credit" && <Note tone="ok">Paid; no credit deduction.</Note>}
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Approval route</p>
              <ol className="space-y-1.5 text-sm">
                {routing.certifier && <Step n="Certifies credits" who={routing.certifier.name} />}
                {routing.recommender && <Step n="Recommends" who={routing.recommender.name} />}
                <Step n={routing.approverExternal ? "Approves (Regional Office)" : "Approves"} who={routing.approver.name} external={routing.approverExternal} />
              </ol>
            </div>
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Filing date</p>
              {filing?.ok ? <Note tone="ok">{prettyDate(filingDate)} works — all signatories available.</Note> : (<>
                <Note tone="bad">{FILING_REASONS[filing?.reason] ?? "This date can't be used."}</Note>
                {filing?.suggested && <button type="button" onClick={() => setFilingDate(filing.suggested)} className="mt-2 w-full rounded-lg border border-psa-blue px-3 py-1.5 text-sm font-medium text-psa-blue hover:bg-psa-blue/5">Use {prettyDate(filing.suggested)}</button>}
              </>)}
            </div>
          </div>
        </aside>
      </div>

      {filed.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-lg font-semibold text-slate-900 dark:text-white">Filed this session</h2>
          <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {filed.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 text-sm dark:bg-slate-900/40">
                <span className="font-medium text-slate-800 dark:text-slate-200">{a.applicantName} — {a.leaveTypeName}</span>
                <span className="text-slate-500 dark:text-slate-400">{prettyDate(a.start)}–{prettyDate(a.end)} · {a.workingDays} day{a.workingDays > 1 ? "s" : ""}</span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, tone }) {
  const t = tone === "ok" ? "text-green-600 dark:text-green-400" : tone === "bad" ? "text-psa-red" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-slate-200";
  return <div className="flex items-baseline justify-between gap-3"><span className="text-sm text-slate-500 dark:text-slate-400">{label}</span><span className={`text-sm font-semibold tabular-nums ${t}`}>{value}</span></div>;
}
function Step({ n, who, external }) {
  return <li className="flex items-center justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">{n}</span><span className="text-right font-medium text-slate-800 dark:text-slate-200">{who}{external && <span className="ml-1 rounded bg-psa-gold/20 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-300">external</span>}</span></li>;
}
function Note({ tone, children }) {
  const map = { ok: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300", bad: "bg-red-50 text-psa-red dark:bg-red-950/40 dark:text-red-300", warn: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" };
  return <p className={`rounded-lg px-3 py-2 text-sm ${map[tone]}`}>{children}</p>;
}
function StatusBadge({ status }) {
  const label = status === "forwarded_ro" ? "Forwarded to RO" : "Submitted";
  const cls = status === "forwarded_ro" ? "bg-psa-gold/20 text-amber-700 dark:text-amber-300" : "bg-psa-blue/10 text-psa-blue dark:text-blue-300";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}
