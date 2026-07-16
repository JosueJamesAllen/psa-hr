// Live data access against Supabase. RLS enforces who can see/do what; these
// functions just shape rows to the app's camelCase objects. Mirrors the former
// mock API so the pages needed only their "current user" wiring changed.
import { supabase } from "./supabaseClient";

const fullName = (r) => [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ");
const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export function mapEmployee(r) {
  return {
    id: r.id, employeeIdNo: r.employee_id_no, name: fullName(r),
    firstName: r.first_name, lastName: r.last_name, middleName: r.middle_name,
    empClass: r.emp_class, coswSub: r.cosw_sub, position: r.position, unitId: r.unit_id,
    payBasis: r.emp_class === "cosw" ? (r.daily_wage != null ? "daily" : "monthly") : "monthly",
    monthlySalary: r.salary, dailyWage: r.daily_wage, role: r.app_role, email: r.email,
  };
}
function mapLeaveType(r) {
  return {
    id: r.id, code: r.code, name: r.name, category: r.category, appliesTo: r.applies_to,
    isPaid: r.is_paid, requiresCredits: r.requires_credits, routing: r.routing,
    advanceMinDays: r.advance_min_days, advanceMaxDays: r.advance_max_days,
  };
}

// ---------- employees ----------
export async function listEmployees() {
  const { data, error } = await supabase.from("employees").select("*")
    .eq("account_status", "approved").order("last_name");
  if (error) throw error;
  return data.map(mapEmployee);
}
export async function getEmployee(id) {
  const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
  if (error) throw error;
  return mapEmployee(data);
}

// ---------- reference ----------
export async function listLeaveTypes(empClass) {
  const { data, error } = await supabase.from("leave_types").select("*")
    .contains("applies_to", [empClass]).eq("active", true).order("code");
  if (error) throw error;
  return data.map(mapLeaveType);
}
export async function getSignatorySeats() {
  const { data, error } = await supabase.from("signatory_seats")
    .select("seat, holder_name, is_external, employee_id").is("effective_to", null);
  if (error) throw error;
  const seats = {};
  for (const s of data) {
    seats[s.seat] = { seat: s.seat, external: s.is_external, id: s.employee_id, name: s.holder_name };
  }
  return seats;
}
export async function getSignatoryUnavailability() {
  const { data, error } = await supabase.from("signatory_unavailability")
    .select("signatory_id, start_date, end_date");
  if (error) return [];
  return (data ?? []).map((u) => ({ signatoryId: u.signatory_id, start: u.start_date, end: u.end_date }));
}

// ---------- balances & leave card ----------
export async function getBalances(employeeId) {
  const { data, error } = await supabase.from("leave_balances")
    .select("category, balance").eq("employee_id", employeeId);
  if (error) throw error;
  return data.reduce((acc, b) => ({ ...acc, [b.category]: Number(b.balance) }), {});
}

export async function getLeaveCard(employeeId, year) {
  const balances = await getBalances(employeeId);
  if (balances.vacation == null && balances.sick == null) return null; // COSW: no VL/SL card

  const { data: events, error: evError } = await supabase.from("attendance_events")
    .select("event_date, equivalent_days, charge_category, with_pay")
    .eq("employee_id", employeeId).eq("with_pay", true);
  if (evError) throw evError; // silently treating this as "no charges" would show wrong balances

  const now = new Date();
  const monthsShown = year < now.getFullYear() ? 12 : now.getMonth() + 1;
  const ACC = 1.25;
  const charge = (cat, m) => (events ?? [])
    .filter((e) => e.charge_category === cat)
    .filter((e) => new Date(`${e.event_date}T00:00:00`).getFullYear() === year && (m == null || new Date(`${e.event_date}T00:00:00`).getMonth() === m))
    .reduce((s, e) => s + Number(e.equivalent_days || 0), 0);
  const totVL = charge("vacation", null), totSL = charge("sick", null);

  let vl = round3((balances.vacation ?? 0) - monthsShown * ACC + totVL);
  let sl = round3((balances.sick ?? 0) - monthsShown * ACC + totSL);
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const rows = [{ period: "Balance forwarded", forward: true, vlBalance: vl, slBalance: sl, total: round3(vl + sl) }];
  for (let m = 0; m < monthsShown; m++) {
    const vc = round3(charge("vacation", m)), sc = round3(charge("sick", m));
    vl = round3(vl + ACC - vc); sl = round3(sl + ACC - sc);
    rows.push({ period: `${MONTHS[m]} ${year}`, vlEarned: ACC, vlCharged: vc, vlBalance: vl, slEarned: ACC, slCharged: sc, slBalance: sl, total: round3(vl + sl) });
  }
  return rows;
}

// ---------- review queue ----------
export async function listMyPending() {
  const { data, error } = await supabase.rpc("pending_applications");
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((a) => a.leave_type_id))];
  const { data: types } = await supabase.from("leave_types").select("id, name, category").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const nameOf = Object.fromEntries((types ?? []).map((t) => [t.id, t]));
  return (data ?? []).map((a) => ({
    id: a.id, applicantName: a.applicant_name,
    leaveTypeName: nameOf[a.leave_type_id]?.name ?? "Leave",
    category: nameOf[a.leave_type_id]?.category, isPaid: a.is_paid,
    start: a.inclusive_start, end: a.inclusive_end, workingDays: Number(a.working_days),
    filingDate: a.date_of_filing, status: a.status, approverExternal: a.approval_external,
    deduction: a.deduction_amount != null ? Number(a.deduction_amount) : null, deductionHalf: a.deduction_half,
  }));
}
export async function certifyCredits(id, approverExternal) {
  const { error } = await supabase.from("leave_applications")
    .update({ status: approverExternal ? "forwarded_ro" : "credits_certified", certified_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function recommend(id) {
  const { error } = await supabase.from("leave_applications").update({ status: "recommended", recommended_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function decide(id, decision, remarks = "") {
  const { error } = await supabase.from("leave_applications").update({ status: decision, decision_remarks: remarks, decided_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function recordExternalDecision(id, decision, { channel, recordedById, remarks = "" }) {
  const { error } = await supabase.from("leave_applications").update({
    status: decision, approval_external: true, external_channel: channel,
    decision_recorded_by: recordedById, decision_remarks: remarks, decided_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

// ---------- filing ----------
export async function submitLeaveApplication(p) {
  const { data, error } = await supabase.from("leave_applications").insert({
    employee_id: p.employeeId, applicant_name: p.applicantName, position_snap: p.position,
    emp_class_snap: p.empClass, salary_snap: p.salary ?? null, leave_type_id: p.leaveTypeId,
    date_of_filing: p.filingDate, inclusive_start: p.start, inclusive_end: p.end,
    working_days: p.workingDays, is_paid: p.isPaid, approval_external: p.approverExternal,
    deduction_amount: p.deduction ?? null, deduction_half: p.deductionHalf ?? null,
    details: p.purpose ? { purpose: p.purpose } : null, status: "submitted",
  }).select().single();
  if (error) throw error;
  return { id: data.id, status: data.status };
}

// ---------- attendance ----------
export async function postAttendanceEvent(p) {
  const { data, error } = await supabase.from("attendance_events").insert({
    employee_id: p.employeeId, event_date: p.date, type: p.type,
    minutes: p.minutes ?? null, equivalent_days: p.equivalentDays,
    with_pay: p.withPay, charge_category: p.chargeCategory ?? null, encoded_by: p.encodedById,
  }).select().single();
  if (error) throw error;
  let balanceAfter = null;
  if (p.withPay && p.chargeCategory) {
    const { data: row } = await supabase.from("leave_balances").select("id, used, balance")
      .eq("employee_id", p.employeeId).eq("category", p.chargeCategory).eq("period_label", "cumulative").maybeSingle();
    if (row) {
      await supabase.from("leave_balances").update({ used: Number(row.used) + p.equivalentDays }).eq("id", row.id);
      balanceAfter = round3(Number(row.balance) - p.equivalentDays);
    }
  }
  return { ...p, id: data.id, balanceAfter };
}
export async function listAttendanceEvents(employeeId) {
  const { data, error } = await supabase.from("attendance_events")
    .select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id, date: e.event_date, type: e.type, minutes: e.minutes,
    equivalentDays: Number(e.equivalent_days ?? 0), withPay: e.with_pay,
    chargeCategory: e.charge_category, balanceAfter: null,
  }));
}

// ---------- accounts ----------
export async function listUnits() {
  const { data, error } = await supabase.from("units").select("name").order("name");
  if (error) throw error;
  return data.map((u) => u.name);
}
export async function listPendingAccounts() {
  const { data, error } = await supabase.from("account_requests").select("*").eq("status", "pending").order("requested_at");
  if (error) throw error;
  return data.map((r) => ({ id: r.id, name: r.full_name, email: r.email, requestedAt: r.requested_at, authUserId: r.auth_user_id }));
}
export async function listProcessedAccounts() {
  const { data, error } = await supabase.from("account_requests").select("*").neq("status", "pending").order("decided_at", { ascending: false }).limit(20);
  if (error) return [];
  return (data ?? []).map((r) => ({ id: r.id, name: r.full_name, email: r.email, status: r.status, empClass: r.emp_class ?? null, position: r.position ?? null, remarks: r.decision_remarks ?? null }));
}
export async function approveAccount(req, details) {
  const toks = (req.name || req.email).trim().split(/\s+/);
  const last = toks.length > 1 ? toks[toks.length - 1] : toks[0];
  const first = toks.length > 1 ? toks.slice(0, -1).join(" ") : "";
  const { data: unit } = await supabase.from("units").select("id").eq("name", details.unit).maybeSingle();
  const { error: e1 } = await supabase.from("employees").insert({
    email: req.email, auth_user_id: req.authUserId, employee_id_no: details.employeeIdNo,
    last_name: last, first_name: first || last, emp_class: details.empClass, cosw_sub: details.coswSub,
    position: details.position, unit_id: unit?.id ?? null, salary_grade: details.salaryGrade,
    salary: details.monthlySalary, daily_wage: details.dailyWage, account_status: "approved", app_role: "staff",
  });
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("account_requests").update({ status: "approved", decided_at: new Date().toISOString() }).eq("id", req.id);
  if (e2) throw e2;
}
export async function clearProcessedAccounts() {
  // Returns how many rows were actually removed — RLS silently skips rows the
  // caller may not delete, so 0 with a non-empty log means missing permission.
  const { data, error } = await supabase.from("account_requests")
    .delete().neq("status", "pending").select("id");
  if (error) throw error;
  return (data ?? []).length;
}
export async function rejectAccount(id, remarks = "") {
  const { error } = await supabase.from("account_requests").update({
    status: "rejected", decided_at: new Date().toISOString(),
    decision_remarks: remarks.trim() || null,
  }).eq("id", id);
  if (error) throw error;
  // notify the applicant by email; the rejection stands even if this fails
  try {
    const { error: fnError } = await supabase.functions.invoke("reject-account", { body: { requestId: id } });
    if (fnError) throw fnError;
    return { emailSent: true };
  } catch {
    return { emailSent: false };
  }
}
