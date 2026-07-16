-- =====================================================================
-- Let admins clear the processed account-requests log.
-- account_requests has no DELETE policy, so deletes silently match zero
-- rows for everyone; this allows admins to remove decided requests only
-- (pending ones must still be approved or rejected, never deleted).
-- =====================================================================
create policy acctreq_delete on account_requests for delete to authenticated
  using (is_admin() and status <> 'pending');
