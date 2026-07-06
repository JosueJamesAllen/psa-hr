// Mock seed data, shaped like the rows Supabase will eventually return.
// Only this file and leaveApi.js change when the real database is wired up.

export const employees = [
  { id: "e_reg", employeeIdNo: "011492", name: "Sonny Jr. R. De La Cruz", empClass: "regular", coswSub: null, seat: null, position: "Statistical Analyst", unit: "Statistical" },
  { id: "e_css", employeeIdNo: "59579", name: "Gemma N. Opis", empClass: "regular", coswSub: null, seat: "css", position: "Chief Statistical Specialist", unit: "Statistical" },
  { id: "e_ao1", employeeIdNo: "005976", name: "Olivia J. Jasmin", empClass: "regular", coswSub: null, seat: "ao1_hrmo", position: "Administrative Officer I", unit: "Administrative" },
  { id: "e_cos_m", employeeIdNo: "2019-03-045", name: "Kane Carol T. Matibag-Pajanustan", empClass: "cosw", coswSub: "contract_of_service", seat: null, position: "Statistical Analyst (COS)", unit: "Statistical", payBasis: "monthly", monthlySalary: 30024 },
  { id: "e_jo_d", employeeIdNo: "2022-07-272", name: "Rocco V. Llante", empClass: "cosw", coswSub: "job_order", seat: null, position: "Driver (JO)", unit: "Administrative", payBasis: "daily", dailyWage: 765.14 },
];

// Signatory seats keyed by seat, matching resolveRouting()'s expected shape.
export const signatorySeats = {
  ao1_hrmo: { seat: "ao1_hrmo", id: "e_ao1", name: "Olivia J. Jasmin" },
  css: { seat: "css", id: "e_css", name: "Gemma N. Opis" },
  sss: { seat: "sss", id: "e_sss", name: "Orlando L. Mercene" },
  rd: { seat: "rd", name: "Leni R. Rioflorido", external: true },
};

// Dates a signatory can't sign (their own leave / official travel).
export const signatoryUnavailability = [
  { seat: "ao1_hrmo", start: "2026-06-11", end: "2026-06-13", reason: "on leave" },
];

export const leaveTypes = [
  { code: "VL", name: "Vacation Leave", category: "vacation", appliesTo: ["regular", "contractual"], isPaid: true, requiresCredits: true, routing: "ao1_css", advanceMinDays: 7, advanceMaxDays: 14 },
  { code: "SL", name: "Sick Leave", category: "sick", appliesTo: ["regular", "contractual"], isPaid: true, requiresCredits: true, routing: "ao1_css", advanceMinDays: null, advanceMaxDays: null },
  { code: "WELLNESS", name: "Wellness Leave", category: "wellness", appliesTo: ["regular", "contractual"], isPaid: true, requiresCredits: true, routing: "ao1_css", advanceMinDays: 7, advanceMaxDays: 14 },
  { code: "WELLNESS_COSW", name: "Wellness Leave (COSW)", category: "wellness", appliesTo: ["cosw"], isPaid: true, requiresCredits: true, routing: "ao1_css", advanceMinDays: 7, advanceMaxDays: 14 },
  { code: "VL_COSW", name: "Vacation Leave \u2014 unpaid (COSW)", category: "vacation", appliesTo: ["cosw"], isPaid: false, requiresCredits: false, routing: "sss_css", advanceMinDays: 7, advanceMaxDays: 14 },
  { code: "SL_COSW", name: "Sick Leave \u2014 unpaid (COSW)", category: "sick", appliesTo: ["cosw"], isPaid: false, requiresCredits: false, routing: "sss_css", advanceMinDays: null, advanceMaxDays: null },
];

// leave_balances rows (VL/SL cumulative; wellness period-bounded). Keyed per employee.
export const leaveBalances = [
  { employeeId: "e_reg", category: "vacation", balance: 25.215 },
  { employeeId: "e_reg", category: "sick", balance: 26.999 },
  { employeeId: "e_reg", category: "wellness", balance: 5 },
  { employeeId: "e_css", category: "vacation", balance: 181.301 },
  { employeeId: "e_css", category: "sick", balance: 367.458 },
  { employeeId: "e_css", category: "wellness", balance: 5 },
  { employeeId: "e_ao1", category: "vacation", balance: 291.353 },
  { employeeId: "e_ao1", category: "sick", balance: 318 },
  { employeeId: "e_ao1", category: "wellness", balance: 5 },
  { employeeId: "e_cos_m", category: "wellness", balance: 1 },
  { employeeId: "e_jo_d", category: "wellness", balance: 1 },
];

// In-flight applications for the review queue. Each sits at a different stage so
// every signatory seat has something to act on (incl. a CSS leave forwarded to the RO).
export const leaveApplications = [
  { id: "a1", applicantId: "e_reg", applicantName: "Sonny Jr. R. De La Cruz", position: "Statistical Analyst", empClass: "regular", applicantSeat: null, leaveTypeCode: "VL", leaveTypeName: "Vacation Leave", category: "vacation", isPaid: true, chain: "ao1_css", approverExternal: false, start: "2026-06-22", end: "2026-06-24", workingDays: 3, filingDate: "2026-06-10", status: "submitted", balance: 25.215 },
  { id: "a2", applicantId: "e_reg", applicantName: "Sonny Jr. R. De La Cruz", position: "Statistical Analyst", empClass: "regular", applicantSeat: null, leaveTypeCode: "SL", leaveTypeName: "Sick Leave", category: "sick", isPaid: true, chain: "ao1_css", approverExternal: false, start: "2026-06-02", end: "2026-06-03", workingDays: 2, filingDate: "2026-06-04", status: "credits_certified", balance: 26.999 },
  { id: "a3", applicantId: "e_jo_d", applicantName: "Rocco V. Llante", position: "Driver (JO)", empClass: "cosw", applicantSeat: null, leaveTypeCode: "VL_COSW", leaveTypeName: "Vacation Leave \u2014 unpaid (COSW)", category: "vacation", isPaid: false, chain: "sss_css", approverExternal: false, start: "2026-06-25", end: "2026-06-26", workingDays: 2, filingDate: "2026-06-15", status: "submitted", deduction: 1530.28, deductionHalf: "second_half" },
  { id: "a4", applicantId: "e_cos_m", applicantName: "Kane Carol T. Matibag-Pajanustan", position: "Statistical Analyst (COS)", empClass: "cosw", applicantSeat: null, leaveTypeCode: "VL_COSW", leaveTypeName: "Vacation Leave \u2014 unpaid (COSW)", category: "vacation", isPaid: false, chain: "sss_css", approverExternal: false, start: "2026-06-18", end: "2026-06-19", workingDays: 2, filingDate: "2026-06-05", status: "recommended", deduction: 2729.45, deductionHalf: "second_half" },
  { id: "a5", applicantId: "e_css", applicantName: "Gemma N. Opis", position: "Chief Statistical Specialist", empClass: "regular", applicantSeat: "css", leaveTypeCode: "VL", leaveTypeName: "Vacation Leave", category: "vacation", isPaid: true, chain: "ao1_css", approverExternal: true, start: "2026-06-29", end: "2026-06-30", workingDays: 2, filingDate: "2026-06-16", status: "forwarded_ro", balance: 181.301 },
  { id: "a6", applicantId: "e_ao1", applicantName: "Olivia J. Jasmin", position: "Administrative Officer I", empClass: "regular", applicantSeat: "ao1_hrmo", leaveTypeCode: "SL", leaveTypeName: "Sick Leave", category: "sick", isPaid: true, chain: "ao1_css", approverExternal: false, start: "2026-06-09", end: "2026-06-09", workingDays: 1, filingDate: "2026-06-10", status: "credits_certified", balance: 318 },
];

// Org units (drives the unit picker on account approval + per-unit analytics later).
export const units = ["Administrative", "Statistical", "Civil Registration", "National ID"];

// New Google sign-ins awaiting admin setup (account_status = 'pending').
export const accountRequests = [
  { id: "r1", name: "Jasmine T. Rosales", email: "jrosales@psa.gov.ph", requestedAt: "2026-06-14", status: "pending" },
  { id: "r2", name: "Mark Anthony D. Villaruel", email: "mavillaruel@psa.gov.ph", requestedAt: "2026-06-16", status: "pending" },
  { id: "r3", name: "Ferdinand G. Sarmiento", email: "fsarmiento@psa.gov.ph", requestedAt: "2026-06-17", status: "pending" },
];
