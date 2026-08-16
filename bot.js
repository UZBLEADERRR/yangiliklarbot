// Telegram bot — GitHub Actions har 5 daqiqada ishga tushiradi.
import { readFileSync, writeFileSync } from 'node:fs';

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('BOT_TOKEN yoʻq — repo Secrets ga qoʻshing');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

function loadState() {
  try {
    const data = JSON.parse(readFileSync('state.json', 'utf8'));
    if (!data.users) data.users = [];
    if (!data.last_sent_slots) data.last_sent_slots = [];
    return data;
  } catch {
    return { offset: 0, users: [], last_sent_slots: [] };
  }
}

async function send(chatId, text) {
  try {
    await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('Xabar yuborishda xato:', e);
  }
}

function reply(text) {
  const t = (text || '').trim().toLowerCase();
  if (t === '/start') return 'Salom! Men yangiliklar botiman. Har kuni soat 22:00 va 22:05 da sizga yangilik yuboraman.';
  if (t === '/yordam') return 'Buyruqlar:\n/start — roʻyxatdan oʻtish\n/vaqt — hozirgi vaqt';
  if (t === '/vaqt') return 'Hozirgi vaqt: ' + new Intl.DateTimeFormat('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  return 'Tushunmadim. /yordam deb yozing.';
}

const state = loadState();

// 1. Yangi xabarlarni tekshirish
const res = await fetch(`${API}/getUpdates?offset=${state.offset}&timeout=0`);
const data = await res.json();

for (const update of data.result ?? []) {
  state.offset = update.update_id + 1;
  const message = update.message;
  if (!message?.chat?.id) continue;

  const chatId = message.chat.id;
  if (!state.users.includes(chatId)) {
    state.users.push(chatId);
  }

  await send(chatId, reply(message.text));
}

// 2. Vaqtni tekshirish (Oʻzbekiston vaqti)
const now = new Date();
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
const uzTime = formatter.format(now);
const todayDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

console.log('Hozirgi vaqt (UZ):', uzTime);

// 22:00 va 22:05 yangiliklarini tekshirish
const [hour, minute] = uzTime.split(':').map(Number);

async function checkAndSend(slotTime, label) {
  const sentKey = `${todayDate}_${slotTime}`;
  if (state.last_sent_slots?.includes(sentKey)) return;

  const [slotH, slotM] = slotTime.split(':').map(Number);
  // Agar hozirgi vaqt slot vaqtidan o'tgan bo'lsa va juda ko'p o'tib ketmagan bo'lsa (masalan 30 daqiqa)
  if ((hour > slotH || (hour === slotH && minute >= slotM)) && (hour === slotH && minute < slotM + 30)) {
    const newsMessage = `📢 <b>Kechki yangiliklar (${label})</b>\n\nBugungi asosiy voqealar bilan tanishing...\n\n🕒 Vaqt: ${uzTime}`;
    for (const chatId of state.users) {
      await send(chatId, newsMessage);
    }
    if (!state.last_sent_slots) state.last_sent_slots = [];
    state.last_sent_slots.push(sentKey);
    console.log(`Yangilik yuborildi: ${sentKey}`);
  }
}

await checkAndSend('22:00', '22:00');
await checkAndSend('22:05', '22:05');

writeFileSync('state.json', JSON.stringify(state, null, 2));
console.log('Ish yakunlandi.');
