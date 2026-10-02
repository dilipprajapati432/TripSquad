import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { requireAuth } from "./middleware/auth.js";
import { loadTrip } from "./middleware/trip.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import authRoutes from "./routes/auth.js";
import tripRoutes from "./routes/trips.js";
import placeRoutes from "./routes/places.js";
import pollRoutes from "./routes/polls.js";
import expenseRoutes from "./routes/expenses.js";
import aiRoutes from "./routes/ai.js";
import miscRoutes from "./routes/misc.js";
import userRoutes from "./routes/users.js";
import chatRoutes from "./routes/chat.js";
import coverRoutes, { serveCoverImage } from "./routes/cover.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // needed on Render so rate limiting sees real IPs
  app.use(helmet());
  app.use(cors({ origin: env.clientUrls }));
  // Profile photos are sent as small data URLs. The reviver drops "toString"/"valueOf" keys, so a body like
  // {"name":{"toString":1}} can't make String(value) throw (it would otherwise be a 500).
  app.use(express.json({ limit: "400kb", reviver: (key, value) => (key === "toString" || key === "valueOf" ? undefined : value) }));

  // Only login / sign-up attempts count, not GET /auth/me (which runs on every page load)
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, skip: (req) => req.method === "GET", message: { error: "Too many attempts. Try again in 15 minutes." } });
  const aiLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, message: { error: "AI limit reached. Try again later." } });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/covers/:key", serveCoverImage); // public: <img> tags can't send the login token
  app.use("/api/auth", authLimiter, authRoutes);
  // Place search goes to a shared, 1-request-per-second geocoder: limit each person
  const utilLimiter = rateLimit({ windowMs: 60 * 1000, limit: 40, keyGenerator: (req) => String(req.user._id), message: { error: "Too many searches. Wait a moment." } });
  app.use("/api/util", requireAuth, utilLimiter, miscRoutes);
  app.use("/api/users", requireAuth, userRoutes);
  app.use("/api/trips", requireAuth); // everything under /api/trips needs login
  app.use("/api/trips/:tripId/places", loadTrip, placeRoutes);
  app.use("/api/trips/:tripId/polls", loadTrip, pollRoutes);
  app.use("/api/trips/:tripId/expenses", loadTrip, expenseRoutes);
  app.use("/api/trips/:tripId/ai", aiLimiter, loadTrip, aiRoutes);
  app.use("/api/trips/:tripId/chat", loadTrip, chatRoutes);
  app.use("/api/trips/:tripId/cover", loadTrip, coverRoutes);
  app.use("/api/trips", tripRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
