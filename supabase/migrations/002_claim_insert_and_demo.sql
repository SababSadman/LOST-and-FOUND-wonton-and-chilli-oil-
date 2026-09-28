-- Ensures a signed-in user can file their own claim.
--
-- The live project rejected inserts into public.claims with
--   42501 new row violates row-level security policy
-- even when claimant_id = auth.uid() and status = 'pending', which means the
-- insert policy was missing or defined differently there. This recreates it to
-- match schema.sql. Safe to re-run.

-- The grant is separate from the policy; both are required.
grant insert on public.claims to authenticated;
grant insert on public.claim_evidence to authenticated;

drop policy if exists "users can create their own pending claims" on public.claims;
create policy "users can create their own pending claims"
  on public.claims for insert to authenticated
  with check (claimant_id = (select auth.uid()) and status = 'pending');

drop policy if exists "claimants can create their evidence" on public.claim_evidence;
create policy "claimants can create their evidence"
  on public.claim_evidence for insert to authenticated
  with check (claimant_id = (select auth.uid()));
