import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    if (!getBooleanValue(env.ENABLE_AUTO_REPLY)) return text("未启用自动回复", 403);
    const row = await env.DB.prepare(
      `SELECT source_prefix, name, subject, message, enabled FROM auto_reply_mails where address = ?`
    )
      .bind(payload.address)
      .first();
    return json(row || null);
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    if (!getBooleanValue(env.ENABLE_AUTO_REPLY)) return text("未启用自动回复", 403);
    const body = await req.json().catch(() => ({}));
    const { source_prefix, name, subject, message, enabled } = body as {
      source_prefix?: string;
      name?: string;
      subject?: string;
      message?: string;
      enabled?: boolean;
    };
    await env.DB.prepare(
      `INSERT OR REPLACE INTO auto_reply_mails (address, source_prefix, name, subject, message, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        payload.address,
        source_prefix || null,
        name || null,
        subject || null,
        message || null,
        enabled === false ? 0 : 1
      )
      .run();
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}