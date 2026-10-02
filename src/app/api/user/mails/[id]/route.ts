import { NextRequest } from "next/server";
import { json, text, ApiError, requireUser } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** DELETE /api/user/mails/:id —— 删除用户绑定地址下的一封邮件（受 ENABLE_USER_DELETE_EMAIL 控制） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env, payload } = await requireUser(req);
    if (!getBooleanValue(env.ENABLE_USER_DELETE_EMAIL)) return text("未开启用户删除邮件功能", 403);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return text("无效的邮件 ID", 400);

    // 校验邮件属于该用户绑定的地址
    const mail = await env.DB.prepare(
      `SELECT rm.id FROM raw_mails rm
       JOIN users_address ua ON ua.address_id = (SELECT id FROM address WHERE name = rm.address)
       WHERE ua.user_id = ? AND rm.id = ? LIMIT 1`
    )
      .bind(payload.user_id, id)
      .first<{ id: number }>();
    if (!mail) return text("邮件不存在", 404);

    const res = await env.DB.prepare(`DELETE FROM raw_mails WHERE id = ?`)
      .bind(id)
      .run();
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}