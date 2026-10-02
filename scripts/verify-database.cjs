const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create role supabase_admin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    grant usage on schema auth, storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant select on storage.objects to anon;`);
  await db.exec(fs.readFileSync('supabase/schema.sql', 'utf8').replace('create extension if not exists pgcrypto;', ''));
  for (const file of ['001_open_access_auth.sql', '002_claim_insert_and_demo.sql', '003_portal_feature_wiring.sql']) {
    await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
  }
  await db.exec(fs.readFileSync('supabase/migrations/003_portal_feature_wiring.sql', 'utf8'));
  const owner = '11111111-1111-4111-8111-111111111111';
  const claimant = '22222222-2222-4222-8222-222222222222';
  const admin = '33333333-3333-4333-8333-333333333333';
  const other = '44444444-4444-4444-8444-444444444444';
  for (const [id, name] of [[owner, 'Owner'], [claimant, 'Claimant'], [admin, 'Admin'], [other, 'Other']]) {
    await db.query('insert into auth.users values($1,$2,$3)', [id, name + '@example.com', JSON.stringify({ full_name: name, student_id: name + '01', role: 'admin' })]);
  }
  assert.equal((await db.query('select role from public.profiles where id=$1', [owner])).rows[0].role, 'student');
  await db.query("update public.profiles set role='admin' where id=$1", [admin]);
  const as = async (uid) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
    await db.exec('set role authenticated');
  };
  const item = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const failedItem = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const cat = (await db.query("select id from public.categories where name='Electronics'")).rows[0].id;
  await as(owner);
  await assert.rejects(db.query('select public.portal_save_profile($1,$2,$3,$4,$5)', ['Should roll back', 'CSE', 'x', null, '{"messages":true,"reviews":true}']));
  assert.equal((await db.query('select full_name from public.profiles where id=$1', [owner])).rows[0].full_name, 'Owner');
  await db.query('select public.portal_save_profile($1,$2,$3,$4,$5)', ['Owner', 'CSE', '01700000000', 'data:image/png;base64,dGVzdA==', '{"messages":true,"reviews":true}']);
  assert.equal((await db.query('select avatar_path from public.profiles where id=$1', [owner])).rows[0].avatar_path, 'data:image/png;base64,dGVzdA==');
  await assert.rejects(db.query('select public.portal_create_item($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [failedItem, cat, 'found', 'Phone', 'A black phone found in class', 'Room 201', '2026-10-02', null, 'x']));
  assert.equal((await db.query('select count(*)::int n from public.items where id=$1', [failedItem])).rows[0].n, 0);
  await db.query('select public.portal_create_item($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [item, cat, 'found', 'Phone', 'A black phone found in class', 'Room 201', '2026-10-02', null, 'Cracked left corner']);
  await as(admin);
  await db.query("update public.items set approval_status='approved',reviewed_at=now(),reviewed_by=$2 where id=$1", [item, admin]);
  await as(claimant);
  await assert.rejects(db.query('select public.portal_create_claim($1,$2,$3,$4,$5)', [item, 'ownership', 'Black', 'Proof', 'x']));
  assert.equal((await db.query('select count(*)::int n from public.claims')).rows[0].n, 0);
  const claim = (await db.query('select public.portal_create_claim($1,$2,$3,$4,$5) id', [item, 'ownership', 'Cracked left corner', 'Receipt from store', '01700000000'])).rows[0].id;
  await assert.rejects(db.query('select public.portal_approve_claim($1)', [claim]), /administrators/);
  await as(other);
  const competing = (await db.query('select public.portal_create_claim($1,$2,$3,$4,$5) id', [item, 'ownership', 'Blue case', 'Receipt from store', '01800000000'])).rows[0].id;
  await as(admin);
  const dispute = (await db.query("select id from public.disputes where item_id=$1 and status='open'", [item])).rows[0].id;
  await db.query('select public.portal_award_dispute($1,$2)', [dispute, claim]);
  const pin = (await db.query('select public.portal_approve_claim($1) pin', [claim])).rows[0].pin;
  assert.match(pin, /^\d{4}$/);
  assert.equal((await db.query('select status from public.claims where id=$1', [competing])).rows[0].status, 'rejected');
  assert.equal((await db.query('select awarded_claim_id from public.disputes where id=$1', [dispute])).rows[0].awarded_claim_id, claim);
  const conv = (await db.query('select id from public.conversations where claim_id=$1', [claim])).rows[0].id;
  const handover = (await db.query('select id from public.handovers where claim_id=$1', [claim])).rows[0].id;
  await assert.rejects(db.query('select public.portal_complete_handover($1)', [handover]), /Confirm/);
  await as(claimant);
  await assert.rejects(db.query("select public.portal_reschedule_handover($1,now()-interval '1 day')", [handover]), /future/);
  await db.query("select public.portal_reschedule_handover($1,now()+interval '1 day')", [handover]);
  assert.ok((await db.query('select scheduled_for from public.handovers where id=$1', [handover])).rows[0].scheduled_for);
  await db.query('insert into public.messages(conversation_id,sender_id,body) values($1,$2,$3)', [conv, claimant, 'Meet at Student Affairs']);
  await db.query("update public.handovers set status='confirmed' where id=$1", [handover]);
  await as(owner);
  assert.equal((await db.query("select count(*)::int n from public.notifications where title='New message'")).rows[0].n, 2);
  await db.query('select public.portal_read_conversation($1)', [conv]);
  assert.ok((await db.query('select read_at from public.messages where conversation_id=$1', [conv])).rows[0].read_at);
  const imagePath = owner + '/' + item + '/new.png';
  await db.query("insert into storage.objects(bucket_id,name) values('item-photos',$1)", [imagePath]);
  await db.query('select public.portal_change_item_photo($1,$2)', [item, imagePath]);
  assert.equal((await db.query('select photo_path from public.items where id=$1', [item])).rows[0].photo_path, imagePath);
  assert.equal((await db.query('select approval_status from public.items where id=$1', [item])).rows[0].approval_status, 'pending');
  await as(other);
  await assert.rejects(db.query('select public.portal_change_item_photo($1,$2)', [item, imagePath]), /own reports/);
  await assert.rejects(db.query('select public.portal_read_conversation($1)', [conv]), /participant/);
  await as(admin);
  await db.query("update public.items set approval_status='approved',reviewed_at=now(),reviewed_by=$2 where id=$1", [item, admin]);
  await db.query('select public.portal_complete_handover($1)', [handover]);
  await db.query('select public.portal_complete_handover($1)', [handover]);
  assert.equal((await db.query('select status from public.items where id=$1', [item])).rows[0].status, 'resolved');
  assert.equal((await db.query('select status from public.claims where id=$1', [claim])).rows[0].status, 'returned');
  await db.close();
  console.log('PASS: migration, role isolation, atomic report/claim/profile rollback, dispute award, idempotent approval/completion, chat notifications/read receipts, profile image persistence, image replacement and permissions.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
