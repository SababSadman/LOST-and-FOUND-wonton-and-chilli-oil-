'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  Role,
  View,
  AdminTab,
  DeskTab,
  AuthMode,
  AuthRoleTab,
  Item,
  Claim,
  ClaimReview,
  Approval,
  Dispute,
  Category,
  Conversation,
  NotificationItem,
  Activity,
  UserProfile,
  MatchScoreResult,
  VerificationResult,
} from '@/types';
import {
  INITIAL_ITEMS,
  INITIAL_CATEGORIES,
  INITIAL_APPROVALS,
  INITIAL_CLAIMS,
  INITIAL_CLAIM_REVIEWS,
  INITIAL_DISPUTES,
  INITIAL_CONVERSATIONS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ACTIVITY,
  MOCK_PROFILE_STUDENT,
  MOCK_PROFILE_ADMIN,
} from '@/data/mockData';

interface PortalContextType {
  authed: boolean;
  role: Role;
  authMode: AuthMode;
  authRoleTab: AuthRoleTab;
  view: View;
  adminTab: AdminTab;
  deskTab: DeskTab;
  selectedItemId: number;
  showClaimForm: boolean;
  activeConversationId: string;
  toast: string;
  search: string;
  typeFilter: string;
  categoryFilter: string;
  statusFilter: string;
  sortBy: string;
  
  items: Item[];
  categories: Category[];
  approvals: Approval[];
  claims: Claim[];
  claimReviews: ClaimReview[];
  disputes: Dispute[];
  conversations: Conversation[];
  notifications: NotificationItem[];
  activity: Activity[];
  profileStudent: UserProfile;
  profileAdmin: UserProfile;

  // Actions & Navigation
  setSearch: (val: string) => void;
  setTypeFilter: (val: string) => void;
  setCategoryFilter: (val: string) => void;
  setStatusFilter: (val: string) => void;
  setSortBy: (val: string) => void;
  setAuthRoleTab: (tab: AuthRoleTab) => void;
  setAuthMode: (mode: AuthMode) => void;
  setAuthed: (authed: boolean) => void;
  setAdminTab: (tab: AdminTab) => void;
  setDeskTab: (tab: DeskTab) => void;
  setShowClaimForm: (show: boolean) => void;
  
  goTo: (view: View) => void;
  openItemDetail: (id: number, wantClaim?: boolean) => void;
  showToast: (msg: string) => void;
  login: (id: string, pass: string) => void;
  signup: (name: string, id: string, dept: string, pass: string) => void;
  continueAsGuest: () => void;
  logout: () => void;
  
  tokens: (text: string) => string[];
  generalizeLocation: (loc: string) => string;
  matchScore: (a: Item, b: Item) => MatchScoreResult;
  matchTone: (score: number) => { label: string; bg: string; color: string };
  matchesFor: (item: Item, all: Item[]) => { other: Item; score: number; reasons: string[] }[];
  verifyMatch: (answer: string, hidden: string) => VerificationResult;
  
  submitClaim: (feature: string, proof: string, contact: string) => void;
  submitLostForm: (title: string, category: string, location: string, date: string, description: string, hidden: string, photo: string) => void;
  submitFoundForm: (title: string, category: string, location: string, date: string, description: string, hidden: string, photo: string) => void;
  
  approveApproval: (id: number) => void;
  rejectApproval: (id: number) => void;
  approveClaimReview: (id: number) => void;
  rejectClaimReview: (id: number) => void;
  awardDispute: (disputeId: number, claimantName: string) => void;
  escalateDispute: (disputeId: number) => void;
  
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  exportReport: () => void;
  
  selectConversation: (id: string) => void;
  sendChat: (text: string) => void;
  confirmHandover: () => void;
  completeHandover: () => void;
  
  markAllRead: () => void;
  openNotification: (n: NotificationItem) => void;
  saveProfile: (name: string, dept: string, phone: string) => void;
  currentProfile: () => UserProfile;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export const PortalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authed, setAuthed] = useState<boolean>(true);
  const [role, setRole] = useState<Role>('student');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authRoleTab, setAuthRoleTab] = useState<AuthRoleTab>('student');
  const [view, setView] = useState<View>('dashboard');
  const [adminTab, setAdminTab] = useState<AdminTab>('approvals');
  const [deskTab, setDeskTab] = useState<DeskTab>('claims');
  const [selectedItemId, setSelectedItemId] = useState<number>(1);
  const [showClaimForm, setShowClaimForm] = useState<boolean>(false);
  const [activeConversationId, setActiveConversationId] = useState<string>('c1');
  const [toast, setToastState] = useState<string>('');
  
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');

  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [approvals, setApprovals] = useState<Approval[]>(INITIAL_APPROVALS);
  const [claims, setClaims] = useState<Claim[]>(INITIAL_CLAIMS);
  const [claimReviews, setClaimReviews] = useState<ClaimReview[]>(INITIAL_CLAIM_REVIEWS);
  const [disputes, setDisputes] = useState<Dispute[]>(INITIAL_DISPUTES);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activity, setActivity] = useState<Activity[]>(INITIAL_ACTIVITY);
  const [profileStudent, setProfileStudent] = useState<UserProfile>(MOCK_PROFILE_STUDENT);
  const [profileAdmin, setProfileAdmin] = useState<UserProfile>(MOCK_PROFILE_ADMIN);

  const showToast = (msg: string) => {
    setToastState(msg);
    setTimeout(() => {
      setToastState('');
    }, 3000);
  };

  const nextId = () => Math.floor(Date.now() + Math.random() * 1000);

  const currentProfile = () => (role === 'admin' ? profileAdmin : profileStudent);

  const goTo = (targetView: View) => {
    setView(targetView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openItemDetail = (id: number, wantClaim: boolean = false) => {
    setSelectedItemId(id);
    setShowClaimForm(wantClaim);
    setView('item-detail');
  };

  const login = (id: string, pass: string) => {
    const assignedRole: Role = authRoleTab === 'admin' ? 'admin' : 'student';
    setRole(assignedRole);
    setAuthed(true);
    setView('dashboard');
    showToast(`Signed in as ${assignedRole === 'admin' ? 'Administrator' : 'Student'}.`);
  };

  const signup = (name: string, id: string, dept: string, pass: string) => {
    const assignedRole: Role = authRoleTab === 'admin' ? 'admin' : 'student';
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

    if (assignedRole === 'admin') {
      setProfileAdmin({ ...profileAdmin, name, dept, id, initials: initials || 'AD' });
    } else {
      setProfileStudent({ ...profileStudent, name, dept, id, initials: initials || 'ST' });
    }

    setRole(assignedRole);
    setAuthed(true);
    setView('dashboard');
    showToast('Account created and signed in.');
  };

  const continueAsGuest = () => {
    setRole('guest');
    setAuthed(true);
    setView('dashboard');
    showToast('Browsing as Guest. Sign in to post or claim items.');
  };

  const logout = () => {
    if (role === 'guest') {
      setAuthMode('login');
      setAuthed(false);
    } else {
      setRole('guest');
      showToast('Signed out. Continuing as Guest.');
    }
  };

  // Algorithms
  const tokens = (text: string): string[] => {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  };

  const generalizeLocation = (loc: string): string => {
    if (!loc) return 'Campus Grounds';
    const l = loc.toLowerCase();
    if (l.includes('cafeteria') || l.includes('canteen')) return 'Cafeteria / Dining Area';
    if (l.includes('library') || l.includes('study')) return 'Library & Study Hub';
    if (l.includes('room') || l.includes('lab') || l.includes('class')) return 'Academic Building';
    if (l.includes('plaza') || l.includes('ground') || l.includes('field')) return 'Open Campus Grounds';
    if (l.includes('auditorium') || l.includes('hall')) return 'Auditorium & Events Complex';
    return 'UIU Campus Area';
  };

  const dayGap = (a: string, b: string): number => {
    const da = new Date(a);
    const db = new Date(b);
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return 999;
    return Math.abs(da.getTime() - db.getTime()) / 86400000;
  };

  const matchScore = (a: Item, b: Item): MatchScoreResult => {
    const reasons: string[] = [];
    let score = 0;
    if (a.category === b.category) {
      score += 34;
      reasons.push('Same category');
    }
    const ta = tokens(a.title + ' ' + a.description);
    const tb = tokens(b.title + ' ' + b.description);
    const shared = ta.filter((t) => tb.indexOf(t) !== -1);
    if (shared.length) {
      score += Math.min(shared.length, 4) * 9;
      reasons.push('Shared wording: ' + shared.slice(0, 4).join(', '));
    }
    if (generalizeLocation(a.location) === generalizeLocation(b.location)) {
      score += 18;
      reasons.push('Same area of campus');
    }
    const gap = dayGap(a.date, b.date);
    if (gap <= 1) {
      score += 12;
      reasons.push('Reported within a day of each other');
    } else if (gap <= 3) {
      score += 8;
      reasons.push('Reported within three days');
    } else if (gap <= 7) {
      score += 4;
      reasons.push('Reported within a week');
    }
    return { score: Math.min(100, Math.round(score)), reasons };
  };

  const matchTone = (score: number) => {
    if (score >= 70) return { label: 'Strong match', bg: 'var(--success-soft)', color: 'var(--success)' };
    if (score >= 45) return { label: 'Possible match', bg: 'var(--warning-soft)', color: 'var(--warning)' };
    return { label: 'Weak match', bg: 'var(--info-soft)', color: 'var(--info)' };
  };

  const matchesFor = (item: Item, all: Item[]) =>
    all
      .filter((o) => o.id !== item.id && o.type !== item.type && o.status !== 'Resolved')
      .map((o) => {
        const m = matchScore(item, o);
        return { other: o, score: m.score, reasons: m.reasons };
      })
      .filter((m) => m.score >= 45)
      .sort((x, y) => y.score - x.score);

  const verifyMatch = (answer: string, hidden: string): VerificationResult => {
    const h = tokens(hidden);
    const a = tokens(answer);
    const hit = h.filter((t) => a.indexOf(t) !== -1);
    const pct = h.length ? Math.round((hit.length / h.length) * 100) : 0;
    return {
      hit: hit.length,
      total: h.length,
      pct,
      label: h.length ? `${hit.length} of ${h.length} held-back details named` : 'No held-back detail on file',
    };
  };

  const categoryCode = (categoryName: string) => categoryName.slice(0, 4).toUpperCase();

  const logActivity = (code: string, title: string, detail: string) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newAct = { code, title, detail, time: 'now' };
    setActivity((prev) => [newAct, ...prev].slice(0, 12));
  };

  const pushNote = (title: string, body: string, goToView?: View) => {
    const newNote: NotificationItem = {
      id: nextId(),
      title,
      body,
      time: 'just now',
      unread: true,
      goTo: goToView,
    };
    setNotifications((prev) => [newNote, ...prev].slice(0, 12));
  };

  const formatDate = (value: string): string => {
    if (!value) return 'Today';
    const d = new Date(value + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Actions
  const submitClaim = (feature: string, proof: string, contact: string) => {
    const item = items.find((i) => i.id === selectedItemId);
    if (!item || !feature.trim() || !proof.trim() || !contact.trim()) return;

    const kind = item.type === 'found' ? 'ownership' : 'recovery';
    const id = nextId();
    const me = currentProfile().name;
    const answer = feature.trim() + ' ' + proof.trim();
    const vm = verifyMatch(answer, item.hiddenDetail);

    const newClaim: Claim = {
      id,
      itemId: item.id,
      kind,
      itemTitle: item.title,
      itemMeta: `${item.category} · ${item.location}`,
      submitted: 'Today',
      verification: 'Under review',
      handover: 'Not scheduled',
    };

    const newReview: ClaimReview = {
      id,
      kind,
      itemId: item.id,
      claimant: me,
      item: item.title,
      publicDesc: item.description,
      claimantAnswer: answer,
      hiddenDetail: item.hiddenDetail,
      contact,
      status: 'pending',
    };

    const nextStatus = kind === 'ownership' ? 'Pending Claim' : 'Match Under Review';
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)));
    setClaims((prev) => [newClaim, ...prev]);
    setClaimReviews((prev) => [newReview, ...prev]);
    setShowClaimForm(false);
    setView('claims');
    setDeskTab('claims');

    const isOwn = kind === 'ownership';
    logActivity(item.code, isOwn ? 'Ownership claim filed' : 'Found-response filed', `${item.title} · ${me} · ${vm.label}`);
    pushNote(
      isOwn ? 'Claim submitted' : 'Found report submitted',
      `Your ${isOwn ? 'claim for' : 'response to'} the ${item.title} is with the admin desk for verification.`,
      'claims'
    );
    showToast(isOwn ? 'Claim submitted for admin verification.' : 'Found report sent to the admin desk.');
  };

  const submitLostForm = (
    title: string,
    category: string,
    location: string,
    date: string,
    description: string,
    hidden: string,
    photo: string
  ) => {
    if (!title || !category || !location || !description || !hidden) return;
    const approval: Approval = {
      id: nextId(),
      type: 'lost',
      title: title.trim(),
      category,
      code: categoryCode(category),
      submittedBy: currentProfile().name,
      mine: true,
      location: location.trim(),
      date: formatDate(date),
      description: description.trim(),
      hiddenDetail: hidden.trim(),
      photo,
    };
    setApprovals((prev) => [approval, ...prev]);
    setView('claims');
    setDeskTab('reports');

    logActivity(approval.code, 'Lost report submitted', `${title} · awaiting approval`);
    pushNote('Lost report received', `Your ${title} report is queued for admin approval.`, 'claims');
    showToast('Lost report sent for admin approval.');
  };

  const submitFoundForm = (
    title: string,
    category: string,
    location: string,
    date: string,
    description: string,
    hidden: string,
    photo: string
  ) => {
    if (!title || !category || !location || !description || !hidden) return;
    const approval: Approval = {
      id: nextId(),
      type: 'found',
      title: title.trim(),
      category,
      code: categoryCode(category),
      submittedBy: currentProfile().name,
      mine: true,
      location: location.trim(),
      date: formatDate(date),
      description: description.trim(),
      hiddenDetail: hidden.trim(),
      photo,
    };
    setApprovals((prev) => [approval, ...prev]);
    setView('claims');
    setDeskTab('reports');

    logActivity(approval.code, 'Found item handed in', `${title} · awaiting approval`);
    pushNote('Found item received', `Thank you. Your ${title} submission is queued for admin approval.`, 'claims');
    showToast('Sent to the admin approval queue.');
  };

  const approveApproval = (id: number) => {
    const a = approvals.find((x) => x.id === id);
    if (!a) return;
    const newItem: Item = {
      id: nextId(),
      title: a.title,
      category: a.category,
      code: a.code,
      type: a.type || 'found',
      status: 'Open',
      location: a.location,
      date: a.date,
      reporter: a.submittedBy,
      mine: !!a.mine,
      description: a.description,
      hiddenDetail: a.hiddenDetail,
      photo: a.photo || '',
    };
    const nextItems = [newItem, ...items];
    setItems(nextItems);
    setApprovals((prev) => prev.filter((x) => x.id !== id));

    const foundMatches = matchesFor(newItem, nextItems);
    logActivity(a.code, newItem.type === 'lost' ? 'Lost report published' : 'Found item published', `${a.title} · approved by desk`);
    pushNote(
      newItem.type === 'lost' ? 'Lost report published' : 'Found item published',
      foundMatches.length
        ? `${a.title} is live, and the desk sees ${foundMatches.length} possible match(es).`
        : `${a.title} is now visible on the counter.`,
      foundMatches.length ? 'claims' : 'browse'
    );
    showToast(newItem.type === 'lost' ? 'Lost report approved and published.' : 'Found item approved and published.');
  };

  const rejectApproval = (id: number) => {
    const a = approvals.find((x) => x.id === id);
    setApprovals((prev) => prev.filter((x) => x.id !== id));
    if (a) {
      logActivity(a.code, 'Submission rejected', `${a.title} · did not meet posting rules`);
    }
    showToast('Submission rejected.');
  };

  const approveClaimReview = (id: number) => {
    const r = claimReviews.find((x) => x.id === id);
    if (!r) return;
    const code = String(1000 + Math.floor(Math.random() * 9000));
    const convId = 'cv' + id;
    const already = conversations.some((c) => c.id === convId);

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const conv: Conversation = {
      id: convId,
      itemTitle: r.item,
      name: (r.kind === 'recovery' ? 'Owner · ' : 'Finder · ') + r.item,
      avatar: r.item
        .replace(/[^A-Za-z ]/g, '')
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase(),
      unread: true,
      lastMessage: 'Handover approved. Agree a time and confirm.',
      time: nowTime,
      handover: { text: 'Propose a time at the Student Affairs desk', status: 'proposed', code },
      messages: [
        {
          mine: false,
          text: 'The admin approved this handover. Agree a time at the Student Affairs desk and confirm it here. Both of you will need the handover code.',
          time: nowTime,
        },
      ],
    };

    setClaimReviews((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'approved' } : x)));
    setClaims((prev) =>
      prev.map((c) =>
        c.id === r.id || c.itemTitle === r.item
          ? { ...c, verification: 'Approved', handover: 'Approved — agree a time in chat', handoverCode: code }
          : c
      )
    );
    if (!already) {
      setConversations((prev) => [conv, ...prev]);
    }
    logActivity('CLM', 'Claim approved', `${r.item} · ${r.claimant} · handover code issued`);
    pushNote('Claim approved', `Your claim for the ${r.item} was approved. Handover code ${code}.`, 'messages');
    showToast('Claim approved. Handover chat opened.');
  };

  const rejectClaimReview = (id: number) => {
    const r = claimReviews.find((x) => x.id === id);
    if (!r) return;
    setClaimReviews((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)));
    setClaims((prev) =>
      prev.map((c) =>
        c.id === r.id || c.itemTitle === r.item ? { ...c, verification: 'Rejected', handover: 'Closed' } : c
      )
    );
    setItems((prev) => prev.map((i) => (i.title === r.item ? { ...i, status: 'Open' } : i)));
    logActivity('CLM', 'Claim rejected', `${r.item} · ${r.claimant} · listing reopened`);
    pushNote('Claim not approved', `The desk could not verify your claim for the ${r.item}. Listing open again.`, 'claims');
    showToast('Claim rejected. Listing reopened.');
  };

  const awardDispute = (disputeId: number, claimantName: string) => {
    const d = disputes.find((x) => x.id === disputeId);
    if (!d) return;
    setDisputes((prev) => prev.filter((x) => x.id !== disputeId));
    logActivity(d.code, 'Dispute settled', `${d.itemTitle} · awarded to ${claimantName}`);
    pushNote('Dispute settled', `The ${d.itemTitle} was awarded to ${claimantName}.`, 'admin');
    showToast(`${d.itemTitle} awarded to ${claimantName}.`);
  };

  const escalateDispute = (disputeId: number) => {
    const d = disputes.find((x) => x.id === disputeId);
    if (!d) return;
    setDisputes((prev) => prev.filter((x) => x.id !== disputeId));
    logActivity(d.code, 'Dispute escalated', `${d.itemTitle} · sent to Student Affairs`);
    showToast('Escalated to Student Affairs.');
  };

  const addCategory = (name: string) => {
    if (!name.trim()) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      showToast(`${name} is already in the index.`);
      return;
    }
    setCategories((prev) => [...prev, { name: name.trim(), code: name.slice(0, 4).toUpperCase() }]);
    showToast('Category added.');
  };

  const removeCategory = (name: string) => {
    const open = items.filter((i) => i.category === name && i.status !== 'Resolved').length;
    if (open > 0) {
      showToast(`Move the ${open} open listing(s) out of ${name} first.`);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.name !== name));
    showToast(`${name} removed from the index.`);
  };

  const exportReport = () => {
    const rows = [['Section', 'Label', 'Lost', 'Found', 'Resolved']];
    [
      ['February', 11, 14, 9],
      ['March', 15, 11, 10],
      ['April', 19, 17, 15],
      ['May', 13, 18, 16],
      ['June', 16, 21, 18],
      ['July', 12, 17, 14],
    ].forEach((r) => rows.push(['Monthly', String(r[0]), String(r[1]), String(r[2]), String(r[3])]));

    categories.forEach((c) => {
      const inCat = items.filter((i) => i.category === c.name);
      rows.push([
        'Category',
        c.name,
        String(inCat.filter((i) => i.type === 'lost').length),
        String(inCat.filter((i) => i.type === 'found').length),
        String(inCat.filter((i) => i.status === 'Resolved').length),
      ]);
    });
    rows.push(['Queue', 'Awaiting approval', '', String(approvals.length), '']);
    rows.push(['Queue', 'Claims awaiting review', '', String(claimReviews.filter((r) => r.status === 'pending').length), '']);
    rows.push(['Queue', 'Open disputes', '', String(disputes.length), '']);

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uiu-lost-found-statistics.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Statistics exported.');
  };

  const selectConversation = (id: string) => {
    setActiveConversationId(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false } : c)));
  };

  const sendChat = (text: string) => {
    if (!text.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              lastMessage: text,
              time: now,
              messages: [...c.messages, { mine: true, text, time: now, status: 'Sent' }],
            }
          : c
      )
    );
  };

  const confirmHandover = () => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId && c.handover
          ? {
              ...c,
              handover: { ...c.handover, status: 'confirmed' },
              messages: [
                ...c.messages,
                { mine: true, text: 'Handover confirmed. See you then!', time: now, status: 'Sent' },
              ],
            }
          : c
      )
    );
    showToast('Handover confirmed. Use the code at the desk.');
  };

  const completeHandover = () => {
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv || !conv.handover) return;
    const title = conv.itemTitle;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const existingHandover = conv.handover;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conv.id
          ? {
              ...c,
              handover: {
                text: existingHandover.text,
                status: 'complete' as const,
                code: existingHandover.code,
              },
              lastMessage: 'Item returned.',
              time: now,
              messages: [...c.messages, { mine: true, text: 'Handover complete. Thank you!', time: now, status: 'Sent' }],
            }
          : c
      )
    );

    setItems((prev) => prev.map((i) => (i.title === title ? { ...i, status: 'Resolved' } : i)));
    setClaims((prev) =>
      prev.map((c) =>
        c.itemTitle === title
          ? { ...c, verification: 'Returned', handover: 'Completed at Student Affairs desk' }
          : c
      )
    );
    logActivity('RTN', 'Item returned', `${title} · handover code verified`);
    pushNote('Item returned', `${title} was handed over and the case is closed.`, 'claims');
    showToast('Handover complete. Case closed.');
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    showToast('All notifications marked as read.');
  };

  const openNotification = (n: NotificationItem) => {
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
    if (n.goTo) setView(n.goTo);
  };

  const saveProfile = (name: string, dept: string, phone: string) => {
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();

    if (role === 'admin') {
      setProfileAdmin((prev) => ({ ...prev, name: name || prev.name, dept: dept || prev.dept, phone: phone || prev.phone, initials: initials || prev.initials }));
    } else {
      setProfileStudent((prev) => ({ ...prev, name: name || prev.name, dept: dept || prev.dept, phone: phone || prev.phone, initials: initials || prev.initials }));
    }
    showToast('Profile updated.');
  };

  return (
    <PortalContext.Provider
      value={{
        authed,
        role,
        authMode,
        authRoleTab,
        view,
        adminTab,
        deskTab,
        selectedItemId,
        showClaimForm,
        activeConversationId,
        toast,
        search,
        typeFilter,
        categoryFilter,
        statusFilter,
        sortBy,
        items,
        categories,
        approvals,
        claims,
        claimReviews,
        disputes,
        conversations,
        notifications,
        activity,
        profileStudent,
        profileAdmin,
        setSearch,
        setTypeFilter,
        setCategoryFilter,
        setStatusFilter,
        setSortBy,
        setAuthRoleTab,
        setAuthMode,
        setAuthed,
        setAdminTab,
        setDeskTab,
        setShowClaimForm,
        goTo,
        openItemDetail,
        showToast,
        login,
        signup,
        continueAsGuest,
        logout,
        tokens,
        generalizeLocation,
        matchScore,
        matchTone,
        matchesFor,
        verifyMatch,
        submitClaim,
        submitLostForm,
        submitFoundForm,
        approveApproval,
        rejectApproval,
        approveClaimReview,
        rejectClaimReview,
        awardDispute,
        escalateDispute,
        addCategory,
        removeCategory,
        exportReport,
        selectConversation,
        sendChat,
        confirmHandover,
        completeHandover,
        markAllRead,
        openNotification,
        saveProfile,
        currentProfile,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
};

export const usePortal = () => {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
};
