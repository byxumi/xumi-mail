import { NextRequest } from "next/server";
import { json, text, ApiError, requireUser } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/user/sendbox —— 用户绑定地址的发送记录（UserSendBox.vue，address 可选过滤） */
export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);
    const address = searchParams.get("address")?.trim() || "";

    // 用户可见的地址集合
    const where = address
      ? `WHERE sb.address = ? AND sb.address IN (SELECT a.name FROM address a JOIN users_address ua ON ua.address_id = a.id WHERE ua.user_id = ?)`
      : `WHERE sb.address IN (SELECT a.name FROM address a JOIN users_address ua ON ua.address_id = a.id WHERE ua.user_id = ?)`;
    const params = address ? [address, payload.user_id] : [payload.user_id];

    const rows = await env.DB.prepare(
      `SELECT sb.id, sb.address, sb.raw, sb.created_at FROM sendbox sb ${where} ORDER BY sb.id DESC LIMIT ? OFFSET ?`
    )
      .bind(...params, limit, offset)
      .all<any>();
    const countRow = await env.DB.prepare(
      `SELECT count(*) as count FROM sendbox sb ${where}`
    )
      .bind(...params)
      .first<number>("count");

    return json({ results: rows.results || [], count: countRow || 0 });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}