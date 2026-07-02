// Data access for the leave module. Every function is async and returns the
// same shape the real Supabase queries will, so swapping the internals later
// (see the commented example) won't touch any component.
import {
  employees,
  signatorySeats,
  signatoryUnavailability,
  leaveTypes,
  leaveBalances,
} from "../mock/data";

const clone = (v) => JSON.parse(JSON.stringify(v));

/** All employees — powers the demo "Filing as" switcher for now. */
export async function listEmployees() {
  return clone(employees);
}

/** A single employee by id. Later: getCurrentEmployee() resolves from auth. */
export async function getEmployee(id) {
  return clone(employees.find((e) => e.id === id) ?? null);
}

/** Leave types a given employee class may file. */
export async function listLeaveTypes(empClass) {
  return clone(leaveTypes.filter((t) => t.appliesTo.includes(empClass)));
}

/** Current credit balances for an employee, as { vacation, sick, wellness }. */
export async function getBalances(employeeId) {
  return leaveBalances
    .filter((b) => b.employeeId === employeeId)
    .reduce((acc, b) => ({ ...acc, [b.category]: b.balance }), {});
}

/** Signatory seats keyed by seat (ao1_hrmo | css | sss | rd). */
export async function getSignatorySeats() {
  return clone(signatorySeats);
}

/** Ranges when a signatory can't sign. */
export async function getSignatoryUnavailability() {
  return clone(signatoryUnavailability);
}

/**
 * Persist a leave application. Mock: echoes it back with an id + status.
 * Real version will be roughly:
 *   const { data, error } = await supabase.from("leave_applications").insert(payload).select().single();
 *   if (error) throw error;
 *   return data;
 */
export async function submitLeaveApplication(payload) {
  return {
    id: crypto.randomUUID(),
    ...payload,
    status: payload.approverExternal ? "forwarded_ro" : "submitted",
  };
}
