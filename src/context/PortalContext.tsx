'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
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

interface PortalContextType {
  authed: boolean;
  authLoading: boolean;
  role: Role;
  authMode: AuthMode;
  authRoleTab: AuthRoleTab;
  view: View;
  adminTab: AdminTab;
  deskTab: DeskTab;
  selectedItemId: string | number;
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
  openItemDetail: (id: string | number, wantClaim?: boolean) => void;
  showToast: (msg: string) => void;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, id: string, dept: string, pass: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  
  tokens: (text: string) => string[];
  generalizeLocation: (loc: string) => string;
  matchScore: (a: Item, b: Item) => MatchScoreResult;
  matchTone: (score: number) => { label: string; bg: string; color: string };
  matchesFor: (item: Item, all: Item[]) => { other: Item; score: number; reasons: string[] }[];
  verifyMatch: (answer: string, hidden: string) => VerificationResult;
  
  submitClaim: (feature: string, proof: string, contact: string) => Promise<void>;
  submitLostForm: (title: string, category: string, location: string, date: string, description: string, hidden: string, photo: string) => Promise<void>;
  submitFoundForm: (title: string, category: string, location: string, date: string, description: string, hidden: string, photo: string) => Promise<void>;
  
  approveApproval: (id: string | number) => Promise<void>;
  rejectApproval: (id: string | number) => Promise<void>;
  approveClaimReview: (id: string | number) => Promise<void>;
  rejectClaimReview: (id: string | number) => Promise<void>;
  awardDispute: (disputeId: string | number, claimantName: string) => void;
  escalateDispute: (disputeId: string | number) => void;
  
  addCategory: (name: string) => Promise<void>;
  removeCategory: (name: string) => Promise<void>;
  exportReport: () => void;
  
  selectConversation: (id: string) => void;
  sendChat: (text: string) => void;
  confirmHandover: () => void;
  completeHandover: () => void;
  
  markAllRead: () => Promise<void>;
  openNotification: (n: NotificationItem) => Promise<void>;
  saveProfile: (name: string, dept: string, phone: string) => Promise<void>;
  currentProfile: () => UserProfile;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

type Related<T> = T | T[] | null;

interface CategoryRow {
  id: number;
  name: string;
  code: string;
}

interface ProfileNameRow {
  full_name: string;
}

interface PrivateDetailRow {
  hidden_detail: string;
}

interface ItemRow {
  id: string;
  reporter_id?: string;
  type: 'lost' | 'found';
  approval_status: 'pending' | 'approved' | 'rejected';
  status: 'open' | 'pending_claim' | 'match_under_review' | 'resolved';
  title: string;
  description: string;
  location?: string;
  public_location: string;
  occurred_on: string;
  photo_path: string | null;
  category: Related<CategoryRow>;
  reporter?: Related<ProfileNameRow>;
  private_detail?: Related<PrivateDetailRow>;
}

interface ClaimItemRow {
  title: string;
  location: string;
  description: string;
  category: Related<Pick<CategoryRow, 'name' | 'code'>>;
  private_detail: Related<PrivateDetailRow>;
}

interface ClaimHandoverRow {
  pin_code: string;
  status: 'proposed' | 'confirmed' | 'complete' | 'cancelled';
  scheduled_for: string | null;
}

interface ClaimRow {
  id: string;
  item_id: string;
  claimant_id: string;
  kind: 'ownership' | 'recovery';
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  created_at: string;
  item: Related<ClaimItemRow>;
  claimant: Related<ProfileNameRow>;
  evidence: Related<{
    identifying_feature: string;
    proof: string;
    contact_phone: string;
  }>;
  handover: Related<ClaimHandoverRow>;
}

interface ConversationRow {
  id: string;
  claim_id: string;
  updated_at: string;
  item: Related<{ title: string }>;
  claim: Related<{ claimant_id: string }>;
  handover: Related<{
    id: string;
    pin_code: string;
    status: 'proposed' | 'confirmed' | 'complete' | 'cancelled';
    location: string;
  }>;
  messages: Array<{
    sender_id: string;
    body: string;
    created_at: string;
  }>;
}

const EMPTY_PROFILE: UserProfile = {
  name: 'UIU User',
  dept: 'Not specified',
  phone: '',
  id: '',
  initials: 'UI',
};

function firstRelated<T>(value: Related<T>): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'UI';
}

function displayDate(value: string) {
  return new Date(value + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function itemStatusLabel(status: ItemRow['status']): Item['status'] {
  const labels: Record<ItemRow['status'], Item['status']> = {
    open: 'Open',
    pending_claim: 'Pending Claim',
    match_under_review: 'Match Under Review',
    resolved: 'Resolved',
  };
  return labels[status];
}

export const PortalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authed, setAuthed] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [role, setRole] = useState<Role>('guest');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authRoleTab, setAuthRoleTab] = useState<AuthRoleTab>('student');
  const [view, setView] = useState<View>('dashboard');
  const [adminTab, setAdminTab] = useState<AdminTab>('approvals');
  const [deskTab, setDeskTab] = useState<DeskTab>('claims');
  const [selectedItemId, setSelectedItemId] = useState<string | number>('');
  const [showClaimForm, setShowClaimForm] = useState<boolean>(false);
  const [activeConversationId, setActiveConversationId] = useState<string>('c1');
  const [toast, setToastState] = useState<string>('');
  
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');

  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimReviews, setClaimReviews] = useState<ClaimReview[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [profileStudent, setProfileStudent] = useState<UserProfile>(EMPTY_PROFILE);
  const [profileAdmin, setProfileAdmin] = useState<UserProfile>(EMPTY_PROFILE);

  const loadProfile = useCallback(async (userId: string) => {
    const [{ data: profile, error: profileError }, { data: privateProfile, error: privateError }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, department, role')
          .eq('id', userId)
          .single(),
        supabase
          .from('profile_private')
          .select('student_id, phone')
          .eq('user_id', userId)
          .single(),
      ]);

    if (profileError) throw profileError;
    if (privateError) throw privateError;

    const userRole: Role = profile.role === 'admin' ? 'admin' : 'student';
    const mappedProfile: UserProfile = {
      name: profile.full_name,
      dept: profile.department,
      phone: privateProfile.phone ?? '',
      id: privateProfile.student_id,
      initials: initialsFor(profile.full_name),
    };

    if (userRole === 'admin') {
      setProfileAdmin(mappedProfile);
    } else {
      setProfileStudent(mappedProfile);
    }

    setCurrentUserId(userId);
    setRole(userRole);
    return userRole;
  }, [supabase]);

  const refreshPortalData = useCallback(async (userId: string | null) => {
    const categoryRequest = supabase
      .from('categories')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    const itemColumns = userId
      ? 'id, reporter_id, type, approval_status, status, title, description, location, public_location, occurred_on, photo_path, category:categories(id, name, code), reporter:profiles!items_reporter_id_fkey(full_name), private_detail:item_private_details(hidden_detail)'
      : 'id, type, approval_status, status, title, description, public_location, occurred_on, photo_path, category:categories(id, name, code)';

    const itemRequest = supabase
      .from('items')
      .select(itemColumns)
      .order('created_at', { ascending: false });

    const [
      { data: categoryData, error: categoryError },
      { data: itemData, error: itemError },
    ] = await Promise.all([categoryRequest, itemRequest]);

    if (categoryError) throw categoryError;
    if (itemError) throw itemError;

    const categoryRows = (categoryData ?? []) as unknown as CategoryRow[];
    setCategories(categoryRows.map(({ id, name, code }) => ({ id, name, code })));

    const rows = (itemData ?? []) as unknown as ItemRow[];
    const rowsWithPhotos = await Promise.all(rows.map(async (row) => {
      if (!row.photo_path) return { row, photo: '' };
      const { data } = await supabase.storage
        .from('item-photos')
        .createSignedUrl(row.photo_path, 60 * 60);
      return { row, photo: data?.signedUrl ?? '' };
    }));

    const publishedItems: Item[] = [];
    const pendingApprovals: Approval[] = [];

    rowsWithPhotos.forEach(({ row, photo }) => {
      const category = firstRelated(row.category);
      const reporter = firstRelated(row.reporter);
      const privateDetail = firstRelated(row.private_detail);
      const location = row.location ?? row.public_location;
      const mine = Boolean(userId && row.reporter_id === userId);

      if (row.approval_status === 'approved') {
        publishedItems.push({
          id: row.id,
          title: row.title,
          category: category?.name ?? 'Others',
          code: category?.code ?? 'OTHR',
          type: row.type,
          status: itemStatusLabel(row.status),
          location,
          date: displayDate(row.occurred_on),
          reporter: reporter?.full_name ?? 'UIU Community',
          mine,
          description: row.description,
          hiddenDetail: privateDetail?.hidden_detail ?? '',
          photo,
        });
      } else if (row.approval_status === 'pending') {
        pendingApprovals.push({
          id: row.id,
          type: row.type,
          title: row.title,
          category: category?.name ?? 'Others',
          code: category?.code ?? 'OTHR',
          submittedBy: reporter?.full_name ?? 'UIU User',
          mine,
          location,
          date: displayDate(row.occurred_on),
          description: row.description,
          hiddenDetail: privateDetail?.hidden_detail ?? '',
          photo,
        });
      }
    });

    setItems(publishedItems);
    setApprovals(pendingApprovals);
    setSelectedItemId((previous) => previous || publishedItems[0]?.id || '');
  }, [supabase]);

  const refreshUserData = useCallback(async (userId: string) => {
    const [
      { data: claimData, error: claimError },
      { data: notificationData, error: notificationError },
      { data: activityData, error: activityError },
      { data: conversationData, error: conversationError },
    ] = await Promise.all([
      supabase
        .from('claims')
        .select('id, item_id, claimant_id, kind, status, created_at, item:items!claims_item_id_fkey(title, location, description, category:categories(name, code), private_detail:item_private_details(hidden_detail)), claimant:profiles!claims_claimant_id_fkey(full_name), evidence:claim_evidence(identifying_feature, proof, contact_phone), handover:handovers(pin_code, status, scheduled_for)')
        .order('created_at', { ascending: false }),
      supabase
        .from('notifications')
        .select('id, title, body, destination, read_at, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('activity_log')
        .select('event_code, action, detail, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('conversations')
        .select('id, claim_id, updated_at, item:items!conversations_item_id_fkey(title), claim:claims!conversations_claim_id_fkey(claimant_id), handover:handovers(id, pin_code, status, location), messages(sender_id, body, created_at)')
        .order('updated_at', { ascending: false }),
    ]);

    if (claimError) throw claimError;
    if (notificationError) throw notificationError;
    if (activityError) throw activityError;
    if (conversationError) throw conversationError;

    const claimRows = (claimData ?? []) as unknown as ClaimRow[];
    const ownClaims: Claim[] = claimRows
      .filter((claim) => claim.claimant_id === userId)
      .map((claim) => {
        const item = firstRelated(claim.item);
        const category = firstRelated(item?.category ?? null);
        const handover = firstRelated(claim.handover);
        const verification: Claim['verification'] =
          claim.status === 'approved'
            ? 'Approved'
            : claim.status === 'rejected'
              ? 'Rejected'
              : claim.status === 'returned'
                ? 'Returned'
                : 'Under review';

        return {
          id: claim.id,
          itemId: claim.item_id,
          kind: claim.kind,
          itemTitle: item?.title ?? 'Item',
          itemMeta: category
            ? `${category.name} · ${item?.location ?? 'UIU Campus'}`
            : item?.location ?? 'UIU Campus',
          submitted: new Date(claim.created_at).toLocaleDateString('en-GB'),
          verification,
          handover: handover
            ? handover.status === 'complete'
              ? 'Completed at Student Affairs desk'
              : 'Approved — agree a time in chat'
            : 'Not scheduled',
          handoverCode: handover?.pin_code,
        };
      });
    setClaims(ownClaims);

    setClaimReviews(claimRows.map((claim) => {
      const item = firstRelated(claim.item);
      const claimant = firstRelated(claim.claimant);
      const evidence = firstRelated(claim.evidence);
      const privateDetail = firstRelated(item?.private_detail ?? null);
      return {
        id: claim.id,
        kind: claim.kind,
        itemId: claim.item_id,
        claimant: claimant?.full_name ?? 'UIU User',
        item: item?.title ?? 'Item',
        publicDesc: item?.description ?? '',
        claimantAnswer: evidence
          ? `${evidence.identifying_feature} ${evidence.proof}`.trim()
          : '',
        hiddenDetail: privateDetail?.hidden_detail ?? '',
        contact: evidence?.contact_phone ?? '',
        status: claim.status === 'pending'
          ? 'pending'
          : claim.status === 'rejected'
            ? 'rejected'
            : 'approved',
      };
    }));

    const validViews: View[] = [
      'dashboard',
      'browse',
      'item-detail',
      'report-lost',
      'report-found',
      'claims',
      'messages',
      'notifications',
      'profile',
      'admin',
    ];
    setNotifications((notificationData ?? []).map((notification) => ({
      id: Number(notification.id),
      title: notification.title,
      body: notification.body,
      time: new Date(notification.created_at).toLocaleString('en-GB'),
      unread: notification.read_at === null,
      goTo: validViews.includes(notification.destination as View)
        ? notification.destination as View
        : undefined,
    })));

    setActivity((activityData ?? []).map((entry) => ({
      code: entry.event_code,
      title: entry.action,
      detail: entry.detail,
      time: new Date(entry.created_at).toLocaleString('en-GB'),
    })));

    const conversationRows = (conversationData ?? []) as unknown as ConversationRow[];
    const mappedConversations: Conversation[] = conversationRows.map((conversation) => {
      const item = firstRelated(conversation.item);
      const claim = firstRelated(conversation.claim);
      const handover = firstRelated(conversation.handover);
      const orderedMessages = [...(conversation.messages ?? [])]
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const lastMessage = orderedMessages.at(-1);
      const itemTitle = item?.title ?? 'Item';

      return {
        id: conversation.id,
        claimId: conversation.claim_id,
        handoverId: handover?.id,
        itemTitle,
        name: claim?.claimant_id === userId
          ? `Finder · ${itemTitle}`
          : `Claimant · ${itemTitle}`,
        avatar: initialsFor(itemTitle),
        unread: false,
        lastMessage: lastMessage?.body ?? 'Handover approved. Agree a time and confirm.',
        time: new Date(lastMessage?.created_at ?? conversation.updated_at)
          .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        handover: handover
          ? {
              text: `${handover.location} — agree a time with the other participant`,
              status: handover.status === 'cancelled' ? 'proposed' : handover.status,
              code: handover.pin_code,
            }
          : undefined,
        messages: orderedMessages.map((message) => ({
          mine: message.sender_id === userId,
          text: message.body,
          time: new Date(message.created_at)
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: message.sender_id === userId ? 'Sent' : undefined,
        })),
      };
    });
    setConversations(mappedConversations);
    setActiveConversationId((previous) =>
      mappedConversations.some((conversation) => conversation.id === previous)
        ? previous
        : mappedConversations[0]?.id ?? '',
    );
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!mounted) return;

        if (data.user) {
          await loadProfile(data.user.id);
          await Promise.all([
            refreshPortalData(data.user.id),
            refreshUserData(data.user.id),
          ]);
          if (mounted) setAuthed(true);
        } else {
          setRole('guest');
          setCurrentUserId(null);
          await refreshPortalData(null);
        }
      } catch (error) {
        console.error('Unable to initialize Supabase portal:', error);
        setRole('guest');
        setCurrentUserId(null);
        await refreshPortalData(null).catch((refreshError) => {
          console.error('Unable to load public listings:', refreshError);
        });
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }

    initialize();
    return () => {
      mounted = false;
    };
  }, [loadProfile, refreshPortalData, refreshUserData, supabase]);

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

  const openItemDetail = (id: string | number, wantClaim: boolean = false) => {
    setSelectedItemId(id);
    setShowClaimForm(wantClaim);
    setView('item-detail');
  };

  const login = async (email: string, pass: string) => {
    setAuthLoading(true);
    const desiredRole: Role = authRoleTab === 'admin' ? 'admin' : 'student';
    try {
      const credentials = { email: email.trim(), password: pass };
      const signIn = await supabase.auth.signInWithPassword(credentials);
      let user = signIn.data.user;

      // Open portal: an unknown email is registered on its first sign-in attempt.
      if (signIn.error) {
        const { data: created, error: signUpError } = await supabase.auth.signUp({
          ...credentials,
          options: { data: { full_name: email.split('@')[0], role: desiredRole } },
        });
        if (signUpError) throw signUpError;
        user = created.session
          ? created.user
          : (await supabase.auth.signInWithPassword(credentials)).data.user;
        if (!user) {
          throw new Error(
            'Account created but it needs email confirmation. Turn off "Confirm email" in Supabase → Authentication → Sign In / Providers → Email.',
          );
        }
      }

      if (!user) throw new Error('Unable to start a session for this account.');
      const userId = user.id;
      await supabase.from('profiles').update({ role: desiredRole }).eq('id', userId);
      const assignedRole = await loadProfile(userId);

      await Promise.all([refreshPortalData(userId), refreshUserData(userId)]);
      setAuthed(true);
      setView('dashboard');
      showToast(`Signed in as ${assignedRole === 'admin' ? 'Administrator' : 'Student'}.`);
    } catch (error) {
      setAuthed(false);
      showToast(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const signup = async (
    name: string,
    email: string,
    id: string,
    dept: string,
    pass: string,
  ) => {
    setAuthLoading(true);
    try {
      const desiredRole: Role = authRoleTab === 'admin' ? 'admin' : 'student';
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: name.trim(),
            student_id: id.trim(),
            department: dept.trim(),
            role: desiredRole,
          },
        },
      });
      if (error) throw error;

      // If Supabase requires email confirmation, session is null — try signing in immediately anyway.
      const userId = data.user?.id;
      const session = data.session ?? (await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })).data.session;
      if (!userId || !session) {
        setAuthMode('login');
        showToast('Account created! Sign in to continue.');
        return;
      }

      await supabase.from('profiles').update({ role: desiredRole }).eq('id', userId);
      await loadProfile(userId);
      await Promise.all([
        refreshPortalData(userId),
        refreshUserData(userId),
      ]);
      setAuthed(true);
      setView('dashboard');
      showToast('Account created and signed in.');
    } catch (error) {
      setAuthed(false);
      showToast(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setAuthLoading(false);
    }
  };

  const continueAsGuest = async () => {
    setRole('guest');
    setCurrentUserId(null);
    setAuthed(true);
    setView('dashboard');
    await refreshPortalData(null).catch((error) => {
      console.error('Unable to refresh public listings:', error);
    });
    showToast('Browsing as Guest. Sign in to post or claim items.');
  };

  const logout = async () => {
    if (role === 'guest') {
      setAuthMode('login');
      setAuthed(false);
    } else {
      await supabase.auth.signOut();
      setRole('guest');
      setCurrentUserId(null);
      setClaims([]);
      setNotifications([]);
      setActivity([]);
      await refreshPortalData(null);
      setAuthed(true);
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

  const uploadItemPhoto = async (photo: string, itemId: string) => {
    if (!photo || !currentUserId) return null;

    const response = await fetch(photo);
    const file = await response.blob();
    const extension = file.type.split('/')[1] || 'jpg';
    const path = `${currentUserId}/${itemId}/photo.${extension}`;
    const { error } = await supabase.storage
      .from('item-photos')
      .upload(path, file, { contentType: file.type, upsert: true });

    if (error) throw error;
    return path;
  };

  const submitItem = async (
    type: 'lost' | 'found',
    title: string,
    category: string,
    location: string,
    date: string,
    description: string,
    hidden: string,
    photo: string,
  ) => {
    if (!currentUserId) {
      showToast('Please sign in before submitting a report.');
      return;
    }

    const selectedCategory = categories.find((entry) => entry.name === category);
    if (!selectedCategory?.id) {
      showToast('Please select a valid category.');
      return;
    }

    const itemId = crypto.randomUUID();
    let photoPath: string | null = null;

    try {
      photoPath = await uploadItemPhoto(photo, itemId);
      const { error: itemError } = await supabase.from('items').insert({
        id: itemId,
        reporter_id: currentUserId,
        category_id: selectedCategory.id,
        type,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        occurred_on: date,
        photo_path: photoPath,
      });
      if (itemError) throw itemError;

      const { error: detailError } = await supabase
        .from('item_private_details')
        .insert({
          item_id: itemId,
          reporter_id: currentUserId,
          hidden_detail: hidden.trim(),
        });
      if (detailError) throw detailError;

      await refreshPortalData(currentUserId);
      setView('claims');
      setDeskTab('reports');
      pushNote(
        type === 'lost' ? 'Lost report received' : 'Found item received',
        `Your ${title} submission is queued for admin approval.`,
        'claims',
      );
      showToast(
        type === 'lost'
          ? 'Lost report sent for admin approval.'
          : 'Found item sent for admin approval.',
      );
    } catch (error) {
      if (photoPath) {
        await supabase.storage.from('item-photos').remove([photoPath]);
      }
      showToast(error instanceof Error ? error.message : 'Unable to submit report.');
    }
  };

  // Actions
  const submitClaim = async (feature: string, proof: string, contact: string) => {
    const item = items.find((i) => i.id === selectedItemId);
    if (!item || !feature.trim() || !proof.trim() || !contact.trim()) return;
    if (!currentUserId || typeof item.id !== 'string') {
      showToast('Please sign in before submitting a claim.');
      return;
    }

    const kind = item.type === 'found' ? 'ownership' : 'recovery';
    try {
      const { data: claim, error: claimError } = await supabase
        .from('claims')
        .insert({
          item_id: item.id,
          claimant_id: currentUserId,
          kind,
        })
        .select('id')
        .single();
      if (claimError) throw claimError;

      const { error: evidenceError } = await supabase
        .from('claim_evidence')
        .insert({
          claim_id: claim.id,
          claimant_id: currentUserId,
          identifying_feature: feature.trim(),
          proof: proof.trim(),
          contact_phone: contact.trim(),
        });
      if (evidenceError) throw evidenceError;

      await Promise.all([
        refreshPortalData(currentUserId),
        refreshUserData(currentUserId),
      ]);
      setShowClaimForm(false);
      setView('claims');
      setDeskTab('claims');
      const isOwnership = kind === 'ownership';
      pushNote(
        isOwnership ? 'Claim submitted' : 'Found report submitted',
        `Your ${isOwnership ? 'claim for' : 'response to'} the ${item.title} is with the admin desk for verification.`,
        'claims',
      );
      showToast(
        isOwnership
          ? 'Claim submitted for admin verification.'
          : 'Found report sent to the admin desk.',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to submit claim.');
    }
  };

  const submitLostForm = (
    title: string,
    category: string,
    location: string,
    date: string,
    description: string,
    hidden: string,
    photo: string
  ) => submitItem(
    'lost',
    title,
    category,
    location,
    date,
    description,
    hidden,
    photo,
  );

  const submitFoundForm = (
    title: string,
    category: string,
    location: string,
    date: string,
    description: string,
    hidden: string,
    photo: string
  ) => submitItem(
    'found',
    title,
    category,
    location,
    date,
    description,
    hidden,
    photo,
  );

  const approveApproval = async (id: string | number) => {
    const a = approvals.find((x) => x.id === id);
    if (!a || !currentUserId || typeof id !== 'string') return;

    const { error } = await supabase
      .from('items')
      .update({
        approval_status: 'approved',
        reviewed_by: currentUserId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', id);

    if (error) {
      showToast(error.message);
      return;
    }

    await refreshPortalData(currentUserId);
    pushNote(
      a.type === 'lost' ? 'Lost report published' : 'Found item published',
      `${a.title} is now visible in Browse Listings.`,
      'browse',
    );
    showToast(
      a.type === 'lost'
        ? 'Lost report approved and published.'
        : 'Found item approved and published.',
    );
  };

  const rejectApproval = async (id: string | number) => {
    const a = approvals.find((x) => x.id === id);
    if (!a || !currentUserId || typeof id !== 'string') return;

    const { error } = await supabase
      .from('items')
      .update({
        approval_status: 'rejected',
        reviewed_by: currentUserId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: 'Submission did not meet portal posting rules.',
      })
      .eq('id', id);

    if (error) {
      showToast(error.message);
      return;
    }

    await refreshPortalData(currentUserId);
    showToast('Submission rejected.');
  };

  const approveClaimReview = async (id: string | number) => {
    const r = claimReviews.find((x) => x.id === id);
    if (!r || !currentUserId || typeof id !== 'string' || typeof r.itemId !== 'string') return;

    const reviewedAt = new Date().toISOString();
    const { error: claimError } = await supabase
      .from('claims')
      .update({
        status: 'approved',
        reviewed_by: currentUserId,
        reviewed_at: reviewedAt,
      })
      .eq('id', id);
    if (claimError) {
      showToast(claimError.message);
      return;
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({ claim_id: id, item_id: r.itemId })
      .select('id')
      .single();
    if (conversationError) {
      showToast(conversationError.message);
      return;
    }

    const code = String(1000 + Math.floor(Math.random() * 9000));
    const { error: handoverError } = await supabase.from('handovers').insert({
      claim_id: id,
      conversation_id: conversation.id,
      pin_code: code,
    });
    if (handoverError) {
      showToast(handoverError.message);
      return;
    }

    await Promise.all([
      refreshPortalData(currentUserId),
      refreshUserData(currentUserId),
    ]);
    showToast('Claim approved. Handover chat opened.');
  };

  const rejectClaimReview = async (id: string | number) => {
    const r = claimReviews.find((x) => x.id === id);
    if (!r || !currentUserId || typeof id !== 'string') return;

    const { error } = await supabase
      .from('claims')
      .update({
        status: 'rejected',
        reviewed_by: currentUserId,
        reviewed_at: new Date().toISOString(),
        admin_note: 'Claim evidence did not sufficiently match the held-back detail.',
      })
      .eq('id', id);
    if (error) {
      showToast(error.message);
      return;
    }

    await Promise.all([
      refreshPortalData(currentUserId),
      refreshUserData(currentUserId),
    ]);
    showToast('Claim rejected. Listing reopened.');
  };

  const awardDispute = (disputeId: string | number, claimantName: string) => {
    const d = disputes.find((x) => x.id === disputeId);
    if (!d) return;
    setDisputes((prev) => prev.filter((x) => x.id !== disputeId));
    logActivity(d.code, 'Dispute settled', `${d.itemTitle} · awarded to ${claimantName}`);
    pushNote('Dispute settled', `The ${d.itemTitle} was awarded to ${claimantName}.`, 'admin');
    showToast(`${d.itemTitle} awarded to ${claimantName}.`);
  };

  const escalateDispute = (disputeId: string | number) => {
    const d = disputes.find((x) => x.id === disputeId);
    if (!d) return;
    setDisputes((prev) => prev.filter((x) => x.id !== disputeId));
    logActivity(d.code, 'Dispute escalated', `${d.itemTitle} · sent to Student Affairs`);
    showToast('Escalated to Student Affairs.');
  };

  const addCategory = async (name: string) => {
    if (!name.trim()) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      showToast(`${name} is already in the index.`);
      return;
    }

    const { error } = await supabase.from('categories').insert({
      name: name.trim(),
      code: name.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase(),
    });
    if (error) {
      showToast(error.message);
      return;
    }
    await refreshPortalData(currentUserId);
    showToast('Category added.');
  };

  const removeCategory = async (name: string) => {
    const open = items.filter((i) => i.category === name && i.status !== 'Resolved').length;
    if (open > 0) {
      showToast(`Move the ${open} open listing(s) out of ${name} first.`);
      return;
    }

    const category = categories.find((entry) => entry.name === name);
    if (!category?.id) return;
    const { error } = await supabase
      .from('categories')
      .update({ is_active: false })
      .eq('id', category.id);
    if (error) {
      showToast(error.message);
      return;
    }
    await refreshPortalData(currentUserId);
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

  const markAllRead = async () => {
    if (!currentUserId) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', currentUserId)
      .is('read_at', null);
    if (error) {
      showToast(error.message);
      return;
    }
    await refreshUserData(currentUserId);
    showToast('All notifications marked as read.');
  };

  const openNotification = async (n: NotificationItem) => {
    if (currentUserId && n.unread) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', n.id);
      await refreshUserData(currentUserId);
    }
    if (n.goTo) setView(n.goTo);
  };

  const saveProfile = async (name: string, dept: string, phone: string) => {
    if (!currentUserId) return;
    const [{ error: profileError }, { error: privateError }] = await Promise.all([
      supabase
        .from('profiles')
        .update({ full_name: name.trim(), department: dept.trim() })
        .eq('id', currentUserId),
      supabase
        .from('profile_private')
        .update({ phone: phone.trim() || null })
        .eq('user_id', currentUserId),
    ]);
    if (profileError || privateError) {
      showToast(profileError?.message ?? privateError?.message ?? 'Unable to update profile.');
      return;
    }
    await loadProfile(currentUserId);
    showToast('Profile updated.');
  };

  return (
    <PortalContext.Provider
      value={{
        authed,
        authLoading,
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
