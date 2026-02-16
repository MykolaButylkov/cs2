// db.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function ensureColumn(db, columnName, definition) {
  const columns = await db.all(`PRAGMA table_info(users)`);
  const exists = columns.some((c) => c.name === columnName);

  if (!exists) {
    await db.exec(`ALTER TABLE users ADD COLUMN "${columnName}" ${definition}`);
    console.log(`✅ Column added: ${columnName}`);
  }
}

export async function initDB() {
  const db = await open({
    filename: "./app.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      nick TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL UNIQUE,
      tournament TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      phoneVerified INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    );
  `);

  await ensureColumn(db, "paid", "INTEGER DEFAULT 0");
  await ensureColumn(db, "paidAt", "TEXT");
  await ensureColumn(db, "paymentRef", "TEXT");

  return db;
}
