-- =====================================================================
-- Migration 008: security hardening
--   1) Leave-application state machine enforced in the DB. RLS (006) says
--      WHO may write a row; this trigger says WHAT a valid write looks
--      like — no skipping straight to 'approved', no editing days/dates/
--      type once review has started, no inserting pre-approved rows.
--   2) Audit log populated by triggers instead of trusting the client;
--      the open "anyone may insert" policy is removed, so entries can
--      be neither forged nor skipped.
--   3) bootstrap_current_user links an auth account to an employee row
--      only when the provider attests the email is verified.
-- =====================================================================

-- ---------- 1) leave-application flow guard ----------
create or replace function enforce_leave_application_flow() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft','submitted') then
      raise exception 'applications must be created as draft or submitted, not %', new.status;
    end if;
    return new;
  end if;

  if new.employee_id is distinct from old.employee_id then
    raise exception 'an application cannot be reassigned to another employee';
  end if;

  if new.status is distinct from old.status and not (
       (old.status = 'draft'     and new.status in ('submitted','cancelled'))
    or (old.status = 'submitted' and new.status in
          ('credits_certified','recommended','forwarded_ro','disapproved','cancelled'))
    or (old.status in ('credits_certified','recommended','forwarded_ro')
          and new.status in ('approved','disapproved'))
  ) then
    raise exception 'invalid status transition: % -> %', old.status, new.status;
  end if;

  -- core details are editable only while the applicant still owns the app
  -- (draft/submitted); any reviewer action must leave them untouched
  if old.status not in ('draft','submitted')
     or new.status not in ('draft','submitted','cancelled') then
    if (new.leave_type_id, new.date_of_filing, new.inclusive_start, new.inclusive_end,
        new.working_days, new.is_paid, new.deduction_amount, new.deduction_half,
        new.applicant_name, new.emp_class_snap, new.salary_snap, new.details)
       is distinct from
       (old.leave_type_id, old.date_of_filing, old.inclusive_start, old.inclusive_end,
        old.working_days, old.is_paid, old.deduction_amount, old.deduction_half,
        old.applicant_name, old.emp_class_snap, old.salary_snap, old.details) then
      raise exception 'application details are locked once review has started';
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists leave_application_flow on leave_applications;
create trigger leave_application_flow
  before insert or update on leave_applications
  for each row execute function enforce_leave_application_flow();

-- ---------- 2) trigger-written audit log ----------
-- SECURITY DEFINER: runs as the migration owner, so it can insert into
-- audit_log after client insert rights are revoked below.
create or replace function write_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_detail jsonb;
  v_id     uuid;
begin
  if tg_op = 'INSERT' then
    v_detail := to_jsonb(new);
    v_id     := new.id;
  elsif tg_op = 'DELETE' then
    v_detail := to_jsonb(old);
    v_id     := old.id;
  else
    v_id := new.id;
    -- log only the fields that changed
    select jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value))
      into v_detail
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n on n.key = o.key
     where o.value is distinct from n.value;
    if v_detail is null then return new; end if;  -- no-op update
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (current_employee_id(), lower(tg_op), tg_table_name, v_id, v_detail);
  return coalesce(new, old);
end $$;

drop trigger if exists audit_employees           on employees;
drop trigger if exists audit_leave_applications  on leave_applications;
drop trigger if exists audit_leave_balances      on leave_balances;
drop trigger if exists audit_leave_ledger        on leave_ledger;
drop trigger if exists audit_attendance_events   on attendance_events;
drop trigger if exists audit_signatory_seats     on signatory_seats;
drop trigger if exists audit_account_requests    on account_requests;

create trigger audit_employees          after insert or update or delete on employees          for each row execute function write_audit();
create trigger audit_leave_applications after insert or update or delete on leave_applications for each row execute function write_audit();
create trigger audit_leave_balances     after insert or update or delete on leave_balances     for each row execute function write_audit();
create trigger audit_leave_ledger       after insert or update or delete on leave_ledger       for each row execute function write_audit();
create trigger audit_attendance_events  after insert or update or delete on attendance_events  for each row execute function write_audit();
create trigger audit_signatory_seats    after insert or update or delete on signatory_seats    for each row execute function write_audit();
create trigger audit_account_requests   after insert or update or delete on account_requests   for each row execute function write_audit();

-- clients may no longer write audit rows directly (triggers do it)
drop policy if exists audit_insert on audit_log;
revoke insert, update, delete on audit_log from authenticated;

-- ---------- 3) verified-email guard on account linking ----------
create or replace function bootstrap_current_user()
  returns employees language plpgsql security definer set search_path = public as $$
declare emp employees;
begin
  select * into emp from employees where auth_user_id = auth.uid() limit 1;
  if found then return emp; end if;

  -- refuse to link by email unless the provider attests it is verified
  -- (Google OAuth always sets user_metadata.email_verified = true)
  if not coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false) then
    return emp;   -- null row -> caller files an account request
  end if;

  update employees
     set auth_user_id = auth.uid(), updated_at = now()
   where auth_user_id is null
     and account_status = 'approved'
     and lower(email) = lower(auth.jwt() ->> 'email')
   returning * into emp;
  return emp;   -- null row when no employee matches the email
end $$;
