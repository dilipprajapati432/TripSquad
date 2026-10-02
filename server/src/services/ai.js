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
- Only suggest REAL places that exist in or near ${destination}, with the exact name they have on maps
  (e.g. "Laxman Jhula", not "Rishikesh bridge walk"). Never invent generic names like "Local Market" or "Rest House".
- 2 to 4 places per day. Keep places of the same day close to each other.
- If some wishes don't suit ${destination} (e.g. beaches in the mountains), pick the closest fitting alternatives
  and don't mention what's missing.
- "note" is one short, positive sentence: why go, or a practical tip. Mention rough cost in local currency if relevant.
- Respond with compact JSON only (one line, no code fences, no extra text), in exactly this shape:
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

/** Thrown when the AI's answer was cut off (it ran out of tokens), so we can retry once. */
class CutOffError extends Error {}

async function callGroq(prompt) {
  const res = await fetch(`${env.groqBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.groqKey}` },
    body: JSON.stringify({
      model: env.groqModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 8192,
      // Thinking models spend the token allowance on hidden "thinking" before they answer; with too much of it
      // the plan gets cut off. A plan doesn't need deep thought: Qwen 3 can skip it ("none"), GPT-OSS can't go below "low".
      // "parsed" keeps any Qwen thinking out of the reply text.
      ...(/qwen3/i.test(env.groqModel) && { reasoning_effort: "none", reasoning_format: "parsed" }),
      ...(/gpt-oss/i.test(env.groqModel) && { reasoning_effort: "low" }),
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") {
    console.warn(`AI answer cut off (${env.groqModel}): ${JSON.stringify(data.usage || {})}`);
    throw new CutOffError();
  }
  return choice?.message?.content || "";
}

/** Parse and validate the AI output. Never trust it blindly. */
export function parsePlan(text, maxDays) {
  let json;
  try {
    // Drop any <think>…</think> block first: its text can contain braces that would confuse the match below
    const match = text.replace(/<think>[\s\S]*?<\/think>/gi, "").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found");
    json = JSON.parse(match[0]);
  } catch (err) {
    console.error(`Failed to parse AI output (${text.length} characters): ${text.slice(0, 300)}${text.length > 300 ? "…" : ""}`);
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
  if (env.geminiKey) return parsePlan(await callGemini(prompt), days);
  let text;
  try {
    text = await callGroq(prompt);
  } catch (err) {
    if (!(err instanceof CutOffError)) throw err;
    try {
      // One retry, asking for a shorter answer
      text = await callGroq(`${prompt}\nKeep every note under 12 words and use at most 3 places per day.`);
    } catch (err2) {
      if (err2 instanceof CutOffError) throw new Error("The AI's answer was too long and got cut off. Try again, or ask for a shorter trip.");
      throw err2;
    }
  }
  return parsePlan(text, days);
}
