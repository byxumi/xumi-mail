"use client";

// 客户端 API 封装：同域 /api 路由，地址 JWT 与用户 JWT 存 localStorage

export interface OpenSettingsDTO {
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
  hasAdminPassword: boolean;
}

export interface MailRowDTO {
  id: number;
  message_id: string | null;
  source: string;
  address: string;
  raw?: string | null;
  metadata: string | null;
  is_unread: number | null;
  created_at: string;
}

export interface ParsedMailDTO {
  id: number;
  message_id: string | null;
  source: string;
  address: string;
  metadata: string | null;
  is_unread: number | null;
  created_at: string;
  sender: string;
  subject: string;
  text: string;
  html: string;
  attachments: Array<{ filename: string; mimeType: string; disposition: string; size: number }>;
}

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ADDRESS_TOKEN_KEY = "tm_address_jwt";
const USER_TOKEN_KEY = "tm_user_jwt";
const ADMIN_TOKEN_KEY = "tm_admin_auth";

export const tokenStore = {
  getAddress: () => (typeof window !== "undefined" ? localStorage.getItem(ADDRESS_TOKEN_KEY) : "") || "",
  setAddress: (t: string) => {
    if (typeof window !== "undefined") localStorage.setItem(ADDRESS_TOKEN_KEY, t);
  },
  clearAddress: () => {
    if (typeof window !== "undefined") localStorage.removeItem(ADDRESS_TOKEN_KEY);
  },
  getUser: () => (typeof window !== "undefined" ? localStorage.getItem(USER_TOKEN_KEY) : "") || "",
  setUser: (t: string) => {
    if (typeof window !== "undefined") localStorage.setItem(USER_TOKEN_KEY, t);
  },
  clearUser: () => {
    if (typeof window !== "undefined") localStorage.removeItem(USER_TOKEN_KEY);
  },
  getAdmin: () => (typeof window !== "undefined" ? localStorage.getItem(ADMIN_TOKEN_KEY) : "") || "",
  setAdmin: (t: string) => {
    if (typeof window !== "undefined") localStorage.setItem(ADMIN_TOKEN_KEY, t);
  },
  clearAdmin: () => {
    if (typeof window !== "undefined") localStorage.removeItem(ADMIN_TOKEN_KEY);
  },
};

async function request<T = any>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: "address" | "user" | "admin" | "none";
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = "GET", body, auth = "none", headers = {} } = options;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "x-lang": "zh-CN",
    ...headers,
  };
  if (auth === "address") {
    const t = tokenStore.getAddress();
    if (t) h["Authorization"] = `Bearer ${t}`;
  } else if (auth === "user") {
    const t = tokenStore.getUser();
    if (t) h["x-user-token"] = t;
  } else if (auth === "admin") {
    const t = tokenStore.getAdmin();
    if (t) h["x-admin-auth"] = t;
  }
  const res = await fetch(path, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status >= 400) {
    const msg = (await res.text().catch(() => "")) || `请求失败 (${res.status})`;
    throw new ApiClientError(res.status, msg);
  }
  return (await res.json().catch(() => null)) as T;
}

// ---------- 公开设置 ----------
export const api = {
  settings: () => request<OpenSettingsDTO>("/api/settings"),

  // 地址
  newAddress: (body: { name?: string; domain?: string; enableRandomSubdomain?: boolean }) =>
    request<{ address: string; jwt: string; password?: string | null; address_id: number }>(
      "/api/new_address",
      { method: "POST", body }
    ),
  addressLogin: (body: { email: string; password: string }) =>
    request<{ jwt: string; address: string }>("/api/address_login", { method: "POST", body }),
  changePassword: (body: { new_password: string }) =>
    request<{ success: boolean }>("/api/address_change_password", {
      method: "POST",
      body,
      auth: "address",
    }),
  addressSettings: () =>
    request<{ address: string; send_balance: number }>("/api/address/settings", { auth: "address" }),

  // 邮件
  mails: (params: { limit?: number; offset?: number }) =>
    request<{ results: MailRowDTO[]; count: number }>(
      `/api/mails?limit=${params.limit ?? 20}&offset=${params.offset ?? 0}`,
      { auth: "address" }
    ),
  mail: (id: string | number) =>
    request<MailRowDTO | null>(`/api/mail/${id}`, { auth: "address" }),
  deleteMail: (id: string | number) =>
    request<{ success: boolean }>(`/api/mail/${id}`, { method: "DELETE", auth: "address" }),
  markRead: (id: string | number, isUnread: boolean) =>
    request<{ success: boolean }>(`/api/mail/${id}`, {
      method: "PATCH",
      body: { isUnread },
      auth: "address",
    }),
  parsedMails: (params: { limit?: number; offset?: number }) =>
    request<{ results: ParsedMailDTO[]; count: number }>(
      `/api/parsed_mails?limit=${params.limit ?? 20}&offset=${params.offset ?? 0}`,
      { auth: "address" }
    ),
  parsedMail: (id: string | number) =>
    request<ParsedMailDTO | null>(`/api/parsed_mail/${id}`, { auth: "address" }),
  deleteAddress: () =>
    request<{ success: boolean }>("/api/address", { method: "DELETE", auth: "address" }),
  clearInbox: () =>
    request<{ success: boolean }>("/api/clear_inbox", { method: "DELETE", auth: "address" }),
  clearSentItems: () =>
    request<{ success: boolean }>("/api/clear_sent_items", { method: "DELETE", auth: "address" }),

  // 发件
  sendMail: (body: {
    from_name?: string;
    to_mail: string;
    to_name?: string;
    subject: string;
    content: string;
    is_html?: boolean;
  }) => request<{ status: string }>("/api/send_mail", { method: "POST", body, auth: "address" }),
  sendbox: (params: { limit?: number; offset?: number }) =>
    request<{ results: any[]; count: number }>(
      `/api/sendbox?limit=${params.limit ?? 20}&offset=${params.offset ?? 0}`,
      { auth: "address" }
    ),
  deleteSent: (id: string | number) =>
    request<{ success: boolean }>(`/api/sendbox?id=${id}`, { method: "DELETE", auth: "address" }),

  // 自动回复 / webhook
  autoReply: () => request<any | null>("/api/auto_reply", { auth: "address" }),
  saveAutoReply: (body: any) =>
    request<{ success: boolean }>("/api/auto_reply", { method: "POST", body, auth: "address" }),
  webhookSettings: () => request<any>("/api/webhook/settings", { auth: "address" }),
  saveWebhookSettings: (body: any) =>
    request<{ success: boolean }>("/api/webhook/settings", { method: "POST", body, auth: "address" }),

  // 用户
  register: (body: { user_email: string; password: string }) =>
    request<{ jwt: string; user_id: number; user_email: string }>("/api/user/register", {
      method: "POST",
      body,
    }),
  login: (body: { user_email: string; password: string }) =>
    request<{ jwt: string; user_id: number; user_email: string }>("/api/user/login", {
      method: "POST",
      body,
    }),
  userAddresses: () =>
    request<{ results: Array<{ id: number; name: string; created_at: string; mail_count: number }> }>(
      "/api/user/addresses",
      { auth: "user" }
    ),
  bindAddress: (body: { address_id: number }) =>
    request<{ success: boolean }>("/api/user/bind_address", { method: "POST", body, auth: "user" }),
  unbindAddress: () =>
    request<{ success: boolean }>("/api/user/bind_address", { method: "DELETE", auth: "user" }),
  userMails: (params: { address: string; limit?: number; offset?: number }) =>
    request<{ results: MailRowDTO[]; count: number }>(
      `/api/user/mails?address=${encodeURIComponent(params.address)}&limit=${params.limit ?? 20}&offset=${params.offset ?? 0}`,
      { auth: "user" }
    ),

  // 管理
  adminStatistics: () => request<any>("/api/admin/statistics", { auth: "admin" }),
  adminMails: (params: { limit?: number; offset?: number; address?: string }) =>
    request<any>(
      `/api/admin/mails?limit=${params.limit ?? 50}&offset=${params.offset ?? 0}${params.address ? `&address=${encodeURIComponent(params.address)}` : ""}`,
      { auth: "admin" }
    ),
  adminDeleteMail: (id: number) =>
    request<{ success: boolean }>("/api/admin/mails", { method: "DELETE", body: { id }, auth: "admin" }),
  adminAddresses: (params: { limit?: number; offset?: number; query?: string }) =>
    request<any>(
      `/api/admin/address?limit=${params.limit ?? 50}&offset=${params.offset ?? 0}${params.query ? `&query=${encodeURIComponent(params.query)}` : ""}`,
      { auth: "admin" }
    ),
  adminCreateAddress: (body: { name: string; domain?: string }) =>
    request<any>("/api/admin/address", { method: "POST", body, auth: "admin" }),
  adminDeleteAddress: (id: number) =>
    request<{ success: boolean }>(`/api/admin/address?id=${id}`, {
      method: "DELETE",
      auth: "admin",
    }),
  adminUsers: (params: { limit?: number; offset?: number; query?: string }) =>
    request<any>(
      `/api/admin/users?limit=${params.limit ?? 50}&offset=${params.offset ?? 0}${params.query ? `&query=${encodeURIComponent(params.query)}` : ""}`,
      { auth: "admin" }
    ),
  adminDeleteUser: (id: number) =>
    request<{ success: boolean }>(`/api/admin/users?id=${id}`, { method: "DELETE", auth: "admin" }),
  adminAutoCleanup: () => request<any>("/api/admin/auto_cleanup", { auth: "admin" }),
  saveAdminAutoCleanup: (body: any) =>
    request<{ success: boolean }>("/api/admin/auto_cleanup", { method: "POST", body, auth: "admin" }),
  adminCleanup: (body: { cleanType: string; cleanDays: number }) =>
    request<{ success: boolean }>("/api/admin/auto_cleanup", { method: "PUT", body, auth: "admin" }),
  adminSendMail: (body: any) =>
    request<{ status: string }>("/api/admin/send_mail", { method: "POST", body, auth: "admin" }),
  adminAiExtract: () => request<any>("/api/admin/ai_extract/settings", { auth: "admin" }),
  saveAdminAiExtract: (body: any) =>
    request<{ success: boolean }>("/api/admin/ai_extract/settings", {
      method: "POST",
      body,
      auth: "admin",
    }),
  adminEmailRule: () => request<any>("/api/admin/email_rule/settings", { auth: "admin" }),
  saveAdminEmailRule: (body: any) =>
    request<{ success: boolean }>("/api/admin/email_rule/settings", {
      method: "POST",
      body,
      auth: "admin",
    }),
  adminBlacklist: (key: string) =>
    request<{ key: string; value: string[] }>(`/api/admin/blacklist?key=${key}`, { auth: "admin" }),
  saveAdminBlacklist: (body: { key: string; value: string[] }) =>
    request<{ success: boolean }>("/api/admin/blacklist", { method: "POST", body, auth: "admin" }),
};

export const sha256Hex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** 相对时间（iOS 风格：刚刚 / n 分钟前 / n 小时前 / 昨天 / 日期） */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const fmt = (n: number) => String(n).padStart(2, "0");

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;

  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${fmt(d.getHours())}:${fmt(d.getMinutes())}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${fmt(d.getHours())}:${fmt(d.getMinutes())}`;

  const sameYear = d.getFullYear() === now.getFullYear();
  if (sameYear) {
    return `${fmt(d.getMonth() + 1)}-${fmt(d.getDate())} ${fmt(d.getHours())}:${fmt(d.getMinutes())}`;
  }
  return `${d.getFullYear()}-${fmt(d.getMonth() + 1)}-${fmt(d.getDate())} ${fmt(d.getHours())}:${fmt(d.getMinutes())}`;
}

export function extractSender(sender: string): { name: string; email: string } {
  const m = sender.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: sender, email: sender };
}