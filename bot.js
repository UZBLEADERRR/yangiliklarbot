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
    return data;
  } catch {
    return { offset: 0, users: [] };
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

const newsMessage = `📢 <b>Bugungi yangiliklar</b>\n\nKoreyada vaqt: ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Seoul' })}\n\nBugungi asosiy voqealar bilan tanishing...\n\n(Bu yerga yangilik matnini qo'shishingiz mumkin)`;

const state = loadState();

// 1. Yangi xabarlarni tekshirish
const res = await fetch(`${API}/getUpdates?offset=${state.offset}&timeout=0`);
const data = await res.json();

for (const update of data.result ?? []) {
  state.offset = update.update_id + 1;
  const message = update.message;
  if (!message?.chat?.id) continue;

  const chatId = message.chat.id;
  const text = (message.text || '').trim().toLowerCase();

  if (!state.users.includes(chatId)) {
    state.users.push(chatId);
  }

  if (text === '/start') {
    await send(chatId, 'Salom! Yangiliklar botiga xush kelibsiz.');
    await send(chatId, newsMessage);
  } else if (text === '/yordam') {
    await send(chatId, 'Buyruqlar:\n/start — yangiliklarni olish');
  } else {
    await send(chatId, 'Tushunmadim. /start deb yozing.');
  }
}

writeFileSync('state.json', JSON.stringify(state, null, 2));
console.log('Ish yakunlandi.');
