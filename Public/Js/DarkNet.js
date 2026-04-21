// DarkNet.js - DeathNote Webug Core Library
// Handles all frontend interactions with the backend API

const DarkNet = (function() {
    // Private variables
    let currentUser = null;
    let activeSocket = null;
    let sessionCheckInterval = null;
    const API_BASE = '/api';

    // Helper: fetch with JSON
    async function _fetch(endpoint, options = {}) {
        const res = await fetch(API_BASE + endpoint, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    // ==========================
    // Authentication
    // ==========================
    async function login(username, password) {
        const data = await _fetch('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (data.success) {
            currentUser = { username };
            startSessionCheck();
            return { success: true, redirect: data.redirect };
        }
        return { success: false, message: data.message };
    }

    async function logout() {
        await _fetch('/logout', { method: 'POST' });
        currentUser = null;
        stopSessionCheck();
        window.location.href = 'index.html';
    }

    async function checkSession() {
        const data = await _fetch('/check-session');
        if (!data.loggedIn) {
            currentUser = null;
            if (window.location.pathname !== '/index.html' && window.location.pathname !== '/register.html') {
                window.location.href = 'index.html';
            }
        } else {
            currentUser = data.user;
        }
        return data.loggedIn;
    }

    function startSessionCheck() {
        if (sessionCheckInterval) clearInterval(sessionCheckInterval);
        sessionCheckInterval = setInterval(checkSession, 60000);
    }

    function stopSessionCheck() {
        if (sessionCheckInterval) clearInterval(sessionCheckInterval);
    }

    // ==========================
    // WhatsApp Pairing
    // ==========================
    async function requestQR() {
        const data = await _fetch('/request-qr', { method: 'POST' });
        return data.qr;
    }

    async function requestPairingCode(phoneNumber) {
        const data = await _fetch('/request-pairing-code', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber })
        });
        return data.code;
    }

    async function getWhatsAppStatus() {
        const data = await _fetch('/whatsapp-status');
        return data;
    }

    // ==========================
    // Bans / Bug Execution
    // ==========================
    async function executeBug(bugType, targetNumber, category = 'android', intensity = 50) {
        const data = await _fetch('/execute-bug', {
            method: 'POST',
            body: JSON.stringify({ bugType, targetNumber, category, intensity })
        });
        return data;
    }

    async function getBannedNumbers() {
        const data = await _fetch('/banned-numbers');
        return data.numbers || [];
    }

    async function requestUnban(number, reason) {
        const data = await _fetch('/request-unban', {
            method: 'POST',
            body: JSON.stringify({ number, reason })
        });
        return data;
    }

    // ==========================
    // Media Download
    // ==========================
    async function downloadTikTok(url) {
        const data = await _fetch(`/tiktok?url=${encodeURIComponent(url)}`);
        return data;
    }

    async function downloadYouTube(url) {
        const data = await _fetch(`/youtube?url=${encodeURIComponent(url)}`);
        return data;
    }

    async function downloadInstagram(url) {
        const data = await _fetch(`/instagram?url=${encodeURIComponent(url)}`);
        return data;
    }

    // ==========================
    // Anime & Quotes
    // ==========================
    async function getRandomAnime() {
        const res = await fetch('https://api.waifu.pics/sfw/waifu');
        const data = await res.json();
        return data.url;
    }

    const quotes = [
        "I am justice.",
        "The note never forgets.",
        "Only the number is required.",
        "Eliminate with no mercy.",
        "Your name is already written.",
        "This world is rotten.",
        "I'll take a potato chip... and eat it!",
        "Delete, delete, delete..."
    ];

    function getRandomQuote() {
        return quotes[Math.floor(Math.random() * quotes.length)];
    }

    // ==========================
    // Statistics
    // ==========================
    async function getStats() {
        const data = await _fetch('/stats');
        return data;
    }

    // ==========================
    // Public API
    // ==========================
    return {
        // Auth
        login,
        logout,
        checkSession,
        getCurrentUser: () => currentUser,
        // WhatsApp
        requestQR,
        requestPairingCode,
        getWhatsAppStatus,
        // Bans
        executeBug,
        getBannedNumbers,
        requestUnban,
        // Media
        downloadTikTok,
        downloadYouTube,
        downloadInstagram,
        // Anime & Quotes
        getRandomAnime,
        getRandomQuote,
        // Stats
        getStats
    };
})();

// Expose globally if needed (for inline scripts)
if (typeof window !== 'undefined') {
    window.DarkNet = DarkNet;
}
