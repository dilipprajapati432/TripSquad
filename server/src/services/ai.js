import { env } from "../config/env.js";

// Works with either Gemini or Groq — whichever key you put in .env.
// We ask for STRICT JSON so the result can be placed on the map, not just shown as text.

export function aiAvailable() {
  return Boolean(env.geminiKey || env.groqKey);
}

function buildPrompt({ destination, days, request, members }) {
  return `You are a travel planner. Create a day-by-day itinerary.
Destination: ${destination}
Number of days: ${days}
Group size: ${members}
What the group wants: ${request}

Rules:
- Only suggest REAL places that exist in or near ${destination}, with their real, searchable names.
- 2 to 4 places per day. Keep places of the same day close to each other.
- "note" is one short sentence: why go, or a tip. Mention rough cost in local currency if relevant.
- Respond with JSON only, in exactly this shape:
{"days":[{"day":1,"places":[{"name":"Place name","note":"Short tip"}]}]}`;
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
}

async function callGroq(prompt) {
  const res = await fetch(`${env.groqBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.groqKey}` },
    body: JSON.stringify({
      model: env.groqModel,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/** Parse and validate the AI output. Never trust it blindly. */
export function parsePlan(text, maxDays) {
  let json;
  try {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    json = JSON.parse(cleaned);
  } catch {
    throw new Error("The AI returned something unreadable. Please try again.");
  }
  if (!Array.isArray(json?.days)) throw new Error("The AI plan had the wrong format. Please try again.");
  const days = [];
  for (const d of json.days) {
    const day = Math.round(Number(d?.day));
    if (!Number.isFinite(day) || day < 1 || day > maxDays || !Array.isArray(d.places)) continue;
    const places = d.places
      .filter((p) => typeof p?.name === "string" && p.name.trim())
      .slice(0, 5)
      .map((p) => ({ name: p.name.trim().slice(0, 120), note: String(p.note || "").trim().slice(0, 300) }));
    if (places.length) days.push({ day, places });
  }
  if (!days.length) throw new Error("The AI plan was empty. Try describing your trip in more detail.");
  return days;
}

export async function generatePlan({ destination, days, request, members }) {
  const prompt = buildPrompt({ destination, days, request, members });
  const text = env.geminiKey ? await callGemini(prompt) : await callGroq(prompt);
  return parsePlan(text, days);
}
