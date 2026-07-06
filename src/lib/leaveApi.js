// Data access for the leave module. Every function is async and returns the
// same shape the real Supabase queries will, so swapping the internals later
// won't touch any component. Review actions, filings, and attendance charges
// persist in session stores; balances derive from the seed minus those charges.
import {
  employees,
  signatorySeats,
  signatoryUnavailability,
  leaveTypes,
  leaveBalances,
  leaveApplications,
  accountRequests,
  units,
} from "../mock/data";

const clone = (v) => JSON.parse(JSON.stringify(v));
const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

// Session stores.
let applications = clone(leaveApplications);
let attendanceEvents = [];
let accounts = clone(accountRequests);

const TERMINAL = ["approved", "disapproved", "cancelled"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHLY_ACCRUAL = 1.25;

/** Which seat must act next on an application (null once terminal). */
export function pendingSeat(app) {
  switch (app.status) {
    case "submitted":
      return app.chain === "sss_css" ? "sss" : "ao1_hrmo";
    case "credits_certified":
    case "recommended":
      return "css";
    case "forwarded_ro":
      return "ao1_hrmo";
    default:
      return null;
  }
}

// ---------- reads ----------
export async function listEmployees() {
  return clone(employees);
}
export async function getEmployee(id) {
  return clone(employees.find((e) => e.id === id) ?? null);
}
export async function listLeaveTypes(empClass) {
  return clone(leaveTypes.filter((t) => t.appliesTo.includes(empClass)));
}
export async function getSignatorySeats() {
  return clone(signatorySeats);
}
export async function getSignatoryUnavailability() {
  return clone(signatoryUnavailability);
}

// original (pre-charge) balances for an employee, as { category: balance }
function origBalances(employeeId) {
  return leaveBalances
    .filter((b) => b.employeeId === employeeId)
    .reduce((acc, b) => ({ ...acc, [b.category]: b.balance }), {});
}
// with-pay attendance charges recorded this session, optionally scoped to a month
function chargesFor(employeeId, category, { year = null, month = null } = {}) {
  return attendanceEvents
    .filter((e) => e.employeeId === employeeId && e.withPay && e.chargeCategory === category)
    .filter((e) => year == null || new Date(`${e.date}T00:00:00`).getFullYear() === year)
    .filter((e) => month == null || new Date(`${e.date}T00:00:00`).getMonth() === month)
    .reduce((sum, e) => sum + (e.equivalentDays || 0), 0);
}

/** Current credit balances: seed minus with-pay attendance charges. */
export async function getBalances(employeeId) {
  const orig = origBalances(employeeId);
  const out = { ...orig };
  for (const cat of ["vacation", "sick"]) {
    if (orig[cat] != null) out[cat] = round3(orig[cat] - chargesFor(employeeId, cat));
  }
  return out;
}

/**
 * A regular/contractual employee's leave card for the year: Balance Forwarded +
 * one row per elapsed month, VL/SL earned/charged/balance, matching the paper card.
 * Returns null for COSW (no VL/SL card).
 */
export async function getLeaveCard(employeeId, year) {
  const orig = origBalances(employeeId);
  if (orig.vacation == null && orig.sick == null) return null;

  const now = new Date();
  const monthsShown = year < now.getFullYear() ? 12 : now.getMonth() + 1;
  // Balance forwarded so that current-month balance (no charges) equals the seed.
  let vl = round3((orig.vacation ?? 0) - monthsShown * MONTHLY_ACCRUAL);
  let sl = round3((orig.sick ?? 0) - monthsShown * MONTHLY_ACCRUAL);

  const rows = [{ period: "Balance forwarded", forward: true, vlBalance: vl, slBalance: sl, total: round3(vl + sl) }];
  for (let m = 0; m < monthsShown; m++) {
    const vlChg = round3(chargesFor(employeeId, "vacation", { year, month: m }));
    const slChg = round3(chargesFor(employeeId, "sick", { year, month: m }));
    vl = round3(vl + MONTHLY_ACCRUAL - vlChg);
    sl = round3(sl + MONTHLY_ACCRUAL - slChg);
    rows.push({
      period: `${MONTHS[m]} ${year}`,
      vlEarned: MONTHLY_ACCRUAL, vlCharged: vlChg, vlBalance: vl,
      slEarned: MONTHLY_ACCRUAL, slCharged: slChg, slBalance: sl,
      total: round3(vl + sl),
    });
  }
  return rows;
}

/** Applications awaiting a given seat's action. */
export async function listPendingForSeat(seat) {
  return clone(applications.filter((a) => !TERMINAL.includes(a.status) && pendingSeat(a) === seat));
}

// ---------- writes (mock mutations) ----------
function patch(id, changes) {
  const i = applications.findIndex((a) => a.id === id);
  if (i === -1) throw new Error(`Application not found: ${id}`);
  applications[i] = { ...applications[i], ...changes };
  return clone(applications[i]);
}
export async function certifyCredits(id) {
  const app = applications.find((a) => a.id === id);
  return patch(id, { status: app.approverExternal ? "forwarded_ro" : "credits_certified", certifiedAt: new Date().toISOString() });
}
export async function recommend(id) {
  return patch(id, { status: "recommended", recommendedAt: new Date().toISOString() });
}
export async function decide(id, decision, remarks = "") {
  return patch(id, { status: decision, decisionRemarks: remarks, decidedAt: new Date().toISOString() });
}
export async function recordExternalDecision(id, decision, { channel, recordedByName, remarks = "" }) {
  return patch(id, {
    status: decision, approvalExternal: true, externalChannel: channel,
    decisionRecordedBy: recordedByName, decisionRemarks: remarks, decidedAt: new Date().toISOString(),
  });
}
export async function submitLeaveApplication(payload) {
  const saved = { id: crypto.randomUUID(), ...payload, status: "submitted" };
  applications = [saved, ...applications];
  return clone(saved);
}

// ---------- attendance ----------
/** Record a personnel pass / tardiness / undertime / absence (charges derive from this). */
export async function postAttendanceEvent(payload) {
  const saved = { id: crypto.randomUUID(), ...payload };
  attendanceEvents = [saved, ...attendanceEvents];
  if (payload.withPay && payload.chargeCategory) {
    const b = await getBalances(payload.employeeId);
    saved.balanceAfter = b[payload.chargeCategory];
  }
  return clone(saved);
}
export async function listAttendanceEvents(employeeId) {
  return clone(attendanceEvents.filter((e) => e.employeeId === employeeId));
}

// ---------- account approval (admin) ----------
export async function listUnits() {
  return clone(units);
}
export async function listPendingAccounts() {
  return clone(accounts.filter((a) => a.status === "pending"));
}
export async function listProcessedAccounts() {
  return clone(accounts.filter((a) => a.status !== "pending"));
}
function patchAccount(id, changes) {
  const i = accounts.findIndex((a) => a.id === id);
  if (i === -1) throw new Error(`Account not found: ${id}`);
  accounts[i] = { ...accounts[i], ...changes };
  return clone(accounts[i]);
}
/** Approve a sign-in and record the employee setup details. */
export async function approveAccount(id, details) {
  return patchAccount(id, { status: "approved", ...details, decidedAt: new Date().toISOString() });
}
export async function rejectAccount(id, reason = "") {
  return patchAccount(id, { status: "rejected", rejectionReason: reason, decidedAt: new Date().toISOString() });
}
