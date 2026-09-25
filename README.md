# 📍 TripSquad

**Plan trips together, live.** A real-time group travel web app: a shared itinerary on a map, live polls, live location sharing, multi-currency expense splitting with smart settle-up, and an AI trip planner.

Built with the MERN stack + Socket.io + Leaflet.

---

## Features

| Feature | What it does |
|---|---|
| 🧳 **Trips & invites** | Create a trip, share an invite link (or WhatsApp), friends join in one tap. Max 30 people per trip. |
| 🗺️ **Shared itinerary** | Search real places (OpenStreetMap), pin them on the map, organise by day, **drag & drop** to reorder or move between days. Each day has its own color and route line. |
| ⚡ **Real-time** | Every change (places, polls, expenses, members) appears instantly for everyone. Shows who's online. Reconnects and re-syncs automatically. |
| 📍 **Live location** | Opt-in. Friends see you on the map while your page is open. Throttled, auto-stops after 1 hour, **never stored in the database**. |
| 🗳️ **Polls** | "Scuba or boat party?" — live vote bars, one vote per person, close to pick a winner. |
| 💸 **Expenses** | Split equally or by exact amounts, in **any currency** (INR, AED, EUR, USD…). The exchange rate is saved with each expense. |
| 🤝 **Smart settle-up** | A debt-simplification algorithm turns everyone's balances into the **fewest payments**. Mark payments as paid. |
| 💰 **Budgets** | Set a personal budget and track your share of spending. |
| ✨ **AI planner** | "3 days, beaches + seafood" → a day-by-day plan with every place **found on the real map**. Places the AI invented are flagged, not added. |
| 📱 **Mobile-friendly** | Works in the phone browser during the trip. |

---

## Tech stack

- **Frontend:** React (Vite), React Router, Leaflet + react-leaflet, dnd-kit, socket.io-client
- **Backend:** Node.js, Express 5, Socket.io, Mongoose
- **Database:** MongoDB Atlas
- **Free external APIs:** OpenStreetMap Nominatim (place search), open.er-api.com (exchange rates), Gemini or Groq (AI)
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

You should see `✅ MongoDB connected` and `🚀 TripSquad API running on http://localhost:5000`.

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

Tests cover money splitting (no lost paise), the settle-up algorithm (always settles everyone to zero, at most n−1 payments), and AI output validation.

---

## Deploy (free)

1. Push to GitHub (the `.gitignore` keeps `.env` and `node_modules` out).
2. **Backend → Render:** New Web Service → root directory `server` → build `npm install` → start `npm start`. Add all variables from `.env`, with `CLIENT_URL` set to your Vercel URL.
3. **Frontend → Vercel:** New Project → root directory `client` → add `VITE_API_URL` = your Render URL. (`client/vercel.json` already makes links like `/join/abc` work.)
4. In Atlas → Network Access, allow `0.0.0.0/0` so Render can connect.

Render's free tier sleeps after inactivity, so the first request can take ~30 seconds.

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

## Interview talking points

- **Why store money in paise?** `0.1 + 0.2 !== 0.3` in JavaScript. Integers avoid rounding bugs; `splitEqual` hands out leftover paise so shares always add up exactly.
- **Why save the exchange rate on each expense?** Rates change daily. Old balances must not change when rates move.
- **How does settle-up work?** Compute each person's balance (paid − owed), then greedily match the biggest debtor with the biggest creditor. At most n−1 payments.
- **What if two people edit the same trip at once?** Writes to the same trip are queued per document, and Mongoose optimistic concurrency (`__v`) rejects stale saves across servers, which are retried with fresh data. No change is lost.
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
