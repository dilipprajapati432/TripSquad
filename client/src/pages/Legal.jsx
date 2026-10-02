import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SiteFooter, SiteHeader } from "../components/Layout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import BackLink from "../components/BackLink.jsx";
import "../landing.css";

const GITHUB_URL = "https://github.com/dilipprajapati432";
const UPDATED = "29 September 2026";
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || "";

function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <a href={GITHUB_URL} target="_blank" rel="noreferrer">the TripSquad GitHub page</a>
  );
}

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Two columns on wide screens: a sticky "On this page" list on the left (it highlights the
 * section you're reading) and the text on the right at a comfortable reading width.
 */
function LegalLayout({ title, eyebrow, intro, children }) {
  const { user, loading } = useAuth();
  const bodyRef = useRef(null);
  const [toc, setToc] = useState([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    document.title = `${title} — TripSquad`;
    const heads = [...(bodyRef.current?.querySelectorAll("h2") || [])];
    for (const h of heads) h.id ||= slug(h.textContent);
    setToc(heads.map((h) => ({ id: h.id, text: h.textContent })));
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" }
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [title]);

  return (
    <div className="legal-page">
      {/* Logged in: the app's own header is shown instead (see App.jsx) */}
      {!user && !loading && <SiteHeader />}
      <header className="legal-hero">
        <div className="legal-wrap">
          <div className="back-row"><BackLink fallback="/" fallbackLabel={user ? "My trips" : "Home"} /></div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {intro && <p className="legal-intro">{intro}</p>}
          <p className="legal-meta">Last updated {UPDATED}</p>
        </div>
      </header>
      <div className="legal-wrap legal-grid">
        <nav className="legal-toc" aria-label="On this page">
          <span className="legal-toc-title">On this page</span>
          <ol>
            {toc.map((t) => (
              <li key={t.id}><a href={`#${t.id}`} className={active === t.id ? "is-active" : ""}>{t.text}</a></li>
            ))}
          </ol>
          <div className="legal-toc-other">
            {title.startsWith("Privacy") ? <Link to="/terms">Terms of use →</Link> : <Link to="/privacy">Privacy policy →</Link>}
          </div>
        </nav>
        <main className="legal" ref={bodyRef}>{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy" eyebrow="Privacy" intro="What TripSquad collects, who can see it, how long we keep it and how to delete it.">
      <div className="legal-summary">
        <strong>The short version</strong>
        <ul>
          <li>We only collect what the app needs to plan a trip with your friends.</li>
          <li>Your live location is shared only with your trip, only while you choose, and is never saved to our database.</li>
          <li>No ads, no analytics trackers, and we never sell your data.</li>
          <li>You can delete your account at any time from <Link to="/profile">your profile</Link>.</li>
        </ul>
      </div>

      <h2>Who we are</h2>
      <p>TripSquad is a group trip planner: a shared itinerary, chat and expense splitting for friends travelling together. For any privacy question or request, contact us through <Contact />.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> your name, email address and password. The password is stored only as a secure hash (bcrypt); we can't read it.</li>
        <li><strong>Profile (optional):</strong> photo, short bio, home city, languages, food preference, phone number, emergency contact and how friends can pay you back. You choose whether your phone, emergency contact and payment details are visible to your trip members or only to you.</li>
        <li><strong>Trip content:</strong> trips, places, notes, chat messages, polls and votes, expenses and payments you add. People in the same trip can see this content.</li>
        <li><strong>Live location:</strong> only while you have location sharing turned on in a trip (see below).</li>
        <li><strong>Photos you upload:</strong> a profile photo and, if you own a trip, a cover photo.</li>
      </ul>

      <h2>Live location</h2>
      <ul>
        <li>Location sharing is off until you turn it on in a trip, and your browser or phone asks for your permission first.</li>
        <li>Your position is sent only to the people in that trip.</li>
        <li>It stops when you tap Stop, close the app or tab, leave the trip or are removed from it, and it turns itself off after 1 hour.</li>
        <li>Your location is <strong>never written to our database</strong>. The server keeps only your latest position in memory so friends who open the trip can see it, and forgets it after 10 minutes without an update or when the server restarts.</li>
      </ul>

      <h2>Photos</h2>
      <ul>
        <li>Photos are resized in your browser before upload (profile photos to 256 and 64 pixels, cover photos to banner size). Re-drawing the image also removes hidden data such as the GPS location your camera may have saved.</li>
        <li>Your profile photo is shown to people who share a trip with you. A trip cover is visible to anyone who has the cover's link, which is long and random.</li>
        <li>Suggested cover and place photos come from Wikipedia and Wikivoyage. We store only the link and the author credit, not the photo.</li>
      </ul>

      <h2>How long we keep data</h2>
      <div className="legal-table">
        <table>
          <thead><tr><th>Data</th><th>Kept until</th></tr></thead>
          <tbody>
            <tr><td>Live location</td><td>In memory only: at most 10 minutes after your last update. Never saved.</td></tr>
            <tr><td>Account and profile</td><td>You delete your account.</td></tr>
            <tr><td>Profile photo</td><td>You remove or replace it, or delete your account.</td></tr>
            <tr><td>Uploaded trip cover</td><td>The owner replaces or removes it, or deletes the trip.</td></tr>
            <tr><td>Trip content (plan, chat, polls, expenses)</td><td>The trip owner deletes the trip.</td></tr>
            <tr><td>Your login on this device</td><td>A login token stored in your browser for 7 days, or until you log out.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Deleting your account</h2>
      <p>Go to <Link to="/profile">My profile</Link> and choose <strong>Delete my account</strong>. We then:</p>
      <ul>
        <li>delete your name, email, password, photo, bio, contact details and your private messages;</li>
        <li>delete trips where you are the only member;</li>
        <li>remove you from shared trips (if you owned one, the longest-standing member becomes the owner).</li>
      </ul>
      <p>Group-chat messages and expenses you added stay in your friends' trips, shown as "Deleted user", so their shared history and balances stay correct. If you still owe or are owed money in a shared trip, you'll be asked to settle up first.</p>

      <h2>Services we use</h2>
      <p>To run TripSquad we send the minimum needed to these services:</p>
      <ul>
        <li><strong>OpenStreetMap</strong> (map images) and <strong>Nominatim</strong> (place search): the map area you view and the place names you search.</li>
        <li><strong>Open-Meteo</strong> (weather): the trip's destination coordinates and dates.</li>
        <li><strong>ExchangeRate-API</strong> (open.er-api.com): currency codes, when an expense is in another currency.</li>
        <li><strong>Wikipedia and Wikivoyage</strong>: destination and place names, to find photos.</li>
        <li><strong>AI provider</strong> (Google Gemini or Groq), only when you use the AI planner: the destination, trip length and the request you type.</li>
        <li><strong>Hosting</strong> (for example Vercel, Render and MongoDB Atlas): they store and serve the app and its data, and may keep standard server logs such as IP addresses for a short time.</li>
      </ul>

      <h2>Cookies and tracking</h2>
      <p>TripSquad doesn't use advertising or analytics cookies. We store your login token and a few settings (such as dark mode) in your browser's local storage so you stay logged in.</p>

      <h2>Security</h2>
      <p>All traffic is encrypted with HTTPS. Only trip members can open a trip's content, and requests are rate-limited to stop abuse. No system is perfectly secure, so please use a password you don't use elsewhere.</p>

      <h2>Children</h2>
      <p>TripSquad is not meant for children under 13, and we don't knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>If we change this policy we'll update the date at the top. For important changes we'll also tell you in the app.</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of use" eyebrow="Terms" intro="By creating an account or using TripSquad you agree to these terms. They're short on purpose.">

      <h2>Using TripSquad</h2>
      <ul>
        <li>TripSquad is free to use. You need to be at least 13 years old.</li>
        <li>Keep your password safe. You're responsible for what happens in your account.</li>
        <li>Give accurate information, especially your name, so your friends know who you are.</li>
      </ul>

      <h2>Your content</h2>
      <ul>
        <li>You own what you add: messages, photos, plans and expenses. You allow us to store and show it to the people in your trips, which is how the app works.</li>
        <li>Only upload photos you have the right to share.</li>
        <li>Don't use TripSquad to harass people, share illegal content, send spam or try to break or overload the service. We may remove content or accounts that do.</li>
      </ul>

      <h2>Money and bookings</h2>
      <ul>
        <li>TripSquad helps you <strong>track</strong> shared costs. It doesn't move money, hold money or process payments. Payments between friends happen outside the app.</li>
        <li>Exchange rates, weather, photos and AI suggestions come from third-party services and can be wrong or out of date. Check important details (opening times, bookings, prices) yourself.</li>
      </ul>

      <h2>Location</h2>
      <p>Location sharing is optional and approximate. Don't rely on it for safety or emergencies.</p>

      <h2>No warranty</h2>
      <p>TripSquad is provided "as is". We work to keep it running and your data safe, but we can't promise it will always be available or error-free. As far as the law allows, we're not liable for indirect losses from using the app.</p>

      <h2>Ending your account</h2>
      <p>You can delete your account at any time from <Link to="/profile">your profile</Link>. See the <Link to="/privacy">privacy policy</Link> for what happens to your data.</p>

      <h2>Changes</h2>
      <p>We may update these terms. If the changes are important we'll tell you in the app. Questions? Contact us through <Contact />.</p>
    </LegalLayout>
  );
}
