// AI 邮件信息提取：默认 local 模式（纯本地规则，内容不出 Worker），可选 Workers AI 模式
import { Env, ExtractResult, ParsedEmail } from "@/types";
import { getBooleanValue, getJsonObjectValue, getStringValue } from "../config";
import { getJsonSetting } from "../db";
import { CONSTANTS } from "../constants";
import { commonParseMail } from "./parse";
import { extractCode, joinSubjectAndBody } from "./extract_code";

const PROMPT = `
You are an expert email analyzer. Your task is to first UNDERSTAND the email content, then EXTRACT the most relevant information based on priority.

# Step 1: UNDERSTAND the Email
Read the entire email carefully and determine its:
- Overall purpose (verification, marketing, notification, etc.)
- Key context and situation
- What the sender wants the recipient to do
- Any security-sensitive content

# Step 2: EXTRACT Based on Priority
After understanding, extract the most important item according to this priority order:

**Priority 1: auth_code (Authentication Code)**
- Numeric or alphanumeric codes used for login verification
- Keywords: verification code, OTP, security code, confirmation code, auth code, 验证码, 校验码
- Extract ONLY the code itself (remove spaces, hyphens, etc.)

**Priority 2: auth_link (Authentication Link)**
- Links used for login, email verification, account activation, or password reset
- Keywords: verify, confirm, activate, login, signin, signup, reset, 验证, 激活, 登录
- Must be a real, complete URL (http:// or https://)
- Never fabricate or infer links that don't exist in the content

**Priority 3: service_link (Service Link)**
- Links related to specific services or actions
- Real URLs for technical or service-related notifications

**Priority 4: subscription_link (Subscription Management Link)**
- Links for managing email subscriptions, typically unsubscribe

**Priority 5: other_link (Other Valuable Link)**
- Any other link that might be useful or important

**Priority 6: none**
- No relevant codes, links, or valuable content found

# Critical Rules
1. **Understand First**: Always analyze the email's purpose before extracting
2. **Single Selection**: Choose ONLY ONE type based on the highest priority match
3. **Real Data Only**: Never invent, guess, or fabricate content
4. **Complete URLs**: Links must be full, valid URLs as they appear in the email
5. **Clean Extraction**: Return only the raw extracted content, no extra text

# Output Format (JSON only)
{
  "type": "auth_code|auth_link|service_link|subscription_link|other_link|none",
  "result": "the extracted code/link OR empty string",
  "result_text": "the display text"
}

IMPORTANT: Return ONLY the JSON, no explanations or additional text.
`;

export interface AiExtractSettings {
  enableAllowList?: boolean;
  allowList?: string[];
  enableSendToAi?: boolean;
}

const resolveExtractMode = (value: unknown): "local" | "ai" | null => {
  if (value === undefined || value === null) return "local";
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "" || normalized === "local") return "local";
  if (normalized === "ai") return "ai";
  return null;
};

async function extractWithCloudflareAI(content: string, env: Env): Promise<ExtractResult> {
  const modelName = getStringValue(env.AI_EXTRACT_MODEL) || "@cf/meta/llama-3.1-8b-instruct-fast";
  const result = await env.AI.run(modelName, {
    messages: [
      { role: "system", content: PROMPT },
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["auth_code", "auth_link", "service_link", "subscription_link", "other_link", "none"],
          },
          result: { type: "string" },
          result_text: { type: "string" },
        },
        required: ["type", "result", "result_text"],
      },
    },
    stream: false,
  });
  const response = (result as any)?.response;
  if (typeof response === "string") {
    return JSON.parse(response) as ExtractResult;
  }
  if (response && typeof response === "object") {
    return response as ExtractResult;
  }
  throw new Error("Unexpected response format from Cloudflare AI");
}

async function saveExtractMetadata(
  env: Env,
  message_id: string | null,
  result: ExtractResult
): Promise<void> {
  try {
    const metadata = JSON.stringify({ ai_extract: result, extracted_at: new Date().toISOString() });
    await env.DB.prepare(`UPDATE raw_mails SET metadata = ? WHERE message_id = ?`)
      .bind(metadata, message_id)
      .run();
  } catch (e) {
    console.error("AI extraction metadata save error:", e);
  }
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  const decodeCodePoint = (value: number, fallback: string) => {
    if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return fallback;
    return String.fromCodePoint(value);
  };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith("#x")) {
      return decodeCodePoint(Number.parseInt(normalized.slice(2), 16), match);
    }
    if (normalized.startsWith("#")) {
      return decodeCodePoint(Number.parseInt(normalized.slice(1), 10), match);
    }
    return entities[normalized] ?? match;
  });
}

function htmlToTextForAi(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<\s*(script|style|head|svg)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, " $3 $2 ")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*(p|div|tr|td|th|li|table|section|article|header|footer|h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getEmailContentForExtract(parsedEmail: ParsedEmail | undefined): string {
  if (parsedEmail?.text) return parsedEmail.text;
  if (!parsedEmail?.html) return "";
  return htmlToTextForAi(parsedEmail.html) || parsedEmail.html;
}

function isAddressInAiAllowlist(settings: AiExtractSettings | null | undefined, address: string): boolean {
  if (!settings?.enableAllowList) return true;
  if (!Array.isArray(settings.allowList) || settings.allowList.length === 0) return false;
  return settings.allowList.some((pattern) => {
    if (typeof pattern !== "string") return false;
    if (!pattern.includes("*")) return address === pattern;
    const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp("^" + escapedPattern + "$").test(address);
  });
}

export async function extractEmailInfo(
  env: Env,
  rawEmail: string,
  message_id: string | null,
  address: string
): Promise<ExtractResult | null> {
  try {
    if (!getBooleanValue(env.ENABLE_AI_EMAIL_EXTRACT)) return null;

    const mode = resolveExtractMode(env.AI_EXTRACT_MODE);
    if (!mode) {
      console.error(`Email extraction skipped: unsupported AI_EXTRACT_MODE "${env.AI_EXTRACT_MODE}"`);
      return null;
    }

    const aiSettings = await getJsonSetting<AiExtractSettings>(env, CONSTANTS.AI_EXTRACT_SETTINGS_KEY);
    const isAiAllowed = isAddressInAiAllowlist(aiSettings, address);

    const parsedEmail = await commonParseMail(rawEmail);
    const emailContent = getEmailContentForExtract(parsedEmail);

    const runLocalExtract = async () => {
      const localContent = joinSubjectAndBody(parsedEmail?.subject, emailContent);
      const code = localContent ? extractCode(localContent) : null;
      if (!code) return null;
      const result: ExtractResult = { type: "auth_code", result: code, result_text: "" };
      await saveExtractMetadata(env, message_id, result);
      return result;
    };

    if (mode === "local") {
      return await runLocalExtract();
    }

    if (!isAiAllowed) {
      return await runLocalExtract();
    }

    if (!env.AI) {
      console.error('AI_EXTRACT_MODE is "ai" but the Workers AI binding "AI" is not configured');
      return null;
    }

    if (!emailContent) return null;

    const truncatedContent =
      emailContent.length > 4000
        ? emailContent.substring(0, 4000) + "...[truncated]"
        : emailContent;

    const result = await extractWithCloudflareAI(truncatedContent, env);

    if (result.type !== "none" && result.result) {
      await saveExtractMetadata(env, message_id, result);
    }
    return result;
  } catch (e) {
    console.error("AI email extraction error:", e);
    return null;
  }
}

export { getJsonObjectValue };