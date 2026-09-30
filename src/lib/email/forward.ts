// 邮件转发：全局转发 + 规则转发
import { Env, EmailRuleSettings } from "@/types";
import {
  getDomainMapValue,
  getJsonObjectValue,
  getMailDomain,
  getStringArray,
  isDomainOrSubdomain,
} from "../config";
import { getJsonSetting } from "../db";
import { CONSTANTS } from "../constants";

const MAX_REGEX_PATTERN_LENGTH = 200;

function safeRegexTest(pattern: string, input: string): boolean {
  try {
    if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
      console.warn("source pattern too long, skipped:", pattern.substring(0, 50) + "...");
      return false;
    }
    const regex = new RegExp(pattern, "i");
    return regex.test(input);
  } catch (regexError) {
    console.error("regex test error for pattern:", pattern, regexError);
    return false;
  }
}

export function matchSourcePatterns(
  from: string,
  sourcePatterns: string[] | undefined | null,
  sourceMatchMode: "any" | "all" | undefined
): boolean {
  if (!sourcePatterns || sourcePatterns.length === 0) return true;
  const matchMode = sourceMatchMode || "any";
  if (matchMode === "all") {
    return sourcePatterns.every((pattern) => safeRegexTest(pattern, from));
  }
  return sourcePatterns.some((pattern) => safeRegexTest(pattern, from));
}

interface ForwardRule {
  domains?: string[];
  forward?: string;
  sourcePatterns?: string[];
  sourceMatchMode?: "any" | "all";
}

async function forwardToGlobalAddresses(
  forward: (addr: string) => Promise<void>,
  env: Env
): Promise<void> {
  try {
    const forwardAddressList = getStringArray(env.FORWARD_ADDRESS_LIST);
    for (const forwardAddress of forwardAddressList) {
      await forward(forwardAddress);
    }
  } catch (error) {
    console.error("forward email error", error);
  }
}

async function forwardByRules(
  toAddress: string,
  from: string,
  forward: (addr: string) => Promise<void>,
  env: Env
): Promise<void> {
  try {
    const subdomainForwardAddressList =
      getJsonObjectValue<ForwardRule[]>(env.SUBDOMAIN_FORWARD_ADDRESS_LIST) || [];
    const emailRuleSettings = await getJsonSetting<EmailRuleSettings>(
      env,
      CONSTANTS.EMAIL_RULE_SETTINGS_KEY
    );
    const allRules = [
      ...(subdomainForwardAddressList || []),
      ...((emailRuleSettings as any)?.emailForwardingList || []),
    ];
    const messageDomain = getMailDomain(toAddress);
    for (const rule of allRules) {
      if (!matchSourcePatterns(from, rule.sourcePatterns, rule.sourceMatchMode)) continue;
      if (rule.domains && rule.domains.length > 0) {
        const normalizedDomains: string[] = rule.domains.map((d: string) =>
          d.trim().toLowerCase()
        );
        if (normalizedDomains.some((domain: string) => domain.length === 0)) {
          if (rule.forward) await forward(rule.forward);
          continue;
        }
        for (const normalizedDomain of normalizedDomains) {
          if (isDomainOrSubdomain(messageDomain, normalizedDomain) && rule.forward) {
            await forward(rule.forward);
          }
        }
      } else {
        if (rule.forward) await forward(rule.forward);
      }
    }
  } catch (error) {
    console.error("forward by rules error", error);
  }
}

export async function forwardEmail(
  toAddress: string,
  from: string,
  forward: (addr: string) => Promise<void>,
  env: Env
): Promise<void> {
  await forwardToGlobalAddresses(forward, env);
  await forwardByRules(toAddress, from, forward, env);
}

export { getDomainMapValue };