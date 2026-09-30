// Bridges the standalone portal bundle to the live Supabase schema.
//
// The bundle renders from `this.state` and mutates it through a handful of
// methods. Rather than rewrite its rendering, this injects a `PortalData`
// helper plus an override block that swaps those methods for Supabase calls,
// mapping rows into the exact shapes the existing JSX already expects.

function buildConfigScript(url: string, key: string) {
  return (
    '<script data-portal-config>window.__PORTAL_ENV__=' +
    JSON.stringify({ url, key }) +
    ';</script>'
  );
}

const DATA_LAYER = String.raw`
<script data-portal-supabase>
(() => {
  const env = window.__PORTAL_ENV__ || {};
  if (!env.url || !env.key || !window.supabase) {
    window.__PORTAL_DATA__ = null;
    return;
  }

  const db = window.supabase.createClient(env.url, env.key);
  const first = (v) => (Array.isArray(v) ? v[0] : v) || null;
  const initials = (name) =>
    (name || '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((p) => p[0]).join('').toUpperCase() || 'UI';
  const showDate = (v) => {
    if (!v) return 'Today';
    const d = new Date(v + 'T00:00:00');
    return isNaN(d) ? String(v) : d.toLocaleDateString('en-GB',
      { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const STATUS = {
    open: 'Open', pending_claim: 'Pending Claim',
    match_under_review: 'Match Under Review', resolved: 'Resolved',
  };

  const PortalData = {
    db,
    userId: null,
    role: 'guest',

    async currentUser() {
      const { data } = await db.auth.getUser();
      return data.user || null;
    },

    // Open access: sign in, and register the account if it does not exist yet.
    async signIn(email, password, desiredRole) {
      const creds = { email: String(email || '').trim(), password: String(password || '') };
      if (!creds.email || !creds.password) throw new Error('Enter an email and password.');

      let res = await db.auth.signInWithPassword(creds);
      if (res.error) {
        const made = await db.auth.signUp({
          ...creds,
          options: { data: { full_name: creds.email.split('@')[0], role: desiredRole } },
        });
        if (made.error) throw made.error;
        res = made.data.session ? { data: made.data } : await db.auth.signInWithPassword(creds);
        if (res.error) throw res.error;
        if (!res.data || !res.data.user) {
          throw new Error('Account made, but it needs email confirmation. Turn off "Confirm email" in Supabase > Authentication > Sign In / Providers > Email.');
        }
      }

      // The role comes from the signup trigger's metadata; it is not in the
      // profiles column grant, so it cannot be reassigned from the client.
      // An existing account keeps whatever role it was created with.
      this.userId = res.data.user.id;
      return res.data.user;
    },

    async signOut() {
      await db.auth.signOut();
      this.userId = null;
      this.role = 'guest';
    },

    async loadProfile(userId) {
      const [{ data: pub }, { data: priv }] = await Promise.all([
        db.from('profiles').select('full_name, department, role').eq('id', userId).maybeSingle(),
        db.from('profile_private').select('student_id, phone').eq('user_id', userId).maybeSingle(),
      ]);
      if (!pub) return null;
      this.role = pub.role === 'admin' ? 'admin' : 'student';
      return {
        name: pub.full_name,
        roleLabel: this.role === 'admin' ? 'Administrator' : 'Student account',
        idLabel: this.role === 'admin' ? 'Staff ID' : 'UIU ID',
        idValue: (priv && priv.student_id) || '—',
        dept: pub.department,
        phone: (priv && priv.phone) || '',
        emailNotif: true,
        pushNotif: true,
        initials: initials(pub.full_name),
      };
    },

    async signedPhoto(path) {
      if (!path) return '';
      const { data } = await db.storage.from('item-photos').createSignedUrl(path, 3600);
      return (data && data.signedUrl) || '';
    },

    // Items + categories. Anonymous users get the guest-safe column set.
    async loadPortal(userId) {
      const cols = userId
        ? 'id, reporter_id, type, approval_status, status, title, description, location, public_location, occurred_on, photo_path, category:categories(id,name,code), reporter:profiles!items_reporter_id_fkey(full_name), private_detail:item_private_details(hidden_detail)'
        : 'id, type, approval_status, status, title, description, public_location, occurred_on, photo_path, category:categories(id,name,code)';

      const [cats, rows] = await Promise.all([
        db.from('categories').select('id,name,code').eq('is_active', true).order('name'),
        db.from('items').select(cols).order('created_at', { ascending: false }),
      ]);
      if (cats.error) throw cats.error;
      if (rows.error) throw rows.error;

      const items = [];
      const approvals = [];
      for (const row of rows.data || []) {
        const cat = first(row.category);
        const rep = first(row.reporter);
        const hidden = first(row.private_detail);
        const shared = {
          id: row.id,
          title: row.title,
          category: (cat && cat.name) || 'Others',
          code: (cat && cat.code) || 'OTHR',
          type: row.type,
          location: row.location || row.public_location,
          date: showDate(row.occurred_on),
          description: row.description,
          hiddenDetail: (hidden && hidden.hidden_detail) || '',
          photo: await this.signedPhoto(row.photo_path),
          mine: !!(userId && row.reporter_id === userId),
        };
        if (row.approval_status === 'approved') {
          items.push({ ...shared, status: STATUS[row.status] || 'Open',
            reporter: (rep && rep.full_name) || 'UIU Community' });
        } else if (row.approval_status === 'pending') {
          approvals.push({ ...shared, submittedBy: (rep && rep.full_name) || 'UIU User' });
        }
      }
      return { categories: (cats.data || []).map((c) => ({ id: c.id, name: c.name, code: c.code })), items, approvals };
    },

    // Claims, notifications and the activity feed for a signed-in user.
    async loadUser(userId) {
      const [claimRes, noteRes, actRes] = await Promise.all([
        db.from('claims').select('id, item_id, claimant_id, kind, status, created_at, item:items!claims_item_id_fkey(title, location, description, category:categories(name,code), private_detail:item_private_details(hidden_detail)), claimant:profiles!claims_claimant_id_fkey(full_name), evidence:claim_evidence(identifying_feature, proof, contact_phone), handover:handovers(pin_code, status)').order('created_at', { ascending: false }),
        db.from('notifications').select('id,title,body,destination,read_at,created_at').order('created_at', { ascending: false }),
        db.from('activity_log').select('event_code,action,detail,created_at').order('created_at', { ascending: false }).limit(20),
      ]);
      if (claimRes.error) throw claimRes.error;

      const rows = claimRes.data || [];
      const verdict = { approved: 'Approved', rejected: 'Rejected', returned: 'Returned' };
      const claims = rows.filter((c) => c.claimant_id === userId).map((c) => {
        const it = first(c.item);
        const cat = it ? first(it.category) : null;
        const ho = first(c.handover);
        return {
          id: c.id, itemId: c.item_id, kind: c.kind,
          itemTitle: (it && it.title) || 'Item',
          itemMeta: [cat && cat.name, it && it.location].filter(Boolean).join(' · ') || 'UIU Campus',
          submitted: new Date(c.created_at).toLocaleDateString('en-GB'),
          verification: verdict[c.status] || 'Under review',
          handover: ho ? (ho.status === 'complete' ? 'Completed at the Student Affairs desk' : 'Approved — agree a time in chat') : 'Not scheduled',
          handoverCode: ho ? ho.pin_code : undefined,
        };
      });

      const claimReviews = rows.map((c) => {
        const it = first(c.item);
        const ev = first(c.evidence);
        const hidden = it ? first(it.private_detail) : null;
        return {
          id: c.id, kind: c.kind, itemId: c.item_id,
          claimant: (first(c.claimant) || {}).full_name || 'UIU User',
          item: (it && it.title) || 'Item',
          publicDesc: (it && it.description) || '',
          claimantAnswer: ev ? (ev.identifying_feature + ' ' + ev.proof).trim() : '',
          hiddenDetail: (hidden && hidden.hidden_detail) || '',
          contact: (ev && ev.contact_phone) || '',
          status: c.status === 'pending' ? 'pending' : (c.status === 'rejected' ? 'rejected' : 'approved'),
        };
      });

      const notifications = (noteRes.data || []).map((n) => ({
        id: n.id, title: n.title, body: n.body,
        time: new Date(n.created_at).toLocaleString('en-GB'),
        unread: n.read_at === null, goTo: n.destination || undefined,
      }));

      const activity = (actRes.data || []).map((a) => ({
        code: a.event_code, title: a.action, detail: a.detail,
        time: new Date(a.created_at).toLocaleString('en-GB'),
      }));

      return { claims, claimReviews, notifications, activity };
    },

    // Conversations carry their messages and the handover they belong to.
    async loadConversations(userId) {
      const { data, error } = await db
        .from('conversations')
        .select('id, claim_id, updated_at, item:items!conversations_item_id_fkey(title), claim:claims!conversations_claim_id_fkey(claimant_id), handover:handovers(id, pin_code, status, location), messages(id, sender_id, body, created_at)')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      return (data || []).map((c) => {
        const item = first(c.item);
        const claim = first(c.claim);
        const ho = first(c.handover);
        const title = (item && item.title) || 'Item';
        const msgs = [...(c.messages || [])].sort((a, b) =>
          String(a.created_at).localeCompare(String(b.created_at)));
        const last = msgs[msgs.length - 1];
        return {
          id: c.id,
          claimId: c.claim_id,
          handoverId: ho ? ho.id : null,
          itemTitle: title,
          name: (claim && claim.claimant_id === userId ? 'Finder · ' : 'Claimant · ') + title,
          avatar: initials(title),
          unread: false,
          lastMessage: last ? last.body : 'Handover approved. Agree a time and confirm.',
          time: new Date(last ? last.created_at : c.updated_at)
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          handover: ho ? {
            text: ho.location + ' — agree a time with the other participant',
            status: ho.status === 'cancelled' ? 'proposed' : ho.status,
            code: ho.pin_code,
          } : undefined,
          messages: msgs.map((m) => ({
            mine: m.sender_id === userId,
            text: m.body,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: m.sender_id === userId ? 'Sent' : undefined,
          })),
        };
      });
    },

    async sendMessage(conversationId, body, userId) {
      const { error } = await db.from('messages')
        .insert({ conversation_id: conversationId, sender_id: userId, body: body.trim() });
      if (error) throw error;
      await db.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    },

    // A participant may only move proposed -> confirmed; the guard trigger
    // rejects anything else and reserves completion for admins.
    async confirmHandover(handoverId) {
      const { error } = await db.from('handovers')
        .update({ status: 'confirmed' }).eq('id', handoverId);
      if (error) throw error;
    },

    async completeHandover(handoverId, claimId, itemId) {
      const { error } = await db.from('handovers')
        .update({ status: 'complete' }).eq('id', handoverId);
      if (error) throw error;
      await db.from('claims').update({ status: 'returned' }).eq('id', claimId);
      if (itemId) await db.from('items').update({ status: 'resolved' }).eq('id', itemId);
    },

    // Disputes are keyed by item; the UI groups the competing claimants itself.
    async loadDisputes() {
      const { data, error } = await db
        .from('disputes')
        .select('id, item_id, status, reason, item:items!disputes_item_id_fkey(title, category:categories(code))')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) return [];

      const rows = data || [];
      if (!rows.length) return [];
      const ids = rows.map((d) => d.item_id);
      const { data: claims } = await db
        .from('claims')
        .select('item_id, created_at, claimant:profiles!claims_claimant_id_fkey(full_name), evidence:claim_evidence(identifying_feature, proof)')
        .in('item_id', ids);

      return rows.map((d) => {
        const item = first(d.item);
        const cat = item ? first(item.category) : null;
        const mine = (claims || []).filter((c) => c.item_id === d.item_id);
        return {
          id: d.id,
          itemTitle: (item && item.title) || 'Item',
          code: (cat && cat.code) || 'OTHR',
          claimants: mine.map((c) => {
            const ev = first(c.evidence);
            return {
              name: (first(c.claimant) || {}).full_name || 'UIU User',
              answer: ev ? (ev.identifying_feature + ' ' + ev.proof).trim() : '—',
              date: new Date(c.created_at).toLocaleDateString('en-GB'),
            };
          }),
        };
      });
    },

    async resolveDispute(disputeId, adminId, escalatedTo) {
      const patchRow = {
        status: escalatedTo ? 'escalated' : 'resolved',
        resolved_by: adminId,
        resolved_at: new Date().toISOString(),
      };
      if (escalatedTo) patchRow.escalated_to = escalatedTo;
      const { error } = await db.from('disputes').update(patchRow).eq('id', disputeId);
      if (error) throw error;
    },

    async uploadPhoto(dataUrl, itemId, userId) {
      if (!dataUrl || !dataUrl.startsWith('data:')) return null;
      const blob = await (await fetch(dataUrl)).blob();
      const ext = (blob.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '');
      const path = userId + '/' + itemId + '/photo.' + ext;
      const { error } = await db.storage.from('item-photos')
        .upload(path, blob, { contentType: blob.type, upsert: true });
      if (error) throw error;
      return path;
    },

    async createItem({ type, title, categoryName, location, date, description, hidden, photo, categories, userId }) {
      const cat = (categories || []).find((c) => c.name === categoryName);
      if (!cat || !cat.id) throw new Error('Pick a category that exists in the index.');
      const id = (crypto.randomUUID && crypto.randomUUID()) ||
        String(Date.now()) + Math.random().toString(16).slice(2);
      let path = null;
      try {
        path = await this.uploadPhoto(photo, id, userId);
        const ins = await db.from('items').insert({
          id, reporter_id: userId, category_id: cat.id, type,
          title: title.trim(), description: description.trim(),
          location: location.trim(), occurred_on: date || new Date().toISOString().slice(0, 10),
          photo_path: path,
        });
        if (ins.error) throw ins.error;
        const det = await db.from('item_private_details')
          .insert({ item_id: id, reporter_id: userId, hidden_detail: hidden.trim() });
        if (det.error) throw det.error;
        return id;
      } catch (err) {
        if (path) await db.storage.from('item-photos').remove([path]);
        throw err;
      }
    },

    async createClaim({ itemId, kind, feature, proof, contact, userId }) {
      const { data, error } = await db.from('claims')
        .insert({ item_id: itemId, claimant_id: userId, kind }).select('id').single();
      if (error) throw error;
      const ev = await db.from('claim_evidence').insert({
        claim_id: data.id, claimant_id: userId,
        identifying_feature: feature.trim(), proof: proof.trim(), contact_phone: contact.trim(),
      });
      if (ev.error) throw ev.error;
      return data.id;
    },

    async decideItem(itemId, approved, adminId) {
      const { error } = await db.from('items').update({
        approval_status: approved ? 'approved' : 'rejected',
        reviewed_by: adminId, reviewed_at: new Date().toISOString(),
        rejection_reason: approved ? null : 'Did not meet portal posting rules.',
      }).eq('id', itemId);
      if (error) throw error;
    },

    async approveClaim(claimId, itemId, adminId) {
      const upd = await db.from('claims').update({
        status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString(),
      }).eq('id', claimId);
      if (upd.error) throw upd.error;

      const conv = await db.from('conversations')
        .insert({ claim_id: claimId, item_id: itemId }).select('id').single();
      if (conv.error) throw conv.error;

      const pin = String(1000 + Math.floor(Math.random() * 9000));
      const ho = await db.from('handovers')
        .insert({ claim_id: claimId, conversation_id: conv.data.id, pin_code: pin });
      if (ho.error) throw ho.error;
      return pin;
    },

    async rejectClaim(claimId, adminId) {
      const { error } = await db.from('claims').update({
        status: 'rejected', reviewed_by: adminId, reviewed_at: new Date().toISOString(),
        admin_note: 'Evidence did not sufficiently match the held-back detail.',
      }).eq('id', claimId);
      if (error) throw error;
    },

    async addCategory(name) {
      const { error } = await db.from('categories').insert({
        name: name.trim(),
        code: name.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase(),
      });
      if (error) throw error;
    },

    async removeCategory(id) {
      const { error } = await db.from('categories').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },

    async saveProfile(userId, name, dept, phone) {
      const [a, b] = await Promise.all([
        db.from('profiles').update({ full_name: name.trim(), department: dept.trim() }).eq('id', userId),
        db.from('profile_private').update({ phone: phone.trim() || null }).eq('user_id', userId),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
    },

    async markNotificationsRead(userId) {
      await db.from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId).is('read_at', null);
    },
  };

  window.__PORTAL_DATA__ = PortalData;
})();
</script>`;

// Replaces the bundle's in-memory methods with Supabase-backed ones. Runs after
// the app mounts, so it patches the live instance and re-renders it.
const OVERRIDES = String.raw`
<script data-portal-overrides>
(() => {
  const Data = window.__PORTAL_DATA__;
  if (!Data) return;

  // The dc runtime keeps the logic object on the wrapper component as .logic
  // (state lives there; setState proxies through __host). It is not a fiber
  // stateNode itself, so walk the tree for the wrapper and read .logic.
  const findInstance = () => {
    const roots = [];
    const collect = (el) => {
      for (const k of Object.keys(el)) {
        if (k.startsWith('__reactContainer')) roots.push(el[k]);
      }
      for (const child of el.children) collect(child);
    };
    collect(document.body);

    for (const root of roots) {
      const queue = [root];
      let guard = 0;
      while (queue.length && guard++ < 20000) {
        const fiber = queue.shift();
        if (!fiber) continue;
        const host = fiber.stateNode;
        const logic = host && host.logic;
        if (logic && logic.state && 'authed' in logic.state && typeof logic.setState === 'function') {
          return logic;
        }
        if (fiber.child) queue.push(fiber.child);
        if (fiber.sibling) queue.push(fiber.sibling);
      }
    }
    return null;
  };

  const patch = (app) => {
    const setS = (patchObj) => new Promise((r) => app.setState(patchObj, r));
    const toast = (m) => app.showToast(m);
    const fail = (e) => toast((e && e.message) || 'Something went wrong.');

    // Pull everything the current identity is allowed to see.
    app.refreshAll = async function () {
      try {
        const uid = Data.userId;
        const portal = await Data.loadPortal(uid);
        const patchObj = {
          categories: portal.categories,
          items: portal.items,
          approvals: portal.approvals,
        };
        if (uid) {
          const [mine, convos] = await Promise.all([
            Data.loadUser(uid),
            Data.loadConversations(uid),
          ]);
          Object.assign(patchObj, mine);
          patchObj.conversations = convos;
          if (Data.role === 'admin') patchObj.disputes = await Data.loadDisputes();
          const convIds = convos.map((c) => c.id);
          if (!convIds.includes(app.state.activeConversationId)) {
            patchObj.activeConversationId = convIds[0] || '';
          }
        }
        // Keep a selection that exists, or the template's find() falls through.
        const ids = patchObj.items.map((i) => i.id);
        if (!ids.includes(app.state.selectedItemId)) patchObj.selectedItemId = ids[0];
        await setS(patchObj);
      } catch (e) { fail(e); }
    };

    app.login = async function (e) {
      e.preventDefault();
      const role = app.state.authRoleTab;
      const email = app.loginIdRef.current ? app.loginIdRef.current.value : '';
      const pass = app.loginPasswordRef.current ? app.loginPasswordRef.current.value : '';
      try {
        const user = await Data.signIn(email, pass, role);
        const profile = await Data.loadProfile(user.id);
        const patchObj = { authed: true, role: Data.role,
          view: Data.role === 'admin' ? 'admin' : 'dashboard' };
        if (profile) patchObj[Data.role === 'admin' ? 'profileAdmin' : 'profileStudent'] = profile;
        await setS(patchObj);
        await app.refreshAll();
        // An existing account keeps the role it was created with, so say so
        // rather than silently landing them somewhere they did not choose.
        if (Data.role !== role) {
          toast('Signed in as ' + Data.role + '. This account was created as a ' + Data.role + '.');
        } else {
          toast(Data.role === 'admin' ? 'Welcome back, Admin.' : 'Welcome back!');
        }
      } catch (err) { fail(err); }
    };

    app.signup = async function (e) {
      e.preventDefault();
      const pass = app.signupPasswordRef.current.value;
      const confirm = app.signupConfirmRef.current.value;
      if (pass.length < 8) return toast('Use at least 8 characters for your password.');
      if (pass !== confirm) return toast('The passwords do not match.');
      const role = app.state.authRoleTab;
      const idField = app.signupIdRef.current ? app.signupIdRef.current.value.trim() : '';
      const email = idField.includes('@') ? idField : '';
      if (!email) return toast('Enter your email address in the ID field to register.');
      try {
        const user = await Data.signIn(email, pass, role);
        const name = app.signupNameRef.current ? app.signupNameRef.current.value.trim() : '';
        const dept = app.signupDeptRef.current ? app.signupDeptRef.current.value.trim() : '';
        if (name || dept) {
          await Data.saveProfile(user.id, name || email.split('@')[0], dept || 'Not specified', '');
        }
        const profile = await Data.loadProfile(user.id);
        const patchObj = { authed: true, role: Data.role,
          view: Data.role === 'admin' ? 'admin' : 'dashboard' };
        if (profile) patchObj[Data.role === 'admin' ? 'profileAdmin' : 'profileStudent'] = profile;
        await setS(patchObj);
        await app.refreshAll();
        toast('Account created and signed in.');
      } catch (err) { fail(err); }
    };

    app.continueAsGuest = async function () {
      Data.userId = null; Data.role = 'guest';
      await setS({ authed: true, role: 'guest', view: 'browse' });
      await app.refreshAll();
    };

    app.onExit = async function () {
      const wasGuest = app.state.role === 'guest';
      await Data.signOut();
      await setS({ authed: false, authMode: 'login', view: 'dashboard',
        claims: [], claimReviews: [], notifications: [] });
      await app.refreshAll();
      if (!wasGuest) toast('Signed out.');
    };

    app.submitLostForm = (e) => submitItem(e, 'lost');
    app.submitFoundForm = (e) => submitItem(e, 'found');

    async function submitItem(e, type) {
      e.preventDefault();
      const p = type === 'lost'
        ? { t: app.lostTitleRef, c: app.lostCategoryRef, l: app.lostLocationRef,
            d: app.lostDateRef, x: app.lostDescriptionRef, h: app.lostPrivateRef, slot: 'lost-photo-slot' }
        : { t: app.foundTitleRef, c: app.foundCategoryRef, l: app.foundLocationRef,
            d: app.foundDateRef, x: app.foundDescriptionRef, h: app.foundPrivateRef, slot: 'found-photo-slot' };
      const title = p.t.current.value.trim();
      const categoryName = p.c.current.value;
      const location = p.l.current.value.trim();
      const description = p.x.current.value.trim();
      const hidden = p.h.current.value.trim();
      if (!title || !categoryName || !location || !description || !hidden) return;
      if (!Data.userId) return toast('Please sign in before filing a report.');
      const slot = document.getElementById(p.slot);
      try {
        await Data.createItem({
          type, title, categoryName, location, date: p.d.current.value,
          description, hidden,
          photo: slot ? slot.getAttribute('src') || '' : '',
          categories: app.state.categories, userId: Data.userId,
        });
        await setS({ view: 'claims', deskTab: 'reports', lostDescriptionCount: 0, lostPrivateCount: 0 });
        await app.refreshAll();
        e.target.reset();
        toast(type === 'lost' ? 'Lost report sent for admin approval.' : 'Sent to the admin approval queue.');
      } catch (err) { fail(err); }
    }

    app.submitClaim = async function (e) {
      e.preventDefault();
      const item = app.state.items.find((i) => i.id === app.state.selectedItemId);
      if (!item) return;
      const feature = app.claimFeatureRef.current.value.trim();
      const proof = app.claimProofRef.current.value.trim();
      const contact = app.claimContactRef.current.value;
      if (!feature || !proof || !contact) return;
      if (!Data.userId) return toast('Please sign in before making a claim.');
      const kind = item.type === 'found' ? 'ownership' : 'recovery';
      try {
        await Data.createClaim({ itemId: item.id, kind, feature, proof, contact, userId: Data.userId });
        await setS({ showClaimForm: false, view: 'claims', deskTab: 'claims' });
        await app.refreshAll();
        e.target.reset();
        toast(kind === 'ownership' ? 'Claim submitted for admin verification.' : 'Found report sent to the admin desk.');
      } catch (err) { fail(err); }
    };

    app.approveApproval = async function (id) {
      try { await Data.decideItem(id, true, Data.userId); await app.refreshAll(); toast('Approved and published.'); }
      catch (err) { fail(err); }
    };
    app.rejectApproval = async function (id) {
      try { await Data.decideItem(id, false, Data.userId); await app.refreshAll(); toast('Submission rejected.'); }
      catch (err) { fail(err); }
    };

    app.approveClaimReview = async function (id) {
      const r = app.state.claimReviews.find((x) => x.id === id);
      if (!r) return;
      try {
        const pin = await Data.approveClaim(id, r.itemId, Data.userId);
        await app.refreshAll();
        toast('Claim approved. Handover code ' + pin + '.');
      } catch (err) { fail(err); }
    };
    app.rejectClaimReview = async function (id) {
      try { await Data.rejectClaim(id, Data.userId); await app.refreshAll(); toast('Claim rejected. Listing reopened.'); }
      catch (err) { fail(err); }
    };

    app.addCategory = async function (e) {
      e.preventDefault();
      const input = app.categoryDraftRef.current;
      const name = input ? input.value.trim() : '';
      if (!name) return;
      if (app.state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return toast(name + ' is already in the index.');
      }
      try {
        await Data.addCategory(name);
        await app.refreshAll();
        if (input) input.value = '';
        toast('Category added.');
      } catch (err) { fail(err); }
    };

    app.removeCategory = async function (name) {
      const open = app.state.items.filter((i) => i.category === name && i.status !== 'Resolved').length;
      if (open > 0) return toast('Move the ' + open + ' open listing(s) out of ' + name + ' first.');
      const cat = app.state.categories.find((c) => c.name === name);
      if (!cat || !cat.id) return;
      try { await Data.removeCategory(cat.id); await app.refreshAll(); toast(name + ' removed from the index.'); }
      catch (err) { fail(err); }
    };

    app.sendChat = async function (e) {
      e.preventDefault();
      const input = app.chatInputRef.current;
      const text = input ? input.value.trim() : '';
      if (!text) return;
      const conv = app.state.conversations.find((c) => c.id === app.state.activeConversationId);
      if (!conv || !Data.userId) return toast('Open a conversation first.');
      if (input) input.value = '';
      try {
        await Data.sendMessage(conv.id, text, Data.userId);
        await app.refreshAll();
      } catch (err) { if (input) input.value = text; fail(err); }
    };

    app.confirmHandover = async function () {
      const conv = app.state.conversations.find((c) => c.id === app.state.activeConversationId);
      if (!conv || !conv.handoverId) return toast('No handover to confirm yet.');
      try {
        await Data.confirmHandover(conv.handoverId);
        await app.refreshAll();
        toast('Handover confirmed. Use the code at the desk.');
      } catch (err) { fail(err); }
    };

    app.completeHandover = async function () {
      const conv = app.state.conversations.find((c) => c.id === app.state.activeConversationId);
      if (!conv || !conv.handoverId) return;
      if (Data.role !== 'admin') {
        return toast('Only the desk can close a handover. Show your code at Student Affairs.');
      }
      const claim = app.state.claims.find((c) => c.id === conv.claimId);
      try {
        await Data.completeHandover(conv.handoverId, conv.claimId, claim ? claim.itemId : null);
        await app.refreshAll();
        toast('Handover complete. Case closed.');
      } catch (err) { fail(err); }
    };

    app.awardDispute = async function (disputeId, claimantName) {
      try {
        await Data.resolveDispute(disputeId, Data.userId, null);
        await app.refreshAll();
        toast('Awarded to ' + claimantName + '.');
      } catch (err) { fail(err); }
    };

    app.escalateDispute = async function (disputeId) {
      try {
        await Data.resolveDispute(disputeId, Data.userId, 'Student Affairs');
        await app.refreshAll();
        toast('Escalated to Student Affairs.');
      } catch (err) { fail(err); }
    };

    app.markAllRead = async function () {
      if (!Data.userId) return;
      try {
        await Data.markNotificationsRead(Data.userId);
        await app.refreshAll();
        toast('All notifications marked as read.');
      } catch (err) { fail(err); }
    };

    if (typeof app.saveProfile === 'function') {
      app.saveProfile = async function (e) {
        if (e && e.preventDefault) e.preventDefault();
        if (!Data.userId) return toast('Sign in to update your profile.');
        try {
          await Data.saveProfile(
            Data.userId,
            app.profileNameRef.current ? app.profileNameRef.current.value : '',
            app.profileDeptRef.current ? app.profileDeptRef.current.value : '',
            app.profilePhoneRef.current ? app.profilePhoneRef.current.value : '',
          );
          const profile = await Data.loadProfile(Data.userId);
          if (profile) await setS(Data.role === 'admin' ? { profileAdmin: profile } : { profileStudent: profile });
          toast('Profile updated.');
        } catch (err) { fail(err); }
      };
    }

    // Start from a clean slate: drop the bundle's demo rows, then load real data.
    (async () => {
      const user = await Data.currentUser();
      const blank = { items: [], approvals: [], claims: [], claimReviews: [],
        notifications: [], activity: [], conversations: [], disputes: [] };
      if (user) {
        Data.userId = user.id;
        const profile = await Data.loadProfile(user.id);
        const patchObj = { ...blank, authed: true, role: Data.role };
        if (profile) patchObj[Data.role === 'admin' ? 'profileAdmin' : 'profileStudent'] = profile;
        await setS(patchObj);
      } else {
        await setS({ ...blank, authed: false, authMode: 'login', role: 'guest' });
      }
      await app.refreshAll();
    })();
  };

  let tries = 0;
  const wait = setInterval(() => {
    const app = findInstance();
    if (app) { clearInterval(wait); patch(app); }
    else if (++tries > 100) clearInterval(wait);
  }, 50);
})();
</script>`;

export function buildSupabaseInjection(url: string, key: string) {
  return (
    buildConfigScript(url, key) +
    '<script src="/vendor/supabase.js"></script>' +
    DATA_LAYER +
    OVERRIDES
  );
}
