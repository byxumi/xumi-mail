import { NextRequest } from "next/server";
import { getEnv, json } from "@/lib/server";
import {
  getBooleanValue,
  getDefaultDomains,
  getDomainLabels,
  getDomains,
  getIntValue,
  getJsonObjectValue,
  getPasswords,
  getRandomSubdomainDomains,
  getStringValue,
  isAnySendMailEnabled,
} from "@/lib/config";
import { VERSION } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /open_api/settings —— 上游公开设置（compat 层，domains 返回 string[]） */
export async function GET(req: NextRequest) {
  const env = await getEnv();
  const smtpImapProxyConfig = getJsonObjectValue<{ smtp?: any; imap?: any }>(
    env.SMTP_IMAP_PROXY_CONFIG
  ) || {};
  const smtpProxyConfig = smtpImapProxyConfig.smtp || {};
  const imapProxyConfig = smtpImapProxyConfig.imap || {};
  const needAuth = getPasswords(env).length > 0;

  return json({
    title: getStringValue(env.TITLE),
    announcement: getStringValue(env.ANNOUNCEMENT),
    alwaysShowAnnouncement: getBooleanValue(env.ALWAYS_SHOW_ANNOUNCEMENT),
    prefix: getStringValue(env.PREFIX).trim().toLowerCase(),
    addressRegex: getStringValue(env.ADDRESS_REGEX),
    minAddressLen: getIntValue(env.MIN_ADDRESS_LEN, 1),
    maxAddressLen: getIntValue(env.MAX_ADDRESS_LEN, 30),
    defaultDomains: getDefaultDomains(env),
    domains: getDomains(env),
    domainLabels: getDomainLabels(env),
    randomSubdomainDomains: getRandomSubdomainDomains(env),
    needAuth,
    adminContact: getStringValue(env.ADMIN_CONTACT),
    enableUserCreateEmail: getBooleanValue(env.ENABLE_USER_CREATE_EMAIL),
    disableAnonymousUserCreateEmail: getBooleanValue(env.DISABLE_ANONYMOUS_USER_CREATE_EMAIL),
    disableCustomAddressName: getBooleanValue(env.DISABLE_CUSTOM_ADDRESS_NAME),
    enableUserDeleteEmail: getBooleanValue(env.ENABLE_USER_DELETE_EMAIL),
    enableMailReadStatus: getBooleanValue(env.ENABLE_MAIL_READ_STATUS),
    enableAutoReply: getBooleanValue(env.ENABLE_AUTO_REPLY),
    enableIndexAbout: getBooleanValue(env.ENABLE_INDEX_ABOUT),
    copyright: getStringValue(env.COPYRIGHT),
    cfTurnstileSiteKey: getStringValue(env.CF_TURNSTILE_SITE_KEY),
    enableWebhook: getBooleanValue(env.ENABLE_WEBHOOK),
    isS3Enabled: false,
    enableSendMail: isAnySendMailEnabled(env),
    version: VERSION,
    showGithub: !getBooleanValue(env.DISABLE_SHOW_GITHUB),
    showGithubForUser: !getBooleanValue(env.DISABLE_SHOW_GITHUB_FOR_USER),
    disableAdminPasswordCheck: getBooleanValue(env.DISABLE_ADMIN_PASSWORD_CHECK),
    enableAddressPassword: getBooleanValue(env.ENABLE_ADDRESS_PASSWORD),
    enableAgentEmailInfo: getBooleanValue(env.ENABLE_AGENT_EMAIL_INFO),
    enableRedeemCode: getBooleanValue(env.ENABLE_REDEEM_CODE),
    redeemCodeUrl: getStringValue(env.REDEEM_CODE_URL),
    smtpImapProxyConfig: {
      smtp: {
        host: getStringValue(smtpProxyConfig.host),
        port: getIntValue(smtpProxyConfig.port, 8025),
        starttls: getBooleanValue(smtpProxyConfig.starttls),
      },
      imap: {
        host: getStringValue(imapProxyConfig.host),
        port: getIntValue(imapProxyConfig.port, 11143),
        starttls: getBooleanValue(imapProxyConfig.starttls),
      },
    },
    statusUrl: getStringValue(env.STATUS_URL),
    enableGlobalTurnstileCheck: getBooleanValue(env.ENABLE_GLOBAL_TURNSTILE_CHECK),
    hasAdminPassword: getJsonObjectValue(env.ADMIN_PASSWORDS) ? true : false,
  });
}