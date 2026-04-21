// ===============================
// DEATHNOTE WEBUG - MAIN SERVER
// ===============================
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');

// ===============================
// CONFIGURATION
// ===============================
const app = express();
const PORT = process.env.PORT || 3000;

// Telegram bot token from token.js
const { TELEGRAM_TOKEN } = require('./token');
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Admin chat ID (replace with your numeric chat ID after starting the bot)
const ADMIN_CHAT_ID = 'YOUR_TELEGRAM_CHAT_ID'; // <-- CHANGE THIS

// Data files
const USERS_FILE = path.join(__dirname, 'users.json');
const DATABASE_FILE = path.join(__dirname, 'database.json');
const BANNED_FILE = path.join(__dirname, 'banned_numbers.json');

// Ensure files exist
function ensureFile(file, defaultContent = {}) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultContent, null, 2));
    }
}
ensureFile(USERS_FILE, { users: [] });
ensureFile(DATABASE_FILE, { pending: [] });
ensureFile(BANNED_FILE, []);

// Helper to read/write JSON
function readJSON(file) {
    return JSON.parse(fs.readFileSync(file));
}
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ===============================
// EXPRESS MIDDLEWARE
// ===============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'deathnote_secret_2025',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set true if HTTPS
}));

// ===============================
// WHATSAPP SOCKET MANAGEMENT
// ===============================
const activeSockets = new Map(); // key: sessionId, value: socket

async function getSocket(sessionId) {
    if (activeSockets.has(sessionId)) {
        return activeSockets.get(sessionId);
    }
    const sessionDir = path.join(__dirname, 'AlphaPrince', `session_${sessionId}`);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const logger = pino({ level: 'silent' });
    const sock = makeWASocket({
        version,
        logger,
        browser: Browsers.macOS('Chrome'),
        auth: state,
        printQRInTerminal: false,
        markOnlineOnConnect: false
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                activeSockets.delete(sessionId);
            }
        }
    });
    activeSockets.set(sessionId, sock);
    return sock;
}

// ===============================
// TELEGRAM BOT COMMANDS
// ===============================
// Helper to get pending registrations
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '💀 DeathNote Admin Bot Active.\nCommands:\n/inbox - Pending registrations\n/approve <username>\n/decline <username>\n/approveall\n/create <username> <password> <email>\n/approveunban <number>\n/denyunban <number>');
});

bot.onText(/\/inbox/, (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const { pending } = readJSON(DATABASE_FILE);
    if (pending.length === 0) {
        bot.sendMessage(ADMIN_CHAT_ID, '📭 No pending registrations.');
        return;
    }
    let text = '📋 *Pending Registrations*\n\n';
    pending.forEach((u, i) => {
        text += `${i+1}. ${u.username} (${u.email})\n`;
    });
    text += '\nUse /approve <username> or /decline <username>';
    bot.sendMessage(ADMIN_CHAT_ID, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/approve (.+)/, (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const username = match[1];
    const db = readJSON(DATABASE_FILE);
    const userIndex = db.pending.findIndex(u => u.username === username);
    if (userIndex === -1) {
        bot.sendMessage(ADMIN_CHAT_ID, `❌ User ${username} not found.`);
        return;
    }
    const approvedUser = db.pending[userIndex];
    const users = readJSON(USERS_FILE);
    users.users.push({
        username: approvedUser.username,
        password: approvedUser.password,
        email: approvedUser.email,
        age: approvedUser.age,
        gender: approvedUser.gender,
        country: approvedUser.country,
        number: approvedUser.number,
        approvedAt: Date.now()
    });
    writeJSON(USERS_FILE, users);
    db.pending.splice(userIndex, 1);
    writeJSON(DATABASE_FILE, db);
    bot.sendMessage(ADMIN_CHAT_ID, `✅ User ${username} approved.`);
});

bot.onText(/\/decline (.+)/, (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const username = match[1];
    const db = readJSON(DATABASE_FILE);
    const userIndex = db.pending.findIndex(u => u.username === username);
    if (userIndex === -1) {
        bot.sendMessage(ADMIN_CHAT_ID, `❌ User ${username} not found.`);
        return;
    }
    db.pending.splice(userIndex, 1);
    writeJSON(DATABASE_FILE, db);
    bot.sendMessage(ADMIN_CHAT_ID, `❌ User ${username} declined.`);
});

bot.onText(/\/approveall/, (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const db = readJSON(DATABASE_FILE);
    if (db.pending.length === 0) {
        bot.sendMessage(ADMIN_CHAT_ID, 'No pending users.');
        return;
    }
    const users = readJSON(USERS_FILE);
    for (const user of db.pending) {
        users.users.push({
            username: user.username,
            password: user.password,
            email: user.email,
            age: user.age,
            gender: user.gender,
            country: user.country,
            number: user.number,
            approvedAt: Date.now()
        });
    }
    writeJSON(USERS_FILE, users);
    writeJSON(DATABASE_FILE, { pending: [] });
    bot.sendMessage(ADMIN_CHAT_ID, `✅ Approved all ${db.pending.length} users.`);
});

bot.onText(/\/create (.+)/, (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const parts = match[1].split(' ');
    if (parts.length < 3) {
        bot.sendMessage(ADMIN_CHAT_ID, 'Usage: /create <username> <password> <email>');
        return;
    }
    const [username, password, email] = parts;
    const users = readJSON(USERS_FILE);
    if (users.users.find(u => u.username === username)) {
        bot.sendMessage(ADMIN_CHAT_ID, `❌ User ${username} already exists.`);
        return;
    }
    users.users.push({ username, password, email, adminCreated: true, approvedAt: Date.now() });
    writeJSON(USERS_FILE, users);
    bot.sendMessage(ADMIN_CHAT_ID, `✅ User ${username} created.`);
});

// Unban approval commands
bot.onText(/\/approveunban (.+)/, (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const number = match[1];
    let banned = readJSON(BANNED_FILE);
    const newBanned = banned.filter(b => b.number !== number);
    writeJSON(BANNED_FILE, newBanned);
    bot.sendMessage(ADMIN_CHAT_ID, `✅ Number +${number} has been unbanned.`);
});

bot.onText(/\/denyunban (.+)/, (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const number = match[1];
    bot.sendMessage(ADMIN_CHAT_ID, `❌ Unban request for +${number} denied.`);
});

// ===============================
// API ROUTES
// ===============================
// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = { username: user.username, email: user.email };
        res.json({ success: true, redirect: '/main.html' });
    } else {
        res.json({ success: false, message: 'Invalid credentials' });
    }
});

// Register
app.post('/api/register', (req, res) => {
    const { email, username, password, age, gender, country, number } = req.body;
    const users = readJSON(USERS_FILE);
    if (users.users.find(u => u.username === username)) {
        return res.json({ success: false, message: 'Username already taken' });
    }
    const db = readJSON(DATABASE_FILE);
    if (db.pending.find(p => p.username === username)) {
        return res.json({ success: false, message: 'Already pending approval' });
    }
    const newUser = { email, username, password, age, gender, country, number, timestamp: Date.now() };
    db.pending.push(newUser);
    writeJSON(DATABASE_FILE, db);
    // Notify admin via Telegram
    const msg = `🆕 *New Registration*\n\n👤 *Username:* ${username}\n📧 *Email:* ${email}\n🌍 *Country:* ${country}\n📱 *Number:* ${number}\n\nUse /approve ${username} or /decline ${username}`;
    bot.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' });
    res.json({ success: true, message: 'Registration sent for approval.' });
});

// Check session
app.get('/api/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    const sessionId = req.session.id;
    if (activeSockets.has(sessionId)) {
        activeSockets.get(sessionId).end();
        activeSockets.delete(sessionId);
    }
    req.session.destroy();
    res.json({ success: true });
});

// Request QR code
app.post('/api/request-qr', async (req, res) => {
    const sessionId = req.session.id;
    if (!sessionId) return res.status(400).json({ error: 'No session' });
    try {
        const sock = await getSocket(sessionId);
        const qrPromise = new Promise((resolve) => {
            const handler = (qr) => {
                sock.ev.off('connection.update', handler);
                resolve(qr);
            };
            sock.ev.on('connection.update', (update) => {
                if (update.qr) handler(update.qr);
            });
        });
        const qrCode = await qrPromise;
        const qrDataURL = await QRCode.toDataURL(qrCode);
        res.json({ qr: qrDataURL });
    } catch (err) {
        console.error('QR error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Request pairing code (phone number)
app.post('/api/request-pairing-code', async (req, res) => {
    const sessionId = req.session.id;
    const { phoneNumber } = req.body;
    if (!sessionId || !phoneNumber) {
        return res.status(400).json({ error: 'Missing session or phone number' });
    }
    try {
        const sock = await getSocket(sessionId);
        const code = await sock.requestPairingCode(phoneNumber);
        res.json({ success: true, code });
    } catch (err) {
        console.error('Pairing error:', err);
        res.status(500).json({ error: err.message });
    }
});

// WhatsApp status
app.get('/api/whatsapp-status', (req, res) => {
    const sessionId = req.session.id;
    const sock = activeSockets.get(sessionId);
    res.json({ connected: !!sock?.user });
});

// Execute bug (ban)
app.post('/api/execute-bug', async (req, res) => {
    const { bugType, targetNumber, category, intensity = 50 } = req.body;
    if (!bugType || !targetNumber) {
        return res.status(400).json({ error: 'Missing bugType or targetNumber' });
    }
    // Log the attack (store in banned file if needed)
    // For now, just simulate success
    // You can extend this to actually call a plugin or send a message
    res.json({ success: true, message: `${bugType} executed on +${targetNumber} (intensity ${intensity}%)` });
});

// Get banned numbers
app.get('/api/banned-numbers', (req, res) => {
    const banned = readJSON(BANNED_FILE);
    res.json({ numbers: banned });
});

// Request unban
app.post('/api/request-unban', (req, res) => {
    const { number, reason } = req.body;
    if (!number) return res.status(400).json({ error: 'Number required' });
    const msg = `🔓 *Unban Request*\n\n📱 Number: +${number}\n📝 Reason: ${reason || 'No reason'}\n\nUse /approveunban ${number} or /denyunban ${number}`;
    bot.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' });
    res.json({ success: true });
});

// TikTok download
app.get('/api/tiktok', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'URL required' });
    try {
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
        const response = await axios.get(apiUrl);
        const data = response.data.data;
        res.json({
            title: data.title,
            author: data.author?.unique_id,
            nowm: 'https://www.tikwm.com' + data.play,
            watermark: 'https://www.tikwm.com' + data.wmplay,
            audio: 'https://www.tikwm.com' + data.music,
            cover: 'https://www.tikwm.com' + data.cover
        });
    } catch (err) {
        res.status(500).json({ error: 'TikTok download failed' });
    }
});

// YouTube download (mp3)
app.get('/api/youtube', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'URL required' });
    try {
        const apiUrl = `https://api.ryzendesu.vip/api/download/ytmp3?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);
        const data = response.data;
        if (data.result) {
            res.json({ title: data.title, url: data.result });
        } else {
            res.status(500).json({ error: 'No download link' });
        }
    } catch (err) {
        res.status(500).json({ error: 'YouTube download failed' });
    }
});

// Instagram download (placeholder)
app.get('/api/instagram', (req, res) => {
    res.status(501).json({ error: 'Instagram download not implemented yet' });
});

// Stats
app.get('/api/stats', (req, res) => {
    const stats = {
        totalVisits: 1337,
        activeSessions: activeSockets.size,
        uptimeSeconds: process.uptime(),
        totalBans: 0,
        totalTikTok: 0,
        totalYouTube: 0
    };
    res.json(stats);
});

// ===============================
// SERVE FRONTEND
// ===============================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
    console.log(`💀 DeathNote Webug running on port ${PORT}`);
    console.log(`Telegram bot active. Admin chat ID: ${ADMIN_CHAT_ID}`);
});
