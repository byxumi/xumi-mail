import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import {
  getStringValue,
  getStringArray,
  getBooleanValue,
  getJsonObjectValue,
  getPasswords,
  getAdminPasswords,
  getUserRoles,
  getDomains,
  getDefaultDomains,
} from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/worker/configs —— worker 配置一览（WorkerConfig.vue 纯展示） */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const domains = getDomains(env);
    return json({
      DEFAULT_LANG: getStringValue(env.DEFAULT_LANG) || "zh",
      TITLE: getStringValue(env.TITLE) || "须弥邮箱",
      HAS_PASSWORD: getPasswords(env).length > 0,
      HAS_ADMIN_PASSWORDS: getAdminPasswords(env).length > 0,
      ANNOUNCEMENT: getStringValue(env.ANNOUNCEMENT),
      ALWAYS_SHOW_ANNOUNCEMENT: getBooleanValue(env.ALWAYS_SHOW_ANNOUNCEMENT),
      PREFIX: getStringValue(env.PREFIX) || "tmp",
      ADDRESS_CHECK_REGEX: getStringValue(env.ADDRESS_CHECK_REGEX),
      ADDRESS_REGEX: getStringValue(env.ADDRESS_REGEX),
      MIN_ADDRESS_LEN: Number(env.MIN_ADDRESS_LEN) || 1,
      MAX_ADDRESS_LEN: Number(env.MAX_ADDRESS_LEN) || 30,
      FORWARD_ADDRESS_LIST: getStringArray(env.FORWARD_ADDRESS_LIST),
      SUBDOMAIN_FORWARD_ADDRESS_LIST: getStringArray(env.SUBDOMAIN_FORWARD_ADDRESS_LIST),
      DEFAULT_DOMAINS: getDefaultDomains(env),
      DOMAINS: domains,
      ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH: getBooleanValue(env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH),
      RANDOM_SUBDOMAIN_DOMAINS: getStringArray(env.RANDOM_SUBDOMAIN_DOMAINS),
      RANDOM_SUBDOMAIN_LENGTH: Number(env.RANDOM_SUBDOMAIN_LENGTH) || 8,
      DOMAIN_LABELS: getJsonObjectValue(env.DOMAIN_LABELS) || {},
      HAS_JWT_SECRET: !!env.JWT_SECRET,
      ADMIN_USER_ROLE: getStringValue(env.ADMIN_USER_ROLE) || "admin",
      USER_DEFAULT_ROLE: getStringValue(env.USER_DEFAULT_ROLE),
      USER_ROLES: getUserRoles(env),
      NO_LIMIT_SEND_ROLE: getStringValue(env.NO_LIMIT_SEND_ROLE),
      ADMIN_CONTACT: getStringValue(env.ADMIN_CONTACT),
      ENABLE_USER_CREATE_EMAIL: getBooleanValue(env.ENABLE_USER_CREATE_EMAIL),
      DISABLE_ANONYMOUS_USER_CREATE_EMAIL: getBooleanValue(env.DISABLE_ANONYMOUS_USER_CREATE_EMAIL),
      ENABLE_USER_DELETE_EMAIL: getBooleanValue(env.ENABLE_USER_DELETE_EMAIL),
      ENABLE_MAIL_READ_STATUS: getBooleanValue(env.ENABLE_MAIL_READ_STATUS),
      ENABLE_REDEEM_CODE: getBooleanValue(env.ENABLE_REDEEM_CODE),
      REDEEM_CODE_URL: getStringValue(env.REDEEM_CODE_URL),
      ENABLE_AUTO_REPLY: getBooleanValue(env.ENABLE_AUTO_REPLY),
      COPYRIGHT: getStringValue(env.COPYRIGHT) || "须弥邮箱",
      ENABLE_WEBHOOK: getBooleanValue(env.ENABLE_WEBHOOK),
      S3_ENABLED: !!(env as any).S3,
      VERSION: "v0.0.9",
      DISABLE_SHOW_GITHUB: getBooleanValue(env.DISABLE_SHOW_GITHUB),
      DISABLE_SHOW_GITHUB_FOR_USER: getBooleanValue(env.DISABLE_SHOW_GITHUB_FOR_USER),
      DISABLE_ADMIN_PASSWORD_CHECK: getBooleanValue(env.DISABLE_ADMIN_PASSWORD_CHECK),
      ENABLE_CHECK_JUNK_MAIL: getBooleanValue(env.ENABLE_CHECK_JUNK_MAIL),
      JUNK_MAIL_CHECK_LIST: getStringArray(env.JUNK_MAIL_CHECK_LIST),
      JUNK_MAIL_FORCE_PASS_LIST: getStringArray(env.JUNK_MAIL_FORCE_PASS_LIST),
      REMOVE_EXCEED_SIZE_ATTACHMENT: getBooleanValue(env.REMOVE_EXCEED_SIZE_ATTACHMENT),
      REMOVE_ALL_ATTACHMENT: getBooleanValue(env.REMOVE_ALL_ATTACHMENT),
      ENABLE_ANOTHER_WORKER: !!(env as any).ANOTHER_WORKER_LIST,
      ANOTHER_WORKER_LIST: getStringArray((env as any).ANOTHER_WORKER_LIST),
    });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}