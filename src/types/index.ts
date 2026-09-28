export type Role = 'student' | 'admin' | 'guest';

export type View =
  | 'dashboard'
  | 'browse'
  | 'item-detail'
  | 'report-lost'
  | 'report-found'
  | 'claims'
  | 'messages'
  | 'notifications'
  | 'profile'
  | 'admin';

export type AdminTab = 'approvals' | 'claim-review' | 'disputes' | 'categories' | 'reports';

export type DeskTab = 'claims' | 'reports' | 'incoming' | 'matches';

export type AuthMode = 'login' | 'signup';

export type AuthRoleTab = 'student' | 'admin';

export interface Item {
  id: string | number;
  title: string;
  category: string;
  code: string;
  type: 'lost' | 'found';
  status: 'Open' | 'Pending Claim' | 'Match Under Review' | 'Resolved';
  location: string;
  date: string;
  reporter: string;
  mine: boolean;
  description: string;
  hiddenDetail: string;
  photo: string;
  credit?: string;
  creditHref?: string;
}

export interface Claim {
  id: string | number;
  itemId: string | number;
  kind: 'ownership' | 'recovery';
  itemTitle: string;
  itemMeta: string;
  submitted: string;
  verification: 'Under review' | 'Approved' | 'Returned' | 'Rejected';
  handover: string;
  handoverCode?: string;
}

export interface ClaimReview {
  id: string | number;
  kind: 'ownership' | 'recovery';
  itemId: string | number;
  claimant: string;
  item: string;
  publicDesc: string;
  claimantAnswer: string;
  hiddenDetail: string;
  contact: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Approval {
  id: string | number;
  type: 'lost' | 'found';
  title: string;
  category: string;
  code: string;
  submittedBy: string;
  mine: boolean;
  location: string;
  date: string;
  description: string;
  hiddenDetail: string;
  photo: string;
  credit?: string;
  creditHref?: string;
}

export interface DisputeClaimant {
  name: string;
  answer: string;
  date: string;
}

export interface Dispute {
  id: string | number;
  itemTitle: string;
  code: string;
  claimants: DisputeClaimant[];
}

export interface Category {
  id?: number;
  name: string;
  code: string;
}

export interface ChatMessage {
  mine: boolean;
  text: string;
  time: string;
  status?: string;
}

export interface HandoverInfo {
  text: string;
  status: 'proposed' | 'confirmed' | 'complete';
  code: string;
}

export interface Conversation {
  id: string;
  claimId?: string;
  handoverId?: string;
  itemTitle: string;
  name: string;
  avatar: string;
  unread: boolean;
  lastMessage: string;
  time: string;
  handover?: HandoverInfo;
  messages: ChatMessage[];
}

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  goTo?: View;
}

export interface Activity {
  code: string;
  title: string;
  detail: string;
  time: string;
}

export interface UserProfile {
  name: string;
  dept: string;
  phone: string;
  id: string;
  initials: string;
  photoId?: string;
}

export interface MatchScoreResult {
  score: number;
  reasons: string[];
}

export interface VerificationResult {
  hit: number;
  total: number;
  pct: number;
  label: string;
}
