# Supabase setup for UIU Lost & Found

The database migration is in [`supabase/schema.sql`](supabase/schema.sql). It models the current portal's profiles, approval queue, lost/found items, private verification details, claims, matching, disputes, conversations, messages, handovers, notifications, activity, and item photos.

## 1. Create and initialize Supabase

1. Create a project at <https://database.new>.
2. Open **SQL Editor** in that project.
3. Paste all of `supabase/schema.sql` and click **Run** once.
   Then run the files in `supabase/migrations/` in numeric order. On an existing
   project that already has migrations 001 and 002, run only
   [`003_portal_feature_wiring.sql`](supabase/migrations/003_portal_feature_wiring.sql).
4. In **Authentication > URL Configuration**, set the Site URL to `http://localhost:3000` for local development. Add the production URL later.
5. In the project's **Connect** dialog, copy the Project URL and publishable key.
6. Copy `.env.example` to `.env.local` and replace its two placeholders. Never commit `.env.local`.

## Updating an existing deployment

Run migration **003** in Supabase SQL Editor before using the new portal code.
It installs the atomic report, claim, profile, dispute, and handover functions,
fixes the claim read policy, persists notification preferences, and adds a
private `message-photos` bucket for chat attachments. It can be run again safely.
Existing administrators retain their role; new registrations are students.
Use the administrator bootstrap SQL below to grant an admin role explicitly.

Add the production URL ending in `/portal-runtime` to **Authentication > URL
Configuration > Redirect URLs** so password reset emails return to the recovery
form. Keep email confirmation enabled if you want verified email registration.

Report images are stored in `item-photos`; they appear in My Desk, the admin
queue, browse cards, and item details. Replacing a published report image as its
owner sends the report back for approval. Profile photos are resized and stored
in the existing `profiles.avatar_path` text field as data URLs (maximum 500 KB).
Message attachments use signed URLs and are visible only to conversation
participants and administrators. The profile toggles control in-app message
and review alerts; they do not send email or operating-system push alerts.

## Verification

```bash
npm run test:database
npx playwright install chromium
npm run dev
# In another terminal:
npm run test:portal
npm run lint
npm run build
```

Database checks use an isolated PostgreSQL engine with Supabase auth/storage
stubs. Browser checks use the real portal bundle with a mocked Supabase SDK;
they do not create or change live accounts or records. Live Supabase/Vercel
verification remains necessary after applying the migration and deploying.

## 2. Install the Next.js clients

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // A Server Component may not write cookies. Proxy refresh handles it.
          }
        },
      },
    },
  );
}
```

For cookie-based authentication, also add Supabase's current SSR session-refresh proxy pattern. Use the official SSR guide because cookie APIs and recommended validation calls can change between releases.

## 3. Sign up users and create profiles

The schema trigger automatically creates `profiles` and `profile_private` rows. Pass profile fields as sign-up metadata:

```ts
const supabase = createClient();

const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name,
      student_id,
      department,
      phone,
    },
  },
});
```

Supabase Auth signs in with an email or phone by default. The current UI asks for a UIU ID. The simplest secure change is to ask for the user's UIU email and keep the UIU ID in `profile_private.student_id`. If login by student ID is mandatory, resolve it in a protected Server Action; do not expose a public student-ID-to-email lookup.

Every new user is a `student`. To bootstrap the first administrator, first sign that user up, then run this once in SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'ADMIN_UIU_EMAIL');
```

## 4. Replace mock state with database calls

The current `PortalContext` stores everything in React state and starts from `src/data/mockData.ts`. Migrate one feature at a time:

- `INITIAL_CATEGORIES` -> `supabase.from('categories').select('*')`
- `INITIAL_ITEMS` and approval queue -> `items`; RLS returns the correct public/owner/admin rows
- held-back detail -> `item_private_details`
- claims and verification answers -> `claims` + `claim_evidence`
- chat -> `conversations` + `messages`
- handover workflow -> `handovers`
- alerts -> `notifications`

For a signed-out guest query, explicitly select `public_location` instead of `location`. PostgreSQL column grants prevent the anonymous API role from reading the exact location or reporter ID even if someone bypasses the UI.

Example server query:

```ts
const supabase = await createClient();
const { data: items, error } = await supabase
  .from('items')
  .select('*, category:categories(id, name, code), reporter:profiles(id, full_name)')
  .eq('approval_status', 'approved')
  .order('created_at', { ascending: false });
```

Example item submission (create the item first, then its private detail):

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Sign in required');

const { data: item, error: itemError } = await supabase
  .from('items')
  .insert({
    reporter_id: user.id,
    category_id,
    type: 'lost',
    title,
    description,
    location,
    occurred_on,
    photo_path,
  })
  .select('id')
  .single();

if (itemError) throw itemError;

const { error: secretError } = await supabase
  .from('item_private_details')
  .insert({ item_id: item.id, reporter_id: user.id, hidden_detail });

if (secretError) throw secretError;
```

If you want the storage path to contain the item ID, generate the UUID in the browser first with `crypto.randomUUID()`, upload to `<user-id>/<item-id>/<filename>`, and include that same `id` and `photo_path` in the item insert. Alternatively, create the pending item first, upload the photo, and update its `photo_path`; RLS permits reporters to edit only their own pending submissions.

For production, wrap the item + private-detail inserts in one database function or trusted Server Action so they succeed or fail together.

## 5. Upload item photos

The migration creates a private `item-photos` bucket. Store objects at:

```text
<authenticated-user-id>/<item-id>/<safe-filename>
```

Save that full object path in `items.photo_path`. Use `createSignedUrl()` to display a photo. Storage RLS permits downloads only when the item is approved, belongs to the requesting reporter, or the requester is an admin.

## Security rules already included

- Guests can read only approved item rows and active categories.
- Hidden item details are readable only by their reporter and admins.
- Claim evidence and contact phone are readable only by the claimant and admins.
- Reporters can see claim status, but not the claimant's private evidence.
- Only admins can approve/reject items and claims or manage disputes/matches.
- Only conversation participants can read/send messages.
- Participants may confirm a proposed handover; only an admin can complete it.
- The publishable key is safe in browser code because RLS limits access. The service-role key bypasses RLS and must remain server-only.

