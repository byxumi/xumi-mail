import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress, requireUser } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 绑定地址到用户（需要用户 token + 地址 JWT） */
export async function POST(req: NextRequest) {
  try {
    const { env, payload } = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { address_id?: number };
    const { address_id } = body;
    if (!address_id) return text("缺少 address_id", 400);

    const existing = await env.DB.prepare(
      `SELECT address_id FROM users_address WHERE user_id = ?`
    )
      .bind(payload.user_id)
      .first();
    if (existing) {
      return text("该用户已绑定地址，请先解绑", 400);
    }

    const addr = await env.DB.prepare(`SELECT id FROM address WHERE id = ?`)
      .bind(address_id)
      .first();
    if (!addr) return text("地址不存在", 404);

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