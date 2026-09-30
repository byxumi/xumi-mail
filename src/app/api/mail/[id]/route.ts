import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { resolveRawEmailRow } from "@/lib/gzip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { env, payload } = await requireAddress(req);
    const { id } = await params;
    const row = await env.DB.prepare(`SELECT * FROM raw_mails where id = ? and address = ?`)
      .bind(id, payload.address)
      .first();
    if (!row) return json(null);
    const resolved = await resolveRawEmailRow(row as any);
    return json(resolved);
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { env, payload } = await requireAddress(req);
    const { id } = await params;
    if (!getBooleanValueLocal(env.ENABLE_USER_DELETE_EMAIL)) {
      return text("已禁用删除邮件", 403);
    }
    const { success } = await env.DB.prepare(`DELETE FROM raw_mails WHERE address = ? and id = ?`)
      .bind(payload.address.toLowerCase(), id)
      .run();
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

function getBooleanValueLocal(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true";
  return false;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { env, payload } = await requireAddress(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { isUnread } = body as { isUnread?: boolean };
    if (typeof isUnread !== "boolean") {
      return text("isUnread 必须是布尔值", 400);
    }
    if (!getBooleanValueLocal(env.ENABLE_MAIL_READ_STATUS)) {
      return text("未启用已读状态", 403);
    }
    const value = isUnread ? 1 : 0;
    const { success } = await env.DB.prepare(
      `UPDATE raw_mails SET is_unread = ? WHERE id = ? AND address = ? AND COALESCE(is_unread, 0) != ?`
    )
      .bind(value, id, payload.address, value)
      .run();
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}