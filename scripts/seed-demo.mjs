// Seeds demo data into the live Supabase project.
//
// Runs entirely through the public API as ordinary users, so everything it
// writes has to satisfy the same RLS policies real users do. No service-role
// key is needed or wanted.
//
//   node scripts/seed-demo.mjs          seed
//   node scripts/seed-demo.mjs --reset  remove previously seeded demo rows first
//
// Demo accounts (password is the same for all): DemoPass!2026
//   admin@uiu.ac.bd            desk admin
//   tanvir@uiu.ac.bd           student
//   nusrat@uiu.ac.bd           student
//   fahim@uiu.ac.bd            student

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY in .env.local');
  process.exit(1);
}

const PASSWORD = 'DemoPass!2026';
// Marks seeded rows so --reset can find them. A zero-width space keeps it out
// of the visible description while still being matchable with LIKE.
const TAG = '​';

const PEOPLE = {
  admin:  { email: 'admin@uiu.ac.bd',   name: 'Portal Admin',  dept: 'Student Affairs Office', role: 'admin',   sid: 'SA-2201' },
  tanvir: { email: 'tanvir@uiu.ac.bd',  name: 'Tanvir Rahman', dept: 'B.Sc. in CSE',           role: 'student', sid: '0111230123' },
  nusrat: { email: 'nusrat@uiu.ac.bd',  name: 'Nusrat Ahmed',  dept: 'B.Sc. in EEE',           role: 'student', sid: '0111230456' },
  fahim:  { email: 'fahim@uiu.ac.bd',   name: 'Fahim Hasan',   dept: 'BBA',                    role: 'student', sid: '0111230789' },
};

// type, owner, category, title, where, when, public blurb, held-back detail
const ITEMS = [
  ['found', 'tanvir', 'Electronics',  'Wireless Earbuds',       'UIU Cafeteria',        -3, 'White charging case with two earbuds. Minor scuff on the outer case.', 'A small nick on the rim of the left earbud.'],
  ['found', 'nusrat', 'Documents',    'Student ID Card',        'Study Hub A',          -5, 'UIU Student ID card in a transparent lanyard holder.',                 'A small yellow star sticker on the back of the lanyard.'],
  ['found', 'fahim',  'Accessories',  'Casio G-Shock Watch',    'Gymnasium',            -6, 'Matte black digital watch with a rubber strap.',                       'Small scratch near the top right button.'],
  ['found', 'nusrat', 'Keys',         'House and Bike Keys',    'Ground Floor Plaza',   -6, 'Ring of three keys on a blue leather fob.',                            'Engraved initials SK on the silver fob.'],
  ['lost',  'tanvir', 'Electronics',  'Scientific Calculator',  'Room 505',             -7, 'Dark scientific calculator with a transparent cover.',                 'Cracked corner on the protective cover.'],
  ['lost',  'fahim',  'Bags',         'Navy Backpack',          'Library Level 4',      -2, 'Navy blue backpack with a laptop sleeve and two side pockets.',        'A frayed left shoulder strap stitched with grey thread.'],
  ['lost',  'nusrat', 'Accessories',  'Brown Leather Wallet',   'Library 3rd Floor',    -4, 'Brown leather tri-fold wallet with a student card inside.',            'Red emergency token tucked behind the cash slot.'],
  ['found', 'tanvir', 'Clothing',     'Grey Hooded Jacket',     'Auditorium Level 2',   -1, 'Grey pullover hoodie, size M, left on a seat after an event.',         'A small ink stain on the inside of the right cuff.'],
];

// Items left in the approval queue rather than published.
const PENDING = [
  ['found', 'fahim',  'Accessories', 'Blue Water Bottle',  'Auditorium Level 2', 0,  'Insulated steel flask covered in stickers.', 'Small dent on the bottom rim.'],
  ['lost',  'nusrat', 'Electronics', 'HP Laptop Charger',  'Lab 4',              -1, 'Black 65W adapter with a blue tip.',         'Wrapped with green electrical tape near the block.'],
];

const api = async (path, { token, method = 'GET', body, prefer } = {}) => {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(URL_ + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const msg = (json && (json.message || json.msg || json.error_description)) || text.slice(0, 200);
    throw new Error(`${method} ${path} -> ${res.status} ${msg}`);
  }
  return json;
};

const dayOffset = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Sign in, or create the account on first run.
async function session(person) {
  try {
    const t = await api('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email: person.email, password: PASSWORD },
    });
    return { token: t.access_token, id: t.user.id };
  } catch {
    const s = await api('/auth/v1/signup', {
      method: 'POST',
      body: {
        email: person.email, password: PASSWORD,
        data: { full_name: person.name, department: person.dept, student_id: person.sid, role: person.role },
      },
    });
    if (!s.access_token) {
      throw new Error(`No session for ${person.email}. Turn off "Confirm email" in Supabase > Authentication > Sign In / Providers > Email.`);
    }
    return { token: s.access_token, id: s.user.id };
  }
}

async function main() {
  const reset = process.argv.includes('--reset');
  console.log(`Seeding ${URL_}\n`);

  // 1. accounts
  const who = {};
  for (const [key, person] of Object.entries(PEOPLE)) {
    who[key] = { ...person, ...(await session(person)) };
    // `role` is deliberately not in the column grant, so it can only be set by
    // the signup trigger from metadata. Name and department are updatable.
    await api(`/rest/v1/profiles?id=eq.${who[key].id}`, {
      token: who[key].token, method: 'PATCH',
      body: { full_name: person.name, department: person.dept },
    });
    const check = await api(`/rest/v1/profiles?id=eq.${who[key].id}&select=role`, { token: who[key].token });
    const actual = check && check[0] ? check[0].role : '?';
    if (actual !== person.role) {
      throw new Error(`${person.email} has role "${actual}", expected "${person.role}". If this account predates the migration, delete it in Supabase > Authentication > Users and re-run.`);
    }
    console.log(`  account  ${person.email.padEnd(22)} ${actual}`);
  }
  const admin = who.admin;

  if (reset) {
    // Match the current marker and the earlier visible "[demo]" one.
    const titles = [...ITEMS, ...PENDING].map((r) => r[3]);
    const all = await api('/rest/v1/items?select=id,title', { token: admin.token });
    const doomed = (all || []).filter((r) => titles.includes(r.title));
    for (const row of doomed) {
      await api(`/rest/v1/items?id=eq.${row.id}`, { token: admin.token, method: 'DELETE' });
    }
    console.log(`\n  reset    removed ${doomed.length} demo item(s)\n`);
  }

  // 2. categories the demo rows need
  const cats = await api('/rest/v1/categories?select=id,name&is_active=eq.true', { token: admin.token });
  const catId = Object.fromEntries((cats || []).map((c) => [c.name, c.id]));
  for (const name of [...new Set([...ITEMS, ...PENDING].map((r) => r[2]))]) {
    if (catId[name]) continue;
    const made = await api('/rest/v1/categories', {
      token: admin.token, method: 'POST', prefer: 'return=representation',
      body: { name, code: name.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() },
    });
    catId[name] = made[0].id;
    console.log(`  category ${name} (created)`);
  }

  // 3. items — inserted by their reporter, then approved by the admin
  const made = [];
  for (const [type, owner, cat, title, where, when, blurb, secret] of ITEMS) {
    const u = who[owner];
    const row = await api('/rest/v1/items', {
      token: u.token, method: 'POST', prefer: 'return=representation',
      body: {
        reporter_id: u.id, category_id: catId[cat], type, title,
        description: `${blurb}${TAG}`, location: where, occurred_on: dayOffset(when),
      },
    });
    const id = row[0].id;
    await api('/rest/v1/item_private_details', {
      token: u.token, method: 'POST',
      body: { item_id: id, reporter_id: u.id, hidden_detail: secret },
    });
    await api(`/rest/v1/items?id=eq.${id}`, {
      token: admin.token, method: 'PATCH',
      body: { approval_status: 'approved', reviewed_by: admin.id, reviewed_at: new Date().toISOString() },
    });
    made.push({ id, type, title, owner });
    console.log(`  item     ${title.padEnd(24)} ${type}  published`);
  }

  // 4. items left awaiting approval
  for (const [type, owner, cat, title, where, when, blurb, secret] of PENDING) {
    const u = who[owner];
    const row = await api('/rest/v1/items', {
      token: u.token, method: 'POST', prefer: 'return=representation',
      body: {
        reporter_id: u.id, category_id: catId[cat], type, title,
        description: `${blurb}${TAG}`, location: where, occurred_on: dayOffset(when),
      },
    });
    await api('/rest/v1/item_private_details', {
      token: u.token, method: 'POST',
      body: { item_id: row[0].id, reporter_id: u.id, hidden_detail: secret },
    });
    console.log(`  item     ${title.padEnd(24)} ${type}  pending approval`);
  }

  // 5. an approved claim -> conversation + handover + chat
  const earbuds = made.find((m) => m.title === 'Wireless Earbuds');
  if (earbuds) {
    const claimant = who.nusrat;
    const claim = await api('/rest/v1/claims', {
      token: claimant.token, method: 'POST', prefer: 'return=representation',
      body: { item_id: earbuds.id, claimant_id: claimant.id, kind: 'ownership', status: 'pending' },
    });
    await api('/rest/v1/claim_evidence', {
      token: claimant.token, method: 'POST',
      body: {
        claim_id: claim[0].id, claimant_id: claimant.id,
        identifying_feature: 'A small nick on the rim of the left earbud',
        proof: 'Lost them after a class in the cafeteria on Tuesday',
        contact_phone: '01712345678',
      },
    });
    await api(`/rest/v1/claims?id=eq.${claim[0].id}`, {
      token: admin.token, method: 'PATCH',
      body: { status: 'approved', reviewed_by: admin.id, reviewed_at: new Date().toISOString() },
    });
    const conv = await api('/rest/v1/conversations', {
      token: admin.token, method: 'POST', prefer: 'return=representation',
      body: { claim_id: claim[0].id, item_id: earbuds.id },
    });
    await api('/rest/v1/handovers', {
      token: admin.token, method: 'POST',
      body: { claim_id: claim[0].id, conversation_id: conv[0].id, pin_code: '8492' },
    });
    const finder = who[earbuds.owner];
    for (const [tok, text] of [
      [finder.token, 'Hello! I handed your earbuds in at the desk. The admin approved your claim.'],
      [claimant.token, 'Thank you so much! Can we meet at Student Affairs around 2:00 PM?'],
      [finder.token, 'That works. Bring the four digit code and they will release them.'],
    ]) {
      await api('/rest/v1/messages', {
        token: tok, method: 'POST',
        body: { conversation_id: conv[0].id, sender_id: tok === finder.token ? finder.id : claimant.id, body: text },
      });
    }
    console.log('  chat     Wireless Earbuds        conversation + handover PIN 8492');
  }

  // 6. a claim still awaiting review
  const wallet = made.find((m) => m.title === 'Brown Leather Wallet');
  if (wallet) {
    const c = await api('/rest/v1/claims', {
      token: who.tanvir.token, method: 'POST', prefer: 'return=representation',
      body: { item_id: wallet.id, claimant_id: who.tanvir.id, kind: 'recovery', status: 'pending' },
    });
    await api('/rest/v1/claim_evidence', {
      token: who.tanvir.token, method: 'POST',
      body: {
        claim_id: c[0].id, claimant_id: who.tanvir.id,
        identifying_feature: 'Red token behind the cash slot',
        proof: 'I think I picked this up near the library stairs',
        contact_phone: '01798765432',
      },
    });
    console.log('  claim    Brown Leather Wallet    awaiting admin review');
  }

  // 7. a dispute for the admin desk
  const watch = made.find((m) => m.title === 'Casio G-Shock Watch');
  if (watch) {
    for (const person of [who.tanvir, who.nusrat]) {
      const c = await api('/rest/v1/claims', {
        token: person.token, method: 'POST', prefer: 'return=representation',
        body: { item_id: watch.id, claimant_id: person.id, kind: 'ownership', status: 'pending' },
      });
      await api('/rest/v1/claim_evidence', {
        token: person.token, method: 'POST',
        body: {
          claim_id: c[0].id, claimant_id: person.id,
          identifying_feature: person === who.tanvir ? 'Scratch near the top right button' : 'Worn strap and a scuffed face',
          proof: 'Lost it at the gym last week',
          contact_phone: '01700000000',
        },
      });
    }
    await api('/rest/v1/disputes', {
      token: admin.token, method: 'POST',
      body: { item_id: watch.id, reason: `Two students claim the same watch. ${TAG}` },
    });
    console.log('  dispute  Casio G-Shock Watch     two competing claimants');
  }

  console.log(`\nDone. Sign in with any address below and password: ${PASSWORD}`);
  for (const p of Object.values(PEOPLE)) console.log(`  ${p.email.padEnd(22)} ${p.role}`);
}

main().catch((err) => { console.error('\nSeed failed:', err.message); process.exit(1); });
