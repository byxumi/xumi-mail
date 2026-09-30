import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 管理员：用户列表 / 创建 / 删除 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 200);
    const offset = parseInt(searchParams.get("offset") || "0") || 0;
    const query = searchParams.get("query") || "";
    let sql = `SELECT u.id, u.user_email, u.created_at, u.updated_at, u.user_info,
                      (SELECT count(*) FROM users_address WHERE user_id = u.id) as address_count,
                      r.role_text as role
               FROM users u LEFT JOIN user_roles r ON r.user_id = u.id`;
    const params: unknown[] = [];
    if (query) {
      sql += ` WHERE u.user_email LIKE ?`;
      params.push(`%${query}%`);
    }
    sql += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const { results } = await env.DB.prepare(sql).bind(...params).all();
    return json({ results });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") || "0");
    if (!id) return text("缺少 id", 400);
    await env.DB.prepare(`DELETE FROM users_address WHERE user_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM user_roles WHERE user_id = ?`).bind(id).run();
    const { success } = await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}