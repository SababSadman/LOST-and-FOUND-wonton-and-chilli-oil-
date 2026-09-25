# Supabase setup for UIU Lost & Found

The database migration is in [`supabase/schema.sql`](supabase/schema.sql). It models the current portal's profiles, approval queue, lost/found items, private verification details, claims, matching, disputes, conversations, messages, handovers, notifications, activity, and item photos.

## 1. Create and initialize Supabase

1. Create a project at <https://database.new>.
2. Open **SQL Editor** in that project.
3. Paste all of `supabase/schema.sql` and click **Run** once.
4. In **Authentication > URL Configuration**, set the Site URL to `http://localhost:3000` for local development. Add the production URL later.
5. In the project's **Connect** dialog, copy the Project URL and publishable key.
6. Copy `.env.example` to `.env.local` and replace its two placeholders. Never commit `.env.local`.

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

