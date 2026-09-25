import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { HttpError } from "./errors.js";

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: "7d" });
}

/** Returns the user id from a token, or null if the token is invalid/expired. */
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret).sub;
  } catch {
    return null;
  }
}

/** Express middleware: requires "Authorization: Bearer <token>" and sets req.user. */
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const userId = token && verifyToken(token);
  if (!userId) throw new HttpError(401, "Please log in again");
  const user = await User.findById(userId);
  if (!user) throw new HttpError(401, "Account not found");
  req.user = user;
  next();
}
