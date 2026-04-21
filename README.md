# 💀 DeathNote Webug — WhatsApp Ban Panel, Media Tools & Telegram Admin Bot

![Version](https://img.shields.io/badge/version-1.0.0-red?style=for-the-badge)
![Node](https://img.shields.io/badge/node-18.x-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-black?style=for-the-badge)
![WhatsApp](https://img.shields.io/badge/Baileys-6.7.9-25D366?style=for-the-badge&logo=whatsapp)
![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?style=for-the-badge&logo=telegram)

<p align="center">
  <img src="https://d.uguu.se/pavwQeEi.jpg" alt="DeathNote Logo" width="300">
</p>

> *“The human whose name is written in this note shall die.”*  
> **DeathNote Webug** is a complete web‑based tool to manage WhatsApp sessions, execute ban/bug commands, download media (TikTok, YouTube), browse anime art, and manage user registrations – all with a Telegram bot for admin approval.

---

## ✨ Features

| Category | Capabilities |
|----------|--------------|
| 🔐 **Authentication** | User registration with Telegram admin approval, session management |
| 📱 **WhatsApp Pairing** | QR code scan or 8‑digit code pairing (Baileys v6) |
| 💀 **Ban Panel** | Group / Android / iOS bug commands, intensity slider, multi‑target, recent bans log |
| 🔓 **Unban Request** | Request unban with reason, admin approves via Telegram |
| 📥 **Media Downloader** | TikTok (no watermark), YouTube (MP3), Instagram (stub) |
| 🎌 **Anime Gallery** | Random anime images from waifu.pics + DeathNote quotes |
| 👨‍💻 **Developer Info** | Stats, WhatsApp channel link, version info |
| 🤖 **Telegram Bot** | Approve/decline registrations, unban requests, create users |

---

## 🖼️ Screenshots

| Login | Dashboard | Ban Panel |
|-------|-----------|-----------|
| ![Login](https://d.uguu.se/miwXVvJo.jpg) | ![Dashboard](https://d.uguu.se/XjDsxNdF.jpg) | ![Ban Panel](https://d.uguu.se/KpgsKRbv.jpg) |

> *Actual screenshots coming soon – above are style previews.*

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Express‑Session
- **WhatsApp**: Baileys (WebSocket, multi‑device)
- **QR & Media**: QRCode, Axios, TikWM API, Ryzendesu API
- **Telegram**: node‑telegram‑bot‑api (polling)
- **Frontend**: HTML5, CSS3 (glassmorphism), vanilla JavaScript
- **Deployment**: Render (recommended) / Vercel (limited)

---

## 📦 Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/deathnote-webug.git
cd deathnote-webug
