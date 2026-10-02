import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin, readJson } from "@/lib/server";
import { getUserRoles } from "@/lib/config";
import { CONSTANTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/user_roles —— 角色列表（来自 env USER_ROLES；UserManagement.vue/RedeemCodes.vue 用） */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    return json({ results: getUserRoles(env) });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** POST /api/admin/user_roles —— 更新用户角色（body {user_id, role_text}） */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = (await readJson(req)) as any;
    if (!body || typeof body !== "object") return text("请求体无效", 400);
    const userId = Number(body.user_id);
    if (!Number.isInteger(userId) || userId <= 0) return text("无效的用户 ID", 400);
    const roleText = body.role_text === undefined || body.role_text === null ? "" : String(body.role_text).trim();
    // 校验用户存在
    const user = await env.DB.prepare(`SELECT id FROM users WHERE id = ?`).bind(userId).first();
    if (!user) return text("用户不存在", 404);
    if (roleText) {
      // 校验角色存在于配置
      const roles = getUserRoles(env);
      if (!roles.some((r: any) => r.role === roleText)) {
        return text("角色不存在", 400);
      }
      await env.DB.prepare(
        `INSERT INTO user_roles (user_id, role_text, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET role_text = excluded.role_text, updated_at = datetime('now')`
      )
        .bind(userId, roleText)
        .run();
    } else {
      await env.DB.prepare(`DELETE FROM user_roles WHERE user_id = ?`).bind(userId).run();
    }
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}