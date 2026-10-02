// Bridges the standalone portal bundle to the live Supabase schema.
//
// The bundle renders from `this.state` and mutates it through a handful of
// methods. Rather than rewrite its rendering, this injects a `PortalData`
// helper plus an override block that swaps those methods for Supabase calls,
// mapping rows into the exact shapes the existing JSX already expects.

function buildConfigScript(url: string, key: string) {
  return (
    '<script data-portal-config>window.__PORTAL_ENV__=' +
    JSON.stringify({ url, key }).replace(/</g, '\\u003c') +
    ';</script>'
  );
}

const DATA_LAYER = String.raw`
<script data-portal-supabase>
(() => {
  const env = window.__PORTAL_ENV__ || {};
  if (!env.url || !env.key || env.url.includes('YOUR_PROJECT_REF') || env.key.includes('REPLACE_ME') || !window.supabase) {
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

    // Signing in must never create an account or overwrite an existing profile.
    async signIn(email, password) {
      const creds = { email: String(email || '').trim(), password: String(password || '') };
      if (!creds.email || !creds.password) throw new Error('Enter an email and password.');

      const res = await db.auth.signInWithPassword(creds);
      if (res.error) throw res.error;

      // Roles are read from the existing profile. New accounts are students;
      // administrators are assigned explicitly by the database owner.
      this.userId = res.data.user.id;
      return res.data.user;
    },

    async signUp(email, password, name, department, studentId) {
      const { data, error } = await db.auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: name.trim(), department: department.trim(), student_id: studentId.trim(), role: 'student' } },
      });
      if (error) throw error;
      this.userId = data.session ? data.user.id : null;
      return data.session ? data.user : null;
    },

    async signOut() {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      this.userId = null;
      this.role = 'guest';
    },

    async loadProfile(userId) {
      const [pubRes, privRes] = await Promise.all([
        db.from('profiles').select('full_name, department, role, avatar_path, notification_preferences').eq('id', userId).maybeSingle(),
        db.from('profile_private').select('student_id, phone').eq('user_id', userId).maybeSingle(),
      ]);
      if (pubRes.error) throw pubRes.error;
      if (privRes.error) throw privRes.error;
      const pub = pubRes.data, priv = privRes.data;
      if (!pub) throw new Error('Your profile is missing. Please contact the portal administrator.');
      this.role = pub.role === 'admin' ? 'admin' : 'student';
      return {
        name: pub.full_name,
        roleLabel: this.role === 'admin' ? 'Administrator' : 'Student account',
        idLabel: this.role === 'admin' ? 'Staff ID' : 'UIU ID',
        idValue: (priv && priv.student_id) || '—',
        dept: pub.department,
        phone: (priv && priv.phone) || '',
        emailNotif: !pub.notification_preferences || pub.notification_preferences.messages !== false,
        pushNotif: !pub.notification_preferences || pub.notification_preferences.reviews !== false,
        initials: initials(pub.full_name),
        photo: pub.avatar_path && pub.avatar_path.startsWith('data:image/') ? pub.avatar_path : '',
      };
    },

    async signedPhoto(path) {
      if (!path) return '';
      const { data, error } = await db.storage.from('item-photos').createSignedUrl(path, 3600);
      if (error) { console.warn('Could not load item photo:', error.message); return ''; }
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
          photoPath: row.photo_path,
          approvalStatus: row.approval_status,
          mine: !!(userId && row.reporter_id === userId),
        };
        if (row.approval_status === 'approved') {
          items.push({ ...shared, status: STATUS[row.status] || 'Open',
            reporter: (rep && rep.full_name) || 'UIU Community' });
        } else if (row.approval_status === 'pending' || (row.approval_status === 'rejected' && shared.mine)) {
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
      if (noteRes.error) throw noteRes.error;
      if (actRes.error) throw actRes.error;

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
        .select('id, item_id, claim_id, updated_at, item:items!conversations_item_id_fkey(title), claim:claims!conversations_claim_id_fkey(claimant_id), handover:handovers(id, pin_code, status, location, scheduled_for), messages(id, sender_id, body, read_at, created_at)')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const photos = {};
      await Promise.all((data || []).flatMap((conv) => (conv.messages || []).filter((m) => m.body.startsWith('image:')).map(async (m) => {
        const { data: photo } = await db.storage.from('message-photos').createSignedUrl(m.body.slice(6), 3600);
        photos[m.id] = photo ? photo.signedUrl : '';
      })));

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
          itemId: c.item_id,
          handoverId: ho ? ho.id : null,
          itemTitle: title,
          name: (claim && claim.claimant_id === userId ? 'Finder · ' : 'Claimant · ') + title,
          avatar: initials(title),
          unread: msgs.some((m) => m.sender_id !== userId && !m.read_at),
          lastMessage: last ? (last.body.startsWith('image:') ? 'Photo attachment' : last.body) : 'Handover approved. Agree a time and confirm.',
          time: new Date(last ? last.created_at : c.updated_at)
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          handover: ho ? {
            text: ho.location + ' — ' + (ho.scheduled_for ? new Date(ho.scheduled_for).toLocaleString() : 'agree a time with the other participant'),
            status: ho.status === 'cancelled' ? 'proposed' : ho.status,
            code: ho.pin_code,
          } : undefined,
          messages: msgs.map((m) => ({
            mine: m.sender_id === userId,
            text: m.body.startsWith('image:') ? (photos[m.id] ? '' : 'Photo unavailable') : m.body,
            photo: photos[m.id] || '',
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: m.sender_id === userId ? (m.read_at ? 'Seen' : 'Sent') : undefined,
          })),
        };
      });
    },

    async sendMessage(conversationId, body, userId) {
      const { error } = await db.from('messages')
        .insert({ conversation_id: conversationId, sender_id: userId, body: body.trim() });
      if (error) throw error;
      // updated_at is maintained by the message trigger for both participants.
    },

    async sendPhoto(conversationId, file, userId) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5242880) throw new Error('Choose a JPEG, PNG, or WebP image under 5 MB.');
      try { const image = await createImageBitmap(file); image.close(); } catch { throw new Error('This image cannot be opened. Choose another file.'); }
      const path = userId + '/' + conversationId + '/' + crypto.randomUUID() + '.' + file.type.split('/')[1];
      const bucket = db.storage.from('message-photos');
      const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      try { await this.sendMessage(conversationId, 'image:' + path, userId); }
      catch (error) { await bucket.remove([path]); throw error; }
    },

    // A participant may only move proposed -> confirmed; the guard trigger
    // rejects anything else and reserves completion for admins.
    async confirmHandover(handoverId) {
      const { error } = await db.from('handovers')
        .update({ status: 'confirmed' }).eq('id', handoverId);
      if (error) throw error;
    },

    async completeHandover(handoverId, claimId, itemId) {
      const { error } = await db.rpc('portal_complete_handover', { handover_id: handoverId });
      if (error) throw error;
    },

    // Disputes are keyed by item; the UI groups the competing claimants itself.
    async loadDisputes() {
      const { data, error } = await db
        .from('disputes')
        .select('id, item_id, status, reason, item:items!disputes_item_id_fkey(title, category:categories(code))')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = data || [];
      if (!rows.length) return [];
      const ids = rows.map((d) => d.item_id);
      const { data: claims, error: claimError } = await db
        .from('claims')
        .select('id, item_id, status, created_at, claimant:profiles!claims_claimant_id_fkey(full_name), evidence:claim_evidence(identifying_feature, proof)')
        .in('item_id', ids);
      if (claimError) throw claimError;

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
              claimId: c.id,
              name: (first(c.claimant) || {}).full_name || 'UIU User',
              answer: ev ? (ev.identifying_feature + ' ' + ev.proof).trim() : '—',
              date: new Date(c.created_at).toLocaleDateString('en-GB'),
            };
          }),
        };
      });
    },

    async resolveDispute(disputeId, adminId, escalatedTo, claimId) {
      if (!escalatedTo) {
        const { error } = await db.rpc('portal_award_dispute', { dispute_id: disputeId, winning_claim_id: claimId });
        if (error) throw error;
        return;
      }
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
      if (!dataUrl) return null;
      if (!/^data:image\/(jpeg|png|webp);base64,/i.test(dataUrl)) throw new Error('Choose a JPEG, PNG, or WebP image.');
      const blob = await (await fetch(dataUrl)).blob();
      if (blob.size > 5242880) throw new Error('Choose an image smaller than 5 MB.');
      try { const image = await createImageBitmap(blob); image.close(); } catch { throw new Error('This image cannot be opened. Choose another file.'); }
      const ext = (blob.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '');
      const path = userId + '/' + itemId + '/' + crypto.randomUUID() + '.' + ext;
      const { error } = await db.storage.from('item-photos')
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (error) throw error;
      return path;
    },

    async changeItemPhoto(item, dataUrl, userId) {
      const path = await this.uploadPhoto(dataUrl, item.id, userId);
      try {
        const { error } = await db.rpc('portal_change_item_photo', { target_item_id: item.id, new_photo_path: path });
        if (error) throw error;
      } catch (error) {
        if (path) await db.storage.from('item-photos').remove([path]);
        throw error;
      }
      // Old URLs stay valid until their expiry; replacing uses a fresh object.
      if (item.photoPath && item.photoPath.startsWith(userId + '/')) await db.storage.from('item-photos').remove([item.photoPath]);
    },

    async createItem({ type, title, categoryName, location, date, description, hidden, photo, categories, userId }) {
      const cat = (categories || []).find((c) => c.name === categoryName);
      if (!cat || !cat.id) throw new Error('Pick a category that exists in the index.');
      const id = (crypto.randomUUID && crypto.randomUUID()) ||
        String(Date.now()) + Math.random().toString(16).slice(2);
      let path = null;
      try {
        path = await this.uploadPhoto(photo, id, userId);
        const { error } = await db.rpc('portal_create_item', { item_id: id, category_id: cat.id, item_type: type,
          item_title: title.trim(), item_description: description.trim(), item_location: location.trim(),
          item_date: date, item_photo_path: path, item_hidden_detail: hidden.trim() });
        if (error) throw error;
        return id;
      } catch (err) {
        if (path) await db.storage.from('item-photos').remove([path]);
        throw err;
      }
    },

    async createClaim({ itemId, kind, feature, proof, contact, userId }) {
      const { data, error } = await db.rpc('portal_create_claim', { target_item_id: itemId, claim_kind: kind,
        feature: feature.trim(), claim_proof: proof.trim(), contact: contact.trim() });
      if (error) throw error;
      return data;
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
      const { data, error } = await db.rpc('portal_approve_claim', { target_claim_id: claimId });
      if (error) throw error;
      return data;
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
        code: 'C' + crypto.randomUUID().replace(/-/g, '').slice(0, 7).toUpperCase(),
      });
      if (error) throw error;
    },

    async removeCategory(id) {
      const { error } = await db.from('categories').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },

    async saveProfile(userId, name, dept, phone, photo, preferences) {
      if (photo && (!/^data:image\/(jpeg|png|webp);base64,/i.test(photo) || photo.length > 700000)) throw new Error('Choose a smaller profile image (under 500 KB).');
      const { error } = await db.rpc('portal_save_profile', { profile_name: name.trim(), profile_department: dept.trim(),
        profile_phone: phone.trim() || null, profile_avatar: photo || null, profile_preferences: preferences || { messages: true, reviews: true } });
      if (error) throw error;
    },

    async markNotificationsRead(userId) {
      const { error } = await db.from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId).is('read_at', null);
      if (error) throw error;
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

    if (!Data) {
      const unavailable = (event) => { if (event && event.preventDefault) event.preventDefault(); toast('The portal database is not configured. Please contact the administrator.'); };
      for (const name of ['login', 'signup', 'submitLostForm', 'submitFoundForm', 'submitClaim', 'saveProfile', 'onForgotPassword']) app[name] = unavailable;
      app.continueAsGuest = () => app.setState({ authed: true, role: 'guest', view: 'browse' });
      app.setState({ authed: false, role: 'guest', items: [], approvals: [], claims: [], claimReviews: [], notifications: [], activity: [], conversations: [], disputes: [], categories: [], profileStudent: {}, profileAdmin: {} });
      return;
    }

    // Pull everything the current identity is allowed to see.
    app.refreshAll = async function () {
      try {
        const uid = Data.userId;
        if (uid && app.state.view === 'messages' && app.state.activeConversationId) {
          const { error } = await Data.db.rpc('portal_read_conversation', { target_conversation_id: app.state.activeConversationId });
          if (error) throw error;
        }
        const portal = await Data.loadPortal(uid);
        const patchObj = {
          categories: portal.categories,
          items: portal.items,
          approvals: portal.approvals,
          ...(uid ? {} : { claims: [], claimReviews: [], notifications: [], activity: [], conversations: [], disputes: [], activeConversationId: '' }),
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
        if (Data.userId !== uid) return;
        await setS(patchObj);
      } catch (e) { fail(e); throw e; }
    };

    app.login = async function (e) {
      e.preventDefault();
      const role = app.state.authRoleTab;
      const email = app.loginIdRef.current ? app.loginIdRef.current.value : '';
      const pass = app.loginPasswordRef.current ? app.loginPasswordRef.current.value : '';
      try {
        const user = await Data.signIn(email, pass, role);
        customElements.get('image-slot').clearDraftImages();
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
      const idField = app.signupIdRef.current ? app.signupIdRef.current.value.trim() : '';
      const email = app.signupEmailRef.current ? app.signupEmailRef.current.value.trim() : '';
      if (!email || !idField) return toast('Enter your email address and student ID.');
      try {
        const name = app.signupNameRef.current ? app.signupNameRef.current.value.trim() : '';
        const dept = app.signupDeptRef.current ? app.signupDeptRef.current.value.trim() : '';
        const user = await Data.signUp(email, pass, name, dept, idField);
        if (!user) {
          await setS({ authed: false, authMode: 'login' });
          return toast('Check your email to confirm your account, then sign in.');
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
      try {
        await Data.signOut();
        customElements.get('image-slot').clearDraftImages();
        Data.userId = null; Data.role = 'guest';
        await setS({ authed: true, role: 'guest', view: 'browse', profileStudent: {}, profileAdmin: {} });
        await app.refreshAll();
      } catch (error) { fail(error); }
    };

    app.onExit = async function () {
      const wasGuest = app.state.role === 'guest';
      try { await Data.signOut(); } catch (error) { return fail(error); }
      customElements.get('image-slot').clearDraftImages();
      await setS({ authed: false, authMode: 'login', view: 'dashboard',
        role: 'guest', claims: [], claimReviews: [], notifications: [], conversations: [], disputes: [],
        profileStudent: {}, profileAdmin: {}, activeConversationId: '' });
      try { await app.refreshAll(); } catch { return; }
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
      if (slot && slot.imageLoading) return toast('Wait for the image to finish loading.');
      if (app._submittingItem) return;
      app._submittingItem = true;
      const form = e.target;
      try {
        await Data.createItem({
          type, title, categoryName, location, date: p.d.current.value,
          description, hidden,
          photo: slot ? slot.imageSource : '',
          categories: app.state.categories, userId: Data.userId,
        });
        form.reset();
        if (slot) slot.clearImage();
        await setS({ view: 'claims', deskTab: 'reports', lostDescriptionCount: 0, lostPrivateCount: 0 });
        await app.refreshAll();
        toast(type === 'lost' ? 'Lost report sent for admin approval.' : 'Sent to the admin approval queue.');
      } catch (err) { fail(err); } finally { app._submittingItem = false; }
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
      if (item.mine) return toast('You cannot claim your own report.');
      if (item.status === 'Resolved') return toast('This item has already been returned.');
      if (app._submittingClaim) return;
      app._submittingClaim = true;
      const form = e.target;
      const kind = item.type === 'found' ? 'ownership' : 'recovery';
      try {
        await Data.createClaim({ itemId: item.id, kind, feature, proof, contact, userId: Data.userId });
        form.reset();
        await setS({ showClaimForm: false, view: 'claims', deskTab: 'claims' });
        await app.refreshAll();
        toast(kind === 'ownership' ? 'Claim submitted for admin verification.' : 'Found report sent to the admin desk.');
      } catch (err) { fail(err); } finally { app._submittingClaim = false; }
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

    app.selectConversation = async function (id) {
      await setS({ activeConversationId: id });
      try { await app.refreshAll(); } catch (error) { fail(error); }
    };

    app.onAttach = function () {
      const conv = app.state.conversations.find((c) => c.id === app.state.activeConversationId);
      if (!conv || !Data.userId) return toast('Open an approved conversation first.');
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = async () => {
        if (!input.files[0]) return;
        try { await Data.sendPhoto(conv.id, input.files[0], Data.userId); await app.refreshAll(); toast('Image sent.'); }
        catch (error) { fail(error); }
      };
      input.click();
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

    app.rescheduleHandover = function () {
      const conv = app.state.conversations.find((c) => c.id === app.state.activeConversationId);
      if (!conv || !conv.handoverId) return toast('No handover to reschedule yet.');
      const dialog = document.createElement('dialog');
      dialog.style.cssText = 'margin:auto;padding:28px;border:0;border-radius:18px;max-width:420px;width:90%;';
      dialog.innerHTML = '<form style="display:grid;gap:14px"><h2>Reschedule handover</h2><label>New date and time<input class="inp" name="time" type="datetime-local" required></label><p role="status"></p><button class="btn btn--flare" type="submit">Propose time</button><button class="btn btn--ghost" type="button">Cancel</button></form>';
      dialog.querySelector('[type=button]').onclick = () => { dialog.close(); dialog.remove(); };
      dialog.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        const time = new Date(event.target.elements.time.value);
        const message = dialog.querySelector('[role=status]');
        if (isNaN(time) || time <= new Date()) { message.textContent = 'Choose a future date and time.'; return; }
        try {
          const { error } = await Data.db.rpc('portal_reschedule_handover', { target_handover_id: conv.handoverId, new_time: time.toISOString() });
          if (error) throw error;
          dialog.close(); dialog.remove(); await app.refreshAll(); toast('New handover time proposed. Confirm it with the other participant.');
        } catch (error) { message.textContent = error.message; }
      };
      document.body.appendChild(dialog); dialog.showModal();
    };

    app.completeHandover = async function () {
      const conv = app.state.conversations.find((c) => c.id === app.state.activeConversationId);
      if (!conv || !conv.handoverId) return;
      if (Data.role !== 'admin') {
        return toast('Only the desk can close a handover. Show your code at Student Affairs.');
      }
      try {
        await Data.completeHandover(conv.handoverId, conv.claimId, conv.itemId);
        await app.refreshAll();
        toast('Handover complete. Case closed.');
      } catch (err) { fail(err); }
    };

    app.awardDispute = async function (disputeId, claimantName) {
      try {
        const dispute = app.state.disputes.find((d) => d.id === disputeId);
        const claimants = dispute ? dispute.claimants.filter((c) => c.name === claimantName) : [];
        if (claimants.length !== 1) return toast('Choose a unique claimant before awarding this dispute.');
        await Data.resolveDispute(disputeId, Data.userId, null, claimants[0].claimId);
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

    app.openNotification = async function (note) {
      try {
        const { error } = await Data.db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', note.id).eq('user_id', Data.userId);
        if (error) throw error;
        const views = ['dashboard', 'browse', 'claims', 'messages', 'notifications', 'profile', 'admin'];
        await setS({ notifications: app.state.notifications.map((n) => n.id === note.id ? { ...n, unread: false } : n),
          view: views.includes(note.goTo) && (note.goTo !== 'admin' || Data.role === 'admin') ? note.goTo : app.state.view });
      } catch (error) { fail(error); }
    };

    app.changeItemImage = function (itemId) {
      const item = [...app.state.items, ...app.state.approvals].find((i) => i.id === itemId);
      if (!item || (!item.mine && Data.role !== 'admin')) return;
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          if (file.size > 5242880) throw new Error('Choose an image smaller than 5 MB.');
          const source = await new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read the image.')); reader.readAsDataURL(file);
          });
          await Data.changeItemPhoto(item, source, Data.userId);
          await app.refreshAll(); toast(item.approvalStatus === 'approved' && Data.role !== 'admin' ? 'Image changed. Your report is queued for review again.' : 'Image updated.');
        } catch (error) { fail(error); }
      };
      input.click();
    };

    // Reference photos (public/stock) for listings without an upload: match the title first, then the category.
    const STOCK_BY_WORD = [
      [['earbud', 'airpod', 'buds'], ['earbuds']],
      [['headphone', 'headset'], ['headphones']],
      [['charger', 'adapter', 'power bank', 'cable'], ['charger']],
      [['calculator'], ['calculator']],
      [['laptop', 'macbook'], ['laptop']],
      [['phone', 'mobile'], ['phone']],
      [['watch'], ['watch']],
      [['wallet', 'purse'], ['wallet']],
      [['id card', 'student id', 'lanyard', 'badge', 'card'], ['id-card']],
      [['key'], ['keys-1', 'keys-2']],
      [['backpack', 'bagpack', 'bag'], ['backpack-1', 'backpack-2']],
      [['hoodie', 'hooded', 'jacket', 'sweater', 'sweatshirt', 'shirt'], ['hoodie-1', 'hoodie-2']],
      [['bottle', 'flask', 'tumbler'], ['bottle']],
      [['glasses', 'spectacles'], ['glasses']],
      [['book', 'notebook', 'diary'], ['books']],
    ];
    const STOCK_BY_CATEGORY = { Electronics: ['laptop'], Bags: ['backpack-1', 'backpack-2'], Clothing: ['hoodie-1', 'hoodie-2'],
      Accessories: ['wallet'], Documents: ['id-card'], Keys: ['keys-1', 'keys-2'], Books: ['books'] };
    const STOCK_CONTAIN = ['hoodie-1', 'hoodie-2', 'watch', 'earbuds'];
    const stockFor = (item) => {
      if (!item || item.photo) return { hasStock: false, showEmpty: false };
      const title = String(item.title || '').toLowerCase();
      const hit = STOCK_BY_WORD.find(([words]) => words.some((w) => title.includes(w)));
      const options = hit ? hit[1] : STOCK_BY_CATEGORY[item.category];
      if (!options) return { hasStock: false, showEmpty: true };
      const seed = String(item.id || item.title || '').split('').reduce((n, ch) => n + ch.charCodeAt(0), 0);
      const name = options[seed % options.length];
      return { hasStock: true, showEmpty: false, stockPhoto: '/stock/' + name + '.jpg',
        stockFit: STOCK_CONTAIN.includes(name) ? 'stock-photo--contain' : '' };
    };

    const render = app.renderVals.bind(app);
    app.renderVals = function () {
      const vals = render();
      vals.myReports = vals.myReports.map((row) => {
        const item = [...app.state.approvals, ...app.state.items].find((i) => row.key === 'a' + i.id || row.key === 'i' + i.id);
        return { ...row, photo: item ? item.photo : '', hasPhoto: !!(item && item.photo),
          status: item && item.approvalStatus === 'rejected' ? 'Rejected' : row.status,
          matchNote: item && item.approvalStatus === 'rejected' ? 'Update the image to submit this report for review again.' : row.matchNote,
          onChangeImage: () => app.changeItemImage(item && item.id) };
      });
      vals.approvals = vals.approvals.filter((a) => a.approvalStatus !== 'rejected');
      vals.noApprovals = vals.approvals.length === 0;
      vals.canChangeItemImage = !!(vals.currentItem && vals.currentItem.id && (vals.currentItem.mine && vals.currentItem.status !== 'Resolved' || Data.role === 'admin'));
      vals.onChangeItemImage = () => app.changeItemImage(app.state.selectedItemId);
      vals.profilePhoto = app.currentProfile().photo || '';
      vals.profileHasUploadedPhoto = !!vals.profilePhoto;
      vals.profileNoUploadedPhoto = !vals.profilePhoto;
      vals.profileHasIllustration = vals.profileHasPhoto && !vals.profilePhoto;
      vals.profileShowInitials = vals.profileNoPhoto && !vals.profilePhoto;
      vals.filteredItems = vals.filteredItems.map((item) => ({ ...item, noPhoto: !item.photo, ...stockFor(item) }));
      vals.currentItem.noPhoto = !vals.currentItem.photo;
      Object.assign(vals.currentItem, stockFor(vals.currentItem));
      vals.canCompleteHandover = Data.role === 'admin';
      return vals;
    };

    if (typeof app.saveProfile === 'function') {
      app.saveProfile = async function (e) {
        if (e && e.preventDefault) e.preventDefault();
        if (!Data.userId) return toast('Sign in to update your profile.');
        try {
          const avatar = document.getElementById('profile-avatar');
          if (avatar && avatar.imageLoading) return toast('Wait for the profile image to finish loading.');
          await Data.saveProfile(
            Data.userId,
            app.profileNameRef.current ? app.profileNameRef.current.value : '',
            app.profileDeptRef.current ? app.profileDeptRef.current.value : '',
            app.profilePhoneRef.current ? app.profilePhoneRef.current.value : '',
            document.getElementById('profile-avatar') ? document.getElementById('profile-avatar').imageSource : undefined,
            { messages: document.getElementById('message-alerts').checked, reviews: document.getElementById('review-alerts').checked },
          );
          const profile = await Data.loadProfile(Data.userId);
          if (profile) await setS(Data.role === 'admin' ? { profileAdmin: profile } : { profileStudent: profile });
          toast('Profile updated.');
        } catch (err) { fail(err); }
      };
    }

    app.onForgotPassword = async function () {
      const email = app.loginIdRef.current ? app.loginIdRef.current.value.trim() : '';
      if (!email) return toast('Enter your email address first.');
      const { error } = await Data.db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/portal-runtime' });
      if (error) return fail(error);
      toast('Check your email for the password reset link.');
    };

    app.messageReporter = function () {
      const conv = app.state.conversations.find((c) => c.itemId === app.state.selectedItemId);
      if (!conv) return toast('A conversation opens after the desk approves your claim.');
      app.setState({ view: 'messages', activeConversationId: conv.id });
    };

    Data.db.auth.onAuthStateChange((event) => {
      if (event !== 'PASSWORD_RECOVERY') return;
      setTimeout(() => {
        const dialog = document.createElement('dialog');
        dialog.style.cssText = 'margin:auto;padding:28px;border:0;border-radius:18px;max-width:420px;width:90%;';
        dialog.innerHTML = '<form style="display:grid;gap:14px"><h2>Set a new password</h2><label>New password<input class="inp" name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirm password<input class="inp" name="confirm" type="password" autocomplete="new-password" minlength="8" required></label><p role="status"></p><button class="btn btn--flare" type="submit">Save password</button></form>';
        dialog.querySelector('form').onsubmit = async (event) => {
          event.preventDefault();
          const form = event.target, message = dialog.querySelector('[role=status]');
          if (form.elements.password.value !== form.elements.confirm.value) { message.textContent = 'The passwords do not match.'; return; }
          const { error } = await Data.db.auth.updateUser({ password: form.elements.password.value });
          if (error) { message.textContent = error.message; return; }
          dialog.close(); dialog.remove(); toast('Password updated.');
        };
        document.body.appendChild(dialog); dialog.showModal();
      }, 0);
    });

    // Start from a clean slate: drop the bundle's demo rows, then load real data.
    (async () => {
      const blank = { items: [], approvals: [], claims: [], claimReviews: [],
        notifications: [], activity: [], conversations: [], disputes: [] };
      await setS(blank);
      const user = await Data.currentUser();
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
    })().catch(fail);

    // Keep chats, review decisions, and expiring signed photo URLs current.
    let refreshing = false;
    setInterval(async () => {
      if (document.hidden || refreshing || !app.state.authed || app._submittingItem || app._submittingClaim) return;
      refreshing = true;
      try { await app.refreshAll(); } catch {} finally { refreshing = false; }
    }, 30000);
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
