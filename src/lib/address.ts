// 地址创建 / 删除 / 清理等公共业务逻辑
import { Env } from "@/types";
import {
  getBooleanValue,
  getDefaultDomains,
  getDomains,
  getIntValue,
  getJsonObjectValue,
  getRandomSubdomainDomains,
  getStringArray,
  getStringValue,
  isDomainOrSubdomain,
  normalizeDomains,
  trimLower,
} from "./config";
import { getJsonSetting, updateAddressUpdatedAt } from "./db";
import { CONSTANTS } from "./constants";
import { signAddressJwt } from "./auth";

const DEFAULT_NAME_REGEX = /[^a-z0-9]/g;
const DEFAULT_RANDOM_SUBDOMAIN_LENGTH = 8;
const MAX_RANDOM_SUBDOMAIN_ATTEMPTS = 5;
const MAX_DOMAIN_LENGTH = 253;
const DOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const isValidDomainLabel = (label: string): boolean => DOMAIN_LABEL_RE.test(label);

const areValidDomainLabels = (labels: string[]): boolean =>
  labels.length > 0 && labels.every(isValidDomainLabel);

export const normalizeAddressDomain = (address: string): string => {
  return address.trim().toLowerCase();
};

export const generateRandomName = (env: Env): string => {
  const minLength = Math.max(getIntValue(env.MIN_ADDRESS_LEN, 1), 1);
  const maxLength = Math.max(getIntValue(env.MAX_ADDRESS_LEN, 30), 1);
  const buildName = (currentName: string = ""): string =>
    currentName.length >= minLength
      ? currentName
      : buildName(currentName + Math.random().toString(36).substring(2, 15));
  const fullName = buildName();
  return fullName.substring(0, Math.min(fullName.length, maxLength));
};

const generateRandomSubdomain = (env: Env): string => {
  const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
  const length = Math.min(
    Math.max(getIntValue(env.RANDOM_SUBDOMAIN_LENGTH, DEFAULT_RANDOM_SUBDOMAIN_LENGTH), 1),
    63
  );
  let subdomain = "";
  for (let i = 0; i < length; i++) {
    subdomain += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return subdomain;
};

const allowRandomSubdomainForDomain = (env: Env, domain: string): boolean => {
  return getRandomSubdomainDomains(env).includes(domain.trim().toLowerCase());
};

const findMatchedAllowedDomain = (
  domain: string,
  allowDomains: string[],
  enableSubdomainMatch: boolean
): string | null => {
  const normalizedDomain = domain.trim().toLowerCase();
  if (normalizedDomain.length > MAX_DOMAIN_LENGTH) return null;
  const domainLabels = normalizedDomain.split(".");
  if (!areValidDomainLabels(domainLabels)) return null;
  const normalizedAllowDomains = normalizeDomains(allowDomains);
  if (normalizedAllowDomains.includes(normalizedDomain)) return normalizedDomain;
  if (!enableSubdomainMatch) return null;
  const matchedDomain = [...normalizedAllowDomains]
    .sort((a, b) => b.length - a.length)
    .find((allowDomain) => {
      if (allowDomain.length > MAX_DOMAIN_LENGTH) return false;
      const allowDomainLabels = allowDomain.split(".");
      if (!areValidDomainLabels(allowDomainLabels)) return false;
      if (domainLabels.length <= allowDomainLabels.length) return false;
      const prefixLabels = domainLabels.slice(0, domainLabels.length - allowDomainLabels.length);
      if (!areValidDomainLabels(prefixLabels)) return false;
      return allowDomainLabels.every((label, index) => {
        return domainLabels[domainLabels.length - allowDomainLabels.length + index] === label;
      });
    });
  return matchedDomain || null;
};

const checkNameRegex = (env: Env, name: string): void => {
  const regexStr = getStringValue(env.ADDRESS_CHECK_REGEX);
  if (!regexStr) return;
  const regex = new RegExp(regexStr);
  if (!regex.test(name)) {
    throw new Error(`Name not match regex: /${regexStr}/`);
  }
};

const getNameRegex = (env: Env): RegExp => {
  const regex = getStringValue(env.ADDRESS_REGEX);
  if (regex) {
    try {
      return new RegExp(regex, "g");
    } catch {
      // fall through
    }
  }
  return DEFAULT_NAME_REGEX;
};

export const generateRandomPassword = (): string => {
  const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

const hashPassword = async (plain: string): Promise<string> => {
  // 与原项目一致：SHA-256 hex
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const generatePasswordForAddress = async (
  env: Env,
  address: string
): Promise<string | null> => {
  if (!getBooleanValue(env.ENABLE_ADDRESS_PASSWORD)) return null;
  const plainPassword = generateRandomPassword();
  const hashedPassword = await hashPassword(plainPassword);
  const { success } = await env.DB.prepare(
    `UPDATE address SET password = ?, updated_at = datetime('now') WHERE name = ?`
  )
    .bind(hashedPassword, address)
    .run();
  if (!success) return null;
  return plainPassword;
};

const insertAddressRecord = async (
  env: Env,
  address: string,
  sourceMeta: string | null | undefined
): Promise<void> => {
  try {
    const result = await env.DB.prepare(`INSERT INTO address(name, source_meta) VALUES(?, ?)`)
      .bind(address, sourceMeta ?? null)
      .run();
    if (!result.success) throw new Error("Failed create address");
  } catch (e) {
    const message = (e as Error).message;
    if (message && message.includes("source_meta")) {
      const result = await env.DB.prepare(`INSERT INTO address(name) VALUES(?)`).bind(address).run();
      if (!result.success) throw new Error("Failed create address");
      return;
    }
    throw e;
  }
};

export const newAddress = async (
  env: Env,
  {
    name,
    domain,
    enablePrefix = true,
    enableRandomSubdomain = false,
    checkLengthByConfig = true,
    addressPrefix = null,
    checkAllowDomains = true,
    enableCheckNameRegex = true,
    sourceMeta = null,
  }: {
    name: string;
    domain?: string | null;
    enablePrefix?: boolean;
    enableRandomSubdomain?: boolean;
    checkLengthByConfig?: boolean;
    addressPrefix?: string | null;
    checkAllowDomains?: boolean;
    enableCheckNameRegex?: boolean;
    sourceMeta?: string | null;
  }
): Promise<{ address: string; jwt: string; password?: string | null; address_id: number }> => {
  name = name.trim().replace(getNameRegex(env), "");
  if (enableCheckNameRegex) {
    checkNameRegex(env, name);
  }
  const minAddressLength = Math.max(
    checkLengthByConfig ? getIntValue(env.MIN_ADDRESS_LEN, 1) : 1,
    1
  );
  const maxAddressLength = Math.max(
    checkLengthByConfig ? getIntValue(env.MAX_ADDRESS_LEN, 30) : 30,
    1
  );
  if (name.length < minAddressLength) {
    throw new Error(`名称太短 (min ${minAddressLength})`);
  }
  if (name.length > maxAddressLength) {
    throw new Error(`名称太长 (max ${maxAddressLength})`);
  }
  if (typeof addressPrefix === "string") {
    name = trimLower(addressPrefix) + name;
  } else if (enablePrefix) {
    name = trimLower(env.PREFIX) + name;
  }
  const allowDomains = checkAllowDomains ? getDefaultDomains(env) : getDomains(env);
  if (!domain && allowDomains.length > 0) {
    if (getBooleanValue(env.CREATE_ADDRESS_DEFAULT_DOMAIN_FIRST)) {
      domain = allowDomains[0].trim().toLowerCase();
    } else {
      domain = allowDomains[Math.floor(Math.random() * allowDomains.length)].trim().toLowerCase();
    }
  } else if (typeof domain === "string") {
    domain = domain.trim().toLowerCase();
  }
  const enableSubdomainMatch =
    env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH !== undefined &&
    getBooleanValue(env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH);
  const allowManualSubdomain = domain
    ? allowDomains.some(
        (baseDomain) =>
          allowRandomSubdomainForDomain(env, baseDomain) && isDomainOrSubdomain(domain, baseDomain)
      )
    : false;
  const matchedAllowDomain = domain
    ? findMatchedAllowedDomain(domain, allowDomains, enableSubdomainMatch || allowManualSubdomain)
    : null;
  if (!domain || !matchedAllowDomain) {
    throw new Error(`域名无效: ${domain}`);
  }
  if (enableRandomSubdomain && !allowRandomSubdomainForDomain(env, domain)) {
    throw new Error("该域名不允许随机子域名");
  }
  const maxAttempts = enableRandomSubdomain ? MAX_RANDOM_SUBDOMAIN_ATTEMPTS : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const addressDomain = enableRandomSubdomain ? `${generateRandomSubdomain(env)}.${domain}` : domain;
    const address = `${name}@${addressDomain}`;
    try {
      await insertAddressRecord(env, address, sourceMeta);
      updateAddressUpdatedAt(env, address);
      const address_id = await env.DB.prepare(`SELECT id FROM address where name = ?`)
        .bind(address)
        .first<number>("id");
      if (!address_id) throw new Error("Failed create address");
      const generatedPassword = await generatePasswordForAddress(env, address);
      const jwt = await signAddressJwt(env, { address, address_id });
      return { jwt, address, password: generatedPassword, address_id };
    } catch (e) {
      const message = (e as Error).message;
      if (message && message.includes("UNIQUE")) {
        if (enableRandomSubdomain && attempt < maxAttempts - 1) continue;
        throw new Error("地址已存在");
      }
      throw new Error("创建地址失败");
    }
  }
  throw new Error("创建地址失败");
};

export const deleteAddressWithData = async (
  env: Env,
  address: string | null | undefined,
  address_id: number | null | undefined
): Promise<boolean> => {
  if (!getBooleanValue(env.ENABLE_USER_DELETE_EMAIL)) {
    throw new Error("已禁用删除邮件");
  }
  if (!address && !address_id) {
    throw new Error("缺少必填字段");
  }
  if (!address_id) {
    address_id = (await env.DB.prepare(`SELECT id FROM address where name = ?`)
      .bind(address)
      .first<number>("id")) as number | undefined;
  } else if (!address) {
    address = (await env.DB.prepare(`SELECT name FROM address where id = ?`)
      .bind(address_id)
      .first<string>("name")) as string | undefined;
  }
  if (!address || !address_id) throw new Error("地址不存在");
  await env.DB.prepare(`DELETE FROM raw_mails WHERE address = ?`).bind(address).run();
  await env.DB.prepare(`DELETE FROM address_sender WHERE address = ?`).bind(address).run();
  await env.DB.prepare(`DELETE FROM sendbox WHERE address = ?`).bind(address).run();
  await env.DB.prepare(`DELETE FROM users_address WHERE address_id = ?`).bind(address_id).run();
  await env.DB.prepare(`DELETE FROM auto_reply_mails WHERE address = ?`).bind(address).run();
  const { success } = await env.DB.prepare(`DELETE FROM address WHERE name = ?`).bind(address).run();
  return success;
};

/** 清理三种类型数据（cron 与后台共用） */
export const cleanup = async (
  env: Env,
  cleanType: string | null | undefined,
  cleanDays: number | null | undefined
): Promise<boolean> => {
  if (cleanType === "inactiveAddress" && getBooleanValue(env.DISABLE_ADDRESS_UPDATED_AT)) {
    return false;
  }
  if (!cleanType || typeof cleanDays !== "number" || cleanDays < 0 || cleanDays > 1000) {
    throw new Error("无效的清理配置");
  }
  let cleanupBatchSize = getIntValue(env.CLEANUP_BATCH_SIZE, 3000);
  if (!Number.isInteger(cleanupBatchSize) || cleanupBatchSize < 1 || cleanupBatchSize > 5000) {
    cleanupBatchSize = 3000;
  }
  console.log(`Cleanup ${cleanType} before ${cleanDays} days`);
  switch (cleanType) {
    case "inactiveAddress":
      await batchDeleteAddressWithData(
        env,
        `id IN (SELECT id FROM address WHERE updated_at < datetime('now', '-${cleanDays} day') ORDER BY updated_at, id LIMIT ${cleanupBatchSize})`
      );
      break;
    case "addressCreated":
      await batchDeleteAddressWithData(
        env,
        `id IN (SELECT id FROM address WHERE created_at < datetime('now', '-${cleanDays} day') ORDER BY created_at, id LIMIT ${cleanupBatchSize})`
      );
      break;
    case "unboundAddress":
      await batchDeleteAddressWithData(
        env,
        `id NOT IN (SELECT address_id FROM users_address) AND created_at < datetime('now', '-${cleanDays} day')`
      );
      break;
    case "mails":
      await env.DB.prepare(
        `DELETE FROM raw_mails WHERE id IN (
          SELECT id FROM raw_mails WHERE created_at < datetime('now', ?) ORDER BY created_at, id LIMIT ?
        )`
      )
        .bind(`-${cleanDays} day`, cleanupBatchSize)
        .run();
      break;
    case "mails_unknow":
      await env.DB.prepare(
        `DELETE FROM raw_mails WHERE address NOT IN (select name from address) AND created_at < datetime('now', '-${cleanDays} day')`
      ).run();
      break;
    case "sendbox":
      await env.DB.prepare(
        `DELETE FROM sendbox WHERE id IN (
          SELECT id FROM sendbox WHERE created_at < datetime('now', ?) ORDER BY created_at, id LIMIT ?
        )`
      )
        .bind(`-${cleanDays} day`, cleanupBatchSize)
        .run();
      break;
    case "emptyAddress":
      await batchDeleteAddressWithData(
        env,
        `name NOT IN (SELECT DISTINCT address FROM raw_mails WHERE address IS NOT NULL) AND created_at < datetime('now', '-${cleanDays} day')`
      );
      break;
    default:
      throw new Error("无效的清理类型");
  }
  return true;
};

const batchDeleteAddressWithData = async (env: Env, addressQueryCondition: string) => {
  await env.DB.prepare(
    `DELETE FROM raw_mails WHERE address IN (SELECT name FROM address WHERE ${addressQueryCondition})`
  ).run();
  await env.DB.prepare(
    `DELETE FROM sendbox WHERE address IN (SELECT name FROM address WHERE ${addressQueryCondition})`
  ).run();
  await env.DB.prepare(
    `DELETE FROM auto_reply_mails WHERE address IN (SELECT name FROM address WHERE ${addressQueryCondition})`
  ).run();
  await env.DB.prepare(
    `DELETE FROM address_sender WHERE address IN (SELECT name FROM address WHERE ${addressQueryCondition})`
  ).run();
  await env.DB.prepare(
    `DELETE FROM users_address WHERE address_id IN (SELECT id FROM address WHERE ${addressQueryCondition})`
  ).run();
  await env.DB.prepare(`DELETE FROM address WHERE ${addressQueryCondition}`).run();
};