// Telegram bot — Gemini AI orqali yangiliklar
import { readFileSync, writeFileSync } from 'node:fs';

const TOKEN = process.env.BOT_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN || !GEMINI_KEY) {
  console.error('BOT_TOKEN yoki GEMINI_API_KEY yoʻq — repo Settings > Secrets ga qoʻshing');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
// Model nomi foydalanuvchi so'raganidek, lekin Google Search uchun 2.0-flash eng barqarori
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

function loadState() {
  try {
    return JSON.parse(readFileSync('state.json', 'utf8'));
  } catch {
    return { offset: 0, users: [] };
  }
}

function saveState(state) {
  writeFileSync('state.json', JSON.stringify(state, null, 2));
}

async function callGemini(prompt) {
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Google Search (Grounding) funksiyasini yoqish
        tools: [{ google_search_retrieval: {} }]
      })
    });
    const data = await res.json();
    
    // Google Search natijasini olish
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return data.candidates[0].content.parts[0].text;
    }
    return "Hozircha yangilik topilmadi.";
  } catch (e) {
    console.error('Gemini Error:', e);
    return "Kechirasiz, yangiliklarni olishda xatolik yuz berdi.";
  }
}

async function send(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const state = loadState();

// Ertalabki 7:00 xabari (GitHub Actions orqali maxsus argument bilan chaqiriladi)
if (process.argv.includes('--morning')) {
  const news = await callGemini("Google orqali bugungi (so'nggi 24 soat ichidagi) eng muhim 5 ta dunyo va O'zbekiston yangiliklarini qidirib top va qisqa, tushunarli qilib o'zbek tilida yozib ber.");
  for (const chatId of state.users) {
    await send(chatId, `☀️ <b>Xayrli tong!</b>\n\nBugungi muhim yangiliklar:\n\n${news}`);
  }
  process.exit(0);
}

const res = await fetch(`${API}/getUpdates?offset=${state.offset}&timeout=0`);
const data = await res.json();

for (const update of data.result ?? []) {
  state.offset = update.update_id + 1;
  
  const message = update.message;
  const callback = update.callback_query;

  if (message) {
    const chatId = message.chat.id;
    if (!state.users.includes(chatId)) state.users.push(chatId);

    if (message.text === '/start') {
      await send(chatId, "Assalomu alaykum! Men Gemini AI yordamida ishlaydigan yangiliklar botiman.", {
        inline_keyboard: [[{ text: "📰 Yangiliklarni ko'rish", callback_data: "get_news" }]]
      });
    }
  }

  if (callback) {
    const chatId = callback.message.chat.id;
    if (callback.data === 'get_news') {
      await send(chatId, "⌛ Google orqali so'nggi yangiliklar qidirilmoqda...");
      const news = await callGemini("Google Search orqali hozirgi vaqtdagi eng shov-shuvli dunyo va O'zbekiston yangiliklarini qidirib top. Ularni qisqa, tushunarli va qiziqarli qilib o'zbek tilida yozib ber.");
      await send(chatId, news, {
        inline_keyboard: [[{ text: "🔄 Yangilash", callback_data: "get_news" }]]
      });
    }
  }
}

saveState(state);
