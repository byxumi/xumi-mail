import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin, readJson } from "@/lib/server";
import { getBooleanValue, getStringValue } from "@/lib/config";
import { CONSTANTS } from "@/lib/constants";
import { resolveRawEmailRow } from "@/lib/gzip";
import { commonParseMail } from "@/lib/email/parse";
import { formatWebhookBody, createWebhookAttachmentPath } from "@/lib/email/webhook";
import { WebhookSettings } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/admin/mail_webhook/test —— 管理员邮件 Webhook 测试发送（MailWebhook.vue） */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    if (!env.KV) return text("未启用 KV", 403);
    const body = (await readJson(req)) as any;
    if (!body || typeof body !== "object") return text("请求体无效", 400);
    const settings: WebhookSettings = {
      enabled: body.enabled === true,
      url: body.url ? String(body.url) : "",
      method: ["POST", "PUT", "PATCH"].includes(body.method) ? body.method : "POST",
      headers: typeof body.headers === "string" ? body.headers : JSON.stringify(body.headers || {}),
      body: typeof body.body === "string" ? body.body : "",
    };
    if (!settings.url) return text("Webhook URL 不能为空", 400);
    const mailId = body.mail_id !== undefined ? Number(body.mail_id) : NaN;
    let row: any = null;
    if (!Number.isNaN(mailId) && Number.isInteger(mailId) && mailId > 0) {
      row = await env.DB.prepare(`SELECT * FROM raw_mails WHERE id = ? LIMIT 1`).bind(mailId).first();
      if (!row) return text("邮件不存在", 404);
    } else {
      row = await env.DB.prepare(`SELECT * FROM raw_mails ORDER BY RANDOM() LIMIT 1`).first();
    }
    const resolved = await resolveRawEmailRow(row);
    const parsedEmail = await commonParseMail(resolved.raw || "");
    const webhookMail: any = {
      id: row ? String(row.id) : "0",
      url: getStringValue(env.FRONTEND_URL)
        ? `${getStringValue(env.FRONTEND_URL)}?mail_id=${row ? row.id : ""}`
        : "",
      attachments:
        env.BACKEND_URL && parsedEmail && parsedEmail.attachments && parsedEmail.attachments.length > 0
          ? await Promise.all(
              parsedEmail.attachments.map((a: any, index: number) =>
                createWebhookAttachmentPath(
                  getStringValue(env.JWT_SECRET),
                  Number(row?.id || "0"),
                  row?.address || "",
                  row?.created_at || "",
                  index
                ).then((url) => ({
                  index,
                  name: a.filename || `attachment-${index}`,
                  contentType: a.mimeType || "application/octet-stream",
                  url,
                }))
              )
            )
          : [],
      from: parsedEmail?.sender || "test@test.com",
      to: row?.address || "test@test.com",
      subject: parsedEmail?.subject || "Test Webhook",
      raw: resolved.raw || "",
      parsedText: parsedEmail?.text || "Test Webhook Body",
      parsedHtml: parsedEmail?.html || "<p>Test Webhook Body</p>",
      aiExtract: null,
    };
    const headers: Record<string, string> = {};
    try {
      const rawHeaders = JSON.parse(settings.headers || "{}");
      if (rawHeaders && typeof rawHeaders === "object") {
        for (const [k, v] of Object.entries(rawHeaders)) headers[k] = String(v);
      }
    } catch {
      // 忽略无效 headers
    }
    const payload = formatWebhookBody(settings.body, webhookMail);
    const res = await fetch(settings.url, {
      method: settings.method,
      headers: { "Content-Type": "application/json", ...headers },
      body: payload,
    });
    if (!res.ok) {
      return text(`发送失败: HTTP ${res.status} ${res.statusText}`, 400);
    }
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : `发送失败: ${(e as Error).message}`, e instanceof ApiError ? e.status : 500);
  }
}