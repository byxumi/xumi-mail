// 邮件存储：写入 raw_mails，支持 gzip 压缩与已读状态
import { Env, MailRow } from "@/types";
import { getBooleanValue } from "../config";
import { compressText } from "../gzip";

export const storeRawMail = async (
  env: Env,
  source: string,
  address: string,
  messageId: string | null,
  raw: string
): Promise<{ success: boolean; last_row_id?: number }> => {
  try {
    const gzipEnabled = getBooleanValue(env.ENABLE_MAIL_GZIP);
    const readStatusEnabled = getBooleanValue(env.ENABLE_MAIL_READ_STATUS);

    // 检测列是否存在（gzip 需要 raw_blob，已读状态需要 is_unread）
    let rawBlob: ArrayBuffer | null = null;
    const tableInfo = await env.DB.prepare(`PRAGMA table_info(raw_mails)`).all<{ name: string }>();
    const columns = new Set(tableInfo.results.map((column) => column.name));
    if (gzipEnabled && columns.has("raw_blob")) {
      try {
        rawBlob = await compressText(raw);
      } catch (error) {
        console.error("gzip compression failed, falling back to plaintext", error);
      }
    }
    const storeUnreadStatus = readStatusEnabled && columns.has("is_unread");

    let result: D1Result;
    if (rawBlob) {
      result = storeUnreadStatus
        ? await env.DB
            .prepare(`INSERT INTO raw_mails (source, address, raw_blob, message_id, is_unread) VALUES (?, ?, ?, ?, 1)`)
            .bind(source, address, rawBlob, messageId)
            .run()
        : await env.DB
            .prepare(`INSERT INTO raw_mails (source, address, raw_blob, message_id) VALUES (?, ?, ?, ?)`)
            .bind(source, address, rawBlob, messageId)
            .run();
    } else {
      result = storeUnreadStatus
        ? await env.DB
            .prepare(`INSERT INTO raw_mails (source, address, raw, message_id, is_unread) VALUES (?, ?, ?, ?, 1)`)
            .bind(source, address, raw, messageId)
            .run()
        : await env.DB
            .prepare(`INSERT INTO raw_mails (source, address, raw, message_id) VALUES (?, ?, ?, ?)`)
            .bind(source, address, raw, messageId)
            .run();
    }
    return { success: result.success, last_row_id: result.meta?.last_row_id };
  } catch (error) {
    console.error("storeRawMail error:", error);
    return { success: false };
  }
};

/** 管理员内部邮件（发给临时地址的测试邮件） */
export const sendAdminInternalMail = async (
  env: Env,
  toMail: string,
  subject: string,
  text: string
): Promise<boolean> => {
  try {
    const { createMimeMessage } = await import("mimetext");
    const msg = createMimeMessage();
    msg.setSender({ name: "Admin", addr: "admin@internal" });
    msg.setRecipient(toMail);
    msg.setSubject(subject);
    msg.addMessage({ contentType: "text/plain", data: text });
    const messageId = Math.random().toString(36).substring(2, 15);
    const { success } = await storeRawMail(env, "admin@internal", toMail, messageId, msg.asRaw());
    return success;
  } catch (error) {
    console.log("sendAdminInternalMail error", error);
    return false;
  }
};

export type { MailRow };