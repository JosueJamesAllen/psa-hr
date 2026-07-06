-- =====================================================================
-- Migration 006: auth bootstrap + Row-Level Security
-- Enforces: office staff = own records; HR staff/admin = office-wide;
-- signatory actions gated by seat; superuser(admin) = everything.
-- =====================================================================

-- ---------- helper functions (SECURITY DEFINER: read employees without
--            tripping RLS recursion) ----------
create or replace function current_employee_id() returns uuid
  language sql stable security definer set search_path = public as $$
    select id from employees where auth_user_id = auth.uid() limit 1 $$;

create or replace function current_app_role() returns app_role
  language sql stable security definer set search_path = public as $$
    select app_role from employees where auth_user_id = auth.uid() limit 1 $$;

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select coalesce((select app_role = 'admin' from employees
                     where auth_user_id = auth.uid() limit 1), false) $$;

create or replace function is_hr_or_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select coalesce((select app_role in ('hr_staff','admin') from employees
                     where auth_user_id = auth.uid() limit 1), false) $$;

create or replace function current_seat() returns signatory_seat
  language sql stable security definer set search_path = public as $$
    select s.seat from signatory_seats s
    join employees e on e.id = s.employee_id
    where e.auth_user_id = auth.uid()
      and (s.effective_to is null or s.effective_to >= current_date)
    limit 1 $$;

-- seat that must act on an application next, from its leave-type routing + status
create or replace function app_pending_seat(p_leave_type uuid, p_status application_status)
  returns signatory_seat language sql stable security definer set search_path = public as $$
    select case
      when p_status = 'submitted' then
        (select case when lt.routing = 'sss_css' then 'sss'::signatory_seat
                     else 'ao1_hrmo'::signatory_seat end
         from leave_types lt where lt.id = p_leave_type)
      when p_status in ('credits_certified','recommended') then 'css'::signatory_seat
      when p_status = 'forwarded_ro' then 'ao1_hrmo'::signatory_seat
      else null::signatory_seat
    end $$;

grant execute on function current_employee_id(), current_app_role(), is_admin(),
  is_hr_or_admin(), current_seat(), app_pending_seat(uuid, application_status) to authenticated;

-- ---------- login bootstrap: link the Google account to its employee row
--            by email on first sign-in (unmatched emails return null) ----------
create or replace function bootstrap_current_user()
  returns employees language plpgsql security definer set search_path = public as $$
declare emp employees;
begin
  select * into emp from employees where auth_user_id = auth.uid() limit 1;
  if found then return emp; end if;

  update employees
     set auth_user_id = auth.uid(), updated_at = now()
   where auth_user_id is null
     and account_status = 'approved'
     and lower(email) = lower(auth.jwt() ->> 'email')
   returning * into emp;
  return emp;   -- null row when no employee matches the email
end $$;
grant execute on function bootstrap_current_user() to authenticated;

-- =====================================================================
-- Enable RLS
-- =====================================================================
alter table employees                enable row level security;
alter table units                    enable row level security;
alter table signatory_seats          enable row level security;
alter table leave_types              enable row level security;
alter table leave_balances           enable row level security;
alter table leave_applications       enable row level security;
alter table leave_application_dates  enable row level security;
alter table attendance_events        enable row level security;
alter table leave_ledger             enable row level security;
alter table signatory_unavailability enable row level security;
alter table time_conversion          enable row level security;
alter table audit_log                enable row level security;

-- ---------- reference tables: readable by any signed-in user, writable by admin ----------
create policy ref_read_units on units for select to authenticated using (true);
create policy ref_write_units on units for all to authenticated using (is_admin()) with check (is_admin());

create policy ref_read_types on leave_types for select to authenticated using (true);
create policy ref_write_types on leave_types for all to authenticated using (is_admin()) with check (is_admin());

create policy ref_read_conv on time_conversion for select to authenticated using (true);
create policy ref_write_conv on time_conversion for all to authenticated using (is_admin()) with check (is_admin());

create policy ref_read_seats on signatory_seats for select to authenticated using (true);
create policy ref_write_seats on signatory_seats for all to authenticated using (is_admin()) with check (is_admin());

create policy ref_read_unavail on signatory_unavailability for select to authenticated using (true);
create policy ref_write_unavail on signatory_unavailability for all to authenticated using (is_hr_or_admin()) with check (is_hr_or_admin());

-- ---------- employees: self or HR/admin ----------
create policy emp_select on employees for select to authenticated
  using (auth_user_id = auth.uid() or is_hr_or_admin());
create policy emp_insert on employees for insert to authenticated
  with check (is_hr_or_admin());
create policy emp_update on employees for update to authenticated
  using (is_hr_or_admin()) with check (is_hr_or_admin());
create policy emp_delete on employees for delete to authenticated
  using (is_admin());

-- ---------- balances / ledger: own or HR/admin (writes HR/admin) ----------
create policy bal_select on leave_balances for select to authenticated
  using (employee_id = current_employee_id() or is_hr_or_admin());
create policy bal_write on leave_balances for all to authenticated
  using (is_hr_or_admin()) with check (is_hr_or_admin());

create policy led_select on leave_ledger for select to authenticated
  using (employee_id = current_employee_id() or is_hr_or_admin());
create policy led_write on leave_ledger for all to authenticated
  using (is_hr_or_admin()) with check (is_hr_or_admin());

-- ---------- attendance: own (read) or HR/admin ----------
create policy att_select on attendance_events for select to authenticated
  using (employee_id = current_employee_id() or is_hr_or_admin());
create policy att_write on attendance_events for all to authenticated
  using (is_hr_or_admin()) with check (is_hr_or_admin());

-- ---------- leave applications: own, HR/admin, or the seat that must act ----------
create policy app_select on leave_applications for select to authenticated
  using (
    employee_id = current_employee_id()
    or is_hr_or_admin()
    or current_seat() = app_pending_seat(leave_type_id, status)
  );
create policy app_insert on leave_applications for insert to authenticated
  with check (employee_id = current_employee_id());
-- (a) applicant may edit/cancel their own draft or submitted app — never advance it
create policy app_update_own on leave_applications for update to authenticated
  using (employee_id = current_employee_id() and status in ('draft','submitted'))
  with check (employee_id = current_employee_id() and status in ('draft','submitted','cancelled'));

-- (b) HR/admin may act on any application, EXCEPT approving/disapproving their own
create policy app_update_admin on leave_applications for update to authenticated
  using (is_hr_or_admin())
  with check (is_hr_or_admin()
              and not (employee_id = current_employee_id() and status in ('approved','disapproved')));

-- (c) the pending seat may act on SOMEONE ELSE's application at its current stage
create policy app_update_seat on leave_applications for update to authenticated
  using (employee_id <> current_employee_id()
         and current_seat() = app_pending_seat(leave_type_id, status))
  with check (employee_id <> current_employee_id());

-- (d) the AO1/HRMO may self-certify their own leave (submitted -> credits_certified only)
create policy app_update_selfcert on leave_applications for update to authenticated
  using (employee_id = current_employee_id() and status = 'submitted' and current_seat() = 'ao1_hrmo')
  with check (employee_id = current_employee_id() and status = 'credits_certified');

create policy appdates_select on leave_application_dates for select to authenticated
  using (exists (
    select 1 from leave_applications a where a.id = application_id
      and (a.employee_id = current_employee_id() or is_hr_or_admin()
           or current_seat() = app_pending_seat(a.leave_type_id, a.status))));
create policy appdates_write on leave_application_dates for all to authenticated
  using (exists (select 1 from leave_applications a where a.id = application_id
      and (a.employee_id = current_employee_id() or is_hr_or_admin())))
  with check (exists (select 1 from leave_applications a where a.id = application_id
      and (a.employee_id = current_employee_id() or is_hr_or_admin())));

-- ---------- audit log: admin reads; any signed-in action may append ----------
create policy audit_select on audit_log for select to authenticated using (is_admin());
create policy audit_insert on audit_log for insert to authenticated with check (true);

-- ---------- base table privileges for the authenticated role ----------
-- Supabase normally pre-grants these; included so the migration is self-contained.
-- RLS policies above still decide which ROWS each caller may actually touch.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  employees, units, signatory_seats, leave_types, leave_balances,
  leave_applications, leave_application_dates, attendance_events,
  leave_ledger, signatory_unavailability, time_conversion, audit_log
  to authenticated;
