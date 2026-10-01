import { NextRequest } from "next/server";
import { json, text, ApiError, requireUser } from "@/lib/server";
import { getSendBalanceState } from "@/lib/sendmail";
import { updateAddressUpdatedAt } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/user/address/:id/settings —— 用户绑定地址的设置（上游 /user_api/address/:id/settings 重写目标） */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { env, payload } = await requireUser(req);
    const { id } = await params;
    const addressId = parseInt(id, 10);
    if (!Number.isSafeInteger(addressId) || addressId <= 0) return text("地址 ID 无效", 400);

    const bound = await env.DB.prepare(
      `SELECT a.name FROM address a JOIN users_address ua ON ua.address_id = a.id
       WHERE ua.user_id = ? AND a.id = ?`
    )
      .bind(payload.user_id, addressId)
      .first<{ name: string }>();
    if (!bound) return text("地址不存在或未绑定", 404);

    updateAddressUpdatedAt(env, bound.name);
    const { balance } = await getSendBalanceState(env, bound.name);
    return json({ address: bound.name, send_balance: balance || 0 });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}