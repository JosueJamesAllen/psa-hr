-- =====================================================================
-- Migration 009: account-request rejection remarks + email notification
--   decision_remarks — admin's reasons, shown to HR and emailed to the
--                      applicant by the reject-account edge function
--   notified_at      — set by the edge function once the email went out
-- =====================================================================

alter table account_requests
  add column if not exists decision_remarks text,
  add column if not exists notified_at timestamptz;
