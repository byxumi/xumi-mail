import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/address_sender?limit&offset&address —— 发信余额列表
 *  POST /api/admin/address_sender body {address,address_id,balance,enabled}
 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 100);
    const offset = parseInt(searchParams.get("offset") || "0") || 0;
    const address = (searchParams.get("address") || "").trim();
    const where = address ? `WHERE a.address = ?` : "";
    const params = address ? [address] : [];
    const rows = await env.DB.prepare(
      `SELECT s.id, s.address, s.balance, s.enabled, s.created_at,
              a.id as address_id
       FROM address_sender s LEFT JOIN address a ON a.name = s.address
       ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`
    )
      .bind(...params, limit, offset)
      .all<any>();
    const count =
      ((await env.DB.prepare(`SELECT count(*) as c FROM address_sender s ${where}`)
        .bind(...params)
        .first("c")) as number) || 0;
    return json({ results: rows.results || [], count });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = (await req.json().catch(() => ({}))) as {
      address?: string;
      address_id?: number;
      balance?: number;
      enabled?: number;
    };
    if (!body.address_id) return text("缺少 address_id", 400);
    const balance = Number(body.balance);
    if (!Number.isFinite(balance) || balance < 0) return text("无效的余额", 400);
    const enabled = body.enabled ? 1 : 0;
    const id = Number(body.address_id);
    if (!Number.isSafeInteger(id) || id <= 0) return text("无效的地址 ID", 400);
    const result = await env.DB.prepare(
      `UPDATE address_sender SET enabled = ?, balance = ? WHERE id = ?`
    )
      .bind(enabled, balance, id)
      .run();
    if ((result.meta.changes ?? 0) !== 1) return text("地址发信记录不存在", 404);
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}