import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { sendMail } from "@/lib/sendmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 管理员代发邮件（前端 SendMail.vue 发送 {from_name, from_mail, to_name, to_mail, subject, is_html, content}） */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { from_name, from_mail, to_name, to_mail, subject, is_html, content } = (await req.json().catch(
      () => ({})
    )) as any;
    if (!from_mail || !to_mail || !subject || !content) {
      return text("缺少必要字段（from_mail/to_mail/subject/content）", 400);
    }
    try {
      await sendMail(
        env,
        String(from_mail),
        { from_name, to_mail, to_name, subject, content, is_html },
        { isAdmin: true }
      );
    } catch (e) {
      return text(`发送失败: ${(e as Error).message}`, 400);
    }
    return json({ status: "ok" });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}