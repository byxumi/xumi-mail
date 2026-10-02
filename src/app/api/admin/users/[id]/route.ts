import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** DELETE /api/admin/users/:id —— 删除用户（UserManagement.vue） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (!Number.isInteger(id) || id <= 0) return text("无效的用户 ID", 400);
    await env.DB.prepare(`DELETE FROM users_address WHERE user_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM user_roles WHERE user_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM user_passkeys WHERE user_id = ?`).bind(id).run();
    const { success } = await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}