const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'deathnote_secret_2025',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set true if HTTPS
}));

// Store active sockets per session (to avoid multiple instances)
const activeSockets = new Map();

// Helper to get or create a WhatsApp socket for a session
async function getSocket(sessionId, telegramChatId = null) {
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

    // Store socket
    activeSockets.set(sessionId, sock);

    // Cleanup on disconnect
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                activeSockets.delete(sessionId);
            }
        }
    });

    return sock;
}

// ======================
// API ROUTES
// ======================

// 1. Request QR code
app.post('/api/request-qr', async (req, res) => {
    const sessionId = req.session.id;
    if (!sessionId) return res.status(400).json({ error: 'No session' });

    try {
        const sock = await getSocket(sessionId);
        
        // Listen for QR event
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
        // Generate QR as data URL
        const qrDataURL = await QRCode.toDataURL(qrCode);
        res.json({ qr: qrDataURL });
    } catch (err) {
        console.error('QR error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Request pairing code (phone number)
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
        console.error('Pairing code error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Check if user is logged in (has active WhatsApp connection)
app.get('/api/check-session', async (req, res) => {
    const sessionId = req.session.id;
    if (!sessionId) return res.json({ loggedIn: false });

    const sock = activeSockets.get(sessionId);
    if (sock && sock.user) {
        res.json({ loggedIn: true, user: { id: sock.user.id } });
    } else {
        res.json({ loggedIn: false });
    }
});

// 4. Get stats (placeholder – you can expand)
app.get('/api/stats', (req, res) => {
    res.json({
        totalVisits: 1337,
        activeSessions: activeSockets.size,
        uptimeSeconds: process.uptime()
    });
});

// TikTok download (using tikwm.com API)
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

// YouTube download (using a public API)
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

// Instagram download (stub – you can add later)
app.get('/api/instagram', async (req, res) => {
    res.status(501).json({ error: 'Instagram download not implemented yet' });
});
// 5. Logout (clear session)
app.post('/api/logout', (req, res) => {
    const sessionId = req.session.id;
    if (activeSockets.has(sessionId)) {
        activeSockets.get(sessionId).end();
        activeSockets.delete(sessionId);
    }
    req.session.destroy();
    res.json({ success: true });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`💀 DeathNote Webug running on port ${PORT}`);
});
