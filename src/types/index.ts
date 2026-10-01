// Cloudflare Worker 环境绑定类型

export interface Env {
  // 基础绑定
  DB: D1Database;
  KV?: KVNamespace;
  ASSETS?: Fetcher;
  AI?: any;

  // 邮件发送
  SEND_MAIL?: any;

  // ------------- 可配置变量 -------------
  // 基础
  PREFIX?: string;
  DEFAULT_DOMAINS?: string[] | string;
  DOMAINS?: string[] | string;
  DOMAIN_LABELS?: string[] | string;
  JWT_SECRET: string;
  DEFAULT_LANG?: string;
  TITLE?: string;
  ANNOUNCEMENT?: string;
  ALWAYS_SHOW_ANNOUNCEMENT?: string;
  COPYRIGHT?: string;
  ADMIN_CONTACT?: string;
  STATUS_URL?: string;
  DISABLE_SHOW_GITHUB?: string;
  DISABLE_SHOW_GITHUB_FOR_USER?: string;
  ENABLE_INDEX_ABOUT?: string;

  // 访问控制
  PASSWORDS?: string[] | string;
  ADMIN_PASSWORDS?: string[] | string;
  ADMIN_API_IP_WHITELIST?: string[] | string;
  DISABLE_ADMIN_PASSWORD_CHECK?: string;
  CF_TURNSTILE_SITE_KEY?: string;
  CF_TURNSTILE_SECRET_KEY?: string;
  ENABLE_GLOBAL_TURNSTILE_CHECK?: string;

  // 地址配置
  ADDRESS_REGEX?: string;
  ADDRESS_CHECK_REGEX?: string;
  MIN_ADDRESS_LEN?: string;
  MAX_ADDRESS_LEN?: string;
  DISABLE_CUSTOM_ADDRESS_NAME?: string;
  ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH?: string;
  RANDOM_SUBDOMAIN_DOMAINS?: string[] | string;
  RANDOM_SUBDOMAIN_LENGTH?: string;
  CREATE_ADDRESS_DEFAULT_DOMAIN_FIRST?: string;
  DISABLE_ANONYMOUS_USER_CREATE_EMAIL?: string;
  ENABLE_USER_CREATE_EMAIL?: string;
  ENABLE_USER_DELETE_EMAIL?: string;
  DISABLE_ADDRESS_UPDATED_AT?: string;

  // 邮件处理
  ENABLE_MAIL_READ_STATUS?: string;
  ENABLE_AUTO_REPLY?: string;
  ENABLE_WEBHOOK?: string;
  ENABLE_MAIL_GZIP?: string;
  REMOVE_EXCEED_SIZE_ATTACHMENT?: string;
  REMOVE_ALL_ATTACHMENT?: string;
  ENABLE_CHECK_JUNK_MAIL?: string;
  JUNK_MAIL_CHECK_LIST?: string[] | string;
  JUNK_MAIL_FORCE_PASS_LIST?: string[] | string;
  BLACK_LIST?: string;
  FORWARD_ADDRESS_LIST?: string[] | string;
  SUBDOMAIN_FORWARD_ADDRESS_LIST?: string[] | string;

  // 地址密码 / 附加开关
  ENABLE_ADDRESS_PASSWORD?: string;
  ENABLE_AGENT_EMAIL_INFO?: string;
  ENABLE_REDEEM_CODE?: string;
  REDEEM_CODE_URL?: string;
  ADMIN_USER_ROLE?: string;
  USER_DEFAULT_ROLE?: string;
  SMTP_IMAP_PROXY_CONFIG?: string;
  USER_ROLES?: string;

  // AI 提取
  ENABLE_AI_EMAIL_EXTRACT?: string;
  AI_EXTRACT_MODE?: string;
  AI_EXTRACT_MODEL?: string;

  // 发信
  RESEND_TOKEN?: string;
  SMTP_CONFIG?: string;
  SEND_MAIL_DOMAINS?: string[] | string;
  DEFAULT_SEND_BALANCE?: string;
  NO_LIMIT_SEND_ROLE?: string;

  // 清理
  CLEANUP_BATCH_SIZE?: string;

  // 前端
  FRONTEND_URL?: string;
  BACKEND_URL?: string;
}

export interface UserPayload {
  user_id: number;
  user_email?: string;
  exp?: number;
}

export interface AddressPayload {
  address: string;
  address_id: number;
  exp?: number;
}

export interface MailRow {
  id: number;
  message_id: string | null;
  source: string;
  address: string;
  raw: string | null;
  raw_blob?: ArrayBuffer | null | number[];
  metadata: string | null;
  is_unread: number | null;
  created_at: string;
}

export interface ParsedEmail {
  sender: string;
  subject: string;
  text: string;
  html: string;
  headers?: Array<{ key: string; value: string }>;
  attachments?: ParsedEmailAttachment[];
}

export interface ParsedEmailAttachment {
  filename: string;
  mimeType: string;
  disposition: string;
  content?: Uint8Array;
  size?: number;
}

export type ExtractResult =
  | { type: "none" }
  | {
      type: "auth_code" | "auth_link" | "service_link" | "subscription_link" | "other_link";
      result: string;
      result_text: string;
    };

export interface OpenSettings {
  title: string;
  announcement: string;
  alwaysShowAnnouncement: boolean;
  prefix: string;
  addressRegex: string;
  minAddressLen: number;
  maxAddressLen: number;
  defaultDomains: string[];
  domains: Array<{ label: string; value: string }>;
  randomSubdomainDomains: string[];
  domainLabels: string[];
  needAuth: boolean;
  adminContact: string;
  enableUserCreateEmail: boolean;
  disableAnonymousUserCreateEmail: boolean;
  disableCustomAddressName: boolean;
  enableUserDeleteEmail: boolean;
  enableMailReadStatus: boolean;
  enableAutoReply: boolean;
  enableIndexAbout: boolean;
  copyright: string;
  cfTurnstileSiteKey: string;
  enableWebhook: boolean;
  isS3Enabled: boolean;
  enableSendMail: boolean;
  version: string;
  showGithub: boolean;
  showGithubForUser: boolean;
  disableAdminPasswordCheck: boolean;
  enableAddressPassword: boolean;
  enableAgentEmailInfo: boolean;
  enableRedeemCode: boolean;
  redeemCodeUrl: string;
  smtpImapProxyConfig: {
    smtp: { host: string; port: number; starttls: boolean };
    imap: { host: string; port: number; starttls: boolean };
  };
  statusUrl: string;
  enableGlobalTurnstileCheck: boolean;
}

export interface SendMailRequest {
  from_name?: string;
  to_mail: string;
  to_name?: string;
  subject: string;
  content: string;
  is_html?: boolean;
}

export interface CleanupSettings {
  enableMailsAutoCleanup?: boolean;
  cleanMailsDays: number;
  enableUnknowMailsAutoCleanup?: boolean;
  cleanUnknowMailsDays: number;
  enableSendBoxAutoCleanup?: boolean;
  cleanSendBoxDays: number;
  enableAddressAutoCleanup?: boolean;
  cleanAddressDays: number;
  enableInactiveAddressAutoCleanup?: boolean;
  cleanInactiveAddressDays: number;
  enableUnboundAddressAutoCleanup?: boolean;
  cleanUnboundAddressDays: number;
  enableEmptyAddressAutoCleanup?: boolean;
  cleanEmptyAddressDays: number;
  customSqlCleanupList?: Array<{
    id: string;
    name: string;
    sql: string;
    enabled: boolean;
  }>;
}

export interface WebhookSettings {
  enabled: boolean;
  url: string;
  method: "POST" | "PUT" | "PATCH";
  headers: string;
  body: string;
}

export interface EmailRuleSettings {
  blockReceiveUnknowAddressEmail?: boolean;
}