import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireUser } from "@/lib/server";
import { getUserRoles } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/user/settings —— 用户设置（上游 /user_api/settings 重写目标）
 * 返回结构对齐上游 userSettings：user_email / user_id / is_admin / access_token / new_user_token / user_role
 */
export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireUser(req);
    const user = await env.DB.prepare(
      `SELECT id, user_email, user_info FROM users WHERE id = ?`
    )
      .bind(payload.user_id)
      .first<{ id: number; user_email: string; user_info: string }>();
    if (!user) return json({ user_email: "", user_id: 0, is_admin: false, access_token: null, new_user_token: null, user_role: null });

    // 角色：从 user_roles 表读取，并尝试与 USER_ROLES 配置匹配
    let userRole: { domains?: string[] | null; role: string; prefix?: string | null } | null = null;
    const roleText = await env.DB.prepare(`SELECT role_text FROM user_roles WHERE user_id = ?`)
      .bind(user.id)
      .first<string>("role_text");
    if (roleText) {
      const configured = getUserRoles(env).find((r) => r.role === roleText);
      userRole = configured
        ? { domains: configured.domains ?? null, role: configured.role, prefix: configured.prefix ?? null }
        : { domains: null, role: roleText, prefix: null };
    }

    // is_admin：拥有 ADMIN_USER_ROLE 角色 或 user_info 标记
    const userInfo = JSON.parse(user.user_info || "{}");
    let isAdmin = !!userInfo.is_admin;
    const adminRole = getAdminRoleText(env);
    if (adminRole && roleText === adminRole) isAdmin = true;

    return json({
      user_email: user.user_email,
      user_id: user.id,
      is_admin: isAdmin,
      access_token: null,
      new_user_token: null,
      user_role: userRole,
    });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

function getAdminRoleText(env: any): string {
  return typeof env.ADMIN_USER_ROLE === "string" ? env.ADMIN_USER_ROLE : "";
}