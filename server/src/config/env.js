import dotenv from "dotenv";

dotenv.config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in server/.env (see .env.example)`);
    process.exit(1);
  }
  return value;
}

// "https://tripsquad.vercel.app/" and "https://tripsquad.vercel.app" must both work: browsers send the
// Origin without a trailing slash, and one extra "/" silently breaks CORS. Comma-separate several URLs.
const clientUrls = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((u) => u.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32 || jwtSecret.startsWith("change-me")) {
  const msg = "JWT_SECRET is too weak. Use a long random string (see server/.env.example).";
  if (process.env.NODE_ENV === "production") {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`Warning: ${msg}`);
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: required("MONGO_URI"),
  jwtSecret,
  clientUrls,
  maxMembers: Number(process.env.MAX_MEMBERS) || 30,
  contactEmail: process.env.CONTACT_EMAIL || "tripsquad@example.com",
  geocoderUrl: process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org",
  fxApiUrl: process.env.FX_API_URL || "https://open.er-api.com/v6/latest",
  weatherUrl: process.env.WEATHER_API_URL || "https://api.open-meteo.com/v1/forecast",
  wikivoyageApi: process.env.WIKIVOYAGE_API_URL || "https://en.wikivoyage.org/w/api.php",
  wikipediaApi: process.env.WIKIPEDIA_API_URL || "https://en.wikipedia.org/w/api.php",
  geminiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  groqKey: process.env.GROQ_API_KEY || "",
  groqBaseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
};
