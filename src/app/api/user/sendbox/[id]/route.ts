import { NextRequest } from "next/server";
import { json, text, ApiError, requireUser } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** DELETE /api/user/sendbox/:id —— 删除用户绑定地址下的一条发送记录（UserSendBox.vue） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env, payload } = await requireUser(req);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return text("无效的记录 ID", 400);

    const bound = await env.DB.prepare(
      `SELECT sb.id FROM sendbox sb
       WHERE sb.id = ? AND sb.address IN (SELECT a.name FROM address a JOIN users_address ua ON ua.address_id = a.id WHERE ua.user_id = ?) LIMIT 1`
    )
      .bind(id, payload.user_id)
      .first<{ id: number }>();
    if (!bound) return text("记录不存在", 404);

    const res = await env.DB.prepare(`DELETE FROM sendbox WHERE id = ?`)
      .bind(id)
      .run();
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}