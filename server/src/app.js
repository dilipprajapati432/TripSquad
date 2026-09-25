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

export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // needed on Render so rate limiting sees real IPs
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl }));
  app.use(express.json({ limit: "100kb" }));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { error: "Too many attempts. Try again in 15 minutes." } });
  const aiLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, message: { error: "AI limit reached. Try again later." } });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/util", requireAuth, miscRoutes);
  app.use("/api/trips", requireAuth); // everything under /api/trips needs login
  app.use("/api/trips/:tripId/places", loadTrip, placeRoutes);
  app.use("/api/trips/:tripId/polls", loadTrip, pollRoutes);
  app.use("/api/trips/:tripId/expenses", loadTrip, expenseRoutes);
  app.use("/api/trips/:tripId/ai", aiLimiter, loadTrip, aiRoutes);
  app.use("/api/trips", tripRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
