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
    if (!data.last_sent) data.last_sent = "";
    return data;
  } catch {
    return { offset: 0, users: [], last_sent: "" };
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

// 22:00 yoki 22:05 ekanligini va bugun hali yuborilmaganini tekshirish
const timeSlots = ['22:00', '22:01', '22:02', '22:05', '22:06', '22:07']; // Kechikishlarni hisobga olgan holda
const currentSlot = timeSlots.includes(uzTime) ? uzTime.substring(0, 5) : null;
const sentKey = `${todayDate}_${currentSlot}`;

if (currentSlot && state.last_sent !== sentKey) {
  const newsMessage = `📢 <b>Kechki yangiliklar (${currentSlot})</b>\n\nBugungi asosiy voqealar bilan tanishing...`;
  
  for (const chatId of state.users) {
    await send(chatId, newsMessage);
  }
  state.last_sent = sentKey;
  console.log(`Yangilik yuborildi: ${sentKey}`);
}

writeFileSync('state.json', JSON.stringify(state, null, 2));
console.log('Ish yakunlandi.');
