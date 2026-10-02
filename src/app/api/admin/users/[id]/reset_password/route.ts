import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin, readJson } from "@/lib/server";
import { sha256Hex } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/admin/users/:id/reset_password —— 重置用户密码（UserManagement.vue，前端已传 SHA-256） */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (!Number.isInteger(id) || id <= 0) return text("无效的用户 ID", 400);
    const body = (await readJson(req)) as any;
    if (!body || typeof body !== "object" || !body.password) return text("密码不能为空", 400);
    const password = String(body.password);
    if (password.length < 6) return text("密码至少 6 位", 400);
    // 前端传的是 SHA-256 哈希时长度 64；传明文则后端哈希
    const hashed = password.length === 64 ? password : await sha256Hex(password);
    const { success } = await env.DB.prepare(
      `UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?`
    )
      .bind(hashed, id)
      .run();
    return json({ success: !!success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}