import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { validate } from "../middleware/validate";
import { User } from "../models/User";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
});

function signToken(userId: string): string {
  return jwt.sign({}, config.jwtSecret, { subject: userId, expiresIn: "7d" });
}

export const authRouter = Router();

authRouter.post("/register", validate(credentialsSchema), async (req, res) => {
  const { email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({ email, passwordHash });
    res.status(201).json({ token: signToken(user.id) });
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ error: "email_taken" });
      return;
    }
    throw err;
  }
});

authRouter.post("/login", validate(credentialsSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }
  res.json({ token: signToken(user.id) });
});
