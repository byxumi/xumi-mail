// Webhook 发送工具
import { Env, ExtractResult, WebhookSettings } from "@/types";
import { getBooleanValue, getStringValue } from "../config";
import { getJsonSetting } from "../db";
import { CONSTANTS } from "../constants";
import { commonParseMail } from "./parse";

const WEBHOOK_ATTACHMENT_TTL_SECONDS = 24 * 60 * 60;
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

const encodeBase32 = (value: Uint8Array): string => {
  const bits = Array.from(value, (byte) => byte.toString(2).padStart(8, "0")).join("");
  return (bits.match(/.{1,5}/g) || [])
    .map((group) => BASE32_ALPHABET[parseInt(group.padEnd(5, "0"), 2)])
    .join("");
};

const decodeBase32 = (value: string): Uint8Array => {
  const bits = Array.from(value.toLowerCase(), (character) =>
    BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, "0")
  ).join("");
  return Uint8Array.from(bits.match(/.{8}/g) || [], (byte) => parseInt(byte, 2));
};

const getSignaturePayload = (
  mailId: number,
  address: string,
  createdAt: string,
  expires: number,
  index: number
): Uint8Array<ArrayBuffer> => {
  const bytes = new TextEncoder().encode(
    JSON.stringify(["webhook-attachment-v1", mailId, address, createdAt, expires, index])
  );
  // 确保底层是 ArrayBuffer（避免 SharedArrayBuffer 兼容问题）
  return new Uint8Array(bytes.buffer.slice(0)) as Uint8Array<ArrayBuffer>;
};

export const createWebhookAttachmentPath = async (
  secret: string,
  mailId: number,
  address: string,
  createdAt: string,
  index: number
): Promise<string> => {
  const expires = Math.floor(Date.now() / 1000) + WEBHOOK_ATTACHMENT_TTL_SECONDS;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    getSignaturePayload(mailId, address, createdAt, expires, index)
  );
  return `/open_api/a/${mailId}/${index}/${expires}/${encodeBase32(new Uint8Array(signature as ArrayBuffer))}`;
};

export const formatWebhookBody = (
  body: string,
  mail: Record<string, unknown>
): string => {
  const attachments = (mail.attachments as Array<{ filename: string; url?: string }>) || [];
  const linkedAttachments = attachments.filter((attachment) => attachment.url);
  const formatMap = {
    ...mail,
    attachments,
    attachmentLinks: linkedAttachments.map((a) => a.url).join("\n"),
    attachmentMarkdownLinks: linkedAttachments
      .map((a) => {
        const filename = a.filename.replace(/[\r\n]/g, " ").replace(/[\\[\]()`*_!<>]/g, "\\$&");
        return `[${filename}](${a.url})`;
      })
      .join("\n"),
  };
  return body.replace(/\$\{(\w+)\}/g, (placeholder, key: string) => {
    if (!Object.hasOwn(formatMap, key)) return placeholder;
    return String(formatMap[key as keyof typeof formatMap]);
  });
};

export const triggerWebhook = async (
  env: Env,
  address: string,
  rawEmail: string,
  storedMailId: number | undefined,
  aiExtract?: ExtractResult | null
): Promise<void> => {
  if (!env.KV || !getBooleanValue(env.ENABLE_WEBHOOK)) return;
  const webhookList: WebhookSettings[] = [];

  const adminMailWebhookSettings = await env.KV.get<WebhookSettings>(
    CONSTANTS.WEBHOOK_KV_ADMIN_MAIL_SETTINGS_KEY,
    "json"
  );
  if (adminMailWebhookSettings?.enabled) webhookList.push(adminMailWebhookSettings);

  const adminSettings = await env.KV.get<{ enableAllowList?: boolean; allowList?: string[] }>(
    CONSTANTS.WEBHOOK_KV_SETTINGS_KEY,
    "json"
  );
  if (!adminSettings?.enableAllowList || adminSettings?.allowList?.includes(address)) {
    const settings = await env.KV.get<WebhookSettings>(
      `${CONSTANTS.WEBHOOK_KV_USER_SETTINGS_KEY}:${address}`,
      "json"
    );
    if (settings?.enabled) webhookList.push(settings);
  }

  if (webhookList.length === 0) return;

  const mailRow = storedMailId
    ? await env.DB.prepare(`SELECT id, address, created_at FROM raw_mails WHERE id = ? AND address = ?`)
        .bind(storedMailId, address)
        .first<{ id: number; address: string; created_at: string }>()
    : null;
  const mailId = String(mailRow?.id || "");

  const parsedEmail = await commonParseMail(rawEmail);
  const usesAttachment = webhookList.some((s) => s.body.includes("${attachment"));
  const backendUrl = getStringValue(env.BACKEND_URL).replace(/\/$/, "");
  const attachments =
    usesAttachment && mailRow && parsedEmail?.attachments
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

  const usableAiExtract = aiExtract?.type !== "none" && aiExtract?.result ? aiExtract : null;
  const webhookMail = {
    id: mailId,
    url: getStringValue(env.FRONTEND_URL) ? `${getStringValue(env.FRONTEND_URL)}?mail_id=${mailId}` : "",
    attachments,
    from: parsedEmail?.sender || "",
    to: address,
    subject: parsedEmail?.subject || "",
    raw: rawEmail || "",
    parsedText: parsedEmail?.text || "",
    parsedHtml: parsedEmail?.html || "",
    aiExtract: usableAiExtract,
    aiExtractType: usableAiExtract?.type || "",
    aiExtractResult: usableAiExtract?.result || "",
    aiExtractResultText: usableAiExtract?.result_text || "",
  };

  for (const settings of webhookList) {
    try {
      const body = formatWebhookBody(settings.body, webhookMail);
      const response = await fetch(settings.url, {
        method: settings.method,
        headers: JSON.parse(settings.headers || "{}"),
        body,
      });
      if (!response.ok) {
        console.log("send webhook error", response.status, response.statusText);
      }
    } catch (e) {
      console.error("triggerWebhook error", e);
    }
  }
};