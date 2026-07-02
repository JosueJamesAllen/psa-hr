// Pure, DB-independent leave rules for PSA Marinduque HR.
// No React, no Supabase — just the domain math so it can be unit-tested and reused
// by both the filing UI and (later) server-side checks. Mirrors docs/DATABASE.md.

export const MONTHLY_ACCRUAL_DAYS = 1.25;   // VL and SL each, per month (regular/contractual)
export const COS_DEDUCTION_DIVISOR = 22;    // monthly-paid COS: per-day rate = monthly / 22

// ---------- date helpers (local, no timezone drift) ----------
const toDate = (s) => (s instanceof Date ? s : new Date(`${s}T00:00:00`));
const iso = (d) => {
  const x = toDate(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const addDays = (s, n) => {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const isWeekend = (s) => [0, 6].includes(toDate(s).getDay());

/** Inclusive working-day count between two dates, excluding weekends and any holidays. */
export function computeWorkingDays(start, end, holidays = []) {
  const H = new Set(holidays);
  let d = iso(start), count = 0;
  while (toDate(d) <= toDate(end)) {
    if (!isWeekend(d) && !H.has(d)) count += 1;
    d = addDays(d, 1);
  }
  return count;
}

// ---------- credits & deductions ----------
/** Projected credits for a regular/contractual employee after N more monthly accruals. */
export function projectCredits(currentBalance, monthsRemaining) {
  return round3(currentBalance + monthsRemaining * MONTHLY_ACCRUAL_DAYS);
}

/** Whether a paid, credit-drawing leave has enough balance. */
export function hasEnoughCredits(balance, workingDays) {
  return balance + 1e-9 >= workingDays;
}

/**
 * Peso deduction for a COSW unpaid VL/SL.
 * Daily-rate Job Orders: dailyWage * days. Monthly-paid Contract of Service: (monthly / 22) * days.
 */
export function coswDeduction(employee, workingDays) {
  const { payBasis, dailyWage, monthlySalary } = employee;
  if (payBasis === "daily") return round2((dailyWage ?? 0) * workingDays);
  if (payBasis === "monthly")
    return round2(((monthlySalary ?? 0) / COS_DEDUCTION_DIVISOR) * workingDays);
  throw new Error(`Unknown payBasis: ${payBasis}`);
}

/** Which payroll half a leave date falls in: 1st = up to the 15th, 2nd = 16th onward. */
export function payrollHalf(dateStr) {
  return toDate(dateStr).getDate() <= 15 ? "first_half" : "second_half";
}

// ---------- signatory routing ----------
/**
 * Resolve who certifies / recommends / approves, and who must be available on the filing date.
 * @param applicantSeat  the applicant's own seat key or null ('ao1_hrmo'|'css'|'sss'|null)
 * @param chain          leaveType.routing ('ao1_css' | 'sss_css')
 * @param seats          { ao1_hrmo, css, sss, rd } each { id?, name, external? }
 */
export function resolveRouting({ applicantSeat = null, chain, seats }) {
  let certifier = null, recommender = null, approver = null, approverExternal = false;

  if (chain === "ao1_css") {
    certifier = seats.ao1_hrmo;
    approver = seats.css;
  } else if (chain === "sss_css") {
    recommender = seats.sss;
    approver = seats.css;
  } else {
    throw new Error(`Unknown routing chain: ${chain}`);
  }

  // A person can't approve their own leave: a CSS applicant escalates to the (external) RD.
  if (applicantSeat === "css") {
    approver = seats.rd;
    approverExternal = true;
  }
  // An AO1 applicant self-certifies (certifier stays AO1); CSS still approves — no change needed.

  // Non-external signatories who must be present to sign on the filing date,
  // excluding the applicant themselves (they're obviously present when filing).
  const requiredForAvailability = [certifier, recommender, approver]
    .filter(Boolean)
    .filter((s) => !s.external)
    .filter((s) => !(applicantSeat && s.seat === applicantSeat));

  return { certifier, recommender, approver, approverExternal, requiredForAvailability };
}

// ---------- filing window & availability ----------
/**
 * The inclusive [earliest, latest] filing-date window for a leave starting on inclusiveStart.
 * Returns null when the leave type has no advance requirement (retroactive filing allowed).
 */
export function filingWindow(inclusiveStart, advanceMinDays, advanceMaxDays) {
  if (advanceMinDays == null || advanceMaxDays == null) return null;
  return {
    earliest: addDays(inclusiveStart, -advanceMaxDays),
    latest: addDays(inclusiveStart, -advanceMinDays),
  };
}

/**
 * Validate a chosen filing date and, if needed, suggest the nearest workable one.
 * @param isAvailable (seat, dateStr) => boolean   // RD/external seats are never passed in
 * @returns { ok, reason?, validDates, suggested }
 */
export function checkFilingDate({
  filingDate,
  inclusiveStart,
  advanceMinDays,
  advanceMaxDays,
  requiredSeats,
  isAvailable,
  holidays = [],
}) {
  const win = filingWindow(inclusiveStart, advanceMinDays, advanceMaxDays);
  const H = new Set(holidays);
  const allPresent = (d) => requiredSeats.every((s) => isAvailable(s, d));

  // Retroactive-allowed types: only require signatories present on the chosen date.
  if (!win) {
    return {
      ok: allPresent(filingDate),
      reason: allPresent(filingDate) ? null : "signatory_unavailable",
      validDates: [],
      suggested: null,
    };
  }

  // Enumerate workable filing dates in the window (working days, all signatories present).
  const valid = [];
  let d = win.earliest;
  while (toDate(d) <= toDate(win.latest)) {
    if (!isWeekend(d) && !H.has(d) && allPresent(d)) valid.push(d);
    d = addDays(d, 1);
  }
  // Default suggestion = the latest workable date (closest to the leave, matching "~1 week before").
  const suggested = valid.length ? valid[valid.length - 1] : null;

  const inWindow = win && toDate(filingDate) >= toDate(win.earliest) && toDate(filingDate) <= toDate(win.latest);
  if (!inWindow) return { ok: false, reason: "outside_window", validDates: valid, suggested, window: win };
  if (!allPresent(filingDate)) return { ok: false, reason: "signatory_unavailable", validDates: valid, suggested, window: win };
  return { ok: true, reason: null, validDates: valid, suggested, window: win };
}

// ---------- rounding ----------
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round3(n) { return Math.round((n + Number.EPSILON) * 1000) / 1000; }

// ---------- tardiness / undertime -> fraction of a day ----------
// Transcribed exactly from HR's printed 8-hour-day table (see 002_seed.sql),
// so it reproduces the leave cards to the decimal. Whole hours are 0.125 each;
// the remaining minutes use the printed lookup (0 for none).
const MINUTE_DAY = {
  0: 0, 1: 0.002, 2: 0.004, 3: 0.006, 4: 0.008, 5: 0.010, 6: 0.012, 7: 0.015, 8: 0.017, 9: 0.019,
  10: 0.021, 11: 0.023, 12: 0.025, 13: 0.027, 14: 0.029, 15: 0.031, 16: 0.033, 17: 0.035, 18: 0.037, 19: 0.040,
  20: 0.042, 21: 0.044, 22: 0.046, 23: 0.048, 24: 0.050, 25: 0.052, 26: 0.054, 27: 0.056, 28: 0.058, 29: 0.060,
  30: 0.062, 31: 0.065, 32: 0.067, 33: 0.069, 34: 0.071, 35: 0.073, 36: 0.075, 37: 0.077, 38: 0.079, 39: 0.081,
  40: 0.083, 41: 0.085, 42: 0.087, 43: 0.090, 44: 0.092, 45: 0.094, 46: 0.096, 47: 0.098, 48: 0.100, 49: 0.102,
  50: 0.104, 51: 0.106, 52: 0.108, 53: 0.110, 54: 0.112, 55: 0.115, 56: 0.117, 57: 0.119, 58: 0.121, 59: 0.123,
};

/** Convert tardiness/undertime minutes to a fraction of a working day (8-hour basis). */
export function minutesToDays(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(m / 60);
  const rem = m % 60;
  return round3(hours * 0.125 + (MINUTE_DAY[rem] ?? 0));
}
