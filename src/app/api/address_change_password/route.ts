import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 修改地址密码（前端传入 SHA-256 哈希后的新密码） */
export async function POST(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    if (!getBooleanValue(env.ENABLE_ADDRESS_PASSWORD)) {
      return text("未启用地址密码", 403);
    }
    const body = (await req.json().catch(() => ({}))) as { new_password?: string };
    const { new_password } = body;
    if (!new_password) return text("新密码不能为空", 400);
    const { success } = await env.DB.prepare(
      `UPDATE address SET password = ?, updated_at = datetime('now') WHERE id = ?`
    )
      .bind(new_password, payload.address_id)
      .run();
    if (!success) return text("更新密码失败", 500);
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}