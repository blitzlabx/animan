# Animan

**Anime & Manga downloader Telegram bot**  
Created by **Blitz** ([@blitzlabx](https://github.com/blitzlabx)) · v1.3.0

Powered by [anime-sdk](https://github.com/hexxt-git/anime-sdk) · Colored buttons (Bot API 9.4) · Floket anti-bot · Ranking algorithms · SQLite · Render-ready

---

## Features

### Content
- 🎬 **Anime** — AllManga, Gogoanime, Anikoto, MegaPlay, AnimeParadise
- 📚 **Manga** — MangaDex, WeebCentral, MangaPill
- 🔀 Multi-provider search with fuzzy ranking (Dice + Jaccard + prefix + year + provider priority)
- 🔥 AniList trending / seasonal / top
- 🎚 Quality picker when multiple streams exist
- SUB / DUB / RAW language selection
- Subtitle links when providers expose them
- Optional on-disk download helpers (MP4 / manga pages)

### Security & UX
- 🛡️ **Floket** human verification (math / word / logic / brand challenges)
- 🚫 Ban system with reasons + admin audit log
- 🔧 Global maintenance mode
- ⏳ Per-user token-bucket rate limiting
- 📢 Optional force-join group
- 🎨 Colored inline buttons (`primary` / `success` / `danger`)
- ⭐ Favorites & history
- Clean Telegram Markdown UI
- Input validation (query length, no URLs, safe callbacks)

### Admin panel (`/admin` + shortcuts)
- Live stats (users, verified, banned, downloads, searches today, cache size)
- Ban / unban by ID (`/ban`, `/unban`)
- User info + search by username (`/user`)
- Broadcast text / photo / video / document / animation
- Maintenance toggle (`/maint`)
- Recent download logs + top downloaders
- Settings view

### Ops
- `/ping` + `/health` for UptimeRobot / cron (Render free tier)
- Dockerfile ready for Render
- Optional webhook mode (`WEBHOOK_URL`)
- Structured logging
- In-memory TTL cache for search & episode lists
- SQLite WAL persistence
- Auto cleanup of old downloads

---

## Quick Start

```bash
cp .env.example .env
# edit TELEGRAM_BOT_TOKEN, ADMIN_ID

npm install
npm run dev
```

### Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | From @BotFather |
| `ADMIN_ID` | ✅ | Your numeric Telegram user ID |
| `DONATION_URL` | — | Support link |
| `FORCE_JOIN_CHAT_ID` | — | Group/channel ID |
| `FORCE_JOIN_CHAT_USERNAME` | — | @username for join button |
| `PORT` | — | Default 3000 |
| `LOG_LEVEL` | — | debug / info / warn / error |
| `WEBHOOK_URL` | — | Full URL to enable webhook mode |

---

## Deploy on Render (free tier)

1. Push to GitHub under **blitzlabx**
2. New **Web Service** → connect repo
3. Runtime: **Docker**
4. Set environment variables
5. Health check path: `/health`
6. Deploy

Keep awake with UptimeRobot → `https://your-service.onrender.com/ping` every 5 minutes.

---

## Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/start` | All | Start + Floket |
| `/anime <title>` | Users | Anime search |
| `/manga <title>` | Users | Manga search |
| `/trending` | Users | AniList trending |
| `/favorites` | Users | Saved titles |
| `/history` | Users | Recent picks |
| `/help` `/commands` | Users | Help |
| `/donate` | Users | Support Blitz |
| `/ping` `/stats` | Users | Latency / mini stats |
| `/admin` | Owner | Admin panel |
| `/ban` `/unban` `/user` `/maint` | Owner | Quick admin |

---

## Architecture

```
src/
├── index.ts                 # Bot + Express entry
├── config.ts                # Env & brand
├── constants/               # Limits, emoji, callback ids, version
├── types/                   # Shared TypeScript types
├── algorithms/
│   ├── ranking.ts           # Fuzzy ranking (Dice/Jaccard/prefix/year)
│   ├── similarity.ts        # Levenshtein, Jaro-Winkler, n-gram cosine
│   └── episodes.ts          # Sort, filter fillers, ranges
├── cache/memory.ts          # TTL cache, rate limiter, sessions
├── logging/logger.ts        # Structured logs
├── db/database.ts           # SQLite (users, logs, favorites, audit)
├── download/video.ts        # MP4 / manga page download helpers
├── commands/registry.ts     # Bot command list + setMyCommands
├── services/
│   ├── anime.ts             # anime-sdk wrappers + multi-search
│   ├── floket.ts            # Anti-bot challenges
│   ├── providers.ts         # Provider metadata helpers
│   └── webhook.ts           # Optional webhook mode
├── handlers/
│   ├── start.ts             # /start, Floket, favorites
│   ├── menu.ts              # Navigation callbacks
│   ├── search.ts            # Search → units → streams
│   ├── admin.ts             # Full admin panel
│   └── extra.ts             # ping, stats, ban shortcuts
├── middleware/guards.ts     # Ban / maintenance / Floket / rate
└── utils/
    ├── keyboards.ts         # Colored InlineKeyboards
    ├── messages.ts          # Markdown templates
    ├── text.ts              # Escape, format, chunk helpers
    ├── errors.ts            # BlitzError, retry, user-facing messages
    └── validate.ts          # Query / user-id / callback validation
```

---

## Ranking algorithm (Blitz)

Search results are scored with a weighted blend:

1. **Title similarity** (55%) — Dice bigrams + token Jaccard + prefix boost  
2. **Year proximity** (15%) — extracted from query when present  
3. **Popularity** (20%) — when catalogue exposes a score  
4. **Provider priority** (10%) — preferred sources ranked higher  

Results are deduplicated by normalized title before display.  
Extended similarity module adds Levenshtein, Jaro-Winkler, and n-gram cosine for suggestions.

---

## Floket

Users must solve a short challenge before search/download:

- Math, word, logic, and brand questions
- Max 3 attempts, 5-minute expiry
- Admin bypasses all checks

---

## Credits

- **Creator**: Blitz (@blitzlabx)
- **SDK**: [hexxt-git/anime-sdk](https://github.com/hexxt-git/anime-sdk)
- **Framework**: grammY

---

## License

MIT · Made with ❤️ by Blitz
