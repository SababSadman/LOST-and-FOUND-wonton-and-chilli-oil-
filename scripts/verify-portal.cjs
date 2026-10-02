const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.PORTAL_TEST_URL || 'http://localhost:3000';
let png;

// The actual iframe bundle and injected bridge run unchanged. Only the SDK
// boundary is replaced, keeping these checks away from live accounts/data.
function fakeSDK() {
  const uid = '11111111-1111-4111-8111-111111111111';
  const tables = {
    profiles: [{ id: uid, full_name: 'Test Student', department: 'Dept. of CSE', role: 'student', avatar_path: null, notification_preferences: { messages: true, reviews: true } }],
    profile_private: [{ user_id: uid, student_id: '0111230123', phone: '01700000000' }],
    categories: [{ id: 1, name: 'Electronics', code: 'ELEC', is_active: true }],
    items: [], claims: [], conversations: [], messages: [], activity_log: [], disputes: [],
    notifications: [{ id: 1, user_id: uid, title: 'Test notification', body: 'Open My Desk.', destination: 'claims', read_at: null, created_at: new Date().toISOString() }],
  };
  const uploads = {};
  const calls = [];
  let signedIn = true;
  window.__PORTAL_TEST__ = { tables, uploads, calls };
  function query(table) {
    let filters = [], patch, insert;
    const builder = {
      select() { return this; }, order() { return this; }, limit() { return this; },
      eq(key, value) { filters.push((row) => row[key] === value); return this; },
      is(key, value) { return this.eq(key, value); },
      in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
      update(value) { patch = value; return this; },
      insert(value) { insert = value; return this; },
      async maybeSingle() { const res = await this; return { ...res, data: res.data[0] || null }; },
      async single() { return this.maybeSingle(); },
      then(resolve, reject) {
        try {
          let rows = tables[table].filter((row) => filters.every((fn) => fn(row)));
          if (patch) { rows.forEach((row) => Object.assign(row, patch)); calls.push({ table, patch }); }
          if (insert) {
            const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), read_at: null, ...insert };
            tables[table].push(row); rows = [row];
            if (table === 'messages') tables.conversations.find((conv) => conv.id === row.conversation_id).messages.push(row);
          }
          resolve({ data: structuredClone(rows), error: null });
        } catch (error) { reject(error); }
      },
    };
    return builder;
  }
  const client = {
    auth: {
      async getUser() { return { data: { user: signedIn ? { id: uid } : null } }; },
      async signInWithPassword() { signedIn = true; return { data: { user: { id: uid } }, error: null }; },
      async signOut() { signedIn = false; return { error: null }; },
      async signUp(payload) { calls.push({ signUp: payload }); return { data: { session: null, user: { id: uid } }, error: null }; },
      async resetPasswordForEmail(email) { calls.push({ resetEmail: email }); return { error: null }; },
      onAuthStateChange(callback) { window.__PORTAL_TEST__.recover = callback; return { data: { subscription: { unsubscribe() {} } } }; },
      async updateUser(payload) { calls.push({ updateUser: payload }); return { error: null }; },
    },
    from: query,
    storage: { from() { return {
      async upload(path, blob) {
        uploads[path] = 'data:' + blob.type + ';base64,' + btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
        return { error: null };
      },
      async createSignedUrl(path) { return { data: { signedUrl: uploads[path] }, error: null }; },
      async remove(paths) { paths.forEach((path) => delete uploads[path]); return { error: null }; },
    }; } },
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      if (name === 'portal_create_item') {
        tables.items.push({ id: args.item_id, reporter_id: uid, type: args.item_type, approval_status: 'pending', status: 'open',
          title: args.item_title, description: args.item_description, location: args.item_location, public_location: 'UIU Campus',
          occurred_on: args.item_date, photo_path: args.item_photo_path, category: { id: 1, name: 'Electronics', code: 'ELEC' },
          reporter: { full_name: 'Test Student' }, private_detail: { hidden_detail: args.item_hidden_detail } });
      } else if (name === 'portal_change_item_photo') {
        const row = tables.items.find((item) => item.id === args.target_item_id);
        row.photo_path = args.new_photo_path; row.approval_status = 'pending';
      } else if (name === 'portal_save_profile') {
        Object.assign(tables.profiles[0], { full_name: args.profile_name, department: args.profile_department,
          avatar_path: args.profile_avatar, notification_preferences: args.profile_preferences });
        tables.profile_private[0].phone = args.profile_phone;
      } else if (name === 'portal_reschedule_handover') {
        tables.conversations[0].handover.scheduled_for = args.new_time;
        tables.conversations[0].handover.status = 'proposed';
      }
      return { data: null, error: null };
    },
  };
  window.supabase = { createClient: () => client };
}

(async () => {
  const raw = await (await fetch(base + '/portal-runtime')).text();
  assert.ok(raw.includes('data-portal-overrides'), 'Route must return the enhanced portal');
  const html = raw.replace(/window\.__PORTAL_ENV__=[\s\S]*?;<\/script>/, 'window.__PORTAL_ENV__={url:"https://portal-test.invalid",key:"test-key"};</script>');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 40;
      const context = canvas.getContext('2d'); context.fillStyle = '#f35a12'; context.fillRect(0, 0, 40, 40);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url === base + '/portal-runtime') return route.fulfill({ contentType: 'text/html', body: html });
      if (url === base + '/vendor/supabase.js') return route.fulfill({ contentType: 'application/javascript', body: '(' + fakeSDK.toString() + ')();' });
      if (url.startsWith(base + '/')) return route.continue();
      return route.abort();
    });
    await page.goto(base + '/portal-runtime');
    await page.getByRole('button', { name: 'Found', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Found', exact: true }).click();
    const form = page.locator('form').filter({ has: page.locator('#found-photo-slot') });
    await form.getByLabel('Item name', { exact: true }).fill('Browser test calculator');
    await form.locator('select').selectOption('Electronics');
    await form.getByLabel('Date found', { exact: true }).fill('2026-10-02');
    await form.getByLabel('Location found', { exact: true }).fill('Auditorium lobby');
    await form.getByLabel(/public description/i).fill('A blue calculator found near the auditorium.');
    await form.getByLabel(/hidden verification detail/i).fill('Scratch under the battery cover');
    await form.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction(() => {
      const slot = document.getElementById('found-photo-slot');
      return !slot.imageLoading && slot.imageSource.startsWith('data:image/');
    });
    await form.getByRole('button', { name: 'Send for admin approval' }).click();
    const report = page.locator('.admin-action-row').filter({ hasText: 'Browser test calculator' });
    await report.getByRole('img').waitFor();
    await page.waitForFunction(() => document.querySelector('.report-photo')?.naturalWidth > 0);
    assert.ok(await page.evaluate(() => window.__PORTAL_TEST__.calls.some((call) => call.rpc === 'portal_create_item' && call.args.item_photo_path)));
    const oldPath = await page.evaluate(() => window.__PORTAL_TEST__.tables.items[0].photo_path);
    const chooserPromise = page.waitForEvent('filechooser');
    await report.getByRole('button', { name: 'Add / change image' }).click();
    await (await chooserPromise).setFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction((old) => window.__PORTAL_TEST__.tables.items[0].photo_path !== old, oldPath);
    assert.ok(await page.evaluate(() => window.__PORTAL_TEST__.calls.some((call) => call.rpc === 'portal_change_item_photo')));
    // Publish the fixture, then verify the image in the actual browse/detail UI.
    await page.evaluate(() => {
      window.__PORTAL_TEST__.tables.items[0].approval_status = 'approved';
      window.__PORTAL_TEST__.tables.conversations.push({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', claim_id: 'test-claim', item_id: window.__PORTAL_TEST__.tables.items[0].id,
        updated_at: new Date().toISOString(), item: { title: 'Browser test calculator' }, claim: { claimant_id: 'other-user' },
        handover: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'proposed', pin_code: '1234', location: 'Student Affairs', scheduled_for: null }, messages: [] });
    });
    await page.getByRole('button', { name: 'Log Out', exact: true }).click();
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
    await page.getByRole('img', { name: 'Browser test calculator', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add / change image' }).count(), 0);
    await page.getByRole('button', { name: 'Details', exact: true }).first().click();
    await page.waitForFunction(() => document.querySelector('.detail-photo')?.naturalWidth > 0);
    // Sign back in to test profile image and notification persistence.
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
    await page.getByLabel('Email address', { exact: true }).fill('student@example.com');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await page.getByRole('button', { name: 'Reschedule', exact: true }).click();
    const future = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    await page.getByLabel('New date and time', { exact: true }).fill(future);
    await page.getByRole('button', { name: 'Propose time', exact: true }).click();
    await page.waitForFunction(() => window.__PORTAL_TEST__.calls.some((call) => call.rpc === 'portal_reschedule_handover'));
    await page.getByPlaceholder('Write a message...', { exact: true }).fill('Testing the wired chat');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText('Testing the wired chat', { exact: true }).first().waitFor();
    const chatChooser = page.waitForEvent('filechooser');
    await page.getByTitle('Attach', { exact: true }).click();
    await (await chatChooser).setFiles({ name: 'chat.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.getByRole('img', { name: 'Chat attachment', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('img[alt="Chat attachment"]')?.naturalWidth > 0);
    await page.getByTitle('Profile', { exact: true }).click();
    await page.locator('#profile-avatar input[type=file]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction(() => { const slot = document.getElementById('profile-avatar'); return !slot.imageLoading && slot.imageSource.startsWith('data:image/'); });
    await page.locator('#message-alerts').uncheck();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.waitForFunction(() => window.__PORTAL_TEST__.tables.profiles[0].avatar_path?.startsWith('data:image/') && window.__PORTAL_TEST__.tables.profiles[0].notification_preferences.messages === false);
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.waitForFunction(() => window.__PORTAL_TEST__.tables.profiles[0].avatar_path === null);
    await page.getByTitle('Notifications', { exact: true }).click();
    await page.getByText('Test notification', { exact: true }).click();
    await page.waitForFunction(() => window.__PORTAL_TEST__.tables.notifications[0].read_at !== null);
    await page.evaluate(() => window.__PORTAL_TEST__.recover('PASSWORD_RECOVERY'));
    await page.getByLabel('New password', { exact: true }).fill('new-test-password');
    await page.getByLabel('Confirm password', { exact: true }).fill('new-test-password');
    await page.getByRole('button', { name: 'Save password', exact: true }).click();
    await page.waitForFunction(() => window.__PORTAL_TEST__.calls.some((call) => call.updateUser));
    await page.getByRole('button', { name: 'Log Out', exact: true }).click();
    await page.getByLabel('Email address', { exact: true }).fill('student@example.com');
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    await page.waitForFunction(() => window.__PORTAL_TEST__.calls.some((call) => call.resetEmail === 'student@example.com'));
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    const signup = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create account', exact: true }) });
    await signup.getByLabel('Full name', { exact: true }).fill('New Student');
    await signup.getByPlaceholder('e.g. 0111230123', { exact: true }).fill('0111111111');
    await signup.getByLabel('Email address', { exact: true }).fill('new@example.com');
    await signup.locator('select').selectOption('Dept. of CSE');
    await signup.getByLabel('Password', { exact: true }).fill('signup-password');
    await signup.getByLabel('Confirm', { exact: true }).fill('signup-password');
    await signup.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.waitForFunction(() => window.__PORTAL_TEST__.calls.some((call) => call.signUp));
    const signedUp = await page.evaluate(() => window.__PORTAL_TEST__.calls.find((call) => call.signUp).signUp);
    assert.equal(signedUp.options.data.student_id, '0111111111');
    assert.equal(signedUp.options.data.role, 'student');
    await page.getByText('Check your email to confirm your account, then sign in.', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: session restoration, report image upload/preview/replacement, guest browse/detail display, chat messages and image attachments, profile photo save/remove, notification preferences/read state, password reset/recovery, registration with email confirmation.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
