import { parseSearchQuery } from './compiled/searchQuery.js';
for (const c of [
  'hello in:#general',
  'in:#general from:kirill',
  'has:image from:@doesnm hello world',
  'before:2026-11-01 after:2026-10-01 in:dm',
  'in:#nonsense from:someone plain words',
  'just words',
]) console.log(JSON.stringify(c), '->', JSON.stringify(parseSearchQuery(c)));
