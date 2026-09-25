import dotenv from "dotenv";

dotenv.config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing ${name} in server/.env (see .env.example)`);
    process.exit(1);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: required("MONGO_URI"),
  jwtSecret: required("JWT_SECRET"),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  maxMembers: Number(process.env.MAX_MEMBERS) || 30,
  contactEmail: process.env.CONTACT_EMAIL || "tripsquad@example.com",
  geocoderUrl: process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org",
  fxApiUrl: process.env.FX_API_URL || "https://open.er-api.com/v6/latest",
  geminiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  groqKey: process.env.GROQ_API_KEY || "",
  groqBaseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
};
