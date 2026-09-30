// 附件处理：按配置移除附件（超过 2MB 或全部），重新生成 MIME
import { Env } from "@/types";
import { getBooleanValue } from "../config";
import { commonParseMail } from "./parse";

export const remove_attachment_if_need = async (
  env: Env,
  rawEmailHolder: { rawEmail: string },
  from_address: string,
  to_address: string,
  size: number
): Promise<void> => {
  const removeAllAttachment = getBooleanValue(env.REMOVE_ALL_ATTACHMENT);
  const removeExceedSizeAttachment =
    getBooleanValue(env.REMOVE_EXCEED_SIZE_ATTACHMENT) && size >= 2 * 1024 * 1024;
  const shouldRemoveAttachment = removeAllAttachment || removeExceedSizeAttachment;
  if (!shouldRemoveAttachment) return;

  const parsedEmail = await commonParseMail(rawEmailHolder.rawEmail);
  if (!parsedEmail) return;

  const { createMimeMessage } = await import("mimetext");
  const msg = createMimeMessage();
  if (parsedEmail.headers) {
    for (const header of parsedEmail.headers) {
      try {
        msg.setHeader(header.key, header.value);
      } catch {
        // ignore
      }
    }
  }
  msg.setSender({ name: parsedEmail.sender || from_address, addr: from_address });
  msg.setRecipient(to_address);
  msg.setSubject(parsedEmail.subject || "Failed to parse email subject");
  if (parsedEmail.html) {
    msg.addMessage({ contentType: "text/html", data: parsedEmail.html });
  }
  if (parsedEmail.text) {
    msg.addMessage({ contentType: "text/plain", data: parsedEmail.text });
  }
  rawEmailHolder.rawEmail = msg.asRaw();
};