import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { signAddressJwt } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/show_password/:id —— 获取地址凭证（Account.vue 查看凭据） */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return text("无效的地址 ID", 400);
    const row = await env.DB.prepare(`SELECT id, name FROM address WHERE id = ?`)
      .bind(id)
      .first<{ id: number; name: string }>();
    if (!row) return text("地址不存在", 404);
    const jwt = await signAddressJwt(env, { address: row.name, address_id: row.id });
    return json({ jwt });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}