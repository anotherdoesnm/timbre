export type Role = 'admin' | 'mod' | null;

export interface Author {
  name: string;
  initial: string;
  color: string;
  role?: Role;
}

export interface Message {
  id: string;
  author: Author;
  time: string;
  text: string;
  grouped?: boolean;
  mention?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  kind: 'text' | 'voice';
  category: string;
  encrypted?: boolean;
  unread?: number;
  mention?: number;
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
      text: 'Напоминаю: клиенты на 1.9.0 не показывают кастомные стикеры — это не баг инстанса, а отсутствующий capability.',
    },
    {
      id: 'm2',
      author: authors.anya,
      time: '14:04',
      text: 'Проверила на chat.mstdn.ca — да, из пяти capabilities приходит два. Гейтить надо по списку, не по версии.',
    },
    {
      id: 'm3',
      author: authors.kirill,
      time: '14:06',
      text: 'Собираю скин с трёхпанельной раскладкой. Пока на моках, без Supabase — хочу сначала попасть в ощущение.',
      grouped: false,
    },
    {
      id: 'm4',
      author: authors.kirill,
      time: '14:06',
      text: 'Шифрование per-channel: в design и mod-chat ключей нет, поэтому там только заглушка и выключенный композер.',
      grouped: true,
    },
    {
      id: 'm5',
      author: authors.ken,
      time: '14:11',
      text: 'А вот это правильный подход: пустое состояние честнее, чем «тихо отправить plaintext».',
      mention: true,
    },
    {
      id: 'm6',
      author: authors.anya,
      time: '14:12',
      text: 'Кстати, unread-точки и бейджи уже как в Cinny?',
    },
    {
      id: 'm7',
      author: authors.kirill,
      time: '14:13',
      text: 'Почти: точка у сервера слева, бейдж у канала справа. Разницу между «прочитано» и «упомянули» разнёс по цвету.',
    },
  ],
  c2: [
    { id: 'm20', author: authors.anya, time: '13:40', text: 'Ветка dev: discovery-цепочка лежит в docs, там же четыре режима отказа.' },
    { id: 'm21', author: authors.volta, time: '13:44', text: '403 от Cloudflare не путать с «это не Harmony» — просто показываем статус.' },
  ],
  c4: [
    { id: 'm30', author: authors.ken, time: '12:10', text: 'Кто-нибудь пробовал WARP? Инстансы за CF иногда режут.' },
  ],
};

export const members = [
  { name: 'volta', initial: 'V', color: '#e3ba91', role: 'admin', status: 'online' },
  { name: 'kirill', initial: 'K', color: '#bdb6ec', role: 'mod', status: 'online' },
  { name: 'anya', initial: 'A', color: '#85e0ba', role: null, status: 'online' },
  { name: 'ken', initial: 'K', color: '#e69d9d', role: null, status: 'idle' },
  { name: 'mira', initial: 'M', color: '#7a7a7a', role: null, status: 'offline' },
];
