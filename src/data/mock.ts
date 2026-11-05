export type Role = 'admin' | 'mod' | null;

export interface Author {
  id?: string;
  name: string;
  initial: string;
  color: string;
  role?: Role;
  avatarUrl?: string;
  /** A webhook or bot post: no profile row, the name comes from the message metadata. */
  bot?: boolean;
}

export interface Message {
  id: string;
  author: Author;
  time: string;
  text: string;
  grouped?: boolean;
  mention?: boolean;
  /** Signed attachment URLs from the message's jsonb parts. */
  images?: string[];
  /** "X joined the server" and friends: no author, no avatar. */
  system?: boolean;
  /** Quoted parent, when this message is a reply. */
  replyTo?: { id: string; author: string; text: string };
  /** Aggregated reactions: one chip per emoji. */
  reactions?: { emoji: string; count: number; mine: boolean }[];
  /** Non-image attachments, with a signed link when one could be made. */
  files?: { name: string; url?: string }[];
  /** Set when the message was edited after sending. */
  edited?: boolean;
  /** Pinned in its channel or conversation. */
  pinned?: boolean;
  /** A poll attached to the message, once its votes are known. */
  poll?: {
    id: string;
    question: string;
    allowMultiple: boolean;
    closed: boolean;
    expiresAt: string | null;
    totalVoters: number;
    options: { id: string; text: string; votes: number }[];
    myOptionIds: string[];
    isAuthor: boolean;
  };
}

export interface Channel {
  id: string;
  name: string;
  kind: 'text' | 'voice';
  category: string;
  encrypted?: boolean;
  unread?: number;
  mention?: number;
  /** Notifications for this channel are off; the unread count still moves. */
  muted?: boolean;
}

export interface Server {
  id: string;
  name: string;
  short: string;
  color: string;
  unread?: number;
}

/* Real public servers on har.mony.lol — keeps the mock honest. */
export const servers: Server[] = [
  { id: 's1', name: 'Experimental Zone', short: 'EZ', color: '#413c65', unread: 3 },
  { id: 's2', name: 'Lockpickers United', short: 'LU', color: '#175c3f' },
  { id: 's3', name: 'ZealOS Harmony experiment', short: 'ZH', color: '#602929', unread: 1 },
];

export const channels: Channel[] = [
  { id: 'c1', name: 'general', kind: 'text', category: 'Text channels', unread: 12 },
  { id: 'c2', name: 'dev', kind: 'text', category: 'Text channels', mention: 2 },
  { id: 'c3', name: 'design', kind: 'text', category: 'Text channels', encrypted: true },
  { id: 'c4', name: 'offtopic', kind: 'text', category: 'Text channels' },
  { id: 'c5', name: 'mod-chat', kind: 'text', category: 'Staff', encrypted: true },
  { id: 'v1', name: 'Lounge', kind: 'voice', category: 'Voice' },
  { id: 'v2', name: 'Pairing', kind: 'voice', category: 'Voice' },
];

export const authors: Record<string, Author> = {
  kirill: { name: 'kirill', initial: 'K', color: '#bdb6ec', role: 'mod' },
  anya: { name: 'anya', initial: 'A', color: '#85e0ba' },
  volta: { name: 'volta', initial: 'V', color: '#e3ba91', role: 'admin' },
  ken: { name: 'ken', initial: 'K', color: '#e69d9d' },
};

export const messages: Record<string, Message[]> = {
  c1: [
    {
      id: 'm1',
      author: authors.volta,
      time: '14:02',
      text: 'Reminder: clients on 1.9.0 do not show custom stickers — that is a missing capability, not an instance bug.',
    },
    {
      id: 'm2',
      author: authors.anya,
      time: '14:04',
      text: 'Checked chat.mstdn.ca: two capabilities out of five. Gate on the list, not on the version.',
    },
    {
      id: 'm3',
      author: authors.kirill,
      time: '14:06',
      text: 'Building the skin with a three-pane layout. Still on mocks, no session — the feel comes first.',
      grouped: false,
    },
    {
      id: 'm4',
      author: authors.kirill,
      time: '14:06',
      text: 'Encryption is per channel: no keys in design and mod-chat, so those show a placeholder and a disabled composer.',
      grouped: true,
    },
    {
      id: 'm5',
      author: authors.ken,
      time: '14:11',
      text: 'That is the right call: an honest empty state beats quietly sending plaintext.',
      mention: true,
    },
    {
      id: 'm6',
      author: authors.anya,
      time: '14:12',
      text: 'Do the unread dots and badges already look like Cinny?',
    },
    {
      id: 'm7',
      author: authors.kirill,
      time: '14:13',
      text: 'Almost: dot on the server rail, badge on the channel. Read and mentioned differ by colour.',
    },
  ],
  c2: [
    { id: 'm20', author: authors.anya, time: '13:40', text: 'The dev branch documents the discovery chain, including its four failure modes.' },
    { id: 'm21', author: authors.volta, time: '13:44', text: 'Do not confuse a Cloudflare 403 with "this is not Harmony" — just show the status.' },
  ],
  c4: [
    { id: 'm30', author: authors.ken, time: '12:10', text: 'Has anyone tried this over WARP? Instances behind CF sometimes cut it.' },
  ],
};

export const members = [
  { name: 'volta', initial: 'V', color: '#e3ba91', role: 'admin', status: 'online' },
  { name: 'kirill', initial: 'K', color: '#bdb6ec', role: 'mod', status: 'online' },
  { name: 'anya', initial: 'A', color: '#85e0ba', role: null, status: 'online' },
  { name: 'ken', initial: 'K', color: '#e69d9d', role: null, status: 'idle' },
  { name: 'mira', initial: 'M', color: '#7a7a7a', role: null, status: 'offline' },
];
