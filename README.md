# TripSquad

**Plan trips together, live.** A real-time group travel web app: a shared itinerary on a map, group and private chat, traveller profiles, live polls, live location sharing, multi-currency expense splitting with smart settle-up, weather per day, and an AI trip planner. Light and dark mode, and an app-style layout on phones.

Built with the MERN stack + Socket.io + Leaflet.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-TripSquad-0d9488?style=for-the-badge&logo=vercel)](https://tripsquad.vercel.app)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-Real--time-010101?style=flat-square&logo=socket.io)](https://socket.io)

> **[→ Try the live demo](https://tripsquad.vercel.app)** — create a trip, share the invite link in a private window, and watch both windows sync in real time.

---

## Features

| Feature | What it does |
|---|---|
| **Trips & invites** | Create a trip, share an invite link (or WhatsApp), friends join in one tap. Max 30 people per trip. |
| **Shared itinerary** | Search real places (OpenStreetMap), pin them on the map, organise by day, **drag & drop** to reorder or move between days. Each day has its own color and route line. |
| **Real-time** | Every change (places, polls, expenses, members) appears instantly for everyone. Shows who's online. Reconnects and re-syncs automatically. |
| **Live location** | Opt-in. Friends see you on the map while your page is open. Throttled, auto-stops after 1 hour, **never stored in the database**. |
| **Polls** | "Scuba or boat party?" — live vote bars, one vote per person, close to pick a winner. |
| **Expenses** | Split equally or by exact amounts, in **any currency** (INR, AED, EUR, USD…). The exchange rate is saved with each expense. |
| **Smart settle-up** | A debt-simplification algorithm turns everyone's balances into the **fewest payments**. Mark payments as paid. |
| **Budgets** | Set a personal budget and track your share of spending. |
| **AI planner** | "3 days, beaches + seafood" → a day-by-day plan with every place **found on the real map**. Places the AI invented are flagged, not added. |
| **Chat** | Group chat per trip plus private 1:1 chats between members. Typing indicator, "Seen by", unread badges, share your location or a planned place, load older messages. |
| **Trip timeline** | Expenses, polls, joins and date changes are posted into the group chat automatically, and friends get a toast when you change something. |
| **Profiles** | Photo, bio, home city, languages, food preference, phone, emergency contact and how to pay you back. Each private field can be "Trip members" or "Only me". Only people who share a trip with you can see your profile. |
| **Friend profile panel** | Tap anyone's photo: see their info, call / WhatsApp / message them, and what you owe each other. |
| **Trip settings** | Rename, change destination or dates (with a warning before places move back to Ideas), pick a trip color. Currency locks once expenses exist. |
| **Weather** | Forecast on each trip day (free Open-Meteo API, available ~2 weeks ahead). |
| **Destination photos** | Trip covers and place thumbnails are found automatically on Wikivoyage / Wikipedia (free, no key), with attribution. Looked up in the background and cached, so pages never wait for them. |
| **Custom trip cover** | The trip owner can upload their own photo (resized in the browser, file type checked on the server, stored in MongoDB), pick another suggested photo, or remove it — and drag to choose which part shows. Everyone sees the change live. |
| **Notifications** | Optional browser alerts for new messages when TripSquad is in the background. |
| **Landing page** | Public home page for visitors (features with real screenshots, how it works, an animated settle-up demo, FAQ). Logged-in users go straight to their trips. |
| **Privacy & account deletion** | `/privacy` and `/terms` pages (needed for the Play Store). Anyone can delete their account from their profile: personal data is wiped, solo trips deleted, shared trips handed to the next member. |
| **Dark mode** | Toggle in the header; remembers your choice. |
| **Mobile-friendly** | Bottom tab bar on phones, works in the phone browser during the trip. |

---

## Tech stack

- **Frontend:** React (Vite), React Router, Leaflet + react-leaflet, dnd-kit, socket.io-client, Lucide icons, Inter font
- **UI:** hand-written CSS with design tokens (one brand color, neutral grays, light/dark themes) — no UI kit
- **Backend:** Node.js, Express 5, Socket.io, Mongoose
- **Database:** MongoDB Atlas
- **Free external APIs:** OpenStreetMap Nominatim (place search), open.er-api.com (exchange rates), Open-Meteo (weather), Wikivoyage/Wikipedia (photos), Gemini or Groq (AI)
- **Security:** bcrypt passwords, JWT auth (REST + sockets), Helmet, rate limiting, membership checks on every route and socket event

## Architecture

```
┌──────────── React app (client/) ────────────┐
│  Pages: Auth · Dashboard · Join · Trip       │
│  Trip tabs: Plan(map) · Money · Polls · People│
└───────┬──────────────────────────┬───────────┘
        │ REST (fetch + JWT)        │ Socket.io (JWT in handshake)
┌───────▼──────────────────────────▼───────────┐
│  Express API (server/)                        │
│  routes/  → validate, check membership, save  │
│  services/realtime → broadcast to trip room   │
│  socket.js → rooms, presence, live location   │
└───────┬──────────────┬──────────────┬─────────┘
   MongoDB Atlas   Nominatim/FX    Gemini/Groq
```

**How a live update works:** Riya drags a place → `PUT /api/trips/:id/places/reorder` → server saves → `emitToTrip(tripId, "places:updated")` → every open browser in room `trip:<id>` updates instantly.

---

## Run it on your computer (Windows / Mac)

You need **Node.js (LTS)** and a free **MongoDB Atlas** cluster.

### 1. Backend

```bash
cd server
npm install
copy .env.example .env        # Mac/Linux: cp .env.example .env
```

Open `server/.env` and fill in:

- `MONGO_URI` — your Atlas connection string (Atlas → Connect → Drivers). Make sure your IP is allowed in Atlas → Network Access.
- `JWT_SECRET` — any long random string. Generate one:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `CONTACT_EMAIL` — your email (OpenStreetMap asks for it with place searches)
- *(optional)* `GEMINI_API_KEY` (free at aistudio.google.com) **or** `GROQ_API_KEY` (free at console.groq.com) to turn on the AI planner

```bash
npm run dev
```

You should see `MongoDB connected` and `TripSquad API running on http://localhost:5000`.

### 2. Frontend (a second terminal)

```bash
cd client
npm install
copy .env.example .env        # Mac/Linux: cp .env.example .env
npm run dev
```

Open **http://localhost:5173**.

### 3. Try it with two people

Open a second browser (or an incognito window), sign up as another person, and open the invite link from the **People** tab. Now drag places, vote, add expenses and share location — watch both windows update live.

> **Location on your phone:** browsers only allow location on `https://` or `localhost`. To test on a phone, deploy it (below) or use a tunnel like ngrok.

### Tests

```bash
cd server
npm test
```

**Landing page screenshots** (`client/public/landing/*.jpg`) are real screenshots of the app. To retake them with your own data and real map tiles, start the server and client, then:

```bash
cd client
npm i --no-save playwright && npx playwright install chromium
node scripts/landing-shots.mjs
```

It creates a demo trip (Lisbon, five friends) through the API and saves fresh images.

Tests cover money splitting (no lost paise), the settle-up algorithm (always settles everyone to zero, at most n−1 payments), and AI output validation.

---

## Deploy (free)

1. **Push everything to GitHub.** Run `git add -A && git commit -m "…" && git push` from the project root and check on GitHub that files like `server/src/routes/chat.js` are there. The `.gitignore` keeps `.env` and `node_modules` out.
2. **Backend → Render:** New Web Service → root directory `server` → build `npm install` → start `npm start` → health check path `/api/health`. Environment variables:
   - `MONGO_URI`, `JWT_SECRET` (at least 32 random characters — the server refuses to start in production otherwise)
   - `NODE_ENV=production`
   - `CLIENT_URL` = your Vercel URL, e.g. `https://tripsquad.vercel.app` (comma-separate several; a trailing `/` is fine)
   - `CONTACT_EMAIL` (sent to OpenStreetMap and Wikimedia), and optionally `GEMINI_API_KEY` or `GROQ_API_KEY`
3. **Frontend → Vercel:** New Project → root directory `client` → framework Vite → environment variables `VITE_API_URL` = your Render URL (e.g. `https://tripsquad-api.onrender.com`) and `VITE_CONTACT_EMAIL` (shown on the privacy page). `client/vercel.json` already makes links like `/join/abc` work.
4. **Atlas → Network Access:** allow `0.0.0.0/0` so Render can connect.
5. Open the Vercel URL, sign up, create a trip, and open the invite link in a private window to test with a second account.

Notes:
- Render's free tier sleeps after 15 minutes without traffic, so the first request after that can take ~30–50 seconds.
- Uploaded trip covers are stored in MongoDB (~200–400 KB each), so the free 512 MB Atlas cluster holds well over a thousand.
- Presence and live locations are kept in the server's memory, so run a single instance (the free tier does).

---

## Where to look in the code (learning guide)

| Concept | File |
|---|---|
| Money as integers (paise), fair splitting | `server/src/utils/money.js` |
| Debt simplification algorithm | `server/src/utils/settle.js` |
| Two people editing at the same moment | `server/src/utils/retry.js` (lock + optimistic concurrency) |
| Socket auth, rooms, presence, live location | `server/src/socket.js` |
| Broadcasting changes from REST routes | `server/src/services/realtime.js` |
| Validating AI output + geocoding it | `server/src/services/ai.js`, `server/src/routes/ai.js` |
| Respecting a free API's rate limit (queue + cache) | `server/src/services/geocode.js` |
| Keeping the UI live, re-syncing after reconnect | `client/src/trip/useTrip.js` |
| Opt-in, throttled geolocation | `client/src/trip/useLocationSharing.js` |
| Drag & drop across days, optimistic updates | `client/src/trip/PlanTab.jsx` |
| Chat: channels, DMs, rate limiting, read receipts | `server/src/routes/chat.js`, `server/src/models/Message.js` |
| Unread badges + notifications outside the Chat tab | `client/src/trip/useChat.js` |
| Scroll position, typing indicator, "Seen by" | `client/src/trip/ChatTab.jsx` |
| Privacy: what trip-mates can see | `server/src/models/User.js` (`toTripMate`), `server/src/routes/users.js` |
| Resizing photos in the browser before upload | `client/src/lib/image.js` |
| System messages + activity toasts | `server/src/services/activity.js` |
| Toasts and confirm dialogs (no `alert()`) | `client/src/context/UIContext.jsx` |
| Dark mode with CSS variables | `client/src/styles.css` (`:root[data-theme="dark"]`), `client/src/lib/theme.js` |

## Interview talking points

- **Why store money in paise?** `0.1 + 0.2 !== 0.3` in JavaScript. Integers avoid rounding bugs; `splitEqual` hands out leftover paise so shares always add up exactly.
- **Why save the exchange rate on each expense?** Rates change daily. Old balances must not change when rates move.
- **How does settle-up work?** Compute each person's balance (paid − owed), then greedily match the biggest debtor with the biggest creditor. At most n−1 payments.
- **What if two people edit the same trip at once?** Writes to the same trip are queued per document, and Mongoose optimistic concurrency (`__v`) rejects stale saves across servers, which are retried with fresh data. No change is lost.
- **How do private chats stay private?** A DM channel is `dm:<idA>_<idB>` (sorted ids). The server checks you are one of the two ids *and* both are still trip members, and sends DM events only to those two users' socket rooms (`user:<id>`), never to the whole trip.
- **How do unread counts work without storing "read" on every message?** Each person has one `ChatRead` row per channel with `lastReadAt`. Unread = messages after that time, not sent by you. "Seen by" = people whose `lastReadAt` is after your last message.
- **Why is live location not in the database?** Privacy by design: it's only kept in memory, visible to trip members, and disappears when sharing stops.
- **What if 1,000 people join?** Trips are capped (`MAX_MEMBERS`). To scale to multiple servers, add the Socket.io Redis adapter (or MongoDB change streams) so rooms span instances.

## Ideas for next steps

- Move the in-memory presence/location store to Redis for multi-server deploys
- Photo uploads per place, trip "memories" page
- PWA install + offline itinerary
- Convert to TypeScript
- Playwright end-to-end tests in CI (GitHub Actions)

---

Map data © OpenStreetMap contributors. Please follow the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) — fine for a personal project; for heavy traffic use a paid geocoding/tile provider.
