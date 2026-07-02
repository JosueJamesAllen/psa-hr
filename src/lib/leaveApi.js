// Data access for the leave module. Every function is async and returns the
// same shape the real Supabase queries will, so swapping the internals later
// won't touch any component. Review-queue actions mutate a session store.
import {
  employees,
  signatorySeats,
  signatoryUnavailability,
  leaveTypes,
  leaveBalances,
  leaveApplications,
} from "../mock/data";

const clone = (v) => JSON.parse(JSON.stringify(v));

// Mutable session copy so review actions and new filings persist while the app runs.
let applications = clone(leaveApplications);

const TERMINAL = ["approved", "disapproved", "cancelled"];

/** Which seat must act next on an application (null once terminal). */
export function pendingSeat(app) {
  switch (app.status) {
    case "submitted":
      return app.chain === "sss_css" ? "sss" : "ao1_hrmo";
    case "credits_certified":
    case "recommended":
      return "css";
    case "forwarded_ro":
      return "ao1_hrmo"; // HRMO records the RD's off-app decision
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
export async function getBalances(employeeId) {
  return leaveBalances
    .filter((b) => b.employeeId === employeeId)
    .reduce((acc, b) => ({ ...acc, [b.category]: b.balance }), {});
}
export async function getSignatorySeats() {
  return clone(signatorySeats);
}
export async function getSignatoryUnavailability() {
  return clone(signatoryUnavailability);
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

/** AO1/HRMO certifies credits. External-approver leaves go straight to the RO. */
export async function certifyCredits(id) {
  const app = applications.find((a) => a.id === id);
  return patch(id, {
    status: app.approverExternal ? "forwarded_ro" : "credits_certified",
    certifiedAt: new Date().toISOString(),
  });
}

/** SSS recommends a COSW unpaid leave. */
export async function recommend(id) {
  return patch(id, { status: "recommended", recommendedAt: new Date().toISOString() });
}

/** CSS approves or disapproves. decision = 'approved' | 'disapproved'. */
export async function decide(id, decision, remarks = "") {
  return patch(id, { status: decision, decisionRemarks: remarks, decidedAt: new Date().toISOString() });
}

/** HRMO records the RD's decision made off-app (forwarded_ro -> approved/disapproved). */
export async function recordExternalDecision(id, decision, { channel, recordedByName, remarks = "" }) {
  return patch(id, {
    status: decision,
    approvalExternal: true,
    externalChannel: channel,
    decisionRecordedBy: recordedByName,
    decisionRemarks: remarks,
    decidedAt: new Date().toISOString(),
  });
}

/** File a new application (always starts at 'submitted'). Later: a Supabase insert. */
export async function submitLeaveApplication(payload) {
  const saved = { id: crypto.randomUUID(), ...payload, status: "submitted" };
  applications = [saved, ...applications];
  return clone(saved);
}
