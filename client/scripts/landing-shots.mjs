/**
 * Takes the screenshots used on the landing page (client/public/landing/*.jpg) from the real app.
 *
 * It creates a demo trip with five friends through the API, then opens each tab in a browser.
 * Run it with the server (npm run dev in /server) and the client (npm run dev in /client) running:
 *
 *   cd client
 *   npm i --no-save playwright && npx playwright install chromium
 *   node scripts/landing-shots.mjs
 *
 * Options (environment variables):
 *   API_URL   default http://localhost:5000      APP_URL  default http://localhost:5173
 *   CHROMIUM  path to a Chromium binary (optional)
 *   NO_TILES=1  replace map tiles with a plain background (for machines that can't reach OpenStreetMap)
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { io } from "socket.io-client";

const API_BASE = (process.env.API_URL || "http://localhost:5000").replace(/\/+$/, "");
const API = `${API_BASE}/api`;
const APP = (process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, "");
const OUT = fileURLToPath(new URL("../public/landing/", import.meta.url));
mkdirSync(OUT, { recursive: true });

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(body && { "Content-Type": "application/json" }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${data.error || res.status}`);
  return data;
}

// ----- Demo data: a long weekend in Lisbon -----
const stamp = Date.now();
const people = ["Dilip Prajapati", "Riya Shah", "Aman Verma", "Sara Lopes", "Leo Martin"];
const users = [];
for (const [i, name] of people.entries()) {
  const u = await call("POST", "/auth/register", null, { name, email: `demo${stamp}-${i}@tripsquad.test`, password: "demo-password-123" });
  await call("PATCH", "/users/me", u.token, { onboarded: true, homeCity: ["Ahmedabad", "Mumbai", "Delhi", "Lisbon", "Paris"][i], phone: "+351 912 345 678", emergencyName: "Family", emergencyPhone: "+351 911 111 111" });
  users.push(u);
}
const [me, riya, aman, sara, leo] = users;
const start = new Date(Date.now() + 18 * 864e5);
const day = (n) => new Date(start.getTime() + n * 864e5).toISOString().slice(0, 10);
const { trip } = await call("POST", "/trips", me.token, { name: "Lisbon long weekend", destination: "Lisbon, Portugal", startDate: day(0), endDate: day(2), currency: "EUR", theme: 3 });
for (const u of users.slice(1)) await call("POST", `/trips/join/${trip.inviteCode}`, u.token, {});
const T = `/trips/${trip.id}`;

const places = [
  [1, "Belém Tower", 38.6916, -9.216, "Go early, the queue grows fast"],
  [1, "Jerónimos Monastery", 38.6979, -9.2068, ""],
  [1, "Pastéis de Belém", 38.6975, -9.2032, "Custard tarts!"],
  [1, "LX Factory", 38.7033, -9.1789, ""],
  [2, "São Jorge Castle", 38.7139, -9.1335, "Tickets booked for 10:00"],
  [2, "Alfama walk", 38.7114, -9.13, ""],
  [2, "Time Out Market", 38.7071, -9.1459, "Lunch"],
  [2, "Miradouro da Senhora do Monte", 38.719, -9.1328, "Sunset"],
  [3, "Pena Palace, Sintra", 38.7876, -9.3906, "Train from Rossio 09:11"],
  [3, "Cabo da Roca", 38.7804, -9.4989, ""],
];
for (const [d, name, lat, lng, note] of places) {
  await call("POST", `${T}/places`, me.token, { name, lat, lng, day: d, note });
}

const ids = users.map((u) => u.user.id);
const expense = (by, description, amount, category, extra = {}) =>
  call("POST", `${T}/expenses`, by.token, { description, amount, category, participants: ids, ...extra });
await expense(me, "Airbnb in Alfama (3 nights)", 540, "stay");
await expense(riya, "Dinner at Taberna da Rua", 142.5, "food");
await expense(aman, "Train to Sintra", 23.5, "transport");
await expense(sara, "Castle tickets", 75, "activity");
await expense(leo, "Airport taxi", 38, "transport");
await expense(riya, "Groceries", 46.2, "food", { participants: [ids[0], ids[1], ids[3]] });
await expense(aman, "Fado show", 90, "activity", { currency: "USD", rate: 0.92 });

const poll = (await call("POST", `${T}/polls`, sara.token, { question: "Saturday night?", options: ["Fado show in Alfama", "Rooftop bar in Bairro Alto", "Early night, Sintra trip next day"] })).poll;
for (const [u, o] of [[me, 0], [riya, 0], [aman, 1], [sara, 0], [leo, 1]]) await call("POST", `${T}/polls/${poll.id}/vote`, u.token, { option: o });
const poll2 = (await call("POST", `${T}/polls`, leo.token, { question: "Rent a car for Sintra?", options: ["Yes", "No, train is fine"] })).poll;
for (const [u, o] of [[me, 1], [aman, 1], [leo, 0]]) await call("POST", `${T}/polls/${poll2.id}/vote`, u.token, { option: o });

const say = (u, text, channel = "group") => call("POST", `${T}/chat/${channel}/messages`, u.token, { text });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [u, text] of [
  [riya, "Landed! Taking the metro to Alfama 🚇"],
  [aman, "I'm 20 min behind you, save me a pastel de nata"],
  [sara, "Welcome to my city 😄 Dinner tonight at Taberna da Rua, I booked for 8"],
  [leo, "Perfect. Who's up for the castle tomorrow morning?"],
  [me, "Me! I added it to Day 2 with the tickets"],
  [riya, "Voted on the Saturday poll, fado it is 🎶"],
]) {
  await say(u, text);
  await wait(400); // keeps the messages in order
}
const dm = `dm:${[ids[0], ids[1]].sort().join("_")}`;
await say(riya, "Can you send me the Airbnb door code?", dm);

// Friends sharing live location (kept in memory only, like the real app)
const spots = [[riya, 38.7117, -9.1302], [aman, 38.7071, -9.1455], [sara, 38.7139, -9.1339]];
const sockets = [];
for (const [u, lat, lng] of spots) {
  const s = io(API_BASE, { auth: { token: u.token }, transports: ["websocket"] });
  await new Promise((resolve) => s.on("connect", resolve));
  await new Promise((resolve) => s.emit("trip:join", { tripId: trip.id }, resolve));
  s.emit("location:update", { tripId: trip.id, lat, lng, accuracy: 12 });
  sockets.push(s);
}

// ----- Screenshots -----
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
async function open({ width = 1440, height = 900, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, colorScheme: "light" });
  await ctx.addInitScript((t) => { localStorage.setItem("tripsquad_token", t); localStorage.setItem("tripsquad_theme", "light"); }, me.token);
  if (process.env.NO_TILES) {
    const tile = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN48+E1AAWTAsgl2lqnAAAAAElFTkSuQmCC", "base64");
    await ctx.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ contentType: "image/png", body: tile }));
  }
  return ctx.newPage();
}
/** Screenshot of just the tab content (below the tab bar), so each feature image shows one thing. */
async function shotTab(p, name, height = 760, width) {
  const tabs = await p.locator(".tabs").boundingBox();
  const vw = p.viewportSize().width;
  await shot(p, name, { x: 0, y: tabs.y + tabs.height + 4, width: width || vw, height });
}
const shot = (p, name, clip) => p.screenshot({ path: `${OUT}${name}.jpg`, type: "jpeg", quality: 82, ...(clip && { clip }) });

const p = await open({ height: 1400 });
await p.goto(`${APP}${T}`);
await p.waitForSelector(".trip-hero");
await p.waitForSelector(".live-person", { timeout: 8000 }).catch(() => {});
await p.locator(".chip, button", { hasText: /^Day 2$/ }).first().click().catch(() => {}); // compact map
await p.waitForTimeout(2500); // map tiles and photos
await shot(p, "trip", { x: 0, y: 0, width: 1440, height: 900 });
await shotTab(p, "plan", 700);
{
  // Live location: the "Live" strip and the map with friends on it
  await p.locator("button", { hasText: "Show everyone" }).first().click().catch(() => {});
  await p.waitForTimeout(1500);
  const bar = await p.locator(".live-bar").boundingBox(), map = await p.locator(".map").boundingBox();
  await shot(p, "live", { x: map.x, y: bar.y, width: map.width, height: map.y + map.height - bar.y });
}

// The chat fills the window, so use a normal-height window for it
const c = await open({ height: 900 });
await c.goto(`${APP}${T}?tab=chat`);
await c.waitForSelector(".bubble", { timeout: 8000 }).catch(() => {});
await c.waitForTimeout(1500);
const tabsBox = await c.locator(".tabs").boundingBox();
await c.evaluate((y) => window.scrollTo(0, y), tabsBox.y + tabsBox.height + 4);
await c.waitForTimeout(600);
await shot(c, "chat");

await p.goto(`${APP}${T}?tab=money`);
await p.waitForSelector(".stat-grid");
await p.waitForTimeout(1200);
await shotTab(p, "money", 640);

await p.goto(`${APP}${T}?tab=polls`);
await p.waitForSelector(".poll");
await p.waitForTimeout(1200);
{
  const polls = p.locator(".poll");
  const a = await polls.first().boundingBox(), b = await polls.last().boundingBox();
  const top = Math.min(a.y, b.y) - 12, bottom = Math.max(a.y + a.height, b.y + b.height) + 12;
  await shot(p, "polls", { x: a.x - 12, y: top, width: a.width + 24, height: bottom - top });
}

await p.goto(`${APP}${T}`);
await p.waitForSelector(".trip-hero");
await p.waitForTimeout(1500);
const ai = p.locator("button", { hasText: "AI plan" }).first();
if (await ai.count()) {
  await ai.click();
  await p.waitForSelector(".modal");
  await p.locator(".modal textarea, .modal input").first().fill("3 days in Lisbon: old town, food markets, a day trip to Sintra, not too rushed");
  await p.waitForTimeout(400);
  const box = await p.locator(".modal").boundingBox();
  await shot(p, "ai", { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: box.height + 48 });
}

// Phone view of the trip, for the hero
const m = await open({ width: 390, height: 844, mobile: true });
await m.goto(`${APP}${T}`);
await m.waitForSelector(".trip-hero");
await m.waitForTimeout(2500);
await shot(m, "phone");

for (const s of sockets) s.disconnect();
await browser.close();
console.log(`Saved screenshots to ${OUT}`);
