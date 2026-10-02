import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { getSetting, saveSetting } from "@/lib/db";
import { CONSTANTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DB_INIT_QUERIES = `
CREATE TABLE IF NOT EXISTS raw_mails (id INTEGER PRIMARY KEY, message_id TEXT, source TEXT, address TEXT, raw TEXT, raw_blob BLOB, metadata TEXT, is_unread INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_raw_mails_address ON raw_mails(address);
CREATE INDEX IF NOT EXISTS idx_raw_mails_created_at ON raw_mails(created_at);
CREATE INDEX IF NOT EXISTS idx_raw_mails_message_id ON raw_mails(message_id);
CREATE TABLE IF NOT EXISTS address (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, password TEXT, source_meta TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_address_name ON address(name);
CREATE INDEX IF NOT EXISTS idx_address_created_at ON address(created_at);
CREATE INDEX IF NOT EXISTS idx_address_updated_at ON address(updated_at);
CREATE INDEX IF NOT EXISTS idx_address_source_meta ON address(source_meta);
CREATE TABLE IF NOT EXISTS auto_reply_mails (id INTEGER PRIMARY KEY, source_prefix TEXT, name TEXT, address TEXT UNIQUE, subject TEXT, message TEXT, enabled INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_auto_reply_mails_address ON auto_reply_mails(address);
CREATE TABLE IF NOT EXISTS address_sender (id INTEGER PRIMARY KEY, address TEXT UNIQUE, balance INTEGER DEFAULT 0, enabled INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_address_sender_address ON address_sender(address);
CREATE TABLE IF NOT EXISTS sendbox (id INTEGER PRIMARY KEY, address TEXT, raw TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_sendbox_address ON sendbox(address);
CREATE INDEX IF NOT EXISTS idx_sendbox_created_at ON sendbox(created_at);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, user_email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, user_info TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_users_user_email ON users(user_email);
CREATE TABLE IF NOT EXISTS users_address (id INTEGER PRIMARY KEY, user_id INTEGER, address_id INTEGER UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_users_address_user_id ON users_address(user_id);
CREATE INDEX IF NOT EXISTS idx_users_address_address_id ON users_address(address_id);
CREATE TABLE IF NOT EXISTS user_roles (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL, role_text TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE TABLE IF NOT EXISTS user_passkeys (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, passkey_name TEXT NOT NULL, passkey_id TEXT NOT NULL, passkey TEXT NOT NULL, counter INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON user_passkeys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_passkeys_user_id_passkey_id ON user_passkeys(user_id, passkey_id);
CREATE TABLE IF NOT EXISTS redeem_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, redeem_type TEXT NOT NULL, value TEXT NOT NULL, result TEXT, enabled INTEGER NOT NULL DEFAULT 1, redeemed INTEGER NOT NULL DEFAULT 0 CHECK (redeemed IN (0, 1)), expires_at DATETIME NOT NULL, redeemed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_type ON redeem_codes(redeem_type);
`;

/** D1 表信息查询（迁移用） */
async function hasColumn(env: any, table: string, column: string): Promise<boolean> {
  const rows = (await env.DB.prepare(`PRAGMA table_info(${table})`).all()) as any;
  return (rows.results || []).some((r: any) => r.name === column);
}

/** POST /api/admin/db_migration —— 数据库迁移（DatabaseManager.vue） */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const version = (await getSetting(env, CONSTANTS.DB_VERSION_KEY)) ?? "";
    // v0.0.2: password 列
    if (!(await hasColumn(env, "address", "password"))) {
      await env.DB.prepare(`ALTER TABLE address ADD COLUMN password TEXT`).run();
    }
    // v0.0.3: metadata 列
    if (!(await hasColumn(env, "raw_mails", "metadata"))) {
      await env.DB.prepare(`ALTER TABLE raw_mails ADD COLUMN metadata TEXT`).run();
    }
    // v0.0.4: source_meta 列 + 索引
    if (!(await hasColumn(env, "address", "source_meta"))) {
      await env.DB.prepare(`ALTER TABLE address ADD COLUMN source_meta TEXT`).run();
    }
    await env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_address_source_meta ON address(source_meta)`
    ).run();
    // v0.0.5: message_id 索引
    await env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_raw_mails_message_id ON raw_mails(message_id)`
    ).run();
    // v0.0.6: raw_blob 列
    if (!(await hasColumn(env, "raw_mails", "raw_blob"))) {
      await env.DB.prepare(`ALTER TABLE raw_mails ADD COLUMN raw_blob BLOB`).run();
    }
    // v0.0.7: is_unread 列
    if (!(await hasColumn(env, "raw_mails", "is_unread"))) {
      await env.DB.prepare(`ALTER TABLE raw_mails ADD COLUMN is_unread INTEGER`).run();
    }
    // 补齐其余表/索引
    const statements = DB_INIT_QUERIES.split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await env.DB.prepare(stmt).run();
    }
    await saveSetting(env, CONSTANTS.DB_VERSION_KEY, CONSTANTS.DB_VERSION);
    return json({ success: true, message: "数据库迁移完成" });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : `迁移失败: ${(e as Error).message}`, e instanceof ApiError ? e.status : 500);
  }
}