import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** DELETE /api/admin/clear_sent_items/:id —— 按地址 ID 清空已发邮件 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return text("无效的地址 ID", 400);
    const { success } = await env.DB.prepare(
      `DELETE FROM sendbox WHERE address IN (SELECT name FROM address WHERE id = ?)`
    )
      .bind(id)
      .run();
    if (!success) return text("清空已发邮件失败", 500);
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}