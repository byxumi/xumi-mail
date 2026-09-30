// Email receive pipeline: 收信处理入口
import { Env, ExtractResult, ParsedEmail } from "@/types";
import { normalizeAddressDomain } from "../address";
import { getBooleanValue, getStringArray } from "../config";
import { getJsonSetting } from "../db";
import { CONSTANTS } from "../constants";
import { isBlocked } from "./black_list";
import { check_if_junk_mail } from "./check_junk";
import { remove_attachment_if_need } from "./check_attachment";
import { extractEmailInfo } from "./ai_extract";
import { forwardEmail } from "./forward";
import { auto_reply } from "./auto_reply";
import { storeRawMail } from "./storage";
import { triggerWebhook } from "./webhook";
import { commonParseMail } from "./parse";

export interface EmailMessageLike {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream | ArrayBuffer | string;
  rawSize?: number;
  setReject(reason: string): void;
  forward(addr: string): Promise<void>;
  reply(message: unknown): Promise<void>;
}

export async function processEmail(
  message: EmailMessageLike,
  env: Env
): Promise<void> {
  const toAddress = normalizeAddressDomain(message.to);

  // 黑名单
  if (await isBlocked(env, message.from, message.headers)) {
    message.setReject("Reject from address");
    console.log(`Reject message from ${message.from} to ${toAddress}`);
    return;
  }

  const rawEmail = await new Response(message.raw).text();
  const parsedEmailContext = { rawEmail };

  // 垃圾邮件检测
  try {
    const is_junk = await check_if_junk_mail(env, toAddress, parsedEmailContext, message.headers.get("Message-ID"));
    if (is_junk) {
      message.setReject("Junk mail");
      console.log(`Junk mail from ${message.from} to ${toAddress}`);
      return;
    }
  } catch (error) {
    console.error("check junk mail error", error);
  }

  // 未知地址邮件
  try {
    const emailRuleSettings = await getJsonSetting<{ blockReceiveUnknowAddressEmail?: boolean }>(
      env,
      CONSTANTS.EMAIL_RULE_SETTINGS_KEY
    );
    if (emailRuleSettings?.blockReceiveUnknowAddressEmail) {
      const db_address_id = await env.DB.prepare(`SELECT id FROM address where name = ?`)
        .bind(toAddress)
        .first("id");
      if (!db_address_id) {
        message.setReject("Unknown address");
        console.log(`Unknown address mail from ${message.from} to ${toAddress}`);
        return;
      }
    }
  } catch (error) {
    console.error("check unknown address mail error", error);
  }

  // 附件处理
  try {
    await remove_attachment_if_need(
      env,
      parsedEmailContext,
      message.from,
      toAddress,
      message.rawSize ?? rawEmail.length
    );
  } catch (error) {
    console.error("remove attachment error", error);
  }

  const message_id = message.headers.get("Message-ID");

  // 保存邮件
  const storedMailId = await storeRawMail(env, message.from, toAddress, message_id, parsedEmailContext.rawEmail)
    .then(({ success, last_row_id }) => {
      if (!success) {
        message.setReject(`Failed save message to ${toAddress}`);
        console.error(`Failed save message from ${message.from} to ${toAddress}`);
      }
      return success ? last_row_id : undefined;
    })
    .catch((error) => {
      console.error("save email error", error);
      return undefined;
    });

  // 转发
  await forwardEmail(toAddress, message.from, (addr) => message.forward(addr), env);

  // AI 提取
  const aiExtractResult = await extractEmailInfo(env, parsedEmailContext.rawEmail, message_id, toAddress);

  // Webhook
  try {
    await triggerWebhook(env, toAddress, parsedEmailContext.rawEmail, storedMailId, aiExtractResult);
  } catch (error) {
    console.error("send webhook error", error);
  }

  // 自动回复
  await auto_reply(env, (replyMessage) => message.reply(replyMessage), toAddress, message.from, message_id);
}

/** 供 parses/inbox 页面解析单条邮件 */
export async function parseMailRow(rawEmail: string) {
  return commonParseMail(rawEmail);
}

export type { ExtractResult, ParsedEmail };
export { getStringArray };