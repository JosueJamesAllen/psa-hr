import { useEffect, useState } from "react";
import { getSignatorySeats, listMyPending, certifyCredits, recommend, decide, recordExternalDecision } from "../lib/leaveApi";
import { useAuth } from "../context/AuthContext";

const SEAT_LABELS = { ao1_hrmo: "AO1 / HRMO", css: "Chief Statistical Specialist", sss: "Supervising Statistical Specialist" };
const peso = (n) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const prettyDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—");

export default function ReviewQueue() {
  const { seat, employee } = useAuth();
  const [seats, setSeats] = useState(null);
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => { getSignatorySeats().then(setSeats).catch(() => {}); }, []);
  const refresh = () => { setItems(null); listMyPending().then(setItems).catch((e) => { setErr(e.message); setItems([]); }); };
  useEffect(() => { if (seat) refresh(); else setItems([]); }, [seat]);

  const act = async (id, fn) => { setBusyId(id); setErr(null); try { await fn(); refresh(); } catch (e) { setErr(e.message); } finally { setBusyId(null); } };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">Review queue</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {seat ? `Applications waiting on you as ${SEAT_LABELS[seat] ?? seat}.` : "Applications waiting on your action."}
        </p>
      </header>
      {err && <p className="mb-4 text-sm text-psa-red">{err}</p>}

      {!seat ? (
        <div className="ui-card-soft p-10 text-center text-sm text-slate-500 dark:text-slate-400">You don't hold a signatory seat, so there's nothing to review.</div>
      ) : items === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="ui-card-soft p-10 text-center text-sm text-slate-500 dark:text-slate-400">Nothing needs your action right now.</div>
      ) : (
        <ul className="space-y-4">
          {items.map((app) => (
            <ApplicationCard key={app.id} app={app} seat={seat} seats={seats} busy={busyId === app.id}
              onCertify={() => act(app.id, () => certifyCredits(app.id, app.approverExternal))}
              onRecommend={() => act(app.id, () => recommend(app.id))}
              onDecide={(d) => act(app.id, () => decide(app.id, d))}
              onRecordExternal={(d, channel) => act(app.id, () => recordExternalDecision(app.id, d, { channel, recordedById: employee.id }))} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicationCard({ app, seat, seats, busy, onCertify, onRecommend, onDecide, onRecordExternal }) {
  const [channel, setChannel] = useState("email");
  return (
    <li className="ui-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-slate-900 dark:text-white">{app.applicantName}</p>
        <span className="rounded-full bg-psa-blue/10 px-2.5 py-1 text-xs font-medium text-psa-blue dark:text-blue-300">{app.leaveTypeName}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Field label="Dates" value={`${prettyDate(app.start)}–${prettyDate(app.end)}`} />
        <Field label="Working days" value={app.workingDays} />
        <Field label="Filed" value={prettyDate(app.filingDate)} />
        {!app.isPaid && app.deduction != null && <Field label="Wage deduction" value={`${peso(app.deduction)} · ${app.deductionHalf === "first_half" ? "1st half" : "2nd half"}`} />}
      </dl>
      {app.status === "forwarded_ro" && (
        <p className="mt-3 rounded-lg bg-psa-gold/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          The CSS's own leave — decided externally by the Regional Director ({seats?.rd?.name ?? "RD"}). Record the decision received by courier or email.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {seat === "ao1_hrmo" && app.status === "submitted" && <PrimaryButton disabled={busy} onClick={onCertify}>Certify credits</PrimaryButton>}
        {seat === "sss" && app.status === "submitted" && <PrimaryButton disabled={busy} onClick={onRecommend}>Recommend</PrimaryButton>}
        {seat === "css" && (app.status === "credits_certified" || app.status === "recommended") && (<>
          <PrimaryButton disabled={busy} onClick={() => onDecide("approved")}>Approve</PrimaryButton>
          <GhostButton disabled={busy} onClick={() => onDecide("disapproved")}>Disapprove</GhostButton>
        </>)}
        {seat === "ao1_hrmo" && app.status === "forwarded_ro" && (<>
          <span className="text-sm text-slate-500 dark:text-slate-400">Received by</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="ui-input px-2 py-1 text-sm">
            <option value="email">Email (e-signed)</option><option value="courier">Courier</option>
          </select>
          <PrimaryButton disabled={busy} onClick={() => onRecordExternal("approved", channel)}>Record approval</PrimaryButton>
          <GhostButton disabled={busy} onClick={() => onRecordExternal("disapproved", channel)}>Record disapproval</GhostButton>
        </>)}
      </div>
    </li>
  );
}
function Field({ label, value }) { return <div><dt className="text-slate-400">{label}</dt><dd className="font-medium text-slate-800 dark:text-slate-200">{value}</dd></div>; }
function PrimaryButton({ children, ...p }) { return <button {...p} className="rounded-lg bg-psa-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-psa-blue/90 focus:outline-none focus:ring-2 focus:ring-psa-blue/40 disabled:opacity-40">{children}</button>; }
function GhostButton({ children, ...p }) { return <button {...p} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{children}</button>; }
