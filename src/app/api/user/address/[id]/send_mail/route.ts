import { NextRequest } from "next/server";
import { json, text, ApiError, requireUser } from "@/lib/server";
import { sendMail } from "@/lib/sendmail";
import { SendMailRequest } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/user/address/:id/send_mail —— 以用户绑定地址发信（上游 /user_api/address/:id/send_mail 重写目标） */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = (await req.json().catch(() => ({}))) as SendMailRequest;
    try {
      await sendMail(env, bound.name, body, {
        sourceIp:
          req.headers.get("cf-connecting-ip") ||
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "",
      });
    } catch (e) {
      return text(`发送失败: ${(e as Error).message}`, 400);
    }
    return json({ status: "ok" });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}