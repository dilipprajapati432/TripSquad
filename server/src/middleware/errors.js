import mongoose from "mongoose";

/** Throw this anywhere in a route: throw new HttpError(404, "Trip not found") */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(_req, _res, next) {
  next(new HttpError(404, "Route not found"));
}

// Express 5 automatically sends errors from async route handlers here.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ error: first?.message || "Invalid data" });
  }
  if (err instanceof mongoose.Error.VersionError) {
    return res.status(409).json({ error: "Someone else changed this at the same moment. Please try again." });
  }
  if (err?.code === 11000) return res.status(409).json({ error: "That already exists (for example, an account with this email)." });
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ error: "Invalid id" });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "That file is too large." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
}
