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
   ENV helpers
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

// Admin creds (Render Environment Variables)
const ADMIN_LOGIN = requireEnv("ADMIN_LOGIN");
const ADMIN_PASSWORD = requireEnv("ADMIN_PASSWORD");

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const dbPromise = initDB();

/* =========================
   ✅ CORS (GitHub Pages + локалка)
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

const corsOptions = {
  origin(origin, cb) {
    // запросы без Origin (curl/postman) — разрешаем
    if (!origin) return cb(null, true);

    const o = normalizeOrigin(origin);

    // разрешаем любой *.github.io (можно ужесточить до одного домена)
    if (o.endsWith(".github.io")) return cb(null, true);

    if (allowlist.has(o)) return cb(null, true);

    console.log("CORS BLOCKED ORIGIN:", o);
    // ВАЖНО: не throw, иначе preflight ломается
    return cb(null, false);
  },
  credentials: false,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* =========================
   Helpers
========================= */
function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const parts = header.split(" ");
    const token = parts.length === 2 ? parts[1] : null;

    if (!token) return res.status(401).json({ ok: false, error: "No token" });

    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

function adminRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ ok: false, error: "No token" });

    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Admin only" });
    }

    next();
  } catch {
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
app.get("/api/health", (req, res) => res.json({ ok: true }));

/* ===== 1) SEND SMS ===== */
app.post("/api/sms/send", async (req, res) => {
  try {
    const { phone } = req.body || {};
    const phoneNorm = normPhone(phone);

    if (!phoneNorm) return res.status(400).json({ ok: false, error: "Phone required" });

    await client.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verifications.create({ to: phoneNorm, channel: "sms" });

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
      return res.status(400).json({ ok: false, error: "Phone and code required" });
    }

    const check = await client.verify.v2
      .services(TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: phoneNorm, code: codeNorm });

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
    const { firstName, nick, teamName, email, phone, tournament, password } = req.body || {};

    if (!firstName || !nick || !teamName || !email || !phone || !tournament || !password) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
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
      return res.status(409).json({ ok: false, error: "User already exists (email/phone)" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.run(
      `INSERT INTO users
       (firstName, nick, teamName, email, phone, tournament, passwordHash, phoneVerified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      String(firstName).trim(),
      String(nick).trim(),
      String(teamName).trim(),
      emailNorm,
      phoneNorm,
      String(tournament).trim(),
      passwordHash
    );

    const user = await db.get(
      `SELECT id, firstName, nick, teamName, email, phone, tournament, phoneVerified, paid, createdAt
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
      return res.status(400).json({ ok: false, error: "Email and password required" });
    }

    const db = await dbPromise;
    const emailNorm = normEmail(email);

    const userRow = await db.get(
      `SELECT id, firstName, nick, teamName, email, phone, tournament, phoneVerified, paid, passwordHash, createdAt
       FROM users WHERE email = ?`,
      emailNorm
    );

    if (!userRow) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const okPass = await bcrypt.compare(password, userRow.passwordHash);
    if (!okPass) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const user = {
      id: userRow.id,
      firstName: userRow.firstName,
      nick: userRow.nick,
      teamName: userRow.teamName,
      email: userRow.email,
      phone: userRow.phone,
      tournament: userRow.tournament,
      phoneVerified: userRow.phoneVerified,
      paid: userRow.paid,
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
      `SELECT id, firstName, nick, teamName, email, phone, tournament, phoneVerified, paid, createdAt
       FROM users WHERE id = ?`,
      req.userId
    );

    if (!user) return res.status(404).json({ ok: false, error: "User not found" });
    res.json({ ok: true, user });
  } catch (err) {
    console.error("ME ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Me failed" });
  }
});

/* =========================
   🔐 ADMIN ROUTES
========================= */

// Admin login -> выдаёт admin token
app.post("/api/admin/login", (req, res) => {
  const { login, password } = req.body || {};

  if (String(login || "") !== ADMIN_LOGIN || String(password || "") !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Invalid admin credentials" });
  }

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ ok: true, token });
});

// ✅ List users (admin only) — ДОБАВИЛ teamName
app.get("/api/admin/users", adminRequired, async (req, res) => {
  try {
    const db = await dbPromise;

    const users = await db.all(`
      SELECT id, firstName, nick, teamName, email, phone, tournament,
             phoneVerified, paid, paidAt, paymentRef, createdAt
      FROM users
      ORDER BY createdAt DESC
    `);

    res.json({ ok: true, users });
  } catch (err) {
    console.error("ADMIN USERS ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Admin users failed" });
  }
});

// Update payment (admin only)
app.post("/api/admin/user/:id/payment", adminRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { paid, paymentRef } = req.body || {};

    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "Bad id" });

    const paidVal = paid ? 1 : 0;
    const paidAt = paidVal ? new Date().toISOString() : null;
    const ref = paymentRef ? String(paymentRef).trim() : null;

    const db = await dbPromise;

    await db.run(
      `UPDATE users SET paid = ?, paidAt = ?, paymentRef = ? WHERE id = ?`,
      paidVal,
      paidAt,
      ref,
      id
    );

    const user = await db.get(
      `SELECT id, firstName, nick, teamName, email, phone, tournament, phoneVerified, paid, paidAt, paymentRef, createdAt
       FROM users WHERE id = ?`,
      id
    );

    res.json({ ok: true, user });
  } catch (err) {
    console.error("ADMIN PAYMENT ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Admin payment update failed" });
  }
});

// ✅ UPDATE user (admin) — nick/email/teamName (телефон НЕ меняем)
app.patch("/api/admin/users/:id", adminRequired, async (req, res) => {
  try {
    const db = await dbPromise;
    const id = Number(req.params.id);

    const { nick, email, teamName } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "Bad id" });

    const updates = [];
    const params = [];

    if (nick !== undefined) {
      const v = String(nick).trim();
      if (!v) return res.status(400).json({ ok: false, error: "Nick required" });
      updates.push("nick = ?");
      params.push(v);
    }

    if (teamName !== undefined) {
      const v = String(teamName).trim();
      if (!v) return res.status(400).json({ ok: false, error: "Team required" });
      updates.push("teamName = ?");
      params.push(v);
    }

    if (email !== undefined) {
      const v = normEmail(email);
      if (!v) return res.status(400).json({ ok: false, error: "Email required" });

      const emailTaken = await db.get(
        `SELECT id FROM users WHERE email = ? AND id <> ?`,
        v,
        id
      );
      if (emailTaken) return res.status(409).json({ ok: false, error: "Email already in use" });

      updates.push("email = ?");
      params.push(v);
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: "Nothing to update" });
    }

    const existingUser = await db.get(`SELECT id FROM users WHERE id = ?`, id);
    if (!existingUser) return res.status(404).json({ ok: false, error: "User not found" });

    params.push(id);
    await db.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    const user = await db.get(
      `SELECT id, firstName, nick, teamName, email, phone, tournament, phoneVerified, paid, createdAt
       FROM users WHERE id = ?`,
      id
    );

    res.json({ ok: true, user });
  } catch (e) {
    console.error("ADMIN UPDATE USER ERROR:", e?.message || e);
    res.status(500).json({ ok: false, error: "Update failed" });
  }
});

// ✅ Очистить ВСЮ таблицу users (admin only)
// В Postman/Fetch: POST /api/admin/clear-users  (Bearer token обязателен)
app.post("/api/admin/clear-users", adminRequired, async (req, res) => {
  try {
    const db = await dbPromise;
    await db.exec("DELETE FROM users;");
    // сброс автоинкремента (SQLite)
    await db.exec("DELETE FROM sqlite_sequence WHERE name='users';");
    res.json({ ok: true });
  } catch (e) {
    console.error("ADMIN CLEAR USERS ERROR:", e?.message || e);
    res.status(500).json({ ok: false, error: "Clear failed" });
  }
});

/* =========================
   START SERVER (Render)
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
