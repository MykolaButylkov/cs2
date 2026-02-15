// server.js

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import twilio from "twilio";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { initDB } from "./db.js";

dotenv.config();

const app = express();
app.use(express.json());

/* =========================
   ✅ CORS (исправленный)
========================= */

const allowlist = new Set([
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://mykolabutylkov.github.io",
]);

function normalizeOrigin(origin) {
  return String(origin || "").replace(/\/$/, "");
}

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);

      const o = normalizeOrigin(origin);

      // разрешаем любой github.io
      if (o.endsWith(".github.io")) return cb(null, true);

      if (allowlist.has(o)) return cb(null, true);

      console.log("CORS BLOCKED ORIGIN:", o);
      return cb(null, false);
    },
    credentials: false,
  })
);

// preflight
app.options("*", cors());

/* =========================
   ENV
========================= */

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing in environment variables`);
  return v;
}

const TWILIO_ACCOUNT_SID = requireEnv("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = requireEnv("TWILIO_AUTH_TOKEN");
const TWILIO_VERIFY_SID = requireEnv("TWILIO_VERIFY_SID");
const JWT_SECRET = requireEnv("JWT_SECRET");

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const dbPromise = initDB();

/* =========================
   Helpers
========================= */

function signToken(user) {
  return jwt.sign(
    { sub: user.id },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const parts = header.split(" ");
    const token = parts.length === 2 ? parts[1] : null;

    if (!token)
      return res.status(401).json({ ok: false, error: "No token" });

    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normPhone(phone) {
  return String(phone || "").trim();
}

/* =========================
   Routes
========================= */

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* ===== 1) SEND SMS ===== */

app.post("/api/sms/send", async (req, res) => {
  try {
    const { phone } = req.body || {};
    const phoneNorm = normPhone(phone);

    if (!phoneNorm)
      return res.status(400).json({ ok: false, error: "Phone required" });

    await client.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verifications.create({
        to: phoneNorm,
        channel: "sms",
      });

    res.json({ ok: true });
  } catch (err) {
    console.error("SMS SEND ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "SMS send failed" });
  }
});

/* ===== 2) VERIFY SMS ===== */

app.post("/api/sms/verify", async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    const phoneNorm = normPhone(phone);
    const codeNorm = String(code || "").trim();

    if (!phoneNorm || !codeNorm) {
      return res
        .status(400)
        .json({ ok: false, error: "Phone and code required" });
    }

    const check = await client.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verificationChecks.create({
        to: phoneNorm,
        code: codeNorm,
      });

    if (check.status !== "approved") {
      return res.status(400).json({ ok: false, error: "Invalid code" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("SMS VERIFY ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Verification failed" });
  }
});

/* ===== 3) REGISTER ===== */

app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, nick, email, phone, tournament, password } =
      req.body || {};

    if (!firstName || !nick || !email || !phone || !tournament || !password) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing required fields" });
    }

    const db = await dbPromise;

    const emailNorm = normEmail(email);
    const phoneNorm = normPhone(phone);

    const existing = await db.get(
      `SELECT id FROM users WHERE email = ? OR phone = ?`,
      emailNorm,
      phoneNorm
    );

    if (existing) {
      return res
        .status(409)
        .json({ ok: false, error: "User already exists (email/phone)" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.run(
      `INSERT INTO users 
      (firstName, nick, email, phone, tournament, passwordHash, phoneVerified)
      VALUES (?, ?, ?, ?, ?, ?, 1)`,
      String(firstName).trim(),
      String(nick).trim(),
      emailNorm,
      phoneNorm,
      String(tournament).trim(),
      passwordHash
    );

    const user = await db.get(
      `SELECT id, firstName, nick, email, phone, tournament, phoneVerified, createdAt
       FROM users WHERE id = ?`,
      result.lastID
    );

    const token = signToken(user);

    res.json({ ok: true, token, user });
  } catch (err) {
    console.error("REGISTER ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Register failed" });
  }
});

/* ===== 4) LOGIN ===== */

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: "Email and password required" });
    }

    const db = await dbPromise;
    const emailNorm = normEmail(email);

    const userRow = await db.get(
      `SELECT id, firstName, nick, email, phone, tournament, phoneVerified, passwordHash, createdAt
       FROM users WHERE email = ?`,
      emailNorm
    );

    if (!userRow)
      return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const okPass = await bcrypt.compare(password, userRow.passwordHash);

    if (!okPass)
      return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const user = {
      id: userRow.id,
      firstName: userRow.firstName,
      nick: userRow.nick,
      email: userRow.email,
      phone: userRow.phone,
      tournament: userRow.tournament,
      phoneVerified: userRow.phoneVerified,
      createdAt: userRow.createdAt,
    };

    const token = signToken(user);

    res.json({ ok: true, token, user });
  } catch (err) {
    console.error("LOGIN ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Login failed" });
  }
});

/* ===== 5) ME ===== */

app.get("/api/auth/me", authRequired, async (req, res) => {
  try {
    const db = await dbPromise;

    const user = await db.get(
      `SELECT id, firstName, nick, email, phone, tournament, phoneVerified, createdAt
       FROM users WHERE id = ?`,
      req.userId
    );

    if (!user)
      return res.status(404).json({ ok: false, error: "User not found" });

    res.json({ ok: true, user });
  } catch (err) {
    console.error("ME ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Me failed" });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
