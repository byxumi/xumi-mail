// 自动回复
import { Env } from "@/types";
import { getBooleanValue } from "../config";

function matchSender(from: string, sourcePrefix: string | undefined): boolean {
  if (!sourcePrefix) return true;
  if (sourcePrefix.startsWith("/") && sourcePrefix.endsWith("/") && sourcePrefix.length > 2) {
    try {
      const regex = new RegExp(sourcePrefix.slice(1, -1));
      return regex.test(from);
    } catch (error) {
      console.error("Invalid regex in source_prefix:", sourcePrefix, error);
      return false;
    }
  }
  return from.startsWith(sourcePrefix);
}

export const auto_reply = async (
  env: Env,
  reply: (message: any) => Promise<void>,
  toAddress: string,
  from: string,
  message_id: string | null
): Promise<void> => {
  if (!getBooleanValue(env.ENABLE_AUTO_REPLY) || !message_id) return;
  try {
    const results = await env.DB.prepare(
      `SELECT * FROM auto_reply_mails where address = ? and enabled = 1`
    )
      .bind(toAddress)
      .first<Record<string, string>>();
    if (results && matchSender(from, results.source_prefix)) {
      const { createMimeMessage } = await import("mimetext");
      const msg = createMimeMessage();
      msg.setHeader("In-Reply-To", message_id);
      msg.setSender({ name: results.name || results.address, addr: results.address });
      msg.setRecipient(from);
      msg.setSubject(results.subject || "Auto-reply");
      msg.addMessage({
        contentType: "text/plain",
        data: results.message || "This is an auto-reply message, please reconact later.",
      });
      const { EmailMessage } = await import("cloudflare:email");
      const replyMessage = new EmailMessage(toAddress, from, msg.asRaw());
      await reply(replyMessage);
    }
  } catch (error) {
    console.log("reply email error", error);
  }
};