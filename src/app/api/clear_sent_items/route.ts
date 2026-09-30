import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    if (!getBooleanValue(env.ENABLE_USER_DELETE_EMAIL)) return text("已禁用删除邮件", 403);
    const { success } = await env.DB.prepare(`DELETE FROM sendbox WHERE address = ?`)
      .bind(payload.address)
      .run();
    if (!success) return text("清空发件箱失败", 500);
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}