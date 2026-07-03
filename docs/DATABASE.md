# PSA Marinduque HR — Leave Application: Database & Process Flow

Phase 1 of the leave-filing system. Schema lives in `supabase/migrations/`; this doc is the rationale.
Stack: React (Vite) · Supabase (Postgres) · Google Auth · Netlify.

## Migrations (run in order)
1. `001_schema.sql` — tables, enums, analytics views.
2. `002_seed.sql` — CSC minute→day conversion table, leave types, signatory-seat instructions.
3. `003_import.sql` — units, employee roster, signatory seats, opening VL/SL balances.

## Employee classes
| Class | VL / SL | Wellness (compensatory) | Other CSC leaves |
|---|---|---|---|
| Regular / Contractual | +1.25 each per month, cumulative | lump 5 at year start, expires year-end | full CS Form 6 set |
| COSW (Contract of Service / Job Order) | may file but **unpaid → wage deduction** | 1/qtr (Q1–Q3) + 3 in Q4, expires each quarter-end, no carry-over | none |

## Signatory routing (depends on leave type + who applies)
- `ao1_css`: **AO1/HRMO certifies → CSS approves** — all regular/contractual leaves and all wellness.
- `sss_css`: **SSS recommends → CSS approves** — COSW unpaid VL/SL only (no credit certification).
- Substitution by applicant:
  - Applicant is the **CSS** → approver becomes the **RD**. The RD is external (processes leave at the
    Regional Office and never logs in here): the app produces the signed form, sets status
    `forwarded_ro`, and an admin records the RD's decision manually (`approval_external`,
    `external_channel` = courier | email, `decision_recorded_by`).
  - Applicant is the **AO1** → AO1 self-certifies, CSS still approves.
- Seats are effective-dated (`signatory_seats`). Current: AO1/HRMO = Olivia J. Jasmin (most likely to
  change), CSS = Gemma N. Opis, SSS = Orlando L. Mercene, RD = Leni R. Rioflorido (external; retirement
  reminder set for ~Nov 2026). Note: two staff are "Administrative Officer I" — only Jasmin holds the
  certifying HRMO seat; Cuadrasal is cashier.

## Filing rules
- Availability is checked on the **date of filing**, not the leave dates. Filing must fall 7–14 days
  before `inclusive_start` (per each leave type's `advance_min/max_days`; `null` = retroactive, e.g. sick).
  All required non-RD signatories must be available on the filing date; if not, the app moves the filing
  date to the nearest day in the window when everyone is present. RD is exempt.
- COSW unpaid VL/SL computes a wage deduction charged to a payroll half (1st = to the 15th,
  2nd = to the 30th/31st).

## Accrual & grants (scheduled)
- Monthly +1.25 VL/SL for regular/contractual. Wellness grants (annual for reg/contractual, quarterly for
  COSW) are issued by the grant job — **not** seeded by `003_import.sql`, to avoid double-counting.

## Opening balances
`003_import.sql` seeds VL/SL balances for the 12 active regular/contractual staff, computed from
`2025_EMPLOYEES-LEAVE-CARD.xlsx` as of the end of the `CUTOFF_MONTH` (currently May 2026). COSWs start
clean. Montiano is seeded as a disabled record (resigned) so his card survives as history.

## Open items
- Monthly-paid COSW deduction divisor (daily-rate COSWs use `daily_wage × days`; monthly-paid COS need a rule).
- Whether sick leave must be advance-filed or may be retroactive (currently retroactive).
- Whether the 6-day CTO column on the leave card is in scope (currently out).
- Assign `app_role='admin'` to HR accounts before launch.
