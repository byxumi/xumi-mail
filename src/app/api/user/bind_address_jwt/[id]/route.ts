import { NextRequest } from "next/server";
import { json, text, ApiError, requireUser } from "@/lib/server";
import { signAddressJwt } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/user/bind_address_jwt/:id —— 获取某个已绑定地址的凭证 JWT（AddressManagement.vue 显示凭据/切换邮箱） */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env, payload } = await requireUser(req);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return text("无效的地址 ID", 400);
    // 仅返回当前用户已绑定的地址
    const row = await env.DB.prepare(
      `SELECT a.id, a.name FROM address a
       JOIN users_address ua ON ua.address_id = a.id
       WHERE ua.user_id = ? AND a.id = ? LIMIT 1`
    )
      .bind(payload.user_id, id)
      .first<{ id: number; name: string }>();
    if (!row) return text("地址不存在", 404);
    const jwt = await signAddressJwt(env, { address: row.name, address_id: row.id });
    return json({ jwt, address: row.name, address_id: row.id });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}