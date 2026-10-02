import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/admin/address/:id/reset_password —— 重置地址密码（前端已 SHA-256）
 * body: { password }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    if (!getBooleanValue(env.ENABLE_ADDRESS_PASSWORD)) return text("地址密码未启用", 403);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return text("无效的地址 ID", 400);
    const body = (await req.json().catch(() => ({}))) as { password?: string };
    if (!body.password) return text("缺少密码", 400);
    const result = await env.DB.prepare(
      `UPDATE address SET password = ?, updated_at = datetime('now') WHERE id = ?`
    )
      .bind(String(body.password), id)
      .run();
    if ((result.meta.changes ?? 0) !== 1) return text("地址不存在", 404);
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}