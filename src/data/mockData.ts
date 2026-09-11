import {
  Item,
  Approval,
  Claim,
  ClaimReview,
  Dispute,
  Category,
  Conversation,
  NotificationItem,
  Activity,
  UserProfile,
} from '@/types';

export const INITIAL_ITEMS: Item[] = [
  {
    id: 1,
    title: 'Wireless Earbuds',
    category: 'Electronics',
    code: 'ELEC',
    type: 'found',
    status: 'Open',
    location: 'UIU Cafeteria',
    date: '23 Jul 2026',
    reporter: 'Tanvir R.',
    mine: false,
    description: 'White charging case with two earbuds. Minor scuff on the outer case.',
    hiddenDetail: 'A small nick on the rim of the left earbud.',
    photo: '',
  },
  {
    id: 2,
    title: 'Leather Wallet',
    category: 'Accessories',
    code: 'ACCS',
    type: 'lost',
    status: 'Pending Claim',
    location: 'Library 3rd Floor',
    date: '22 Jul 2026',
    reporter: 'Sabbir K.',
    mine: false,
    description: 'Brown leather tri-fold wallet containing student card and library card.',
    hiddenDetail: 'Red emergency token inside behind the cash slot.',
    photo: '',
  },
  {
    id: 3,
    title: 'Student ID Card',
    category: 'Documents',
    code: 'DOCS',
    type: 'found',
    status: 'Open',
    location: 'Study Hub A',
    date: '21 Jul 2026',
    reporter: 'Nusrat A.',
    mine: false,
    description: 'UIU Student ID card in a transparent lanyard holder.',
    hiddenDetail: 'A small yellow star sticker on the back of the lanyard.',
    photo: '',
  },
  {
    id: 4,
    title: 'Casio G-Shock Watch',
    category: 'Accessories',
    code: 'ACCS',
    type: 'found',
    status: 'Open',
    location: 'Gymnasium',
    date: '20 Jul 2026',
    reporter: 'Fahim M.',
    mine: false,
    description: 'Matte black digital watch with rubber strap.',
    hiddenDetail: 'Small scratch near the top right button.',
    photo: '',
  },
  {
    id: 5,
    title: 'House & Bike Keys',
    category: 'Keys',
    code: 'KEYS',
    type: 'found',
    status: 'Open',
    location: 'Ground Floor Plaza',
    date: '20 Jul 2026',
    reporter: 'Security Desk',
    mine: false,
    description: 'Ring of 3 keys attached to a blue leather keychain fob.',
    hiddenDetail: 'Engraved initials SK on the silver key fob.',
    photo: '',
  },
  {
    id: 6,
    title: 'Scientific Calculator',
    category: 'Electronics',
    code: 'ELEC',
    type: 'lost',
    status: 'Open',
    location: 'Room 505',
    date: '19 Jul 2026',
    reporter: 'Toji FushiGoro',
    mine: true,
    description: 'Dark scientific calculator with a transparent protective cover.',
    hiddenDetail: 'Cracked corner on the protective cover.',
    photo: '',
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  { name: 'Electronics', code: 'ELEC' },
  { name: 'Documents', code: 'DOCS' },
  { name: 'Keys', code: 'KEYS' },
  { name: 'Clothing', code: 'CLTH' },
  { name: 'Bags', code: 'BAGS' },
  { name: 'Accessories', code: 'ACCS' },
  { name: 'Others', code: 'OTHR' },
];

export const INITIAL_APPROVALS: Approval[] = [
  {
    id: 101,
    type: 'found',
    title: 'Blue Water Bottle',
    category: 'Accessories',
    code: 'ACCS',
    submittedBy: 'Amina B.',
    mine: false,
    location: 'Auditorium Level 2',
    date: 'Today',
    description: 'Insulated stainless steel flask with sticker pack.',
    hiddenDetail: 'Small dent on bottom rim, anime sticker on side.',
    photo: '',
  },
  {
    id: 102,
    type: 'lost',
    title: 'HP Laptop Charger',
    category: 'Electronics',
    code: 'ELEC',
    submittedBy: 'Rafi H.',
    mine: false,
    location: 'Lab 4',
    date: 'Yesterday',
    description: 'Black 65W power adapter with blue tip connector.',
    hiddenDetail: 'Wrapped with green electrical tape near the block.',
    photo: '',
  },
];

export const INITIAL_CLAIMS: Claim[] = [
  {
    id: 201,
    itemId: 2,
    kind: 'ownership',
    itemTitle: 'Leather Wallet',
    itemMeta: 'Accessories · Library 3rd Floor',
    submitted: 'Yesterday',
    verification: 'Under review',
    handover: 'Not scheduled',
  },
];

export const INITIAL_CLAIM_REVIEWS: ClaimReview[] = [
  {
    id: 201,
    kind: 'ownership',
    itemId: 2,
    claimant: 'Sabbir K.',
    item: 'Leather Wallet',
    publicDesc: 'Brown leather tri-fold wallet containing student card and library card.',
    claimantAnswer: 'Red emergency token inside behind cash slot',
    hiddenDetail: 'Red emergency token inside behind the cash slot.',
    contact: '01712345678',
    status: 'pending',
  },
];

export const INITIAL_DISPUTES: Dispute[] = [
  {
    id: 301,
    itemTitle: 'Wireless Earbuds',
    code: 'ELEC',
    claimants: [
      { name: 'Tanvir R.', answer: 'Nick on left earbud rim.', date: '21 Jul 2026' },
      { name: 'Farhan A.', answer: 'Scuffed case cover.', date: '22 Jul 2026' },
    ],
  },
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    itemTitle: 'Leather Wallet',
    name: 'Finder · Leather Wallet',
    avatar: 'LW',
    unread: true,
    lastMessage: 'Handover proposed at Student Affairs Desk.',
    time: '10:42 AM',
    handover: {
      text: 'Propose a time at the Student Affairs desk',
      status: 'proposed',
      code: '8492',
    },
    messages: [
      {
        mine: false,
        text: 'Hello! I found your leather wallet near Library 3rd floor. The admin verified the claim. When can we meet at the desk?',
        time: '10:40 AM',
      },
      {
        mine: true,
        text: 'Thank you so much! I can meet today around 2:00 PM at Student Affairs.',
        time: '10:41 AM',
      },
      {
        mine: false,
        text: 'Sounds great. Let us confirm it here and present the 4-digit code at the desk.',
        time: '10:42 AM',
      },
    ],
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    title: 'Claim under review',
    body: 'Your claim for Leather Wallet is currently being reviewed by the campus desk.',
    time: '10 mins ago',
    unread: true,
    goTo: 'claims',
  },
  {
    id: 2,
    title: 'New possible match',
    body: 'The desk found a potential match for Scientific Calculator.',
    time: '2 hours ago',
    unread: true,
    goTo: 'claims',
  },
];

export const INITIAL_ACTIVITY: Activity[] = [
  {
    code: 'ELEC',
    title: 'Found item published',
    detail: 'Wireless Earbuds · approved by desk',
    time: '10m ago',
  },
  {
    code: 'ACCS',
    title: 'Ownership claim filed',
    detail: 'Leather Wallet · Sabbir K.',
    time: '1h ago',
  },
  {
    code: 'DOCS',
    title: 'Found item published',
    detail: 'Student ID Card · approved by desk',
    time: '3h ago',
  },
  {
    code: 'RTN',
    title: 'Item returned',
    detail: 'Casio Watch · handover code verified',
    time: 'Yesterday',
  },
];

export const MOCK_PROFILE_STUDENT: UserProfile = {
  name: 'Toji FushiGoro',
  dept: 'Computer Science & Engineering',
  phone: '+880 1700 000000',
  id: '011 231 042',
  initials: 'TF',
};

export const MOCK_PROFILE_ADMIN: UserProfile = {
  name: 'Admin Student Affairs',
  dept: 'Student Affairs & Security',
  phone: '+880 1711 999999',
  id: 'ADM-9021',
  initials: 'AD',
};
