import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin, readJson } from "@/lib/server";
import { sha256Hex } from "@/lib/server";

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
    const countRow = await env.DB.prepare(
      query
        ? `SELECT count(*) as cnt FROM users WHERE user_email LIKE ?`
        : `SELECT count(*) as cnt FROM users`
    )
      .bind(...(query ? [`%${query}%`] : []))
      .first();
    return json({ results, count: (countRow as any)?.cnt ?? results.length });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** 管理员：创建用户（body {email, password}，密码需 ≥6 位，后端 sha256 存） */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = (await readJson(req)) as any;
    if (!body || typeof body !== "object") return text("请求体无效", 400);
    const email = body.email !== undefined ? String(body.email).trim() : "";
    const password = body.password !== undefined ? String(body.password) : "";
    if (!email || !password) return text("邮箱和密码不能为空", 400);
    if (password.length < 6) return text("密码至少 6 位", 400);
    const hashed = await sha256Hex(password);
    const userInfo = JSON.stringify({});
    try {
      await env.DB.prepare(
        `INSERT INTO users (user_email, password, user_info, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`
      )
        .bind(email, hashed, userInfo)
        .run();
    } catch (e: any) {
      if (String(e?.message || "").includes("UNIQUE")) return text("用户名已存在", 400);
      throw e;
    }
    return json({ success: true });
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