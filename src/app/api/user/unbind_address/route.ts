import { NextRequest } from "next/server";
import { json, text, ApiError, requireUser } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/user/unbind_address —— 解绑当前用户的一个地址（AddressManagement.vue） */
export async function POST(req: NextRequest) {
  try {
    const { env, payload } = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { address_id?: number | string };
    const addressId = Number(body.address_id);
    if (!Number.isSafeInteger(addressId) || addressId <= 0) return text("无效的地址 ID", 400);
    const res = await env.DB.prepare(
      `DELETE FROM users_address WHERE user_id = ? AND address_id = ?`
    )
      .bind(payload.user_id, addressId)
      .run();
    return json({ success: true, deleted: res.meta?.changes || 0 });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}