// 邮件解析：服务端使用 postal-mime 解析 RFC822 原始邮件
import { ParsedEmail } from "@/types";

export const commonParseMail = async (rawEmail: string): Promise<ParsedEmail | undefined> => {
  if (!rawEmail) return undefined;
  try {
    const { default: PostalMime } = await import("postal-mime");
    const parsed = await PostalMime.parse(rawEmail);
    return {
      sender: parsed.from ? `${parsed.from.name || ""} <${parsed.from.address}>`.trim() : "",
      subject: parsed.subject || "",
      text: parsed.text || "",
      html: parsed.html || "",
      headers: parsed.headers || [],
      attachments: (parsed.attachments || []).map((att) => ({
        filename: att.filename || "attachment",
        mimeType: att.mimeType || "application/octet-stream",
        content: new Uint8Array(att.content as ArrayBuffer | ArrayLike<number>),
        disposition: att.disposition || "attachment",
      })),
    };
  } catch (e) {
    console.error("Failed use PostalMime to parse email", e);
    return undefined;
  }
};