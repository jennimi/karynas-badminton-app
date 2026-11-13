// Turns a WhatsApp export into src/features/chat-import/data/chatSessions.json.
//   npm run chat:build -- "_chat 2.txt"
// Only the extracted session data is stored (lists, prices, payment marks), never
// the raw chat, and long digit strings (bank / phone numbers) and links are removed,
// because everything in src/ ends up in the public website.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { analyseChat } from '../src/features/chat-import/parseChat';

const input = process.argv[2] ?? '_chat 2.txt';
const out = 'src/features/chat-import/data/chatSessions.json';

const redact = (t: string) =>
  t
    .replace(/https?:\/\/\S+/g, '[link]')
    .replace(/\S+@\S+\.\S+/g, '[email]')
    .replace(/\+?\b\d{8,}\b/g, '•••')
    .replace(/\b0\d{2,3}[ -]\d{3,4}[ -]\d{3,5}\b/g, '•••');

const deepRedact = <T>(v: T): T =>
  typeof v === 'string'
    ? (redact(v) as T)
    : Array.isArray(v)
      ? (v.map(deepRedact) as T)
      : v && typeof v === 'object'
        ? (Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepRedact(x)])) as T)
        : v;

const parsed = analyseChat(readFileSync(input, 'utf8'));
for (const s of parsed.sessions) {
  s.priceMsgs = []; // summarised in `reposts`; the full copies are not stored
}
mkdirSync('src/features/chat-import/data', { recursive: true });
writeFileSync(
  out,
  JSON.stringify(deepRedact({ generatedAt: new Date().toISOString().slice(0, 10), ...parsed }))
);
console.log(`wrote ${out}: ${parsed.sessions.length} sessions`);
