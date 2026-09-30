// 环境变量 / 配置读取工具

import { Env } from "@/types";

export const getStringValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  return "";
};

export const getBooleanValue = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return false;
};

export const getIntValue = (value: unknown, defaultValue: number = 0): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseInt(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return defaultValue;
};

export const getStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
      // fall through to split
    }
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
};

export const getJsonObjectValue = <T = any>(value: unknown): T | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const trimLower = (value: unknown): string => {
  return getStringValue(value).trim().toLowerCase();
};

export const normalizeDomains = (domains: string[]): string[] => {
  return domains.map((d) => d.trim().toLowerCase()).filter((d) => d.length > 0);
};

export const getDomains = (env: Env): string[] => {
  return normalizeDomains(getStringArray(env.DOMAINS));
};

export const getDefaultDomains = (env: Env): string[] => {
  const defaultDomains = normalizeDomains(getStringArray(env.DEFAULT_DOMAINS));
  if (defaultDomains.length > 0) return defaultDomains;
  return getDomains(env);
};

export const getRandomSubdomainDomains = (env: Env): string[] => {
  return normalizeDomains(getStringArray(env.RANDOM_SUBDOMAIN_DOMAINS));
};

export const getDomainLabels = (env: Env): string[] => {
  return getStringArray(env.DOMAIN_LABELS);
};

/** 从地址中提取邮件域名，如 user@abc.com -> abc.com */
export const getMailDomain = (address: string): string => {
  const idx = address.lastIndexOf("@");
  return idx >= 0 ? address.substring(idx + 1).toLowerCase() : address.toLowerCase();
};

export const includesDomain = (domains: string[], domain: string): boolean => {
  return domains.map((d) => d.toLowerCase()).includes(domain.toLowerCase());
};

export const isDomainOrSubdomain = (candidate: string, baseDomain: string): boolean => {
  const candidateLower = candidate.toLowerCase();
  const baseLower = baseDomain.toLowerCase();
  if (candidateLower === baseLower) return true;
  return candidateLower.endsWith(`.${baseLower}`);
};

export const getDomainMapValue = <T>(
  map: Record<string, T> | null | undefined,
  domain: string
): T | undefined => {
  if (!map) return undefined;
  const key = domain.toLowerCase();
  if (key in map) return map[key];
  // 支持通配
  for (const k of Object.keys(map)) {
    if (k.startsWith("*.") && key.endsWith(k.substring(1))) {
      return map[k];
    }
  }
  return undefined;
};

/** 获取某域名是否允许发送邮件（Resend / SMTP / SEND_MAIL） */
export const isSendMailBindingEnabled = (env: Env, mailDomain: string): boolean => {
  if (!env.SEND_MAIL) return false;
  const sendMailDomains = normalizeDomains(getStringArray(env.SEND_MAIL_DOMAINS));
  if (sendMailDomains.length === 0) return true;
  return sendMailDomains.includes(mailDomain.toLowerCase());
};

export const isAnySendMailEnabled = (env: Env): boolean => {
  const domains = getDomains(env);
  return domains.some((domain) => {
    const envRecord = env as unknown as Record<string, unknown>;
    const resendEnabled =
      getStringValue(env.RESEND_TOKEN) ||
      getStringValue(envRecord[`RESEND_TOKEN_${domain.replace(/\./g, "_").toUpperCase()}`]);
    if (resendEnabled) return true;
    const smtpConfigMap = getJsonObjectValue<Record<string, unknown>>(env.SMTP_CONFIG);
    if (getDomainMapValue(smtpConfigMap, domain)) return true;
    if (isSendMailBindingEnabled(env, domain)) return true;
    return false;
  });
};

export const getPasswords = (env: Env): string[] => {
  return getStringArray(env.PASSWORDS);
};

export const getAdminPasswords = (env: Env): string[] => {
  return getStringArray(env.ADMIN_PASSWORDS);
};

/** 获取用户角色配置 */
export const getUserRoles = (env: Env): Array<{ domains?: string[]; role: string; prefix?: string }> => {
  const value = getJsonObjectValue<Array<{ domains?: string[]; role: string; prefix?: string }>>(
    env.USER_ROLES
  );
  if (Array.isArray(value)) return value;
  return [];
};