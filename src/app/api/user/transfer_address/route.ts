import { NextRequest } from "next/server";
import { json, text, ApiError, requireUser } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/user/transfer_address —— 把当前用户的一个地址转移给另一个用户（AddressManagement.vue）
 *  body: { address_id, target_user_email }
 */
export async function POST(req: NextRequest) {
  try {
    const { env, payload } = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as {
      address_id?: number | string;
      target_user_email?: string;
    };
    const addressId = Number(body.address_id);
    if (!Number.isSafeInteger(addressId) || addressId <= 0) return text("无效的地址 ID", 400);
    const targetEmail = (body.target_user_email || "").trim().toLowerCase();
    if (!targetEmail) return text("目标用户邮箱不能为空", 400);

    // 确认该地址属于当前用户
    const owned = await env.DB.prepare(
      `SELECT 1 FROM users_address WHERE user_id = ? AND address_id = ?`
    )
      .bind(payload.user_id, addressId)
      .first();
    if (!owned) return text("地址不存在或不属于当前用户", 403);

    // 目标用户必须存在
    const target = await env.DB.prepare(
      `SELECT id FROM users WHERE user_email = ?`
    )
      .bind(targetEmail)
      .first<{ id: number }>();
    if (!target) return text("目标用户不存在", 404);

    // 目标用户不能已有绑定地址（一个用户同一时间只绑定一个地址）
    const targetBound = await env.DB.prepare(
      `SELECT 1 FROM users_address WHERE user_id = ?`
    )
      .bind(target.id)
      .first();
    if (targetBound) return text("目标用户已绑定地址，请先让其解绑", 400);

    // 转移：从当前用户删除绑定，写入目标用户
    await env.DB.prepare(`DELETE FROM users_address WHERE user_id = ? AND address_id = ?`)
      .bind(payload.user_id, addressId)
      .run();
    const res = await env.DB.prepare(
      `INSERT INTO users_address (user_id, address_id) VALUES (?, ?)`
    )
      .bind(target.id, addressId)
      .run();
    if (!res.success) {
      // 回滚
      await env.DB.prepare(`INSERT INTO users_address (user_id, address_id) VALUES (?, ?)`)
        .bind(payload.user_id, addressId)
        .run();
      return text("转移失败", 500);
    }
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}