import { NextRequest } from "next/server";
import { getEnv, json, text, clientIp, ApiError } from "@/lib/server";
import { newAddress, generateRandomName } from "@/lib/address";
import { getBooleanValue, getStringValue } from "@/lib/config";
import { getJsonSetting } from "@/lib/db";
import { CONSTANTS } from "@/lib/constants";
import { verifyUserJwt } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    if (!getBooleanValue(env.ENABLE_USER_CREATE_EMAIL)) {
      return text("已禁用创建邮箱", 403);
    }

    // 匿名创建？检查用户 token
    const userToken = req.headers.get("x-user-token");
    const userPayload = await verifyUserJwt(env, userToken);
    if (getBooleanValue(env.DISABLE_ANONYMOUS_USER_CREATE_EMAIL) && !userPayload) {
      return text("已禁止匿名创建邮箱", 403);
    }

    const body = await req.json().catch(() => ({}));
    let { name, domain, enableRandomSubdomain } = body as {
      name?: string;
      domain?: string;
      enableRandomSubdomain?: boolean;
    };

    // 检查名称黑名单
    const blockList = (await getJsonSetting<string[]>(env, CONSTANTS.ADDRESS_BLOCK_LIST_KEY)) || [];
    if (blockList.some((item) => (name || "").toLowerCase().includes(item.toLowerCase()))) {
      return text(`名称[${name}]被屏蔽`, 400);
    }

    if (!name || getBooleanValue(env.DISABLE_CUSTOM_ADDRESS_NAME)) {
      name = generateRandomName(env);
    }

    const res = await newAddress(env, {
      name,
      domain: domain || null,
      enablePrefix: true,
      enableRandomSubdomain: getBooleanValue(enableRandomSubdomain),
      checkLengthByConfig: true,
      addressPrefix: getStringValue(env.PREFIX).trim().toLowerCase() || null,
      sourceMeta: clientIp(req),
    });
    return json(res);
  } catch (e) {
    console.error("new_address error:", e);
    const message = e instanceof ApiError ? e.message : (e as Error).message;
    return text(`创建邮箱失败: ${message}`, 400);
  }
}