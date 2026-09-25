import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (name.length < 2) throw new HttpError(400, "Name must be at least 2 characters");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Please enter a valid email");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (await User.exists({ email })) throw new HttpError(409, "An account with this email already exists");

  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: signToken(user._id), user: user.toPublic() });
});

router.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = await User.findOne({ email });
  // Same message for wrong email or wrong password, so attackers can't find valid emails
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "Wrong email or password");
  }
  res.json({ token: signToken(user._id), user: user.toPublic() });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

export default router;
