import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getBooleanValue, getStringValue } from "@/lib/config";
import { CONSTANTS } from "@/lib/constants";
import { resolveRawEmailRow } from "@/lib/gzip";
import { commonParseMail } from "@/lib/email/parse";
import { formatWebhookBody, createWebhookAttachmentPath } from "@/lib/email/webhook";
import { WebhookSettings } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    if (!getBooleanValue(env.ENABLE_WEBHOOK) || !env.KV) return text("未启用 Webhook", 403);

    const settings = await req.json().catch(() => null);
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return text("请求体无效", 400);
    }
    const requestedMailId = (settings as WebhookSettings & { mail_id?: number }).mail_id;
    if (requestedMailId !== undefined && (!Number.isSafeInteger(requestedMailId) || requestedMailId <= 0)) {
      return text("无效的邮件 ID", 400);
    }

    // 用户指定邮件，或随机取该地址一封真实邮件作为测试样本
    const mailRow = requestedMailId !== undefined
      ? await env.DB.prepare(
          `SELECT * FROM raw_mails WHERE id = ? AND address = ?`
        ).bind(requestedMailId, payload.address).first<{ id: number; address: string; created_at: string; raw?: string | null; raw_blob?: unknown }>()
      : await env.DB.prepare(
          `SELECT * FROM raw_mails WHERE address = ? ORDER BY RANDOM() LIMIT 1`
        ).bind(payload.address).first<{ id: number; address: string; created_at: string; raw?: string | null; raw_blob?: unknown }>();
    const mailId = mailRow?.id;
    if (requestedMailId !== undefined && !mailRow) {
      return text("邮件不存在", 404);
    }

    const resolved = mailRow ? await resolveRawEmailRow(mailRow) : null;
    const raw = resolved?.raw ?? "";
    const parsedEmail = raw ? await commonParseMail(raw) : null;

    // 构建与真实触发一致的 webhook 邮件对象（无 AI 提取）
    const backendUrl = getStringValue(env.BACKEND_URL).replace(/\/$/, "");
    const attachments =
      parsedEmail?.attachments && mailRow
        ? await Promise.all(
            parsedEmail.attachments.map(async (attachment, index) => ({
              filename: attachment.filename,
              mimeType: attachment.mimeType,
              url: backendUrl
                ? `${backendUrl}${await createWebhookAttachmentPath(
                    getStringValue(env.JWT_SECRET),
                    mailRow.id,
                    mailRow.address,
                    mailRow.created_at,
                    index
                  )}`
                : "",
            }))
          )
        : [];

    const webhookMail = {
      id: mailId ? String(mailId) : "0",
      url: getStringValue(env.FRONTEND_URL) ? `${getStringValue(env.FRONTEND_URL)}?mail_id=${mailId}` : "",
      attachments,
      from: parsedEmail?.sender || "test@test.com",
      to: payload.address,
      subject: parsedEmail?.subject || "test subject",
      raw: raw || "test raw email",
      parsedText: parsedEmail?.text || "test parsed text",
      parsedHtml: parsedEmail?.html || "test parsed html",
      aiExtract: null,
      aiExtractType: "",
      aiExtractResult: "",
      aiExtractResultText: "",
    };

    try {
      const body = formatWebhookBody((settings as WebhookSettings).body || "", webhookMail);
      const response = await fetch(
        (settings as WebhookSettings).url,
        {
          method: (settings as WebhookSettings).method || "POST",
          headers: JSON.parse((settings as WebhookSettings).headers || "{}"),
          body,
        }
      );
      if (!response.ok) {
        return text(`发送失败: HTTP ${response.status} ${response.statusText}`, 400);
      }
    } catch (e) {
      return text(`发送失败: ${e instanceof Error ? e.message : String(e)}`, 400);
    }

    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}
