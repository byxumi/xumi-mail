// 本地规则验证码提取（移植自 cloudflare_temp_email）
// 不使用任何 AI 模型，邮件内容不会离开 Worker

const KEYWORD_LIST = [
  // Chinese
  "验证码", "驗證碼", "校验码", "校驗碼", "认证码", "認證碼", "确认码", "確認碼", "动态码", "動態碼",
  "动态密码", "動態密碼", "动态口令", "短信口令", "安全码", "安全代码", "登录码", "登入码",
  "激活码", "一次性密码", "校验代码", "识别码", "随机码", "交易码", "(?<!源)代码",
  "(?:\\bOTP|动态|動態|一次性)\\s{0,3}密[码碼]",
  // Japanese
  "認証コード", "確認コード", "認証番号", "確認番号", "ワンタイムパスワード", "ワンタイムパスコード",
  "パスコード", "セキュリティコード", "確認用コード",
  // Korean
  "인증\\s{0,3}코드", "인증\\s{0,3}번호", "확인\\s{0,3}코드", "보안\\s{0,3}코드",
  // English
  "verification\\s{0,3}code", "verify\\s{0,3}code", "confirm(?:ation)?\\s{0,3}code", "security\\s{0,3}code",
  "log[\\s-]?in\\s{0,3}code", "sign[\\s-]?in\\s{0,3}code", "access\\s{0,3}code", "auth(?:entication|orization)?\\s{0,3}code",
  "activation\\s{0,3}code", "validation\\s{0,3}code", "two[\\s-]?factor\\s{0,3}code", "2FA\\s{0,3}code",
  "one[\\s-]?time\\s{0,3}(?:pass(?:word|code)|code|pin)", "\\bpasscode", "\\bOTP\\b", "\\bPIN\\b", "\\bcaptcha",
  // Spanish / Portuguese
  "c[óo]digo(?!\\s{1,3}postal)(?:\\s{1,3}de\\s{1,3}(?:verificaci[óo]n|verifica[çc][ãa]o|seguridad|seguran[çc]a|acceso|acesso|confirmaci[óo]n|confirma[çc][ãa]o))?",
  // Italian
  "codice(?:\\s{1,3}di\\s{1,3}(?:sicurezza|verifica|conferma|accesso))?",
  // Turkish / Polish
  "(?<!\\p{L})kod(?:u|y)?(?!\\p{L})",
  // French
  "code\\s{1,3}(?:de\\s{1,3}(?:s[ée]curit[ée]|v[ée]rification|confirmation|connexion)|d['’](?:authentification|acc[èe]s|activation))",
  // German
  "(?:best[äa]tigungs|verifizierungs|sicherheits|anmelde|einmal|aktivierungs)code", "einmalkennwort",
  // Russian / Ukrainian
  "(?<!\\p{L})код(?:\\s{1,3}подтверждения)?(?!\\p{L})",
  // Hebrew
  "קוד(?:\\s{1,3}(?:האימות|אימות))?",
  // Bare "code"
  "\\bcode\\b(?<!(?:promo|promotion|promotional|coupon|discount|gift|referral|invite|invitation|zip|postal|post|country|area|source|error|status|tracking|order|reference|ref|voucher|product|item|booking|qr|bar|redeem|redemption|html|sample)[\\s-]{0,3}code)",
];
const KW = `(?:${KEYWORD_LIST.join("|")})`;
const CJK_KW = `(?:${KEYWORD_LIST
  .filter((k) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(k))
  .join("|")})`;

const DELIM = "\\s{0,3}(?:[:：=—–]|(?<!\\p{L})(?:is|was|ist|est|es|é|è)(?!\\p{L})|是|为|為|は|는|은|です|הוא)[\\s:：]{0,8}";
const OPEN = "[\\[【(（「『\"'“]?\\s{0,3}";
const CLOSE = "\\s{0,3}[\\]】)）」』\"'”]?";

const NUM_BEFORE = "(?<![\\w+\\-/])(?<!\\d[.,:：])(?<![$€£¥₹]\\s?)(?<!\\bRs\\.?\\s?)";
const NUM_AFTER = "(?![\\w/%]|[ -]\\d|[.,:]\\d|\\s?(?:USD|EUR|GBP|RMB|CNY|元|円|원))";
const DIGIT_CODE = `${NUM_BEFORE}(?:[A-Z]{1,3}-)?`
  + "(\\d{3}[ -]\\d{3}|\\d{4}[ -]\\d{4}|\\d{2}[ -]\\d{2}[ -]\\d{2}|\\d(?: \\d){3,7}|\\d{4,8})"
  + NUM_AFTER;
const ALNUM_CODE = "(?<![\\w\\-+/])([A-Za-z0-9]{3,5}-[A-Za-z0-9]{3,5}|[A-Za-z0-9]{4,10})(?![\\w\\-/]| \\d|[.,:]\\d)";
const ANY_CODE = `(?:${DIGIT_CODE}|${ALNUM_CODE})`;

const FILLER = "(?:\\s{1,3}[^\\s。！？!?]{0,40}[^\\s。！？!?.,:])(?:\\s{1,3}[^\\s。！？!?]{0,40}[^\\s。！？!?.,:]){0,8}?";
const NAME_FILLER = "(?:[\\p{L}\\d.'’&-]{1,40}\\s{1,3}){0,4}";

const PATTERNS: RegExp[] = [
  new RegExp(`${KW}${DELIM}${OPEN}${DIGIT_CODE}${CLOSE}`, "giu"),
  new RegExp(`${KW}${DELIM}${OPEN}${ALNUM_CODE}`, "giu"),
  new RegExp(
    `${ANY_CODE}\\s{1,3}(?:is|are|est|ist|es|é|è)\\s{1,3}(?:(?:your|the|votre|ihr|dein|deine|der|die|das|su|tu|il\\s{1,3}tuo|seu|o\\s{1,3}seu)\\s{1,3})?${NAME_FILLER}(?:\\p{L}{1,20}-)?${KW}`,
    "giu"
  ),
  new RegExp(
    `${ANY_CODE}\\s{0,3}[(（【\\[]?\\s{0,3}(?:是|为|為|は)?\\s{0,3}(?:您|你)?的?[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}]{0,6}?${CJK_KW}`,
    "giu"
  ),
  new RegExp(`${ANY_CODE}\\s{0,3}[—–]\\s{0,3}${KW}`, "giu"),
  new RegExp(`${KW}${FILLER}${DELIM}${OPEN}${ANY_CODE}`, "giu"),
  new RegExp(`${KW}\\s{0,3}${OPEN}${DIGIT_CODE}`, "giu"),
  new RegExp(`${KW}[^\\n\\d]{0,60}\\n\\s{0,8}${OPEN}${ANY_CODE}${CLOSE}[ \\t]{0,8}(?:\\n|$)`, "giu"),
];

const VERIFY_TARGET = "(?:e-?mail(?:\\s{1,3}address)?|account|identity|registration|sign[\\s-]?(?:in|up)|log[\\s-]?in|device)";
const VERIFY_CONTEXT = new RegExp(
  [
    KW,
    `\\b(?:verify|confirm|activate|validate)\\s{1,3}(?:(?:your|this|the)\\s{1,3})?${VERIFY_TARGET}`,
    `\\b(?:e-?mail|account|identity|log[\\s-]?in|sign[\\s-]?in)\\s{1,3}(?:verification|confirmation|authentication)`,
    "\\bauthori[sz]e\\s{1,3}(?:(?:this|the|your)\\s{1,3})?(?:transaction|payment|login|sign[\\s-]?in|request|device)",
    "\\btwo[\\s-]?factor\\b|\\b2FA\\b",
    "验证(?:您|你)?的?(?:邮箱|账号|帐号|账户|身份)|(?:邮箱|账号|帐号|身份|登录)验证|驗證(?:您|你)?的?(?:信箱|帳號|身分|身份)",
    "認証|인증",
    "подтверд\\p{L}{0,20}\\s{1,3}(?:ваш\\p{L}{0,6}\\s{1,3})?(?:почт|e-?mail|аккаунт|учётн|учетн|вход|личност)",
    "(?:bestätigen|verifizieren)\\s{1,3}sie\\s{1,3}ihre\\s{1,3}(?:e-?mail|konto|identität)|(?:e-?mail|konto)[\\s-]?(?:adresse\\s{1,3})?(?:bestätigung|verifizierung)",
    "v[ée]rifi(?:er|ez)\\s{1,3}votre\\s{1,3}(?:adresse|e-?mail|compte|identit[ée])",
    "verific\\p{L}{0,20}\\s{1,3}(?:(?:tu|su|seu|sua|il\\s{1,3}tuo|la\\s{1,3}tua)\\s{1,3})?(?:correo|e-?mail|cuenta|conta|account|identidad|identidade|identità)",
  ].join("|"),
  "iu"
);

const FALLBACK_PATTERNS: RegExp[] = [
  new RegExp(
    `(?:^|\\n)(?:[ \\t]{0,8}\\n){0,3}[ \\t]{0,8}(?<![:：][ \\t]{0,8}\\n(?:[ \\t]{0,8}\\n){0,3}[ \\t]{0,8})`
    + `${OPEN}${DIGIT_CODE}${CLOSE}[ \\t]{0,8}(?:\\n|$)`,
    "giu"
  ),
  new RegExp(`(?:\\b(?:use|enter|input|type)|输入|填写|輸入|입력)\\s{0,3}${OPEN}${DIGIT_CODE}`, "giu"),
];

const MAX_TEXT_LENGTH = 20000;
const MAX_SUBJECT_LENGTH = 1000;

export function joinSubjectAndBody(subject: string | undefined, body: string | undefined): string {
  return [subject?.slice(0, MAX_SUBJECT_LENGTH), body].filter(Boolean).join("\n\n");
}

export function extractCode(text: string): string | null {
  if (!text) return null;
  const normalized = normalizeText(text.slice(0, MAX_TEXT_LENGTH));

  for (const pattern of PATTERNS) {
    const code = findCode(normalized, pattern);
    if (code) return code;
  }

  if (!VERIFY_CONTEXT.test(normalized)) return null;

  for (const pattern of FALLBACK_PATTERNS) {
    const code = findCode(normalized, pattern);
    if (code) return code;
  }
  return null;
}

function normalizeText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    .replace(/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/\r\n?/g, "\n")
    .replace(/\bhttps?:\/\/[^\s<>"']+/gi, " ")
    .replace(/\bwww\.[^\s<>"']+/gi, " ")
    .replace(/[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63}){1,8}/g, " ");
}

function findCode(text: string, pattern: RegExp): string | null {
  for (const match of text.matchAll(pattern)) {
    const raw = [...match].slice(1).find((group) => group !== undefined);
    const code = raw?.replace(/[ -]/g, "");
    if (code && isPlausibleCode(code)) return code;
  }
  return null;
}

function isPlausibleCode(code: string): boolean {
  if (/^\d+$/.test(code)) {
    return code.length >= 4 && code.length <= 8 && !looksLikeDate(code);
  }
  return code.length >= 4 && code.length <= 10 && /\d/.test(code) && /^[A-Za-z0-9]+$/.test(code);
}

function looksLikeDate(digits: string): boolean {
  if (digits.length === 4) {
    const n = parseInt(digits, 10);
    if (n >= 1900 && n <= 2099) return true;
  }
  if (digits.length === 8) {
    const year = parseInt(digits.slice(0, 4), 10);
    const month = parseInt(digits.slice(4, 6), 10);
    const day = parseInt(digits.slice(6, 8), 10);
    if (year >= 1900 && year <= 2099 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return true;
    }
  }
  return false;
}