import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Check, ChevronDown, Coins, FileSpreadsheet, Link2, Map as MapIcon, MapPinned, MessageCircle,
  MessageSquare, Radio, Sparkles, Vote, Wallet,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/SiteChrome.jsx";
import SettleDemo from "../components/SettleDemo.jsx";
import "../landing.css";

/** Screenshot in a light browser frame. Images are real screenshots of the app (client/scripts/landing-shots.mjs). */
function Shot({ src, alt, width, height, className = "", eager = false }) {
  return (
    <figure className={`shot ${className}`}>
      <div className="shot-bar" aria-hidden="true"><span /><span /><span /></div>
      <img src={src} alt={alt} width={width} height={height} loading={eager ? "eager" : "lazy"} decoding="async" />
    </figure>
  );
}

const FEATURES = [
  {
    id: "plan",
    icon: MapIcon,
    tint: "tint-teal",
    title: "One itinerary, on one shared map",
    text: "Search a place and drop it on a day. Drag to reorder, move ideas between days, add notes and see the route for each day on the map. When anyone changes the plan, everyone sees it right away.",
    points: ["Day-by-day plan with drag and drop", "Weather forecast for each day", "Photos for every place, found automatically"],
    img: ["/landing/plan.jpg", 2880, 1400, "The Plan tab: places for day 2 in Lisbon on the left, the route on the map on the right"],
  },
  {
    id: "chat",
    icon: MessageSquare,
    tint: "tint-blue",
    title: "Group chat and private chats, inside the trip",
    text: "Talk to the whole group or message one person. Share a place from the plan, see who's typing and who has read your message. Trip updates like new expenses and polls show up in the chat too.",
    points: ["Group and one-to-one chats", "Read receipts and typing indicator", "Share places and your location"],
    img: ["/landing/chat.jpg", 2880, 1800, "The Chat tab with the group conversation and a list of private chats"],
  },
  {
    id: "money",
    icon: Wallet,
    tint: "tint-amber",
    title: "Split expenses across currencies",
    text: "Add who paid and who it's for — split equally or by exact amounts. Pay in dollars on a euro trip and the exchange rate is saved with the expense, so totals never change later. TripSquad works out the fewest payments to settle up.",
    points: ["Equal or exact splits", "10 currencies, rate saved per expense", "Personal budget and category totals"],
    img: ["/landing/money.jpg", 2880, 1280, "The Money tab: group total, your balance, suggested payments and the list of expenses"],
  },
];

const SMALL_FEATURES = [
  { icon: Vote, tint: "tint-violet", title: "Polls", text: "Can't agree on dinner? Start a poll and see the votes come in live.", img: ["/landing/polls.jpg", 1568, 1094, "Two polls with live results"], fit: "top" },
  { icon: Radio, tint: "tint-green", title: "Live location", text: "Find each other in a crowded old town. Share only when you want, with your trip only.", img: ["/landing/live.jpg", 1864, 1954, "Friends sharing live location on the trip map"], fit: "center 40%" },
  { icon: Sparkles, tint: "tint-pink", title: "AI trip planner", text: "Describe what your group likes and get a first draft of the plan, with every place checked on the real map.", img: ["/landing/ai.jpg", 1456, 756, "The AI trip planner asking what the group wants from the trip"], fit: "contain" },
];

const STEPS = [
  { icon: MapPinned, title: "Create a trip", text: "Pick a destination and dates. We find a cover photo and the weather for you." },
  { icon: Link2, title: "Share the invite link", text: "Send it in any chat. Friends join in one tap and see everything straight away." },
  { icon: Coins, title: "Plan, chat and split together", text: "Build the days, vote on plans, add expenses and settle up with the fewest payments." },
];

const FAQ = [
  ["Is TripSquad free?", "Yes. Every feature is free, with no ads and no limit on trips or friends."],
  [
    "Who can see my location?",
    "Only the people in that trip, and only while you're sharing. You choose when to start. It stops when you tap Stop, close the tab or leave the trip, and turns itself off after an hour. Live location is never saved to our database: the server keeps your last position in memory and forgets it after 10 minutes without an update.",
  ],
  [
    "Do my friends need an account?",
    "Yes, a free one — it takes less than a minute. It's how the group knows who paid for what and who is who in the chat. Friends open your invite link, sign up and land straight in the trip.",
  ],
  ["Which currencies can we use?", "The trip has one main currency, and each expense can be in any of the 10 supported currencies (EUR, USD, GBP, INR, AED and more). The exchange rate is fetched when you add the expense (or you can type your own) and saved with it."],
  ["Can I delete my data?", "Yes. You can delete your account at any time from your profile. See the privacy policy for exactly what is kept and for how long."],
];

export default function Landing() {
  useEffect(() => {
    document.title = "TripSquad — group trip planner and expense splitter";
  }, []);

  return (
    <div className="landing">
      <SiteHeader sections />

      {/* ---------- Hero ---------- */}
      <section className="l-hero">
        <div className="l-wrap l-hero-grid">
          <div className="l-hero-copy">
            <span className="eyebrow">Group trip planner</span>
            <h1>Plan the trip together. <span className="text-brand">Split the bill fairly.</span></h1>
            <p className="l-lead">TripSquad puts your group's itinerary, chat and shared expenses in one place, on a live map everyone can edit at the same time.</p>
            <div className="l-cta-row">
              <Link to="/register" className="btn btn-primary btn-lg">Plan a trip — free <ArrowRight size={18} /></Link>
              <a href="#how" className="btn btn-secondary btn-lg">How it works</a>
            </div>
            <ul className="l-trust">
              <li><Check size={15} /> Free, no ads</li>
              <li><Check size={15} /> Phone and desktop</li>
              <li><Check size={15} /> Updates in real time</li>
            </ul>
          </div>
          <div className="l-hero-visual">
            <Shot src="/landing/trip.jpg" alt="A TripSquad trip to Lisbon: cover photo, trip stats, the day plan and the shared map" width={2880} height={1800} eager />
            <img className="l-phone" src="/landing/phone.jpg" alt="The same trip on a phone" width={780} height={1688} loading="eager" decoding="async" />
          </div>
        </div>
      </section>

      {/* ---------- Problem ---------- */}
      <section className="l-section l-problem">
        <div className="l-wrap">
          <h2 className="l-quote">Plans in WhatsApp, money in a spreadsheet, <em>the map in someone's head.</em></h2>
          <div className="l-problem-grid">
            <div className="l-problem-card">
              <span className="stat-icon l-icon tint-blue"><MessageCircle size={21} /></span>
              <h4>The plan gets lost</h4>
              <p>The hotel link, the dinner booking and the train time are buried somewhere in 400 messages.</p>
            </div>
            <div className="l-problem-card">
              <span className="stat-icon l-icon tint-amber"><FileSpreadsheet size={21} /></span>
              <h4>Nobody trusts the spreadsheet</h4>
              <p>One person tracks the money, forgets the taxi, and everyone ends up sending money back and forth.</p>
            </div>
            <div className="l-problem-card">
              <span className="stat-icon l-icon tint-teal"><MapIcon size={21} /></span>
              <h4>Only one person knows the route</h4>
              <p>Everyone else keeps asking "where are we going next?" and "where are you?".</p>
            </div>
          </div>
          <p className="l-problem-answer"><Check size={18} /> TripSquad keeps all three in one shared trip, and every change reaches everyone instantly.</p>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="l-section" id="features">
        <div className="l-wrap">
          <div className="l-head">
            <span className="eyebrow">Features</span>
            <h2>Everything the group needs, in one trip</h2>
            <p>Plan, talk and split costs in the same place, so nothing gets lost between apps.</p>
          </div>
          <div className="l-features">
            {FEATURES.map((f, i) => (
              <article key={f.id} className={`l-feature ${i % 2 ? "is-flipped" : ""}`}>
                <div className="l-feature-copy">
                  <span className={`stat-icon l-icon ${f.tint}`}><f.icon size={21} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                  <ul className="l-points">
                    {f.points.map((pt) => <li key={pt}><Check size={16} /> {pt}</li>)}
                  </ul>
                </div>
                <Shot src={f.img[0]} width={f.img[1]} height={f.img[2]} alt={f.img[3]} />
              </article>
            ))}
          </div>
          <div className="l-small-grid">
            {SMALL_FEATURES.map((f) => (
              <article key={f.title} className="l-small">
                <div className="l-small-img"><img src={f.img[0]} width={f.img[1]} height={f.img[2]} alt={f.img[3]} loading="lazy" decoding="async" style={f.fit === "contain" ? { objectFit: "contain", padding: "4%" } : { objectPosition: f.fit }} /></div>
                <div className="l-small-body">
                  <span className={`stat-icon l-icon ${f.tint}`}><f.icon size={21} /></span>
                  <h4>{f.title}</h4>
                  <p>{f.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="l-section l-how" id="how">
        <div className="l-wrap">
          <div className="l-head">
            <span className="eyebrow">How it works</span>
            <h2>From idea to itinerary in three steps</h2>
            <p>No setup, no spreadsheets. Your friends only need the link.</p>
          </div>
          <ol className="l-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="l-step">
                <span className="l-step-num">{i + 1}</span>
                <span className="stat-icon l-icon tint-teal"><s.icon size={21} /></span>
                <h4>{s.title}</h4>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Settle-up highlight ---------- */}
      <section className="l-section">
        <div className="l-wrap l-settle">
          <div className="l-settle-copy">
            <span className="eyebrow">Settle up</span>
            <h2>6 debts become <em>2 payments</em></h2>
            <p>Four friends, a weekend of shared bills. Paying back every debt means six transfers. TripSquad nets out everyone's balance first, then matches the person who owes the most with the person who is owed the most, again and again.</p>
            <ul className="l-points">
              <li><Check size={16} /> At most n − 1 payments for a group of n people</li>
              <li><Check size={16} /> Exact to the cent: money is stored in whole cents, never rounded twice</li>
              <li><Check size={16} /> Mark a payment as paid and balances update for everyone</li>
            </ul>
          </div>
          <SettleDemo />
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="l-section l-faq" id="faq">
        <div className="l-wrap l-faq-wrap">
          <div className="l-head">
            <span className="eyebrow">FAQ</span>
            <h2>Questions friends usually ask</h2>
          </div>
          <div className="l-faq-list">
            {FAQ.map(([q, a]) => (
              <details key={q} className="l-faq-item">
                <summary>{q}<ChevronDown size={18} className="l-faq-chev" /></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="l-section">
        <div className="l-wrap">
          <div className="l-final">
            <h2>Your next trip starts with one link.</h2>
            <p>Create the trip, send the invite, and plan it together from today.</p>
            <Link to="/register" className="btn btn-lg l-final-btn">Plan a trip — free <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
