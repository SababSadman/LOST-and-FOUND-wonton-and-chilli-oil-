-- Run after schema.sql and migrations 001/002, in Supabase SQL Editor.
-- All multi-table workflows below run in one database transaction.
begin;

alter table public.profiles add column if not exists notification_preferences jsonb not null default '{"messages":true,"reviews":true}'::jsonb;
grant update(notification_preferences) on public.profiles to authenticated;

-- Account creation is always student registration. Administrators are assigned
-- explicitly in SQL Editor; user-controlled signup metadata cannot grant it.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, department, role)
  values(new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'UIU Student'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'department'), ''), 'Not specified'), 'student');
  insert into public.profile_private(user_id, student_id, phone)
  values(new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'student_id'), ''), left(new.id::text, 40)),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''));
  return new;
end $$;
drop policy if exists "users can insert their profile" on public.profiles;

-- INSERT ... RETURNING must see the newly inserted claim. A stable helper
-- that re-queries claims cannot see that tuple in the statement snapshot.
drop policy if exists "claim parties and admins can read claims" on public.claims;
create policy "claim parties and admins can read claims" on public.claims for select to authenticated
using(claimant_id = auth.uid() or private.owns_item(item_id) or private.is_admin());

create or replace function public.portal_save_profile(profile_name text, profile_department text,
  profile_phone text, profile_avatar text, profile_preferences jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to edit your profile'; end if;
  if profile_avatar is not null and (length(profile_avatar) > 700000 or profile_avatar !~ '^data:image/(jpeg|png|webp);base64,') then
    raise exception 'Choose a smaller JPEG, PNG, or WebP profile image';
  end if;
  update public.profiles set full_name = profile_name, department = profile_department,
    avatar_path = profile_avatar, notification_preferences = profile_preferences where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  update public.profile_private set phone = profile_phone where user_id = auth.uid();
  if not found then raise exception 'Private profile not found'; end if;
end $$;

create or replace function public.portal_create_item(
  item_id uuid, category_id bigint, item_type public.item_type, item_title text,
  item_description text, item_location text, item_date date,
  item_photo_path text, item_hidden_detail text
) returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in before submitting a report'; end if;
  if item_photo_path is not null and split_part(item_photo_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid image owner';
  end if;
  insert into public.items(id, reporter_id, category_id, type, title, description, location, occurred_on, photo_path)
  values(item_id, auth.uid(), category_id, item_type, item_title, item_description, item_location, item_date, item_photo_path);
  insert into public.item_private_details(item_id, reporter_id, hidden_detail)
  values(item_id, auth.uid(), item_hidden_detail);
  return item_id;
end $$;

create or replace function public.portal_create_claim(
  target_item_id uuid, claim_kind public.claim_kind, feature text, claim_proof text, contact text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in before filing a claim'; end if;
  insert into public.claims(item_id, claimant_id, kind) values(target_item_id, auth.uid(), claim_kind)
  returning id into new_id;
  insert into public.claim_evidence(claim_id, claimant_id, identifying_feature, proof, contact_phone)
  values(new_id, auth.uid(), feature, claim_proof, contact);
  return new_id;
end $$;

create or replace function public.portal_approve_claim(target_claim_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare target public.claims; conv_id uuid; pin text;
begin
  if not private.is_admin() then raise exception 'Only administrators can approve claims'; end if;
  select * into target from public.claims where id = target_claim_id for update;
  if not found or target.status not in ('pending', 'approved') then raise exception 'Claim is not awaiting approval'; end if;
  perform 1 from public.items where id = target.item_id for update;
  if not exists(select 1 from public.items where id = target.item_id and approval_status = 'approved' and status <> 'resolved') then
    raise exception 'Approve the unresolved report before awarding its claim';
  end if;
  if exists(select 1 from public.claims where item_id = target.item_id and id <> target.id and status in ('approved', 'returned')) then
    raise exception 'Another claim has already been awarded this item';
  end if;
  update public.claims set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = target.id;
  insert into public.conversations(claim_id, item_id) values(target.id, target.item_id)
  on conflict(claim_id) do update set item_id = excluded.item_id returning id into conv_id;
  pin := lpad((floor(random() * 9000)::int + 1000)::text, 4, '0');
  insert into public.handovers(claim_id, conversation_id, pin_code) values(target.id, conv_id, pin)
  on conflict(claim_id) do nothing;
  select pin_code into pin from public.handovers where claim_id = target.id;
  return pin;
end $$;

create or replace function public.portal_complete_handover(handover_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.handovers;
begin
  if not private.is_admin() then raise exception 'Only administrators can complete handovers'; end if;
  select * into target from public.handovers where id = handover_id for update;
  if not found then raise exception 'Handover not found'; end if;
  if target.status = 'complete' then return; end if;
  if target.status <> 'confirmed' then raise exception 'Confirm the handover before completing it'; end if;
  update public.handovers set status = 'complete' where id = handover_id;
  update public.claims set status = 'returned', reviewed_by = auth.uid(), reviewed_at = now() where id = target.claim_id;
end $$;

create or replace function public.portal_reschedule_handover(target_handover_id uuid, new_time timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.handovers;
begin
  select * into target from public.handovers where id = target_handover_id for update;
  if auth.uid() is null or not found or not (private.is_claim_party(target.claim_id) or private.is_admin()) then
    raise exception 'Only handover participants can propose a time';
  end if;
  if target.status not in ('proposed', 'confirmed') then raise exception 'This handover cannot be rescheduled'; end if;
  if new_time is null or new_time <= now() then raise exception 'Choose a future date and time'; end if;
  update public.handovers set scheduled_for = new_time, status = 'proposed', confirmed_at = null where id = target_handover_id;
  insert into public.messages(conversation_id, sender_id, body)
  values(target.conversation_id, auth.uid(), 'Proposed handover time: ' || new_time::text);
end $$;

create or replace function public.portal_award_dispute(dispute_id uuid, winning_claim_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.disputes;
begin
  if not private.is_admin() then raise exception 'Only administrators can resolve disputes'; end if;
  select * into target from public.disputes where id = dispute_id for update;
  if not found or target.status not in ('open', 'escalated') then raise exception 'Dispute is no longer open'; end if;
  if not exists(select 1 from public.claims where id = winning_claim_id and item_id = target.item_id and status = 'pending') then
    raise exception 'Choose a pending claim for this item';
  end if;
  perform public.portal_approve_claim(winning_claim_id);
  update public.claims set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_note = 'Another claimant won the dispute.'
  where item_id = target.item_id and id <> winning_claim_id and status = 'pending';
  update public.disputes set status = 'resolved', awarded_claim_id = winning_claim_id, resolved_by = auth.uid(), resolved_at = now()
  where id = dispute_id;
end $$;

create or replace function public.portal_change_item_photo(target_item_id uuid, new_photo_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.items; admin boolean := private.is_admin();
begin
  select * into target from public.items where id = target_item_id for update;
  if auth.uid() is null or not found or (target.reporter_id <> auth.uid() and not admin) then
    raise exception 'You may only change images on your own reports';
  end if;
  if target.status = 'resolved' and not admin then raise exception 'Returned reports cannot be edited'; end if;
  if new_photo_path is null or split_part(new_photo_path, '/', 1) <> auth.uid()::text
    or split_part(new_photo_path, '/', 2) <> target_item_id::text
    or not exists(select 1 from storage.objects where bucket_id = 'item-photos' and name = new_photo_path) then
    raise exception 'Upload an image before saving it';
  end if;
  update public.items set photo_path = new_photo_path,
    approval_status = case when admin then approval_status else 'pending'::public.approval_status end,
    reviewed_by = case when admin then reviewed_by else null end,
    reviewed_at = case when admin then reviewed_at else null end,
    rejection_reason = case when admin then rejection_reason else null end
  where id = target_item_id;
end $$;

-- Owners must be able to read their upload before it is attached to an item.
drop policy if exists "users can read their own image uploads" on storage.objects;
create policy "users can read their own image uploads" on storage.objects for select to authenticated
using(bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.portal_read_conversation(target_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (private.is_conversation_party(target_conversation_id) or private.is_admin()) then
    raise exception 'You are not a participant in this conversation';
  end if;
  update public.messages set read_at = now() where conversation_id = target_conversation_id and sender_id <> auth.uid() and read_at is null;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('message-photos','message-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.can_read_message_photo(path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.messages m where m.body = 'image:' || path
    and (private.is_conversation_party(m.conversation_id) or private.is_admin()));
$$;
grant execute on function private.can_read_message_photo(text) to authenticated;
drop policy if exists "participants can read message images" on storage.objects;
create policy "participants can read message images" on storage.objects for select to authenticated
using(bucket_id='message-photos' and ((storage.foldername(name))[1]=auth.uid()::text or private.can_read_message_photo(name)));
drop policy if exists "users can upload message images" on storage.objects;
create policy "users can upload message images" on storage.objects for insert to authenticated
with check(bucket_id='message-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users can delete their message images" on storage.objects;
create policy "users can delete their message images" on storage.objects for delete to authenticated
using(bucket_id='message-photos' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function private.portal_message_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target public.conversations; recipient uuid;
begin
  update public.conversations set updated_at = now() where id = new.conversation_id returning * into target;
  select case when c.claimant_id = new.sender_id then i.reporter_id else c.claimant_id end into recipient
  from public.claims c join public.items i on i.id = c.item_id where c.id = target.claim_id;
  if recipient is not null and recipient <> new.sender_id and exists(
    select 1 from public.profiles where id = recipient and notification_preferences->>'messages' <> 'false'
  ) then
    insert into public.notifications(user_id, title, body, destination)
    values(recipient, 'New message', left(new.body, 300), 'messages');
  end if;
  return new;
end $$;
drop trigger if exists portal_message_activity on public.messages;
create trigger portal_message_activity after insert on public.messages for each row execute function private.portal_message_activity();

create or replace function private.portal_review_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid; label text;
begin
  if tg_table_name = 'items' then
    if new.approval_status = old.approval_status then return new; end if;
    recipient := new.reporter_id;
    label := 'Report ' || new.approval_status::text;
  else
    if new.status = old.status then return new; end if;
    recipient := new.claimant_id;
    label := 'Claim ' || new.status::text;
  end if;
  if exists(select 1 from public.profiles where id = recipient and notification_preferences->>'reviews' <> 'false') then
    insert into public.notifications(user_id, title, body, destination)
    values(recipient, label, 'Open My Desk to check the latest status.', 'claims');
  end if;
  insert into public.activity_log(event_code, action, detail, actor_id)
  values('DESK', label, 'Status updated at the lost and found desk.', auth.uid());
  return new;
end $$;
drop trigger if exists portal_item_review_notification on public.items;
create trigger portal_item_review_notification after update of approval_status on public.items for each row execute function private.portal_review_notification();
drop trigger if exists portal_claim_review_notification on public.claims;
create trigger portal_claim_review_notification after update of status on public.claims for each row execute function private.portal_review_notification();

create or replace function private.portal_submission_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare reporter uuid;
begin
  if tg_table_name = 'items' then
    reporter := new.reporter_id;
  else
    select reporter_id into reporter from public.items where id = new.item_id;
    if (select count(*) from public.claims where item_id = new.item_id and status = 'pending') > 1
      and not exists(select 1 from public.disputes where item_id = new.item_id and status in ('open','escalated')) then
      insert into public.disputes(item_id, reason) values(new.item_id, 'Multiple pending claims require desk review.');
    end if;
  end if;
  insert into public.notifications(user_id, title, body, destination)
  select id, 'New submission', 'A report or claim is awaiting desk review.', 'admin'
  from public.profiles where role = 'admin' and is_active and notification_preferences->>'reviews' <> 'false';
  if exists(select 1 from public.profiles where id = reporter and notification_preferences->>'reviews' <> 'false') then
    insert into public.notifications(user_id, title, body, destination)
    values(reporter, 'Desk submission received', 'Open My Desk to follow the report or incoming claim.', 'claims');
  end if;
  insert into public.activity_log(event_code, action, detail, actor_id)
  values('DESK', 'Submission received', 'A submission is awaiting review.', auth.uid());
  return new;
end $$;
drop trigger if exists portal_item_submission on public.items;
create trigger portal_item_submission after insert on public.items for each row execute function private.portal_submission_notification();
drop trigger if exists portal_claim_submission on public.claims;
create trigger portal_claim_submission after insert on public.claims for each row execute function private.portal_submission_notification();

revoke all on function public.portal_create_item(uuid,bigint,public.item_type,text,text,text,date,text,text) from public, anon;
revoke all on function public.portal_create_claim(uuid,public.claim_kind,text,text,text) from public, anon;
revoke all on function public.portal_approve_claim(uuid) from public, anon;
revoke all on function public.portal_complete_handover(uuid) from public, anon;
revoke all on function public.portal_award_dispute(uuid,uuid) from public, anon;
revoke all on function public.portal_change_item_photo(uuid,text) from public, anon;
revoke all on function public.portal_save_profile(text,text,text,text,jsonb) from public, anon;
revoke all on function public.portal_read_conversation(uuid) from public, anon;
revoke all on function public.portal_reschedule_handover(uuid,timestamptz) from public, anon;
grant execute on function public.portal_create_item(uuid,bigint,public.item_type,text,text,text,date,text,text) to authenticated;
grant execute on function public.portal_create_claim(uuid,public.claim_kind,text,text,text) to authenticated;
grant execute on function public.portal_approve_claim(uuid), public.portal_complete_handover(uuid), public.portal_award_dispute(uuid,uuid), public.portal_change_item_photo(uuid,text) to authenticated;
grant execute on function public.portal_save_profile(text,text,text,text,jsonb) to authenticated;
grant execute on function public.portal_read_conversation(uuid) to authenticated;
grant execute on function public.portal_reschedule_handover(uuid,timestamptz) to authenticated;

commit;
