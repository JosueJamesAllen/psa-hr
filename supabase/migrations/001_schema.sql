-- =====================================================================
-- PSA Marinduque HR Webapp — Phase 1 schema (Supabase / Postgres)
-- Migration 001: schema
-- Reflects confirmed decisions:
--   1) COSW VL/SL (non-comp, unpaid) routing = SSS recommends -> CSS approves.
--      Reg/contractual + all wellness routing = AO1 certifies -> CSS approves.
--   2) Signatory seats are assignable + effective-dated (RD retires ~Nov 2026).
--   3) Wellness: reg/contractual = lump 5 at year start (expires year-end);
--      COSW = 1/qtr Q1-Q3 + 3 in Q4, each expires at quarter-end, no carry-over.
--   4) Credits tracked in DAYS.
--   5) Tardy/undertime minutes -> day-fraction via official table (seed 002).
--   6) COSWs get a card too: wellness grants + log of unpaid VL/SL deductions.
--   7) Availability rule is on the DATE OF FILING; filing must be 7-14 days
--      before the leave start; if a required signatory is absent on the chosen
--      filing date, the date must move to one where all are present (RD exempt).
--   8) Opening balances seeded from existing leave cards (separate import).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type employee_class    as enum ('regular','contractual','cosw');
create type cosw_subtype      as enum ('contract_of_service','job_order');
create type account_status    as enum ('pending','approved','rejected','disabled');
create type app_role          as enum ('staff','admin');
create type signatory_seat    as enum ('ao1_hrmo','css','sss','rd');
create type leave_category    as enum ('vacation','sick','wellness','special','other');
create type routing_chain     as enum ('ao1_css','sss_css');   -- per leave type
create type leave_expiry      as enum ('none','year_end','quarter_end');
create type application_status as enum
  ('draft','submitted','credits_certified','recommended','forwarded_ro','approved','disapproved','cancelled');
  -- 'forwarded_ro' = CSS's own leave: certified + signed, sent to the Regional Office
  --                  (courier or e-signed email); RD's decision is later recorded by an admin.
create type ledger_entry_type as enum
  ('balance_forward','monthly_accrual','wellness_grant','leave_charge',
   'cosw_deduction','manual_adjustment');
create type attendance_type   as enum ('personnel_pass','tardiness','undertime','absence');
create type pay_period_half   as enum ('first_half','second_half');  -- COSW payroll cutoff

-- ---------- org units ----------
create table units (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  parent_id  uuid references units(id),
  created_at timestamptz default now()
);

-- ---------- employees (= account record, 1:1 with Google auth) ----------
create table employees (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique references auth.users(id),
  employee_id_no text unique,
  last_name      text not null,
  first_name     text not null,
  middle_name    text,
  position       text,
  emp_class      employee_class not null,
  cosw_sub       cosw_subtype,                -- only when emp_class='cosw'
  unit_id        uuid references units(id),
  salary         numeric(12,2),               -- monthly (regular/contractual)
  daily_wage     numeric(10,2),               -- COSW, basis for deductions
  salary_grade   text,
  date_started   date,                        -- accrual / proration anchor
  app_role       app_role not null default 'staff',
  account_status account_status not null default 'pending',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  constraint cosw_sub_only_for_cosw
    check ( (emp_class='cosw') = (cosw_sub is not null) )
);
create index on employees (emp_class);
create index on employees (account_status);

-- ---------- signatory seats (effective-dated; survives turnover) ----------
-- Current holder of a seat = row with effective_to IS NULL or >= today.
-- reminder_date prompts the admin to update the holder (e.g. RD retirement).
create table signatory_seats (
  id             uuid primary key default gen_random_uuid(),
  seat           signatory_seat not null,
  -- A seat is usually a real employee; the RD is EXTERNAL (processes leave at the
  -- Regional Office and never logs in here) so it may be held by name only.
  employee_id    uuid references employees(id),
  holder_name    text,                         -- used when employee_id is null (e.g. RD)
  is_external    boolean not null default false,
  effective_from date not null default current_date,
  effective_to   date,
  reminder_date  date,
  reminder_note  text,
  created_at     timestamptz default now(),
  check (employee_id is not null or holder_name is not null)
);
create unique index one_active_holder_per_seat
  on signatory_seats (seat) where effective_to is null;

-- ---------- leave types (reference) ----------
create table leave_types (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  name             text not null,
  csc_reference    text,
  category         leave_category not null,
  applies_to       employee_class[] not null,
  is_paid          boolean not null default true,
  requires_credits boolean not null default true,   -- draws a tracked balance
  annual_quota     numeric(6,2),                     -- e.g. wellness reg=5; null=n/a
  expiry           leave_expiry not null default 'none',
  advance_min_days int,            -- e.g. 7  (null = may be filed retroactively)
  advance_max_days int,            -- e.g. 14
  routing          routing_chain not null default 'ao1_css',
  active           boolean not null default true
);

-- ---------- balances ----------
-- VL/SL are cumulative (carry across years): period_label='cumulative', expiry none.
-- Wellness is period-bounded: period_label='2026' (reg) or '2026-Q1' (COSW) + expires_on.
create table leave_balances (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references employees(id),
  category     leave_category not null,
  period_label text not null default 'cumulative',
  earned       numeric(8,3) not null default 0,
  used         numeric(8,3) not null default 0,
  balance      numeric(8,3) generated always as (earned - used) stored,
  expires_on   date,
  unique (employee_id, category, period_label)
);

-- ---------- leave applications (core transaction) ----------
create table leave_applications (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id),

  -- requested DB columns, snapshotted at filing time
  applicant_name  text not null,
  position_snap   text,
  emp_class_snap  employee_class not null,
  salary_snap     numeric(12,2),

  leave_type_id   uuid not null references leave_types(id),
  date_of_filing  date not null default current_date,
  inclusive_start date not null,
  inclusive_end   date not null,
  working_days    numeric(6,2) not null,
  details         jsonb,            -- within-PH/abroad, illness, study purpose, commutation...

  is_paid         boolean not null,
  -- COSW unpaid VL/SL: deduction = daily_wage * working_days, charged to a payroll half
  deduction_amount numeric(12,2),
  deduction_half   pay_period_half,

  status          application_status not null default 'draft',

  -- routing resolved at submit (see app logic / README)
  certifier_id    uuid references employees(id),   -- AO1 (ao1_css chain)
  certified_at    timestamptz,
  cert_snapshot   jsonb,                           -- Total Earned / Less / Balance on form
  recommender_id  uuid references employees(id),   -- SSS (sss_css chain)
  recommended_at  timestamptz,
  approver_id     uuid references employees(id),   -- CSS, or RD (external) if applicant is CSS
  approval_external boolean not null default false, -- true when RD must sign at the RO
  external_channel  text,                           -- 'courier' | 'email' (how it was sent)
  decision_recorded_by uuid references employees(id), -- admin who encoded an external RD decision
  decided_at      timestamptz,
  decision_remarks text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  check (inclusive_end >= inclusive_start)
);
create index on leave_applications (employee_id);
create index on leave_applications (status);
create index on leave_applications (date_of_filing);

create table leave_application_dates (
  application_id uuid references leave_applications(id) on delete cascade,
  leave_date     date not null,
  primary key (application_id, leave_date)
);

-- ---------- admin-encoded attendance (Leave Card "action taken" columns) ----------
create table attendance_events (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id),
  event_date      date not null,
  type            attendance_type not null,
  minutes         int,                          -- raw tardy/undertime minutes
  equivalent_days numeric(8,3),                 -- via conversion table (seed 002)
  with_pay        boolean not null default false,
  charge_category leave_category,               -- vacation|sick when with_pay
  note            text,
  encoded_by      uuid not null references employees(id),
  created_at      timestamptz default now()
);
create index on attendance_events (employee_id, event_date);

-- ---------- leave ledger (the Leave Card, append-only, long format) ----------
-- One row per category-affecting event. Wide monthly cards are rebuilt by views.
create table leave_ledger (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id),
  period        date not null,                  -- month anchor or event date
  entry_type    ledger_entry_type not null,
  category      leave_category,                 -- vacation|sick|wellness
  earned        numeric(8,3) not null default 0,
  charged       numeric(8,3) not null default 0,
  balance_after numeric(8,3),                   -- running balance for this category
  -- COSW unpaid deduction context (entry_type='cosw_deduction')
  deduction_amount numeric(12,2),
  deduction_half   pay_period_half,
  source_application_id uuid references leave_applications(id),
  source_attendance_id  uuid references attendance_events(id),
  note          text,
  created_by    uuid references employees(id),  -- null = system/cron
  created_at    timestamptz default now()
);
create index on leave_ledger (employee_id, period);

-- ---------- signatory unavailability (drives the date-of-filing check) ----------
-- Auto-filled when a signatory's own leave is approved; admin may add manual rows.
create table signatory_unavailability (
  id           uuid primary key default gen_random_uuid(),
  signatory_id uuid not null references employees(id),
  start_date   date not null,
  end_date     date not null,
  reason       text,
  source_application_id uuid references leave_applications(id),
  created_at   timestamptz default now(),
  check (end_date >= start_date)
);
create index on signatory_unavailability (signatory_id, start_date, end_date);

-- ---------- minute/hour -> day conversion (seed 002) ----------
create table time_conversion (
  unit   text not null check (unit in ('minute','hour')),
  amount int  not null,
  equivalent_day numeric(5,3) not null,
  primary key (unit, amount)
);

-- ---------- audit log ----------
create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references employees(id),
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  detail     jsonb,
  created_at timestamptz default now()
);

-- =====================================================================
-- Analytics views
-- =====================================================================
create view v_employee_leave_summary as
select e.id as employee_id,
       e.last_name, e.first_name, e.emp_class, e.unit_id,
       coalesce(max(b.balance) filter (where b.category='vacation'),0) as vl_balance,
       coalesce(max(b.balance) filter (where b.category='sick'),0)     as sl_balance,
       coalesce(sum(b.balance) filter (where b.category='wellness'),0) as wellness_balance
from employees e
left join leave_balances b on b.employee_id = e.id
group by e.id;

create view v_leave_by_unit as
select e.unit_id, u.name as unit_name, lt.code as leave_code,
       count(*) as application_count, sum(la.working_days) as total_days
from leave_applications la
join employees e   on e.id = la.employee_id
left join units u  on u.id = e.unit_id
join leave_types lt on lt.id = la.leave_type_id
where la.status = 'approved'
group by e.unit_id, u.name, lt.code;

create view v_leave_office_wide as
select date_trunc('month', la.inclusive_start)::date as month,
       lt.code as leave_code, la.status,
       count(*) as application_count, sum(la.working_days) as total_days
from leave_applications la
join leave_types lt on lt.id = la.leave_type_id
group by 1, 2, 3;

-- =====================================================================
-- RLS sketch (enable + refine before launch)
-- =====================================================================
-- alter table employees           enable row level security;
-- alter table leave_applications  enable row level security;
-- alter table leave_balances      enable row level security;
-- alter table leave_ledger        enable row level security;
-- Staff: select/insert own rows (employee_id maps via auth_user_id).
-- Admins + the relevant signatory seat: broader read + certify/recommend/approve writes.
