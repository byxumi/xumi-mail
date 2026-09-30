// 核心逻辑冒烟测试：在普通 Node 下直接验证（不依赖 next build）
// 运行：npx tsx scripts/smoke-test.ts
import { extractCode, joinSubjectAndBody } from "../src/lib/email/extract_code";
import { isJunkMailByHeaders } from "../src/lib/email/junk_mail_policy";
import { commonParseMail } from "../src/lib/email/parse";
import { formatWebhookBody } from "../src/lib/email/webhook";
import { matchSourcePatterns } from "../src/lib/email/forward";
import {
  getBooleanValue,
  getIntValue,
  getStringArray,
  normalizeDomains,
  isDomainOrSubdomain,
} from "../src/lib/config";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`✅ ${name}`);
  } else {
    fail++;
    console.log(`❌ ${name}\n   期望: ${JSON.stringify(expected)}\n   实际: ${JSON.stringify(actual)}`);
  }
}

async function main() {
  // ---------- extract_code ----------
  check("验证码: 冒号分隔", extractCode("Your verification code is: 123456"), "123456");
  check("验证码: 中文验证码是", extractCode("您的验证码是 482913，请在5分钟内输入。"), "482913");
  check("验证码: 英文 verification code:", extractCode("Your verification code: 123-456"), "123456");
  check("验证码: 7F3K9Q 字母数字", extractCode("Your login code is 7F3K9Q"), "7F3K9Q");
  check("验证码: OTP", extractCode("Your OTP for login: 591204"), "591204");
  check("验证码: 主题中", joinSubjectAndBody("123456 is your verification code", "some body") && extractCode(joinSubjectAndBody("123456 is your verification code", "some body")), "123456");
  check("验证码: 不在验证上下文则为 null", extractCode("Order #482913 has been shipped. Thanks for your purchase!"), null);
  check("验证码: 年份不算", extractCode("The year is 2026 and nothing else"), null);
  check("验证码: 日期不算", extractCode("Confirm your account created on 2026-04-11"), null);

  // ---------- junk_mail_policy ----------
  check(
    "垃圾检测: SPF fail → junk",
    isJunkMailByHeaders(
      [{ key: "received-spf", value: "fail (google.com: domain of ... does not designate permitted sender hosts)" }],
      ["spf"],
      []
    ),
    true
  );
  check(
    "垃圾检测: SPF pass → 非 junk",
    isJunkMailByHeaders(
      [{ key: "received-spf", value: "pass (google.com: domain of ... designates ... as permitted sender)" }],
      ["spf"],
      []
    ),
    false
  );
  check(
    "垃圾检测: force pass 未满足 → junk",
    isJunkMailByHeaders([{ key: "received-spf", value: "pass (...)" }], [], ["dkim"]),
    true
  );

  // ---------- parse (真实 RFC822 邮件) ----------
  // "测试主题" 的 UTF-8 base64
  const subjectB64 = Buffer.from("测试主题", "utf8").toString("base64");
  const rawEmail = [
    "From: \"Test User\" <test@example.com>",
    "To: tmpuser@mail.example.com",
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    "Message-ID: <abc123@example.com>",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Hello, this is a test email body.",
    "",
  ].join("\r\n");
  const parsed = await commonParseMail(rawEmail);
  check("解析: subject 解码", parsed?.subject, "测试主题");
  check("解析: sender", parsed?.sender, "Test User <test@example.com>");
  check("解析: text", parsed?.text?.trim(), "Hello, this is a test email body.");
  check("解析: headers 含 Message-ID", parsed?.headers?.some((h) => h.key.toLowerCase() === "message-id"), true);

  // ---------- webhook body ----------
  const body = formatWebhookBody(
    "mail received: ${subject} from ${from} to ${to}",
    { subject: "Hello", from: "a@b.com", to: "c@d.com", attachments: [] }
  );
  check("Webhook 模板替换", body, "mail received: Hello from a@b.com to c@d.com");

  // ---------- forward pattern ----------
  check("转发来源匹配: regex", matchSourcePatterns("noreply@google.com", [".*@google\\.com$"], "any"), true);
  check("转发来源匹配: 不匹配", matchSourcePatterns("spam@evil.com", [".*@google\\.com$"], "any"), false);

  // ---------- config utils ----------
  check("布尔: 'true'", getBooleanValue("true"), true);
  check("布尔: undefined", getBooleanValue(undefined), false);
  check("整数: '42'", getIntValue("42", 0), 42);
  check("数组: JSON 字符串", getStringArray('["a","b"]'), ["a", "b"]);
  check("数组: 逗号分隔", getStringArray("a, b, c"), ["a", "b", "c"]);
  check("域名归一", normalizeDomains(["Example.COM", " TEST.com "]), ["example.com", "test.com"]);
  check("子域名判断", isDomainOrSubdomain("team.abc.com", "abc.com"), true);
  check("子域名判断: 非子域", isDomainOrSubdomain("abc.com", "team.abc.com"), false);

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});