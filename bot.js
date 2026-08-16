// Telegram bot — Gemini AI bilan boyitilgan
import { readFileSync, writeFileSync } from 'node:fs';

const TOKEN = process.env.BOT_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN) {
  console.error('BOT_TOKEN yoʻq — repo Secrets ga qoʻshing');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

// Gemini AI orqali yangilik generatsiya qilish
async function getAIUpdate() {
  if (!GEMINI_KEY) return "⚠️ Gemini API kaliti topilmadi. Iltimos, GitHub Secrets ga GEMINI_API_KEY qo'shing.";
  
  const prompt = "Bugungi dunyo yangiliklari, texnologiya va qiziqarli voqealar haqida qisqacha, 5-6 ta banddan iborat o'zbek tilida ma'lumot ber. Har bir yangilik qisqa va lo'nda bo'lsin. Oxirida Koreya vaqtini ham eslatib o't.";
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (e) {
    return "Yangiliklarni yuklashda xatolik yuz berdi.";
  }
}

function loadState() {
  try {
    return JSON.parse(readFileSync('state.json', 'utf8'));
  } catch {
    return { offset: 0, users: [] };
  }
}

async function send(chatId, text) {
  try {
    await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('Xabar yuborishda xato:', e);
  }
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
  const text = (message.text || '').trim().toLowerCase();

  if (text === '/start') {
    await send(chatId, "⏳ *Yangiliklar tayyorlanmoqda...*");
    const aiNews = await getAIUpdate();
    await send(chatId, `📢 *Bugungi yangiliklar:*\n\n${aiNews}`);
  } else {
    await send(chatId, "Yangiliklarni olish uchun /start buyrug'ini yuboring.");
  }
}

writeFileSync('state.json', JSON.stringify(state, null, 2));
console.log('Ish yakunlandi.');
