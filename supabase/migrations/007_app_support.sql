-- =====================================================================
-- Migration 007: account requests (new-hire onboarding) + seat-queue helper
-- =====================================================================

-- New sign-ins whose email doesn't match an employee land here for HR to approve.
create table account_requests (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid references auth.users(id),
  email         text not null,
  full_name     text,
  status        account_status not null default 'pending',
  requested_at  timestamptz default now(),
  decided_at    timestamptz,
  decided_by    uuid references employees(id)
);
create unique index account_requests_email_pending
  on account_requests (lower(email)) where status = 'pending';

alter table account_requests enable row level security;

-- a user may create + see their own request; HR/admin manage all
create policy acctreq_insert_own on account_requests for insert to authenticated
  with check (auth_user_id = auth.uid());
create policy acctreq_select on account_requests for select to authenticated
  using (auth_user_id = auth.uid() or is_hr_or_admin());
create policy acctreq_update on account_requests for update to authenticated
  using (is_hr_or_admin()) with check (is_hr_or_admin());

grant select, insert, update, delete on account_requests to authenticated;

-- Applications awaiting the CURRENT user's signatory seat (RLS still applies).
create or replace function pending_applications()
  returns setof leave_applications language sql stable set search_path = public as $$
    select a.* from leave_applications a
    where current_seat() is not null
      and app_pending_seat(a.leave_type_id, a.status) = current_seat()
    order by a.date_of_filing
  $$;
grant execute on function pending_applications() to authenticated;

-- Denormalize seat-holder names so any signed-in user can see the approval route
-- without needing read access to the employees table (RLS keeps salaries private).
update signatory_seats s
   set holder_name = (select trim(e.first_name || ' ' || coalesce(e.middle_name || ' ', '') || e.last_name)
                      from employees e where e.id = s.employee_id)
 where s.employee_id is not null and s.holder_name is null;
