import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress, requireUser } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET —— 用户绑定的地址列表（上游 /user_api/bind_address 重写目标，返回 {results, count}） */
export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);
    const query = searchParams.get("query")?.trim() || "";

    const where = query
      ? `WHERE ua.user_id = ? AND a.name LIKE ?`
      : `WHERE ua.user_id = ?`;
    const params = query ? [payload.user_id, `%${query}%`] : [payload.user_id];

    const rows = await env.DB.prepare(
      `SELECT a.id, a.name, a.created_at, a.updated_at,
              (SELECT count(*) FROM raw_mails WHERE address = a.name) as mail_count
       FROM address a
       JOIN users_address ua ON ua.address_id = a.id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(...params, limit, offset)
      .all<any>();
    const countRow = await env.DB.prepare(
      `SELECT count(*) as count FROM address a JOIN users_address ua ON ua.address_id = a.id ${where}`
    )
      .bind(...params)
      .first<number>("count");

    return json({ results: rows.results || [], count: countRow || 0 });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** 绑定地址到用户（需要用户 token；支持传 address_id 或 address 名字，允许多地址绑定） */
export async function POST(req: NextRequest) {
  try {
    const { env, payload } = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { address_id?: number; address?: string };
    let { address_id } = body;
    const addressName = (body.address || "").trim();

    // 通过地址名解析 id（前端「绑定当前临时邮箱」场景）
    if (!address_id && addressName) {
      const found = await env.DB.prepare(`SELECT id FROM address WHERE name = ?`)
        .bind(addressName)
        .first<{ id: number }>();
      if (!found) return text("地址不存在", 404);
      address_id = found.id;
    }
    if (!address_id) return text("缺少 address_id", 400);
    address_id = Number(address_id);
    if (!Number.isSafeInteger(address_id) || address_id <= 0) return text("无效的地址 ID", 400);

    const addr = await env.DB.prepare(`SELECT id FROM address WHERE id = ?`)
      .bind(address_id)
      .first();
    if (!addr) return text("地址不存在", 404);

    // 已绑定则幂等返回成功（多地址语义下允许直接重复绑定）
    const bound = await env.DB.prepare(
      `SELECT 1 FROM users_address WHERE user_id = ? AND address_id = ?`
    )
      .bind(payload.user_id, address_id)
      .first();
    if (bound) return json({ success: true });

    const res = await env.DB.prepare(
      `INSERT INTO users_address (user_id, address_id) VALUES (?, ?)`
    )
      .bind(payload.user_id, address_id)
      .run();
    if (!res.success) return text("绑定失败（可能已被其他用户绑定）", 400);
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** 解绑当前用户的所有地址 */
export async function DELETE(req: NextRequest) {
  try {
    const { env, payload } = await requireUser(req);
    const res = await env.DB.prepare(`DELETE FROM users_address WHERE user_id = ?`)
      .bind(payload.user_id)
      .run();
    return json({ success: true, deleted: res.meta?.changes || 0 });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}